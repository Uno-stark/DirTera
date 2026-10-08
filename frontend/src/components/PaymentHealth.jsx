import { useEffect, useState } from "react";
import api from "../api/client";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

function PaymentHealth() {
  // null = checking, true = online, false = offline
  const [online, setOnline] = useState(null);

  const check = async () => {
    try {
      const { data } = await api.get("/api/v1/payments/health", {
        timeout: 10_000,
      });
      const allUp =
        data.ok &&
        data.components?.every((c) => c.status === "operational");
      setOnline(allUp);
    } catch {
      setOnline(false);
    }
  };

  useEffect(() => {
    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const color =
    online === null ? "#d1d5db" : online ? "#22c55e" : "#ef4444";

  const label =
    online === null
      ? "Checking payment service..."
      : online
        ? "Payment service online"
        : "Payment service unavailable";

  return (
    <span
      aria-label={label}
      title={label}
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: color,
        flexShrink: 0,
      }}
    />
  );
}

export default PaymentHealth;
