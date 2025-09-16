import React, { useState, useEffect } from "react";
import axios from "axios";

export default function AddEditSiteModal({ site, onClose, onSaved, apiBase }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (site) {
      setName(site.name);
      setUrl(site.url);
    } else {
      setName("");
      setUrl("");
    }
  }, [site]);

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!name.trim() || !url.trim()) {
        alert("Please fill in all fields.");
        return;
      }

      if (site) {
        // Edit existing site
        await axios.put(`${apiBase}/websites/${site.id}`, { name, url });
      } else {
        // Add new site with default fields
        await axios.post(`${apiBase}/websites`, {
          name,
          url,
          auto_monitor: false,
          notifications_enabled: false,
        });
      }
      onSaved();
    } catch (err) {
      console.error(err.response || err);
      alert("Error saving site: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">
          {site ? "Edit Site" : "Add Site"}
        </h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input
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
