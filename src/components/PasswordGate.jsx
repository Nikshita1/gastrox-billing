import { useState } from "react";

export default function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const HISTORY_PASSWORD = import.meta.env.VITE_HISTORY_PASSWORD || "clinic123";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === HISTORY_PASSWORD) {
      sessionStorage.setItem("historyUnlocked", "true");
      onUnlock();
      setPassword("");
      setError("");
    } else {
      setError("Incorrect password");
      setPassword("");
    }
  };

  return (
    <div className="password-gate-container">
      <div className="password-gate-box">
        <h2>🔐 Protected Area</h2>
        <p>This page is password protected. Please enter the password to continue.</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="password-input"
            autoFocus
          />
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="primary-btn">
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
