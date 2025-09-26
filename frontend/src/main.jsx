import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";  // ✅ correct import
import App from "./App";
import Login from "./Login";
import "./index.css";  // ✅ important!


const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api"; // ✅ no trailing slash

function Root() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    console.log("🔄 Checking localStorage for login...");
    if (localStorage.getItem("loggedIn") === "true") {
      console.log("✅ User already logged in");
      setLoggedIn(true);
    } else {
      console.log("❌ Not logged in, showing Login page");
    }
  }, []);

  return loggedIn ? (
    <App apiBase={apiBase} />
  ) : (
    <Login
      onLogin={() => {
        console.log("🎉 Login successful, switching to App");
        setLoggedIn(true);
      }}
      apiBase={apiBase}
    />
  );
}

console.log("🚀 Rendering Root component...");
createRoot(document.getElementById("root")).render(<Root />);
