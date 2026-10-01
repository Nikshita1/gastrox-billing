import { useEffect, useState } from "react";
import PasswordGate from "./PasswordGate";

export default function ProtectedRoute({ component: Component, ...props }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    setIsUnlocked(sessionStorage.getItem("historyUnlocked") === "true");
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  if (!isUnlocked) {
    return <PasswordGate onUnlock={handleUnlock} />;
  }

  return <Component {...props} />;
}
