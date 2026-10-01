import { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../firebase";

export default function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleUnlockSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user?.email) {
      setError("Please sign in again before opening history.");
      return;
    }

    setIsVerifying(true);
    setError("");
    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      onUnlock();
    } catch (authError) {
      if (["auth/invalid-credential", "auth/wrong-password", "auth/invalid-login-credentials"].includes(authError.code)) {
        setError("Incorrect password. Please try again.");
      } else if (authError.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait and try again later.");
      } else {
        setError("Could not verify your password. Please try again.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="password-gate-container">
      <div className="password-gate-box">
        <h2>History Access</h2>
        <p>Enter your account password to continue.</p>
        <form onSubmit={handleUnlockSubmit}>
          <input
            type="password"
            placeholder="Account password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="password-input"
            autoComplete="current-password"
            autoFocus
            required
            disabled={isVerifying}
          />

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary-btn" disabled={isVerifying}>
            {isVerifying ? "Verifying..." : "Verify & Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
