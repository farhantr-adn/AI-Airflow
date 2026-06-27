import React from "react";
import { CheckCircle, XCircle, Circle, CircleNotch } from "@phosphor-icons/react";

export function StatusBadge({ status }) {
  const map = {
    success: { cls: "badge-success", label: "success", icon: CheckCircle },
    failed: { cls: "badge-error", label: "failed", icon: XCircle },
    running: { cls: "badge-running", label: "running", icon: CircleNotch },
    pending: { cls: "badge-pending", label: "pending", icon: Circle },
    queued: { cls: "badge-pending", label: "queued", icon: Circle },
    live: { cls: "badge-success", label: "live", icon: CheckCircle },
    rolled_back: { cls: "badge-warning", label: "rolled back", icon: Circle },
  };
  const c = map[status] || { cls: "badge-pending", label: status || "—", icon: Circle };
  const Icon = c.icon;
  return (
    <span className={`badge ${c.cls}`}>
      <Icon size={10} weight={status === "running" ? "regular" : "fill"} className={status === "running" ? "animate-spin" : ""} />
      {c.label}
    </span>
  );
}
