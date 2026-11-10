import { Chart as ChartJS, Legend, Tooltip, registerables } from 'chart.js';
import { Bar, Scatter } from 'react-chartjs-2';

ChartJS.register(...registerables, Tooltip, Legend);
ChartJS.defaults.color = '#c3d4cc';
ChartJS.defaults.borderColor = '#2a4238';
ChartJS.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Simple bar chart for one value per district. */
export function BarChart({ labels, values, valueTitle, colour = '#3ddc97', horizontal = false, ariaLabel, className = 'chart-box' }) {
  const data = { labels, datasets: [{ label: valueTitle, data: values, backgroundColor: colour }] };
  const valueAxis = horizontal ? 'x' : 'y';
  const options = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { [valueAxis]: { beginAtZero: true, title: { display: true, text: valueTitle } } },
  };
  return (
    <div className={className}>
      <Bar data={data} options={options} role="img" aria-label={ariaLabel} />
    </div>
  );
}

/** Scatter of service use against psychiatrist density. Each point is one district. */
export function ScatterChart({ points, xTitle, yTitle, ariaLabel, className = 'chart-box' }) {
  const data = {
    datasets: [{ label: 'Districts', data: points, backgroundColor: '#3ddc97', pointRadius: 6, pointHoverRadius: 8 }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const p = ctx.raw;
            return `${p.name}: score ${p.x.toFixed(1)}, ${p.y.toFixed(2)} psychiatrists per 100,000`;
          },
        },
      },
    },
    scales: {
      x: { min: 0, max: 100, title: { display: true, text: xTitle } },
      y: { beginAtZero: true, title: { display: true, text: yTitle } },
    },
  };
  return (
    <div className={className}>
      <Scatter data={data} options={options} role="img" aria-label={ariaLabel} />
    </div>
  );
}
