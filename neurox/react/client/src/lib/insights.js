/* Turns the dataset into short, human-readable findings for the Overview page. */
import { fmt, hasVal } from './data.js';

export function buildInsights(ds, year) {
  const list = ds.decisions(year).filter((x) => x.r);
  const out = [];

  const withLoad = list.filter((x) => hasVal(x.r.visits_per_psychiatrist));
  if (withLoad.length) {
    const top = withLoad.reduce((a, b) => (b.r.visits_per_psychiatrist > a.r.visits_per_psychiatrist ? b : a));
    out.push({
      id: 'load',
      icon: '⚖',
      title: `${top.d.name} has the heaviest load`,
      body: `Each psychiatrist there handled about ${fmt(top.r.visits_per_psychiatrist)} outpatient visits in ${year}.`,
      districtId: top.d.id,
    });
  }

  const withNeed = list.filter((x) => hasVal(x.r.need_index));
  if (withNeed.length) {
    const top = withNeed.reduce((a, b) => (b.r.need_index > a.r.need_index ? b : a));
    out.push({
      id: 'need',
      icon: '◉',
      title: `${top.d.name} shows the highest need`,
      body: `Its need score is ${fmt(top.r.need_index, 1)} out of 100 for ${year}.`,
      districtId: top.d.id,
    });
  }

  let biggestRise = null;
  ds.districts.forEach((d) => {
    const vals = ds.series(d.id, 'need_index').filter(hasVal);
    if (vals.length < 2) return;
    const change = vals[vals.length - 1] - vals[0];
    if (!biggestRise || change > biggestRise.change) {
      biggestRise = { d, change, from: vals[0], to: vals[vals.length - 1] };
    }
  });
  if (biggestRise && biggestRise.change > 0) {
    out.push({
      id: 'rise',
      icon: '↗',
      title: `${biggestRise.d.name} has risen the most`,
      body: `Its need score climbed from ${fmt(biggestRise.from, 1)} to ${fmt(biggestRise.to, 1)} over the years shown.`,
      districtId: biggestRise.d.id,
    });
  }

  const withPsych = list.filter((x) => hasVal(x.r.psych_per_100k));
  if (withPsych.length) {
    const thin = withPsych.reduce((a, b) => (b.r.psych_per_100k < a.r.psych_per_100k ? b : a));
    out.push({
      id: 'thin',
      icon: '◔',
      title: `${thin.d.name} has the thinnest specialist cover`,
      body: `${fmt(thin.r.psych_per_100k, 2)} psychiatrists per 100,000 people in ${year}.`,
      districtId: thin.d.id,
    });
  }

  return out;
}
