import React, { useState } from "react";
import axios from "axios";

export default function Login({ onLogin, apiBase }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${apiBase}/login`, { username, password });
      if (res.data.success) {
        localStorage.setItem("loggedIn", "true");
        onLogin();
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("Login failed. Check server logs.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow-lg rounded-2xl p-10 w-96 flex flex-col"
      >
        <h1 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">
          Web Monitor
        </h1>

        {error && (
          <p className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm text-center">
            {error}
          </p>
        )}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 rounded-lg p-3 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 transition text-white font-semibold py-3 rounded-lg shadow-sm"
        >
          Log In
        </button>
        <p className="text-center text-gray-400 mt-6 text-sm">
          Forgot password? Try Username - admin, Password - admin.
        </p>
        <p className="text-gray-400 text-xs mt-4 text-center">
          © {new Date().getFullYear()} Web Monitor
        </p>
      </form>
    </div>
  );
}
