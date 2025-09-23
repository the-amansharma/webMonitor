import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export default function AddEditSiteModal({ site, onClose, onSaved, apiBase }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (site) {
      setName(site.name);
      setUrl(site.url);
      const savedNotify = JSON.parse(localStorage.getItem(`notify_${site.id}`));
      setNotificationsEnabled(savedNotify ?? site.notifications_enabled);
    } else {
      setName("");
      setUrl("");
      setNotificationsEnabled(false);
    }

    // Auto-focus the name field
    setTimeout(() => nameRef.current?.focus(), 100);
  }, [site]);

  const isValidUrl = (str) => {
    try {
      return Boolean(new URL(str));
    } catch {
      return false;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (!isValidUrl(url)) {
      toast.error("Please enter a valid URL (https://...)");
      return;
    }

    try {
      if (site) {
        // Edit existing site
        await axios.put(`${apiBase}/websites/${site.id}`, { name, url });
      } else {
        // Add new site
        const res = await axios.post(`${apiBase}/websites`, {
          name,
          url,
          auto_monitor: false,
          notifications_enabled: notificationsEnabled,
        });
        // Save notifications for newly created site
        if (res.data.id) {
          localStorage.setItem(`notify_${res.data.id}`, JSON.stringify(notificationsEnabled));
        }
      }

      // Save per-site notification in localStorage
      if (site?.id) {
        localStorage.setItem(`notify_${site.id}`, JSON.stringify(notificationsEnabled));
      }

      toast.success(`Site ${site ? "updated" : "added"} successfully!`);
      onSaved();
    } catch (err) {
      console.error(err.response || err);
      toast.error("Error saving site: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-lg animate-fade-in">
        <h2 className="text-lg font-semibold mb-4">{site ? "Edit Site" : "Add Site"}</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
            ref={nameRef}
            type="text"
            placeholder="Site Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          <input
            type="url"
            placeholder="Site URL (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="border px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            required
          />
          {/* Notification toggle */}
          <label className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(e) => setNotificationsEnabled(e.target.checked)}
              className="accent-green-600"
            />
            Enable Notifications for this site
          </label>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
