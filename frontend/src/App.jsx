import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import AddEditSiteModal from "./components/AddEditSiteModal";
import SiteCard from "./components/SiteCard";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api/";

// Track ongoing manual checks globally
const manualCheckLocks = {};

export default function App() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [autoMonitoring, setAutoMonitoring] = useState(true);
  const [intervalTime, setIntervalTime] = useState(60);
  const [soundOn, setSoundOn] = useState(JSON.parse(localStorage.getItem("soundOn")) ?? false);
  const [email, setEmail] = useState(localStorage.getItem("notificationEmail") || "");

  const audioRef = useRef(null);

  // ---------------- Load Sites ----------------
  const loadSites = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}websites`);
      const mergedSites = res.data.map((s) => ({
        ...s,
        notifications_enabled: JSON.parse(localStorage.getItem(`notify_${s.id}`)) ?? s.notifications_enabled,
      }));
      setSites(mergedSites);
    } catch (err) {
      console.error("Error loading sites", err);
      toast.error("Failed to load sites");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => loadSites(), []);

  // ---------------- Manual Check ----------------
  const onManualCheck = async (id, showToast = true) => {
    if (manualCheckLocks[id]) {
      if (showToast) {
        toast.info(`A manual check for ${sites.find((s) => s.id === id)?.name || "site"} is already running.`);
      }
      return;
    }
    manualCheckLocks[id] = true;

    try {
      const res = await axios.post(`${API}check/${id}`);
      const updatedSite = res.data;
      updatedSite.notifications_enabled = JSON.parse(localStorage.getItem(`notify_${id}`)) ?? updatedSite.notifications_enabled;

      setSites((prev) => prev.map((site) => (site.id === id ? updatedSite : site)));

      // Send email if site is down and notifications enabled
      if (updatedSite.status === "down" && updatedSite.notifications_enabled && email) {
        await axios.post(`${API}notify`, {
          siteId: updatedSite.id,
          email,
          message: `${updatedSite.name} is DOWN!`,
        });
      }

      if (showToast) toast.success(`Manual check completed for ${updatedSite.name}`);
    } catch (err) {
      console.error("Manual check failed", err);
      if (showToast) toast.error("Manual check failed: " + err.message);
    } finally {
      manualCheckLocks[id] = false;
    }
  };

  // ---------------- Auto Monitoring ----------------
  useEffect(() => {
    if (!autoMonitoring) return;

    const id = setInterval(async () => {
      try {
        const currentSites = await axios.get(`${API}websites`).then((r) => r.data);
        await Promise.all(currentSites.map((s) => onManualCheck(s.id, false))); // No toast per site
        toast.success("Auto-monitor cycle complete"); // Only one toast
        setSites(currentSites);
      } catch (err) {
        console.error("Auto-monitor failed", err);
        toast.error("Auto-monitor cycle failed");
      }
    }, intervalTime * 1000);

    return () => clearInterval(id);
  }, [autoMonitoring, intervalTime, email]);

  // ---------------- Sound Alert ----------------
  useEffect(() => {
    localStorage.setItem("soundOn", JSON.stringify(soundOn));
    if (!audioRef.current) return;
    const downCount = sites.filter((s) => s.status === "down").length;
    if (soundOn && downCount > 0) {
      audioRef.current.play().catch((err) => console.error("Audio play failed:", err));
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [sites, soundOn]);

  // ---------------- Add/Edit Site ----------------
  const openAdd = () => {
    setEditingSite(null);
    setModalOpen(true);
  };
  const openEdit = (site) => {
    setEditingSite(site);
    setModalOpen(true);
  };
  const onSaved = async () => {
    setModalOpen(false);
    await loadSites();
  };

  // ---------------- Delete Site ----------------
  const onDelete = async (id) => {
    if (!confirm("Delete this site?")) return;
    try {
      await axios.delete(`${API}websites/${id}`);
      localStorage.removeItem(`notify_${id}`);
      setSites((prev) => prev.filter((s) => s.id !== id));
      toast.success("Site deleted successfully");
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete site");
    }
  };

  // ---------------- Toggle Notifications ----------------
  const onToggleNotifications = (site) => {
    const newValue = !site.notifications_enabled;
    localStorage.setItem(`notify_${site.id}`, JSON.stringify(newValue));
    setSites((prev) => prev.map((s) => (s.id === site.id ? { ...s, notifications_enabled: newValue } : s)));
    toast.success(`Notifications ${newValue ? "enabled" : "disabled"}`);
  };

  // ---------------- Save Email ----------------
  const saveEmail = (emailInput) => {
    setEmail(emailInput);
    localStorage.setItem("notificationEmail", emailInput);
    toast.success("Notification email saved!");
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <ToastContainer position="top-right" autoClose={3000} />
      <Sidebar />
      <div className="flex-1 p-6">
        <Topbar
          onAddClick={openAdd}
          notifyDelay={0}
          setNotifyDelay={() => {}}
          email={email}
          setEmail={saveEmail}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Auto Monitoring:</span>
            <button
              onClick={() => setAutoMonitoring(!autoMonitoring)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                autoMonitoring ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
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
            <span className="text-sm font-medium">Sound Alert:</span>
            <button
              onClick={() => setSoundOn(!soundOn)}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                soundOn ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
              }`}
            >
              {soundOn ? "ON" : "OFF"}
            </button>
          </div>
        </Topbar>

        <audio ref={audioRef} loop>
          <source src="/alert.mp3" type="audio/mpeg" />
        </audio>

        {/* Summary Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Sites */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Total Sites</div>
            <div className="mt-2 text-3xl font-semibold">{sites.length}</div>
          </div>

          {/* Sites Down */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Sites Down</div>
            <div className="mt-2 text-3xl font-semibold">
              {sites.filter((s) => s.status === "down").length}
            </div>
          </div>

          {/* Slowest Site */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Slowest Site</div>
            <div className="mt-2 text-3xl font-semibold">
              {sites.length === 0
                ? "—"
                : sites.reduce((slowest, s) => {
                    const avg = s.responseHistory?.length
                      ? s.responseHistory.reduce((a, r) => a + r.ms, 0) /
                        s.responseHistory.length
                      : 0;
                    return avg > (slowest.avg || 0)
                      ? { name: s.name, avg }
                      : slowest;
                  }, {}).name || "—"}
            </div>
          </div>

          {/* Average Response Time */}
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-sm text-slate-500">Avg Response Time</div>
            <div className="mt-2 text-3xl font-semibold">
              {sites.length === 0
                ? "—"
                : `${(
                    sites.reduce((total, s) => {
                      const avg = s.responseHistory?.length
                        ? s.responseHistory.reduce((a, r) => a + r.ms, 0) /
                          s.responseHistory.length
                        : 0;
                      return total + avg;
                    }, 0) /
                    sites.length /
                    1000
                  ).toFixed(2)} s`}
            </div>
          </div>
        </div>
        {/* Summary Cards End */}

        {/* Sites Down Alerts */}
        {sites.some((s) => s.status === "down") && (
          <div className="mt-6 bg-red-50 p-4 rounded-xl shadow border-l-4 border-red-500">
            <h2 className="text-lg font-semibold text-red-700 mb-3">
              Sites Down
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-600">
                  <th className="text-left py-1">Site</th>
                  <th className="text-left py-1">URL</th>
                  <th className="text-left py-1">Last Checked</th>
                  <th className="text-left py-1">Response Time</th>
                  <th className="text-left py-1">Error</th>
                </tr>
              </thead>
              <tbody>
                {sites
                  .filter((s) => s.status === "down")
                  .map((s) => {
                    const last = s.responseHistory?.slice(-1)[0] || {};
                    return (
                      <tr key={s.id} className="border-t">
                        <td>{s.name}</td>
                        <td>{s.url}</td>
                        <td>{s.lastChecked ?? "—"}</td>
                        <td>{last.ms ? `${last.ms} ms` : "—"}</td>
                        <td>
                          {last.code && last.code !== 0
                            ? `HTTP ${last.code} (${last.error})`
                            : last.error || "N/A"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
       { /* site alerts end */}


        {/* Sites Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading && <div className="text-slate-500">Loading...</div>}
          {!loading &&
            sites
              .slice()
              .sort((a, b) => {
                const order = { down: 0, high_latency: 1, degraded: 1, unknown: 2, up: 3 };
                const priorityA = order[a.status] ?? 4;
                const priorityB = order[b.status] ?? 4;
                if (priorityA !== priorityB) return priorityA - priorityB;
                const avgA = a.responseHistory?.length
                  ? a.responseHistory.reduce((sum, r) => sum + r.ms, 0) / a.responseHistory.length
                  : 0;
                const avgB = b.responseHistory?.length
                  ? b.responseHistory.reduce((sum, r) => sum + r.ms, 0) / b.responseHistory.length
                  : 0;
                return avgB - avgA;
              })
              .map((site) => (
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

        {modalOpen && (
          <AddEditSiteModal
            site={editingSite}
            onClose={() => setModalOpen(false)}
            onSaved={onSaved}
            apiBase={`${API}`}
          />
        )}
      </div>
    </div>
  );
}
