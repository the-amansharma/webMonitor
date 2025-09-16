import React, { useEffect, useState } from "react";
import axios from "axios";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AddEditSiteModal from "./components/AddEditSiteModal";
import SiteCard from "./components/SiteCard";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [autoMonitoring, setAutoMonitoring] = useState(false);
  const [intervalTime, setIntervalTime] = useState(60);

  // Fetch all sites
  const loadSites = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/websites`);
      setSites(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  // Auto monitoring interval
  useEffect(() => {
    if (!autoMonitoring) return;
    const id = setInterval(() => {
      sites.forEach((site) => onManualCheck(site.id));
    }, intervalTime * 1000);
    return () => clearInterval(id);
  }, [autoMonitoring, intervalTime, sites]);

  const openAdd = () => {
    setEditingSite(null);
    setModalOpen(true);
  };

  const openEdit = (site) => {
    setEditingSite(site);
    setModalOpen(true);
  };

  const onSaved = () => {
    setModalOpen(false);
    loadSites();
  };

  const onDelete = async (id) => {
    if (!confirm("Delete this site?")) return;
    try {
      await axios.delete(`${API}/websites/${id}`);
      setSites((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const onManualCheck = async (id) => {
    try {
      const res = await axios.post(`${API}/check/${id}`);
      const updatedSite = res.data;
      setSites((prev) =>
        prev.map((site) => (site.id === id ? updatedSite : site))
      );
    } catch (err) {
      console.error("Manual check failed", err);
    }
  };

  // Toggle notifications
  const onToggleNotifications = async (site) => {
    try {
      const res = await axios.put(`${API}/websites/${site.id}`, {
        notifications_enabled: !site.notifications_enabled,
      });
      setSites((prev) =>
        prev.map((s) => (s.id === site.id ? res.data : s))
      );
    } catch (err) {
      console.error("Toggle notifications failed", err);
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-6">
        <Topbar onAddClick={openAdd}>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Auto Monitoring:</span>
            <button
              onClick={() => setAutoMonitoring(!autoMonitoring)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                autoMonitoring
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {autoMonitoring ? "ON" : "OFF"}
            </button>
            {autoMonitoring && (
              <select
                value={intervalTime}
                onChange={(e) => setIntervalTime(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
                <option value={900}>15m</option>
                <option value={1800}>30m</option>
                <option value={3600}>1h</option>
              </select>
            )}
          </div>
        </Topbar>

        {/* Summary Cards
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Monitored Sites</div>
            <div className="mt-2 text-3xl font-semibold">{sites.length}</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Auto-monitored</div>
            <div className="mt-2 text-3xl font-semibold">
              {sites.filter((s) => s.auto_monitor).length}
            </div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Avg Uptime</div>
            <div className="mt-2 text-3xl font-semibold">
              {sites.length === 0
                ? "—"
                : `${(
                    sites.reduce((a, s) => a + (s.uptime || 0), 0) /
                    sites.length
                  ).toFixed(2)}%`}
            </div>
          </div>
        </div> */}

        {/* Sites Down Alerts
        {sites.some((s) => s.status === "down") && (
          <div className="mt-6 bg-red-50 p-4 rounded-xl shadow border-l-4 border-red-500">
            <h2 className="text-lg font-semibold text-red-700 mb-3">Sites Down</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left py-1">Site</th>
                  <th className="text-left py-1">URL</th>
                  <th className="text-left py-1">Last Checked</th>
                  <th className="text-left py-1">Response Time</th>
                </tr>
              </thead>
              <tbody>
                {sites
                  .filter((s) => s.status === "down")
                  .map((s) => (
                    <tr key={s.id} className="border-t">
                      <td>{s.name}</td>
                      <td>{s.url}</td>
                      <td>{s.lastChecked ?? "—"}</td>
                      <td>
                        {s.responseHistory && s.responseHistory.length > 0
                          ? `${s.responseHistory[s.responseHistory.length - 1].ms} ms`
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )} */}

        {/* Site Cards Grid */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && <div className="text-slate-500">Loading...</div>}
          {!loading &&
            sites.map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                onEdit={() => openEdit(site)}
                onDelete={() => onDelete(site.id)}
                onManualCheck={() => onManualCheck(site.id)}
                onToggleNotifications={() => onToggleNotifications(site)}
              />
            ))}
        </div>
      </div>

      {modalOpen && (
        <AddEditSiteModal
          site={editingSite}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
          apiBase={API}
        />
      )}
    </div>
  );
}
