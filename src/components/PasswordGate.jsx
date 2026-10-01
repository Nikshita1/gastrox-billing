import { useState } from "react";

const HISTORY_UNLOCK_KEY = "historyUnlocked";
const HISTORY_PHONE_KEY = "historyAccessPhone";
const HISTORY_OTP_KEY = "historyAccessOtp";
const HISTORY_TARGET_KEY = "historyAccessOtpTarget";

const normalizePhone = (value = "") => value.replace(/\D/g, "");

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

export default function PasswordGate({ onUnlock }) {
  const [phone, setPhone] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(HISTORY_PHONE_KEY) || "";
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
      ? normalizePhone(localStorage.getItem(HISTORY_PHONE_KEY) || "")
      : "";

  const sendOtpTo = (targetPhone) => {
    const normalizedTarget = normalizePhone(targetPhone);

    if (!normalizedTarget || normalizedTarget.length < 10) {
      setError("Please enter a valid contact number.");
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
    const protectedPhone = registeredPhone || normalizedPhoneValue;

    if (!otpSent) {
      if (registeredPhone && normalizedPhoneValue && normalizedPhoneValue !== registeredPhone) {
        setError("This contact number is not registered for the history access.");
        return;
      }

      if (!protectedPhone) {
        setError("Please enter the registered contact number.");
        return;
      }

      if (!registeredPhone) {
        localStorage.setItem(HISTORY_PHONE_KEY, protectedPhone);
      }

      sendOtpTo(protectedPhone);
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
      if (registeredPhone && safeCurrentPhone !== registeredPhone) {
        setError("The current number does not match the registered owner.");
        return;
      }

      if (!safeNewPhone || safeNewPhone.length < 10) {
        setError("Please enter a valid new contact number.");
        return;
      }

      if (!registeredPhone && !safeCurrentPhone) {
        // first-time setup for a new owner
      }

      sendOtpTo(safeNewPhone);
      return;
    }

    const actualOtp = sessionStorage.getItem(HISTORY_OTP_KEY) || "";
    if (otp.trim() !== actualOtp) {
      setError("Invalid OTP. Please check the code and try again.");
      return;
    }

    const finalPhone = pendingTarget || safeNewPhone;
    localStorage.setItem(HISTORY_PHONE_KEY, finalPhone);
    setPhone(finalPhone);
    setCurrentPhone("");
    setNewPhone("");
    setOtp("");
    setOtpSent(false);
    setPendingTarget("");
    setMode("unlock");
    setError("");
    setInfo(`Contact number updated to ${finalPhone}. You can now unlock with the new number.`);
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
          This history page is protected. Enter your registered contact number and verify the OTP to continue.
        </p>

        {mode === "unlock" ? (
          <form onSubmit={handleUnlockSubmit}>
            <input
              type="tel"
              placeholder="Registered contact number"
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
              Change contact number
            </button>
          </form>
        ) : (
          <form onSubmit={handlePhoneChangeSubmit}>
            <input
              type="tel"
              placeholder="Current registered number"
              value={currentPhone}
              onChange={(e) => setCurrentPhone(e.target.value)}
              className="password-input"
              autoFocus
            />

            <input
              type="tel"
              placeholder="New contact number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="password-input"
            />

            {otpSent && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter OTP sent to new number"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="password-input"
              />
            )}

            {info && <div className="info-message">{info}</div>}
            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="primary-btn">
              {otpSent ? "Confirm Number Change" : "Send OTP to New Number"}
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
