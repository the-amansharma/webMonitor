import React, { useState } from "react";

export default function Topbar({ onAddClick, notifyDelay, setNotifyDelay, children }) {
  const [showDelayInput, setShowDelayInput] = useState(false);
  const [tempDelay, setTempDelay] = useState(notifyDelay);

  const saveDelay = () => {
    setNotifyDelay(tempDelay);
    setShowDelayInput(false);
  };

  return (
    <div className="flex justify-between items-center p-4 bg-white shadow rounded-lg mb-6">
      <h1 className="text-xl font-semibold">Website Monitor</h1>

      <div className="flex items-center gap-4 relative">
        {children}

        {/* Notification Delay Button */}
        <div className="relative">
          <button
            onClick={() => setShowDelayInput(!showDelayInput)}
            className="px-3 py-1 rounded bg-yellow-100 text-yellow-800 text-sm"
          >
            Notify Delay: {notifyDelay} min
          </button>

          {showDelayInput && (
            <div className="absolute top-10 right-0 bg-white p-3 rounded shadow-lg z-50">
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
