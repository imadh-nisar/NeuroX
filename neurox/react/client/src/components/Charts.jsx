import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);
ChartJS.defaults.color = '#c3d4cc';
ChartJS.defaults.borderColor = '#2a4238';
ChartJS.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Line chart. series: [{ label, data, color }]. Null values leave gaps. */
export function LineChart({ labels, series, yTitle, max, ariaLabel, legend = false, className = 'chart-box' }) {
  const data = {
    labels,
    datasets: series.map((s) => ({
      label: s.label,
      data: s.data,
      borderColor: s.color,
      backgroundColor: s.color,
      tension: 0.25,
      spanGaps: false,
      pointRadius: 3,
    })),
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      y: { beginAtZero: true, max, title: { display: Boolean(yTitle), text: yTitle } },
    },
    plugins: { legend: { display: legend } },
  };
  return (
    <div className={className}>
      <Line data={data} options={options} role="img" aria-label={ariaLabel} />
    </div>
  );
}

/** Bar chart. datasets: [{ label, data, backgroundColor }]. */
export function BarChart({
  labels,
  datasets,
  horizontal = false,
  valueTitle,
  categoryTitle,
  legend = false,
  ariaLabel,
  className = 'chart-box',
}) {
  const valueAxis = horizontal ? 'x' : 'y';
  const categoryAxis = horizontal ? 'y' : 'x';
  const data = { labels, datasets };
  const options = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      [valueAxis]: { beginAtZero: true, title: { display: Boolean(valueTitle), text: valueTitle } },
      [categoryAxis]: { title: { display: Boolean(categoryTitle), text: categoryTitle } },
    },
    plugins: { legend: { display: legend } },
  };
  return (
    <div className={className}>
      <Bar data={data} options={options} role="img" aria-label={ariaLabel} />
    </div>
  );
}
