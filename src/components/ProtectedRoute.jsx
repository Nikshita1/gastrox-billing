import { useEffect, useState } from "react";
import PasswordGate from "./PasswordGate";

export default function ProtectedRoute({ component: Component, ...props }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    // Check if already unlocked in this session
    if (sessionStorage.getItem("historyUnlocked") === "true") {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  if (!isUnlocked) {
    return <PasswordGate onUnlock={handleUnlock} />;
  }

  return <Component {...props} />;
}
