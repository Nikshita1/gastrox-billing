import { useState } from "react";

const HISTORY_UNLOCK_KEY = "historyUnlocked";
const HISTORY_PHONE_KEY = "historyAccessPhone";
const HISTORY_OTP_KEY = "historyAccessOtp";
const HISTORY_TARGET_KEY = "historyAccessOtpTarget";
const ADMIN_PHONE = (import.meta.env.VITE_HISTORY_ADMIN_PHONE || "6280874133").replace(/\D/g, "");

const normalizePhone = (value = "") => value.replace(/\D/g, "");
const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export default function PasswordGate({ onUnlock }) {
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(HISTORY_PHONE_KEY) || ADMIN_PHONE;
  });
  const [currentPhone, setCurrentPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [mode, setMode] = useState("unlock");
  const [otpSent, setOtpSent] = useState(false);
  const [pendingTarget, setPendingTarget] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const registeredPhone =
    typeof window !== "undefined"
      ? normalizePhone(localStorage.getItem(HISTORY_PHONE_KEY) || ADMIN_PHONE)
      : ADMIN_PHONE;

  const sendOtpTo = (targetPhone) => {
    const normalizedTarget = normalizePhone(targetPhone);
    const expectedAdminPhone = normalizePhone(ADMIN_PHONE);

    if (normalizedTarget !== expectedAdminPhone) {
      setError("OTP can only be sent to the admin contact number assigned to this clinic.");
      return;
    }

    const generatedOtp = generateOtp();
    sessionStorage.setItem(HISTORY_OTP_KEY, generatedOtp);
    sessionStorage.setItem(HISTORY_TARGET_KEY, normalizedTarget);
    setPendingTarget(normalizedTarget);
    setOtp("");
    setOtpSent(true);
    setError("");
    setInfo(`OTP sent to ${normalizedTarget}. Demo code: ${generatedOtp}`);
  };

  const handleUnlockSubmit = (e) => {
    e.preventDefault();

    const normalizedPhoneValue = normalizePhone(phone);

    if (!otpSent) {
      if (!normalizedPhoneValue) {
        setError("Please enter the admin contact number.");
        return;
      }

      if (normalizedPhoneValue !== normalizePhone(ADMIN_PHONE)) {
        setError("This number is not authorized for history access.");
        return;
      }

      localStorage.setItem(HISTORY_PHONE_KEY, normalizePhone(ADMIN_PHONE));
      sendOtpTo(normalizedPhoneValue);
      return;
    }

    const actualOtp = sessionStorage.getItem(HISTORY_OTP_KEY) || "";
    if (otp.trim() !== actualOtp) {
      setError("Invalid OTP. Please check the code and try again.");
      return;
    }

    sessionStorage.setItem(HISTORY_UNLOCK_KEY, "true");
    setError("");
    setInfo("");
    onUnlock();
  };

  const handlePhoneChangeSubmit = (e) => {
    e.preventDefault();

    const safeCurrentPhone = normalizePhone(currentPhone);
    const safeNewPhone = normalizePhone(newPhone);

    if (!otpSent) {
      if (safeCurrentPhone !== normalizePhone(ADMIN_PHONE)) {
        setError("The current number must match the clinic admin owner number.");
        return;
      }

      if (!safeNewPhone || safeNewPhone.length < 10) {
        setError("Please enter a valid new contact number.");
        return;
      }

      // The admin number is fixed, so we only allow the owner to update the number if they match the official admin phone.
      sendOtpTo(ADMIN_PHONE);
      return;
    }

    const actualOtp = sessionStorage.getItem(HISTORY_OTP_KEY) || "";
    if (otp.trim() !== actualOtp) {
      setError("Invalid OTP. Please check the code and try again.");
      return;
    }

    const finalPhone = normalizePhone(ADMIN_PHONE);
    localStorage.setItem(HISTORY_PHONE_KEY, finalPhone);
    setPhone(finalPhone);
    setCurrentPhone("");
    setNewPhone("");
    setOtp("");
    setOtpSent(false);
    setPendingTarget("");
    setMode("unlock");
    setError("");
    setInfo(`Admin contact number is locked to ${finalPhone}.`);
  };

  const resetOtpState = () => {
    setOtp("");
    setOtpSent(false);
    setPendingTarget("");
    setError("");
    setInfo("");
    sessionStorage.removeItem(HISTORY_OTP_KEY);
    sessionStorage.removeItem(HISTORY_TARGET_KEY);
  };

  const switchToUnlock = () => {
    resetOtpState();
    setMode("unlock");
    setCurrentPhone("");
    setNewPhone("");
  };

  const switchToChange = () => {
    resetOtpState();
    setMode("change");
    setCurrentPhone("");
    setNewPhone("");
  };

  return (
    <div className="password-gate-container">
      <div className="password-gate-box">
        <h2>🔒 History Access</h2>
        <p>
          This history page is protected. Only the clinic admin phone can unlock it.
        </p>

        {mode === "unlock" ? (
          <form onSubmit={handleUnlockSubmit}>
            <input
              type="tel"
              placeholder="Admin contact number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="password-input"
              autoFocus
            />

            {otpSent && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="password-input"
              />
            )}

            {info && <div className="info-message">{info}</div>}
            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="primary-btn">
              {otpSent ? "Verify & Unlock" : "Send OTP"}
            </button>

            <button type="button" className="secondary-btn small-btn" onClick={switchToChange}>
              Change owner access
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneChangeSubmit}>
            <input
              type="tel"
              placeholder="Current admin number"
              value={currentPhone}
              onChange={(e) => setCurrentPhone(e.target.value)}
              className="password-input"
              autoFocus
            />

            <input
              type="tel"
              placeholder="New admin number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="password-input"
            />

            {otpSent && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="password-input"
              />
            )}

            {info && <div className="info-message">{info}</div>}
            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="primary-btn">
              {otpSent ? "Confirm Admin Update" : "Send OTP to Admin"}
            </button>

            <button type="button" className="secondary-btn small-btn" onClick={switchToUnlock}>
              Back to unlock
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
