import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import { BIN_COLOURS, BIN_LABELS, NO_DATA_COLOUR, colourFor, fmt, hasVal } from '../lib/data.js';
import DistrictPanel from './DistrictPanel.jsx';

export default function MapView({ ds, year, setYear, selected, onSelect, onCompare }) {
  const [playing, setPlaying] = useState(false);

  // Auto-advance through the years while playing; stop at the last year.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      const i = ds.years.indexOf(year);
      if (i >= ds.years.length - 1) {
        setPlaying(false);
        return;
      }
      setYear(ds.years[i + 1]);
    }, 1200);
    return () => clearInterval(timer);
  }, [playing, year, ds.years, setYear]);

  return (
    <>
      <div className="toolbar">
        <div className="time-control">
          <button className="btn" type="button" onClick={() => setPlaying((p) => !p)} aria-label="Play through the years">
            {playing ? 'Stop' : 'Play'}
          </button>
          <label className="slider-label">
            <span>Year <output>{year}</output></span>
            <input
              type="range"
              min={0}
              max={ds.years.length - 1}
              step={1}
              value={ds.years.indexOf(year)}
              onChange={(e) => setYear(ds.years[Number(e.target.value)])}
            />
          </label>
        </div>
        <label className="district-pick">
          <span>District</span>
          <select value={selected ?? ''} onChange={(e) => onSelect(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Choose a district</option>
            {ds.sorted.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="legend" aria-label="Colour key for need index">
        {BIN_COLOURS.map((c, i) => (
          <span key={c} className="legend-item"><i style={{ background: c }} />{BIN_LABELS[i]}</span>
        ))}
        <span className="legend-item"><i style={{ background: NO_DATA_COLOUR }} />No data</span>
        <span className="legend-item muted">Need index, 0–100, relative across districts and years</span>
      </div>

      <div className="map-layout">
        <div className="map" role="region" aria-label="Map of districts coloured by need index">
          <MapContainer
            center={[7.85, 80.7]}
            zoom={7}
            minZoom={6}
            maxZoom={11}
            scrollWheelZoom={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap contributors &copy; CARTO"
              subdomains="abcd"
              maxZoom={11}
            />
            {ds.districts.map((d) => {
              const r = ds.rowFor(d.id, year);
              const value = r ? r.need_index : null;
              const pop = r && hasVal(r.population) ? r.population : 100000;
              const lowComp = Boolean(r && hasVal(r.completeness_pct) && r.completeness_pct < ds.meta.low_completeness_pct);
              const isSelected = d.id === selected;
              return (
                <CircleMarker
                  key={d.id}
                  center={[d.lat, d.lon]}
                  radius={7 + Math.sqrt(pop / 20000) * 1.2}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : '#0a1310',
                    weight: isSelected ? 3 : 1.5,
                    fillColor: colourFor(value),
                    fillOpacity: 0.92,
                    dashArray: lowComp ? '4 3' : undefined,
                  }}
                  eventHandlers={{ click: () => onSelect(d.id) }}
                >
                  <Tooltip>
                    {d.name} · {hasVal(value) ? `index ${fmt(value, 1)}` : `no data for ${year}`}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <DistrictPanel ds={ds} year={year} id={selected} onCompare={onCompare} />
      </div>

      <p className="fine">
        Circles sit at approximate district centres and are sized by population. Official boundary polygons are not yet
        included. Dashed outlines mean reporting is below the completeness threshold.
      </p>
    </>
  );
}
