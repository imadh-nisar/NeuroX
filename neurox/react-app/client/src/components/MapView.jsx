import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet';
import { BIN_COLOURS, BIN_LABELS, NO_DATA_COLOUR, colourFor, fmt, hasVal } from '../lib/data.js';
import DistrictPanel from './DistrictPanel.jsx';

export default function MapView({ ds, selected, onSelect, onCompare }) {
  return (
    <>
      <div className="toolbar">
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

      <div className="legend" aria-label="Colour key for the service-use score">
        {BIN_COLOURS.map((c, i) => (
          <span key={c} className="legend-item"><i style={{ background: c }} />{BIN_LABELS[i]}</span>
        ))}
        <span className="legend-item"><i style={{ background: NO_DATA_COLOUR }} />No data</span>
        <span className="legend-item muted">Service-use score, 0 to 100, across the 25 districts</span>
      </div>

      <div className="map-layout">
        <div className="map" role="region" aria-label="Map of districts coloured by service-use score">
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
              const r = ds.rowFor(d.id) || {};
              const isSelected = d.id === selected;
              const pop = hasVal(r.population) ? r.population : 100000;
              return (
                <CircleMarker
                  key={d.id}
                  center={[d.lat, d.lon]}
                  radius={7 + Math.sqrt(pop / 20000) * 1.2}
                  pathOptions={{
                    color: isSelected ? '#ffffff' : '#0a1310',
                    weight: isSelected ? 3 : 1.5,
                    fillColor: colourFor(r.service_use_score),
                    fillOpacity: 0.92,
                  }}
                  eventHandlers={{ click: () => onSelect(d.id) }}
                >
                  <Tooltip>
                    {d.name} · {hasVal(r.service_use_score) ? `score ${fmt(r.service_use_score, 1)}` : 'no data'}
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
        <DistrictPanel ds={ds} id={selected} onCompare={onCompare} />
      </div>

      <p className="fine">
        Circles sit at approximate district centres and are sized by population. Official boundary polygons are not included yet.
      </p>
    </>
  );
}
