/* Short findings for the Start page, built from the 2024 figures. */
import { fmt, hasVal } from './data.js';

export function buildInsights(ds) {
  const rows = ds.rows;
  const name = (id) => ds.byId.get(id)?.name ?? 'District';
  const out = [];

  const withUse = rows.filter((r) => hasVal(r.service_use_score));
  if (withUse.length) {
    const top = withUse.reduce((a, b) => (b.service_use_score > a.service_use_score ? b : a));
    out.push({
      id: 'use',
      icon: '◉',
      title: `${name(top.district_id)} has the highest service use`,
      body: `Score ${fmt(top.service_use_score, 1)} out of 100, based on clinic visits and mental-disorder admissions per 100,000 people.`,
      districtId: top.district_id,
    });
  }

  const none = rows.filter((r) => r.psychiatrists === 0);
  if (none.length) {
    out.push({
      id: 'none',
      icon: '∅',
      title: `${none.length} districts have no psychiatrist recorded`,
      body: `${none.map((r) => name(r.district_id)).join(', ')}. Check whether psychiatrists are based in another division.`,
      districtId: none[0].district_id,
    });
  }

  const withLoad = rows.filter((r) => hasVal(r.visits_per_psychiatrist));
  if (withLoad.length) {
    const top = withLoad.reduce((a, b) => (b.visits_per_psychiatrist > a.visits_per_psychiatrist ? b : a));
    out.push({
      id: 'load',
      icon: '⚖',
      title: `${name(top.district_id)} has the heaviest load per psychiatrist`,
      body: `About ${fmt(top.visits_per_psychiatrist)} clinic visits per psychiatrist in 2024. Clinics are often run by medical officers, so this measures workload.`,
      districtId: top.district_id,
    });
  }

  const withBeds = rows.filter((r) => hasVal(r.beds_per_100k));
  if (withBeds.length) {
    const top = withBeds.reduce((a, b) => (b.beds_per_100k > a.beds_per_100k ? b : a));
    out.push({
      id: 'beds',
      icon: '▥',
      title: `${name(top.district_id)} has the most psychiatric beds per person`,
      body: `${fmt(top.beds_per_100k, 1)} beds per 100,000 people. Some of these beds serve patients from across the country.`,
      districtId: top.district_id,
    });
  }

  return out;
}
