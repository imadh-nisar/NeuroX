/* NeuroX dashboard.
 * Plain JavaScript, no build step.
 * Data comes from api/index.php?action=all. If the API is offline, it falls back to data/dataset.json.
 * Every figure shown is aggregated at district level. No individual is identified.
 */
(function () {
  'use strict';

  // ---------- constants ----------
  var BIN_EDGES = [20, 40, 60, 80];
  var BIN_COLOURS = ['#cfe8df', '#8fc9b0', '#e8b04b', '#d9573b', '#8c2d19'];
  var BIN_LABELS = ['Below 20', '20 to 40', '40 to 60', '60 to 80', '80 and above'];
  var NO_DATA_COLOUR = '#7d8c86';
  var SERIES_COLOURS = ['#3ddc97', '#f2b84b', '#7aa7ff'];
  var AGE_COLOURS = ['#3ddc97', '#7aa7ff', '#f2b84b', '#ff8a70', '#c58af9', '#5fd3e6'];
  var WEIGHT_LABELS = {
    out_rate: 'Outpatient visits per 100,000 population',
    adm_rate: 'Admissions per 100,000 population',
    ref_rate: 'Referrals per 100,000 population',
    unemployment_pct: 'Unemployment rate (district stress factor)'
  };
  var PREFERRED_TREND_DISTRICTS = ['Colombo', 'Kandy', 'Jaffna'];
  var DECISION_ORDER = ['review', 'staff', 'outreach', 'watch', 'data', 'maintain'];
  var DECISION_LABELS = {
    review: 'Review first', staff: 'Add psychiatrist time', outreach: 'Consider outreach',
    watch: 'Watch staffing', data: 'Fix data first', maintain: 'Keep current plan'
  };
  var CATEGORY_HELP = {
    review: 'Need is rising and high. Check capacity and referral routes first.',
    staff: 'Need and workload are both high. Consider moving or adding psychiatrist time.',
    outreach: 'Need is above average but services are not overloaded. Outreach may reach more people.',
    watch: 'Workload is high even though need is average. Keep an eye on it.',
    data: 'The figures are incomplete. Fix reporting before deciding.',
    maintain: 'Nothing in the data calls for a change this year.'
  };

  // ---------- state ----------
  var S = {
    meta: {},
    districts: [],
    byId: new Map(),
    rows: [],
    dy: new Map(),
    ageRows: [],
    alerts: [],
    sources: [],
    years: [],
    year: null,
    source: '',
    selected: null,
    trendIds: [],
    ageDistrict: null,
    ageYear: null,
    simFrom: null,
    simTo: null,
    simFte: 1,
    map: null,
    markers: null,
    charts: {},
    playTimer: null
  };

  // ---------- helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function key(id, year) { return id + '-' + year; }
  function hasVal(v) { return v !== null && v !== undefined && !Number.isNaN(v); }
  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(v, d) {
    if (!hasVal(v)) return '–';
    var digits = d || 0;
    return Number(v).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  function median(values) {
    var a = values.filter(hasVal).slice().sort(function (x, y) { return x - y; });
    if (!a.length) return null;
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function colourFor(v) {
    if (!hasVal(v)) return NO_DATA_COLOUR;
    var i = 0;
    while (i < BIN_EDGES.length && v >= BIN_EDGES[i]) i++;
    return BIN_COLOURS[i];
  }
  function idByName(name) {
    var d = S.districts.find(function (x) { return x.name === name; });
    return d ? d.id : null;
  }
  function byName(a, b) { return a.name.localeCompare(b.name); }
  function download(filename, text) {
    var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(header, rows) {
    return [header].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\n');
  }
  function cellsFor(id, year) {
    return S.ageRows.filter(function (r) { return r.district_id === id && r.year === year; });
  }
  function series(id, field) {
    return S.years.map(function (y) {
      var r = S.dy.get(key(id, y));
      return r && hasVal(r[field]) ? r[field] : null;
    });
  }
  function rankOf(id) {
    var list = S.rows
      .filter(function (r) { return r.year === S.year && hasVal(r.need_index); })
      .sort(function (a, b) { return b.need_index - a.need_index; });
    var pos = list.findIndex(function (r) { return r.district_id === id; });
    return pos < 0 ? null : { pos: pos + 1, total: list.length };
  }
  function combinedRate(id, year, age) {
    var cells = cellsFor(id, year).filter(function (c) { return c.age_group === age; });
    if (cells.length < S.meta.sexes.length) return null;
    if (cells.some(function (c) { return c.visits === null || c.visits === undefined; })) return null;
    var visits = cells.reduce(function (s, c) { return s + c.visits; }, 0);
    var pop = cells.reduce(function (s, c) { return s + c.population; }, 0);
    return pop ? (visits / pop) * 100000 : null;
  }

  // ---------- charts ----------
  function drawChart(name, canvasId, config) {
    if (S.charts[name]) {
      S.charts[name].destroy();
      delete S.charts[name];
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    S.charts[name] = new Chart(canvas, config);
  }
  function lineConfig(names, seriesList, yTitle, max) {
    return {
      type: 'line',
      data: {
        labels: S.years,
        datasets: seriesList.map(function (data, i) {
          return {
            label: names[i],
            data: data,
            borderColor: SERIES_COLOURS[i % SERIES_COLOURS.length],
            backgroundColor: SERIES_COLOURS[i % SERIES_COLOURS.length],
            tension: 0.25,
            spanGaps: false,
            pointRadius: 3
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          y: { beginAtZero: true, max: max, title: { display: true, text: yTitle } }
        },
        plugins: { legend: { display: names.length > 1 } }
      }
    };
  }

  // ---------- map ----------
  function initMap() {
    if (typeof L === 'undefined') {
      $('#map').textContent = 'The map could not load. Check your internet connection and refresh the page.';
      return;
    }
    S.map = L.map('map', { scrollWheelZoom: false, minZoom: 6, maxZoom: 11 }).setView([7.85, 80.7], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 11
    }).addTo(S.map);
    S.markers = L.layerGroup().addTo(S.map);
  }

  function renderMap() {
    if (!S.map) return;
    S.markers.clearLayers();
    S.districts.forEach(function (d) {
      var r = S.dy.get(key(d.id, S.year));
      var pop = r && hasVal(r.population) ? r.population : 100000;
      var value = r ? r.need_index : null;
      var selected = d.id === S.selected;
      var lowComp = !!(r && hasVal(r.completeness_pct) && r.completeness_pct < S.meta.low_completeness_pct);
      var marker = L.circleMarker([d.lat, d.lon], {
        radius: 7 + Math.sqrt(pop / 20000) * 1.2,
        color: selected ? '#ffffff' : '#0a1310',
        weight: selected ? 3 : 1.5,
        fillColor: colourFor(value),
        fillOpacity: 0.92,
        dashArray: lowComp ? '4 3' : ''
      });
      marker.bindTooltip(
        esc(d.name) + ' · ' + (hasVal(value) ? 'index ' + fmt(value, 1) : 'no data for ' + S.year)
      );
      marker.on('click', function () { selectDistrict(d.id); });
      marker.addTo(S.markers);
    });
  }

  function renderLegend() {
    $('#legend').innerHTML = BIN_COLOURS.map(function (c, i) {
      return '<span class="legend-item"><i style="background:' + c + '"></i>' + BIN_LABELS[i] + '</span>';
    }).join('') + '<span class="legend-item"><i style="background:' + NO_DATA_COLOUR + '"></i>No data</span>' +
      '<span class="legend-item muted">Need index, 0–100, relative across districts and years</span>';
  }

  function selectDistrict(id) {
    S.selected = id;
    $('#districtPick').value = String(id);
    renderMap();
    renderPanel();
  }

  function renderPanel() {
    var panel = $('#panel');
    var d = S.byId.get(S.selected);
    if (!d) {
      panel.innerHTML =
        '<h2>District details</h2>' +
        '<p class="muted">Select a district on the map, or choose one from the list above, to see its need, trend and capacity.</p>';
      return;
    }
    var r = S.dy.get(key(d.id, S.year));
    var rank = rankOf(d.id);
    var noData = !r || !hasVal(r.outpatient_visits);
    var lowComp = !!(r && hasVal(r.completeness_pct) && r.completeness_pct < S.meta.low_completeness_pct);
    var rankText = rank
      ? 'Ranked ' + rank.pos + ' of ' + rank.total + ' for ' + S.year + ' (1 = highest need)'
      : 'No index value for ' + S.year;

    panel.innerHTML =
      '<p class="eyebrow">' + esc(d.province) + ' province · ' + S.year + '</p>' +
      '<h2>' + esc(d.name) + '</h2>' +
      (r && hasVal(r.need_index) ? '<p class="summary">' + esc(d.name) + ' is ranked ' + (rank ? rank.pos : '–') + ' of ' + (rank ? rank.total : '–') + ' for need in ' + S.year + '.' + (hasVal(r.visits_per_psychiatrist) ? ' Each psychiatrist there handled about ' + fmt(r.visits_per_psychiatrist, 0) + ' outpatient visits.' : '') + '</p>' : '') +
      (noData
        ? '<div class="note">No outpatient data for ' + S.year + '. The dashboard shows a gap here rather than an estimate.</div>'
        : '') +
      '<div class="index-card">' +
        '<div class="big">' + (hasVal(r && r.need_index) ? fmt(r.need_index, 1) : '–') + '</div>' +
        '<div><strong>Need index</strong><br><span class="muted">' + esc(rankText) + '</span></div>' +
      '</div>' +
      (lowComp
        ? '<div class="note warn">Reporting completeness is ' + fmt(r.completeness_pct, 1) +
          '%. A low figure here may reflect under-reporting rather than low need.</div>'
        : '') +
      '<dl class="metrics">' +
        '<div><dt>Outpatient visits</dt><dd>' + fmt(r && r.outpatient_visits) + '</dd></div>' +
        '<div><dt>Visits per 100,000</dt><dd>' + fmt(r && r.out_rate, 0) + '</dd></div>' +
        '<div><dt>Admissions per 100,000</dt><dd>' + fmt(r && r.adm_rate, 0) + '</dd></div>' +
        '<div><dt>Referrals per 100,000</dt><dd>' + fmt(r && r.ref_rate, 0) + '</dd></div>' +
        '<div><dt>Psychiatrists</dt><dd>' + fmt(r && r.psychiatrists) + '</dd></div>' +
        '<div><dt>Visits per psychiatrist</dt><dd>' + fmt(r && r.visits_per_psychiatrist, 0) + '</dd></div>' +
        '<div><dt>Reporting completeness</dt><dd>' + (r && hasVal(r.completeness_pct) ? fmt(r.completeness_pct, 1) + '%' : '–') + '</dd></div>' +
        '<div><dt>Population (reference)</dt><dd>' + fmt(r && r.population) + '</dd></div>' +
      '</dl>' +
      '<p class="fine">Need index over time</p>' +
      '<div class="chart-box small"><canvas id="panelChart" role="img" aria-label="Need index over time for ' + esc(d.name) + '"></canvas></div>' +
      '<div class="actions">' +
        '<button class="btn" type="button" id="panelCompare">Compare in Trends</button>' +
        '<button class="btn ghost" type="button" id="panelExport">Download history (CSV)</button>' +
      '</div>' +
      '<p class="fine">Aggregated figures only. See Method for how the index is built.</p>';

    $('#panelCompare').addEventListener('click', function () { compareInTrends(d.id); });
    $('#panelExport').addEventListener('click', function () { exportDistrict(d.id); });
    drawChart('panel', 'panelChart', lineConfig([d.name], [series(d.id, 'need_index')], 'Index', 100));
  }

  function compareInTrends(id) {
    if (S.trendIds.indexOf(id) === -1) {
      S.trendIds = S.trendIds.length >= 3 ? S.trendIds.slice(-2).concat([id]) : S.trendIds.concat([id]);
    }
    setTab('trends');
    renderTrends();
  }

  function exportDistrict(id) {
    var d = S.byId.get(id);
    var rows = S.years.map(function (y) {
      var r = S.dy.get(key(id, y)) || {};
      return [y, r.need_index, r.outpatient_visits, r.admissions, r.referrals, r.population,
        r.psychiatrists, r.visits_per_psychiatrist, r.completeness_pct];
    });
    download(
      'neurox_' + d.name.toLowerCase().replace(/\s+/g, '_') + '_history.csv',
      toCsv(['Year', 'Need index', 'Outpatient visits', 'Admissions', 'Referrals', 'Population (reference)',
        'Psychiatrists', 'Visits per psychiatrist', 'Reporting completeness %'], rows)
    );
  }

  // ---------- trends ----------
  function buildTrendControls() {
    var chips = $('#trendChips');
    chips.innerHTML = S.districts.slice().sort(byName).map(function (d) {
      return '<label class="chip"><input type="checkbox" value="' + d.id + '"><span>' + esc(d.name) + '</span></label>';
    }).join('');
    chips.addEventListener('change', function (e) {
      if (e.target.tagName !== 'INPUT') return;
      var id = Number(e.target.value);
      if (e.target.checked) {
        if (S.trendIds.length >= 3) {
          e.target.checked = false;
          $('#trendNote').textContent = 'You can compare up to three districts. Untick one to add another.';
          return;
        }
        S.trendIds.push(id);
      } else {
        S.trendIds = S.trendIds.filter(function (x) { return x !== id; });
      }
      renderTrends();
    });

    var ageD = $('#ageDistrict');
    ageD.innerHTML = S.districts.slice().sort(byName).map(function (d) {
      return '<option value="' + d.id + '">' + esc(d.name) + '</option>';
    }).join('');
    ageD.addEventListener('change', function () { S.ageDistrict = Number(ageD.value); renderTrends(); });

    var ageY = $('#ageYear');
    ageY.innerHTML = S.years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    ageY.addEventListener('change', function () { S.ageYear = Number(ageY.value); renderTrends(); });
  }

  function renderTrends() {
    var chips = document.querySelectorAll('#trendChips input');
    chips.forEach(function (c) { c.checked = S.trendIds.indexOf(Number(c.value)) !== -1; });

    if (!S.trendIds.length) {
      $('#trendNote').textContent = 'Select one to three districts above to compare their need over time.';
      if (S.charts.trend) { S.charts.trend.destroy(); delete S.charts.trend; }
    } else {
      $('#trendNote').textContent = '';
      var names = S.trendIds.map(function (id) { return S.byId.get(id).name; });
      var lists = S.trendIds.map(function (id) { return series(id, 'need_index'); });
      drawChart('trend', 'trendChart', lineConfig(names, lists, 'Need index (0–100)', 100));
    }

    var table = $('#trendTable');
    if (S.trendIds.length) {
      var head = '<thead><tr><th scope="col">District</th>' +
        S.years.map(function (y) { return '<th scope="col">' + y + '</th>'; }).join('') + '</tr></thead>';
      var body = '<tbody>' + S.trendIds.map(function (id) {
        var d = S.byId.get(id);
        return '<tr><th scope="row">' + esc(d.name) + '</th>' + series(id, 'need_index').map(function (v) {
          return '<td>' + fmt(v, 1) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody>';
      table.innerHTML = head + body;
    } else {
      table.innerHTML = '';
    }

    // Age and sex
    var id = S.ageDistrict;
    var year = S.ageYear;
    var cells = cellsFor(id, year);
    var hidden = cells.filter(function (c) { return c.suppressed === 1 || c.suppressed === true; }).length;
    var ageNote = $('#ageNote');
    if (!cells.length) {
      ageNote.textContent = 'No age and sex data for this district in ' + year + '. The dashboard shows a gap rather than an estimate.';
    } else {
      ageNote.textContent = hidden
        ? hidden + ' cell' + (hidden === 1 ? '' : 's') + ' hidden: fewer than ' + S.meta.min_cell_count + ' visits.'
        : 'No cells hidden for this district and year.';
    }

    var barsFor = function (sex) {
      return S.meta.age_groups.map(function (a) {
        var c = cells.find(function (x) { return x.age_group === a && x.sex === sex; });
        return c && hasVal(c.visits) ? c.visits : null;
      });
    };
    drawChart('ageBar', 'ageBarChart', {
      type: 'bar',
      data: {
        labels: S.meta.age_groups,
        datasets: [
          { label: 'Male', data: barsFor('Male'), backgroundColor: '#7aa7ff' },
          { label: 'Female', data: barsFor('Female'), backgroundColor: '#f2b84b' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Outpatient visits' } },
          x: { title: { display: true, text: 'Age group' } }
        }
      }
    });

    var rateDatasets = S.meta.age_groups.map(function (a, i) {
      return {
        label: a,
        data: S.years.map(function (y) { return combinedRate(id, y, a); }),
        borderColor: AGE_COLOURS[i % AGE_COLOURS.length],
        backgroundColor: AGE_COLOURS[i % AGE_COLOURS.length],
        spanGaps: false,
        tension: 0.25
      };
    });
    drawChart('ageRate', 'ageRateChart', {
      type: 'line',
      data: { labels: S.years, datasets: rateDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Visits per 100,000 (both sexes)' } }
        }
      }
    });
  }

  // ---------- coverage ----------
  function flagFor(r, medVpp, medIdx) {
    if (!r || !hasVal(r.outpatient_visits) || !hasVal(r.psychiatrists)) {
      return { text: 'No data', cls: 'flag-none' };
    }
    if (hasVal(r.need_index) && r.need_index >= medIdx && r.visits_per_psychiatrist >= medVpp) {
      return { text: 'High need, high load per psychiatrist', cls: 'flag-high' };
    }
    if (hasVal(r.completeness_pct) && r.completeness_pct < S.meta.low_completeness_pct) {
      return { text: 'Low reporting completeness', cls: 'flag-warn' };
    }
    return { text: '', cls: '' };
  }

  function coverageList() {
    var rows = S.districts.map(function (d) { return { d: d, r: S.dy.get(key(d.id, S.year)) || null }; });
    var complete = rows.filter(function (x) { return x.r && hasVal(x.r.outpatient_visits) && hasVal(x.r.psychiatrists); });
    var medVpp = median(complete.map(function (x) { return x.r.visits_per_psychiatrist; }));
    var medIdx = median(complete.map(function (x) { return x.r.need_index; }));
    var list = rows.map(function (x) { return { d: x.d, r: x.r, flag: flagFor(x.r, medVpp, medIdx) }; });

    var sort = $('#covSort').value;
    list.sort(function (a, b) {
      if (sort === 'name') return byName(a.d, b.d);
      var field = sort === 'index' ? 'need_index' : 'visits_per_psychiatrist';
      var av = a.r && hasVal(a.r[field]) ? a.r[field] : -1;
      var bv = b.r && hasVal(b.r[field]) ? b.r[field] : -1;
      if (av === bv) return 0;
      return av < bv ? 1 : -1;
    });
    return { list: list, medVpp: medVpp, medIdx: medIdx };
  }

  function renderCoverage() {
    var built = coverageList();
    var list = built.list;

    $('#covBody').innerHTML = list.map(function (x) {
      var r = x.r;
      return '<tr>' +
        '<th scope="row">' + esc(x.d.name) + '</th>' +
        '<td>' + esc(x.d.province) + '</td>' +
        '<td>' + fmt(r && r.psychiatrists) + '</td>' +
        '<td>' + fmt(r && r.psych_per_100k, 2) + '</td>' +
        '<td>' + fmt(r && r.outpatient_visits) + '</td>' +
        '<td>' + fmt(r && r.visits_per_psychiatrist, 0) + '</td>' +
        '<td>' + fmt(r && r.need_index, 1) + '</td>' +
        '<td>' + (x.flag.text ? '<span class="flag ' + x.flag.cls + '">' + esc(x.flag.text) + '</span>' : '') + '</td>' +
        '</tr>';
    }).join('');

    var withVpp = list.filter(function (x) { return x.r && hasVal(x.r.visits_per_psychiatrist); });
    drawChart('cov', 'covChart', {
      type: 'bar',
      data: {
        labels: withVpp.map(function (x) { return x.d.name; }),
        datasets: [{
          label: 'Outpatient visits per psychiatrist',
          data: withVpp.map(function (x) { return x.r.visits_per_psychiatrist; }),
          backgroundColor: withVpp.map(function (x) { return x.flag.cls === 'flag-high' ? '#d9573b' : '#3ddc97'; })
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, title: { display: true, text: 'Visits per psychiatrist' } } }
      }
    });

    renderSimulator();
  }

  function renderSimulator() {
    var out = $('#simResult');
    var slider = $('#simFte');
    if (S.simFrom === S.simTo) {
      out.innerHTML = '<p class="note">Choose two different districts to compare.</p>';
      slider.disabled = true;
      return;
    }
    var from = S.dy.get(key(S.simFrom, S.year));
    var to = S.dy.get(key(S.simTo, S.year));
    var ready = from && to &&
      hasVal(from.psychiatrists) && hasVal(to.psychiatrists) &&
      hasVal(from.outpatient_visits) && hasVal(to.outpatient_visits);
    if (!ready) {
      out.innerHTML = '<p class="note">Not enough data for ' + S.year + ' to run the simulation.</p>';
      slider.disabled = true;
      return;
    }

    var maxK = Math.max(0, from.psychiatrists - 1);
    slider.disabled = maxK === 0;
    slider.max = String(maxK);
    if (S.simFte > maxK) S.simFte = maxK;
    slider.value = String(S.simFte);
    $('#simFteOut').textContent = String(S.simFte);

    var k = S.simFte;
    var fromName = S.byId.get(S.simFrom).name;
    var toName = S.byId.get(S.simTo).name;
    var fromAfter = from.psychiatrists - k;
    var toAfter = to.psychiatrists + k;
    var fromBefore = from.outpatient_visits / from.psychiatrists;
    var toBefore = to.outpatient_visits / to.psychiatrists;
    var fromNew = from.outpatient_visits / fromAfter;
    var toNew = to.outpatient_visits / toAfter;

    out.innerHTML =
      '<table class="data sim-table">' +
        '<thead><tr><th scope="col">District</th><th scope="col">Psychiatrists</th>' +
        '<th scope="col">Visits per psychiatrist, before</th><th scope="col">After</th></tr></thead>' +
        '<tbody>' +
          '<tr><th scope="row">' + esc(fromName) + ' (from)</th><td>' + from.psychiatrists + ' → ' + fromAfter +
            '</td><td>' + fmt(fromBefore, 0) + '</td><td>' + fmt(fromNew, 0) + '</td></tr>' +
          '<tr><th scope="row">' + esc(toName) + ' (to)</th><td>' + to.psychiatrists + ' → ' + toAfter +
            '</td><td>' + fmt(toBefore, 0) + '</td><td>' + fmt(toNew, 0) + '</td></tr>' +
        '</tbody>' +
      '</table>' +
      '<p class="fine">Visit volumes are assumed unchanged. The result shows staffing ratios, not clinical impact.</p>';
  }

  // ---------- alerts ----------
  function renderAlerts() {
    $('#alertRule').textContent =
      'Rule: a district is flagged when its need index rises for ' + S.meta.rising_periods +
      ' periods in a row and stays at or above ' + S.meta.rising_threshold + '.';
    var list = $('#alertList');
    if (!S.alerts.length) {
      list.innerHTML = '<div class="empty">No district meets the rule in the current data.</div>';
      return;
    }
    list.innerHTML = S.alerts.map(function (a) {
      var d = S.byId.get(a.district_id);
      return '<article class="alert-card">' +
        '<header><h3>' + esc(d ? d.name : 'District') + '</h3>' +
        '<span class="pill">' + a.first_year + '–' + a.last_year + '</span></header>' +
        '<p>' + esc(a.message) + '</p>' +
        '<p class="fine">Latest index ' + fmt(a.latest_index, 1) + '. Confirm against the source bulletin before acting.</p>' +
        '</article>';
    }).join('');
  }

  // ---------- method ----------
  function renderMethod() {
    var w = S.meta.index_weights || {};
    var total = Object.keys(w).reduce(function (s, k) { return s + w[k]; }, 0) || 1;
    $('#methodIndex').textContent = S.meta.index_method || '';
    $('#methodWeights').innerHTML = Object.keys(w).map(function (k) {
      return '<li><strong>' + fmt((100 * w[k]) / total, 0) + '%</strong>, ' + esc(WEIGHT_LABELS[k] || k) + '</li>';
    }).join('');
    $('#methodThresholds').textContent =
      'Age and sex cells with fewer than ' + S.meta.min_cell_count + ' visits are hidden. ' +
      'Districts with reporting completeness below ' + S.meta.low_completeness_pct + '% are flagged. ' +
      'Alerts need ' + S.meta.rising_periods + ' consecutive periods of rising need, all at or above ' +
      S.meta.rising_threshold + '.';
    $('#methodExcluded').textContent = (S.meta.excluded_indicators || []).join(' ');

    var rows = S.sources.map(function (s) {
      return '<tr><td>' + esc(s.source_name) + (s.is_synthetic ? ' <span class="flag flag-warn">Synthetic</span>' : '') +
        '</td><td>' + esc(s.edition) + '</td><td>' + esc(s.file_name) + '</td><td>' + esc(s.downloaded_on || '–') + '</td></tr>';
    }).join('');
    $('#methodSources').innerHTML =
      '<thead><tr><th scope="col">Source</th><th scope="col">Edition</th><th scope="col">File</th><th scope="col">Downloaded</th></tr></thead>' +
      '<tbody>' + (rows || '<tr><td colspan="4">No sources recorded.</td></tr>') + '</tbody>';
  }

  // ---------- priorities ----------
  function decisionFor(r, medVpp, medIdx, alerted, lowPct) {
    if (!r || !hasVal(r.outpatient_visits)) {
      return { key: 'data', label: DECISION_LABELS.data, reason: 'There are no outpatient figures for this year, so no decision can be made from the data.' };
    }
    if (alerted.has(r.district_id)) {
      return { key: 'review', label: DECISION_LABELS.review, reason: 'Need has risen for several periods in a row and is above the alert level.' };
    }
    if (hasVal(r.completeness_pct) && r.completeness_pct < lowPct) {
      return { key: 'data', label: DECISION_LABELS.data, reason: 'Only ' + fmt(r.completeness_pct, 0) + '% of expected reporting arrived, so true need may be higher than shown.' };
    }
    var highNeed = hasVal(r.need_index) && r.need_index >= medIdx;
    var highLoad = hasVal(r.visits_per_psychiatrist) && r.visits_per_psychiatrist >= medVpp;
    if (highNeed && highLoad) return { key: 'staff', label: DECISION_LABELS.staff, reason: 'Need and the load on each psychiatrist are both above the national middle.' };
    if (highLoad) return { key: 'watch', label: DECISION_LABELS.watch, reason: 'Each psychiatrist carries a heavier load than most districts, though need is average or lower.' };
    if (highNeed) return { key: 'outreach', label: DECISION_LABELS.outreach, reason: 'Need is above the middle, but psychiatrists are not overloaded. Outreach or awareness work may reach more people.' };
    return { key: 'maintain', label: DECISION_LABELS.maintain, reason: 'Need and load are both at or below the national middle.' };
  }

  function priorityList() {
    var cov = coverageList();
    var alerted = new Set(S.alerts.map(function (a) { return a.district_id; }));
    return cov.list.map(function (x) {
      return { d: x.d, r: x.r, decision: decisionFor(x.r, cov.medVpp, cov.medIdx, alerted, S.meta.low_completeness_pct) };
    }).sort(function (a, b) {
      var diff = DECISION_ORDER.indexOf(a.decision.key) - DECISION_ORDER.indexOf(b.decision.key);
      if (diff) return diff;
      return ((b.r && hasVal(b.r.need_index)) ? b.r.need_index : -1) - ((a.r && hasVal(a.r.need_index)) ? a.r.need_index : -1);
    });
  }

  function renderPriorities() {
    var list = priorityList();
    $('#priorityCounts').innerHTML = DECISION_ORDER.map(function (k) {
      var n = list.filter(function (x) { return x.decision.key === k; }).length;
      return '<div class="priority-card priority-' + k + '"><div class="priority-count">' + n + '</div><strong>' +
        esc(DECISION_LABELS[k]) + '</strong><span class="fine">' + esc(CATEGORY_HELP[k]) + '</span></div>';
    }).join('');
    $('#priorityBody').innerHTML = list.map(function (x) {
      return '<tr><th scope="row">' + esc(x.d.name) + '</th><td><span class="flag flag-' + x.decision.key + '">' +
        esc(x.decision.label) + '</span></td><td class="why">' + esc(x.decision.reason) + '</td><td>' +
        fmt(x.r && x.r.need_index, 1) + '</td><td>' + fmt(x.r && x.r.visits_per_psychiatrist, 0) + '</td></tr>';
    }).join('');
  }

  function exportPriorities() {
    var rows = priorityList().map(function (x) {
      return [x.d.name, x.d.province, S.year, x.decision.label, x.decision.reason,
        x.r ? x.r.need_index : '', x.r ? x.r.visits_per_psychiatrist : '', x.r ? x.r.completeness_pct : ''];
    });
    download('neurox_priorities_' + S.year + '.csv', toCsv(
      ['District', 'Province', 'Year', 'Action', 'Reason', 'Need score', 'Visits per psychiatrist', 'Reporting completeness %'], rows));
  }

  function renderNational() {
    var rows = (S.meta.national_context || []).map(function (n) {
      return '<tr><td>' + esc(n.label) + '</td><td>' + fmt(n.value) + '</td><td>' + esc(n.year || 'Not stated') +
        '</td><td>' + esc(n.source) + '<br><span class="fine">' + esc(n.note || '') + '</span></td></tr>';
    }).join('');
    $('#methodNational').innerHTML = '<thead><tr><th scope="col">Figure</th><th scope="col">Value</th><th scope="col">Year</th><th scope="col">Where it comes from</th></tr></thead><tbody>' + rows + '</tbody>';
  }

  // ---------- scroll effects ----------
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateScrollUi() {
    var el = document.documentElement;
    var max = el.scrollHeight - el.clientHeight;
    var p = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;
    $('#scrollProgress').style.transform = 'scaleX(' + p + ')';
    $('#topbar').classList.toggle('is-scrolled', window.scrollY > 8);
    var top = $('#toTop');
    top.classList.toggle('show', p > 0.05);
    top.tabIndex = p > 0.05 ? 0 : -1;
  }

  var scrollFrame = 0;
  function onScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(function () { scrollFrame = 0; updateScrollUi(); });
  }

  var revealObserver = null;
  function revealCards() {
    if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
    var targets = Array.prototype.slice.call(document.querySelectorAll('.view.active .card, .view.active .priority-card'));
    if (reduceMotion || !('IntersectionObserver' in window)) {
      targets.forEach(function (t) { t.classList.add('is-visible'); });
      return;
    }
    targets.forEach(function (t, i) {
      if (t.classList.contains('is-visible')) return;
      t.classList.add('reveal');
      t.style.transitionDelay = (i % 4) * 80 + 'ms';
    });
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); revealObserver.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (t) { if (!t.classList.contains('is-visible')) revealObserver.observe(t); });
  }

  // ---------- year and tabs ----------
  function setYear(y) {
    S.year = y;
    $('#yearSelect').value = String(y);
    $('#yearSlider').value = String(S.years.indexOf(y));
    $('#yearLabel').textContent = String(y);
    renderAll();
  }

  function togglePlay() {
    var btn = $('#playBtn');
    if (S.playTimer) {
      clearInterval(S.playTimer);
      S.playTimer = null;
      btn.textContent = 'Play';
      return;
    }
    btn.textContent = 'Stop';
    S.playTimer = setInterval(function () {
      var next = S.years.indexOf(S.year) + 1;
      if (next >= S.years.length) {
        togglePlay();
        return;
      }
      setYear(S.years[next]);
    }, 1200);
  }

  function setTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + name);
    });
    if (name === 'map' && S.map) setTimeout(function () { S.map.invalidateSize(); }, 0);
    if (window.scrollY > 300) {
      var main = document.getElementById('main');
      if (main) main.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
    revealCards();
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* file:// may block this */ }
  }

  function renderAll() {
    renderMap();
    renderPanel();
    renderTrends();
    renderCoverage();
    renderAlerts();
    renderPriorities();
  }

  // ---------- data ----------
  async function loadData() {
    try {
      var r = await fetch('api/index.php?action=all', { cache: 'no-store' });
      var body = await r.json();
      if (!r.ok || body.error) throw new Error(body.error || ('HTTP ' + r.status));
      return { payload: body, source: 'api' };
    } catch (err) {
      var f = await fetch('data/dataset.json', { cache: 'no-store' });
      if (!f.ok) throw new Error('No data available from the API or the static file.');
      return { payload: await f.json(), source: 'file' };
    }
  }

  function hydrate(payload, source) {
    S.meta = payload.meta || {};
    S.districts = payload.districts || [];
    S.byId = new Map(S.districts.map(function (d) { return [d.id, d]; }));
    S.rows = payload.district_year || [];
    S.dy = new Map(S.rows.map(function (r) { return [key(r.district_id, r.year), r]; }));
    S.ageRows = payload.age_sex || [];
    S.alerts = payload.alerts || [];
    S.sources = payload.sources || [];
    S.years = Array.from(new Set(S.rows.map(function (r) { return r.year; }))).sort(function (a, b) { return a - b; });
    if (!S.years.length) throw new Error('The dataset has no years.');
    if (!S.meta.age_groups) S.meta.age_groups = ['10-14', '15-19', '20-24', '25-39', '40-59', '60+'];
    if (!S.meta.sexes) S.meta.sexes = ['Male', 'Female'];
    S.source = source;

    S.ageDistrict = S.districts[0].id;
    S.ageYear = S.years[S.years.length - 1];
    S.simFrom = S.districts[0].id;
    S.simTo = S.districts[1] ? S.districts[1].id : S.districts[0].id;
    S.trendIds = PREFERRED_TREND_DISTRICTS.map(idByName).filter(function (x) { return x !== null; });

    $('#sourceBadge').hidden = !S.meta.is_synthetic;
    $('#dataStatus').textContent = source === 'api'
      ? 'Live data from the database'
      : 'Static data file (database offline)';
  }

  function buildControls() {
    var sorted = S.districts.slice().sort(byName);
    var options = function (list, selectedId) {
      return list.map(function (d) {
        return '<option value="' + d.id + '"' + (d.id === selectedId ? ' selected' : '') + '>' + esc(d.name) + '</option>';
      }).join('');
    };

    $('#yearSelect').innerHTML = S.years.map(function (y) { return '<option value="' + y + '">' + y + '</option>'; }).join('');
    $('#yearSelect').addEventListener('change', function (e) { setYear(Number(e.target.value)); });

    var slider = $('#yearSlider');
    slider.max = String(S.years.length - 1);
    slider.addEventListener('input', function () { setYear(S.years[Number(slider.value)]); });

    $('#playBtn').addEventListener('click', togglePlay);

    $('#districtPick').innerHTML = '<option value="">Choose a district</option>' + options(sorted, null);
    $('#districtPick').addEventListener('change', function (e) {
      if (e.target.value) selectDistrict(Number(e.target.value));
    });

    $('#simFrom').innerHTML = options(sorted, S.simFrom);
    $('#simTo').innerHTML = options(sorted, S.simTo);
    $('#simFrom').addEventListener('change', function (e) { S.simFrom = Number(e.target.value); renderCoverage(); });
    $('#simTo').addEventListener('change', function (e) { S.simTo = Number(e.target.value); renderCoverage(); });
    $('#simFte').addEventListener('input', function (e) { S.simFte = Number(e.target.value); renderSimulator(); });

    $('#covSort').addEventListener('change', renderCoverage);
    $('#covExport').addEventListener('click', exportCoverage);

    $('#printBtn').addEventListener('click', function () { window.print(); });
    $('#priorityExport').addEventListener('click', exportPriorities);
    $('#toTop').addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    window.addEventListener('scroll', onScroll, { passive: true });
    updateScrollUi();

    buildTrendControls();
    $('#ageDistrict').value = String(S.ageDistrict);
    $('#ageYear').value = String(S.ageYear);

    document.querySelectorAll('.tab').forEach(function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.tab); });
    });
  }

  function exportCoverage() {
    var built = coverageList();
    var rows = built.list.map(function (x) {
      var r = x.r || {};
      return [x.d.name, x.d.province, S.year, r.psychiatrists, r.psych_per_100k, r.outpatient_visits,
        r.visits_per_psychiatrist, r.need_index, r.completeness_pct, x.flag.text];
    });
    download(
      'neurox_coverage_' + S.year + '.csv',
      toCsv(['District', 'Province', 'Year', 'Psychiatrists', 'Psychiatrists per 100,000',
        'Outpatient visits', 'Visits per psychiatrist', 'Need index', 'Reporting completeness %', 'Flag'], rows)
    );
  }

  async function init() {
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = '#c3d4cc';
      Chart.defaults.borderColor = '#2a4238';
      Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    }
    try {
      var loaded = await loadData();
      hydrate(loaded.payload, loaded.source);
      initMap();
      renderLegend();
      buildControls();
      renderMethod();
      renderNational();
      setYear(S.years[S.years.length - 1]);
      var hash = (location.hash || '').replace('#', '');
      setTab(['map', 'trends', 'priorities', 'coverage', 'alerts', 'method'].indexOf(hash) !== -1 ? hash : 'map');
    } catch (err) {
      console.error(err);
      var box = $('#loadError');
      box.hidden = false;
      box.textContent =
        'The dashboard could not load its data. Run the pipeline (pipeline/run_all.py) and start the server from the public folder ' +
        '(php -S localhost:8000). Details: ' + err.message;
      $('#dataStatus').textContent = 'No data loaded';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
