import React, { useState, useEffect } from "react";

export default function Topbar({ onAddClick, children }) {
  const [showSettings, setShowSettings] = useState(false);
  const [email, setEmail] = useState("");

  // Load email from localStorage on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("notificationEmail") || "";
    setEmail(storedEmail);
  }, []);

  // Save email to localStorage
  const saveEmail = () => {
    localStorage.setItem("notificationEmail", email);
    alert("Notification email saved!");
  };

  return (
    <div className="flex justify-between items-center p-4 bg-white shadow rounded-lg mb-6">
      <h1 className="text-xl font-semibold">Website Monitor</h1>

      <div className="flex items-center gap-4 relative">
        {children}

        {/* Email Notification Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-sm"
          >
            E-mail Notification
          </button>

          {showSettings && (
            <div className="absolute top-10 right-0 bg-white p-3 rounded shadow-lg z-50 w-56">
              {/* Email Input */}
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="Notification Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border px-2 py-1 rounded w-full"
                />
                <button
                  onClick={saveEmail}
                  className="px-2 py-1 bg-blue-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onAddClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow"
        >
          + Add Website
        </button>
      </div>
    </div>
  );
}
