import React from "react";

export default function Sidebar() {
  return (
    <div className="w-52 bg-white p-6 shadow-md flex flex-col sticky top-0 h-screen">
      <h2 className="text-xl font-bold mb-6">WebMonitor</h2>
      <nav className="flex flex-col gap-2">
        <a href="#" className="hover:bg-gray-100 p-2 rounded">
          Dashboard
        </a>
      </nav>
    </div>
  );
}
