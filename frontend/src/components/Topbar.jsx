import React, { useState, useEffect } from "react";
import Cookies from "js-cookie";

export default function Topbar({ onAddClick, children }) {
  const [showSettings, setShowSettings] = useState(false);
  const [phone, setPhone] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    Cookies.get("notificationsEnabled") === true
  );

  // Load saved phone and notifications state from cookies
  useEffect(() => {
    const savedPhone = Cookies.get("notificationPhone") || "";
    setPhone(savedPhone);

    const savedNotify = Cookies.get("notificationsEnabled") === "true";
    setNotificationsEnabled(savedNotify);
  }, []);

  const savePhoneAndToggle = () => {
    const sanitized = phone.replace(/\D/g, "");
    if (!sanitized || sanitized.length < 7 || sanitized.length > 15) {
      alert("⚠️ Enter a valid phone number (7-15 digits).");
      return;
    }

    // Save phone and toggle state to cookies
    Cookies.set("notificationPhone", sanitized, { expires: 30 });
    const newState = !notificationsEnabled;
    setNotificationsEnabled(newState);
    Cookies.set("notificationsEnabled", newState.toString(), { expires: 30 });

    setShowSettings(false);
    alert(`📱 Global Notifications ${newState ? "enabled" : "disabled"} for ${sanitized}`);
  };

  return (
    <div className="flex justify-between items-center p-4 bg-white shadow rounded-lg mb-6 sticky top-4 z-10">
      <h1 className="text-xl font-semibold">Website Monitor</h1>

      <div className="flex items-center gap-4 relative">
        {children}

        {/* Notification Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              notificationsEnabled
                ? "bg-yellow-200 text-yellow-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {notificationsEnabled ? "Notifications ON" : "Notifications OFF"}
          </button>

          {showSettings && (
            <div className="absolute top-10 right-0 bg-white p-3 rounded shadow-lg z-50 w-56">
              <input
                type="tel"
                placeholder="Enter Mobile Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="border px-2 py-1 rounded w-full mb-2"
              />
              <button
                onClick={savePhoneAndToggle}
                className={`w-full px-2 py-1 rounded text-white ${
                  notificationsEnabled
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {notificationsEnabled ? "Disable Notifications" : "Enable Notifications"}
              </button>
            </div>
          )}
        </div>

        {/* Add Website Button */}
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
