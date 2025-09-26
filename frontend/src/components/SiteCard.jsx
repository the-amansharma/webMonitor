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
  lastResponse, // passed from App.jsx
}) {
  const last10 = site.responseHistory?.slice(-10) || [];
  const last = lastResponse || last10[last10.length - 1] || {};

  // Status colors
  const statusColorMap = {
    up: "bg-green-100",
    high_latency: "bg-yellow-100",
    down: "bg-red-100",
  };
  const textColorMap = {
    up: "text-green-700",
    high_latency: "text-yellow-700",
    down: "text-red-700",
  };

  // Chart data
  const data = {
    labels: last10.map((r) => (r.time ? r.time.split(" ")[1] : "—")),
    datasets: [
      {
        label: "Response (ms)",
        data: last10.map((r) => (typeof r.ms === "number" ? r.ms : null)),
        fill: false,
        borderColor:
          site.status === "down"
            ? "#f87171"
            : site.status === "high_latency"
            ? "#facc15"
            : "#4ade80",
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

  // Format error based on status
  const formatError = (resp) => {
    if (!resp) return "N/A";

    if (site.status === "down") {
      if (resp.error && resp.error.toLowerCase().includes("http")) {
        return resp.error; // Already contains HTTP info
      }
      return resp.code && resp.code !== 0
        ? `HTTP ${resp.code}`
        : resp.error || "Unknown Error";
    }

    if (site.status === "high_latency") {
      return "Slow response";
    }

    return "N/A";
  };

  return (
    <div
      className={`p-4 rounded-lg shadow transition-colors ${statusColorMap[site.status]}`}
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
        <span className={`font-semibold ${textColorMap[site.status]}`}>
          {site.status?.toUpperCase() || "N/A"}
        </span>
      </p>
      <p className="text-sm mb-1">Last Checked: {site.lastChecked ?? "—"}</p>
      <p className="text-sm mb-1">
        Response: {last.ms ? `${last.ms} ms` : "N/A"}
      </p>

      {/* Error details */}
      {site.status !== "up" && (
        <p className="text-sm font-medium mb-2 text-red-700">
          Error: {formatError(last)}
        </p>
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
      </div>
    </div>
  );
}
