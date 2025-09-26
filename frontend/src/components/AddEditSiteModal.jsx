import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";

export default function AddEditSiteModal({ site, onClose, onSaved, apiBase }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (site) {
      setName(site.name);
      setUrl(site.url);
    } else {
      setName("");
      setUrl("");
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
      setSaving(true); // Show loader

      if (site) {
        // Edit existing site
        await axios.put(`${apiBase}websites/${site.id}`, { name, url });
      } else {
        // Add new site
        await axios.post(`${apiBase}websites`, { name, url });
      }

      toast.success(`Site ${site ? "updated" : "added"} successfully!`);
      onSaved(); // Refresh parent site list
      onClose();  // Close modal AFTER save finishes
    } catch (err) {
      console.error(err.response || err);
      toast.error("Error saving site: " + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false); // Stop loader
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 shadow-lg animate-fade-in relative">
        {/* Optional overlay while saving */}
        {saving && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center rounded-lg z-10">
            <span className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
          </div>
        )}

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

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-gray-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2"
              disabled={saving}
            >
              {saving && (
                <span className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></span>
              )}
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
