import React, { useState, useEffect } from "react";

export default function Topbar({ onAddClick, notifyDelay, setNotifyDelay, children }) {
  const [showDelayInput, setShowDelayInput] = useState(false);
  const [tempDelay, setTempDelay] = useState(notifyDelay);
  const [email, setEmail] = useState("");

  // Load email from localStorage on mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("notificationEmail") || "";
    setEmail(storedEmail);
  }, []);

  // Save delay to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("notifyDelay", notifyDelay);
  }, [notifyDelay]);

  const saveDelay = () => {
    setNotifyDelay(tempDelay);
    setShowDelayInput(false);
  };

  const saveEmail = () => {
    localStorage.setItem("notificationEmail", email);
    alert("Notification email saved!");
  };

  return (
    <div className="flex justify-between items-center p-4 bg-white shadow rounded-lg mb-6">
      <h1 className="text-xl font-semibold">Website Monitor</h1>

      <div className="flex items-center gap-4 relative">
        {children}

        {/* Notification Delay & Email Button */}
        <div className="relative">
          <button
            onClick={() => setShowDelayInput(!showDelayInput)}
            className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-sm"
          >
            Notify Delay: {notifyDelay} min
          </button>

          {showDelayInput && (
            <div className="absolute top-10 right-0 bg-white p-3 rounded shadow-lg z-50 w-56">
              {/* Delay Input */}
              <div className="flex items-center mb-2">
                <input
                  type="number"
                  min={1}
                  value={tempDelay}
                  onChange={(e) => setTempDelay(Number(e.target.value))}
                  className="border px-2 py-1 rounded w-20"
                />
                <span className="ml-1">min</span>
                <button
                  onClick={saveDelay}
                  className="ml-2 px-2 py-1 bg-green-600 text-white rounded"
                >
                  Save
                </button>
              </div>

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
