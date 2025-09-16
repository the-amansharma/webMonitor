import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip);

export default function SiteCard({
  site,
  onEdit,
  onDelete,
  onManualCheck,
  onToggleNotifications,
}) {
  // Get last 10 responses safely
  const last10 = site.responseHistory?.slice(-10) || [];
  const lastCheck = last10[last10.length - 1] || {};

  const data = {
    labels: last10.map((r) => (r.time ? r.time.split(" ")[1] : "—")), // Show HH:MM:SS
    datasets: [
      {
        label: "Response (ms)",
        data: last10.map((r) => (typeof r.ms === "number" ? r.ms : null)),
        fill: false,
        borderColor: site.status === "down" ? "#f87171" : "#4ade80",
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: true } },
    scales: {
      y: { beginAtZero: true },
      x: { ticks: { maxRotation: 45, minRotation: 45 } },
    },
  };

  // Helper for displaying error code + message
  const formatError = (last) => {
    if (!last) return "N/A";
    if (last.code && last.code !== 0) {
      return `HTTP ${last.code} (${last.error || "Unknown Error"})`;
    }
    return last.error || "N/A";
  };

  return (
    <div
      className={`p-4 rounded-lg shadow transition-colors ${
        site.status === "down" ? "bg-red-100" : "bg-green-100"
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-lg">{site.name}</h3>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-blue-600 hover:underline">
            Edit
          </button>
          <button onClick={onDelete} className="text-red-600 hover:underline">
            Delete
          </button>
        </div>
      </div>

      {/* Info */}
      <p className="text-sm text-gray-700 mb-1">{site.url}</p>
      <p className="text-sm mb-1">
        Status:{" "}
        <span
          className={
            site.status === "down"
              ? "text-red-700 font-semibold"
              : "text-green-700 font-semibold"
          }
        >
          {site.status?.toUpperCase() || "N/A"}
        </span>
      </p>
      <p className="text-sm mb-1">Last Checked: {site.lastChecked ?? "—"}</p>
      <p className="text-sm mb-1">
        Response: {lastCheck.ms ? `${lastCheck.ms} ms` : "N/A"}
      </p>

      {/* Error details */}
      {site.status === "down" && (
        <p className="text-sm text-red-700 mb-2">Error: {formatError(lastCheck)}</p>
      )}

      {/* Chart */}
      <div className="h-28">
        <Line data={data} options={options} />
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-3 text-sm">
        <button
          onClick={onManualCheck}
          className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Manual Check
        </button>
        <button
          onClick={onToggleNotifications}
          className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 transition ${
            site.notifications_enabled
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-500"
          }`}
        >
          {site.notifications_enabled ? "🔔 Notifications ON" : "🔕 Notifications OFF"}
        </button>
      </div>
    </div>
  );
}
