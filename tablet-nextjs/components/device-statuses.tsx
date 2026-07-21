"use client";

import { useTabletContext } from "../contexts/tablet-context";

function statusClass(online: boolean | null) {
  if (online === null) return "unknown";
  return online ? "" : "offline";
}

function statusLabel(online: boolean | null) {
  if (online === null) return "checking";
  return online ? "online" : "offline";
}

export function DeviceStatuses() {
  const { connectionState, hardwareOnline, displayOnline } =
    useTabletContext();
  const tabletOnline = connectionState === "connected";

  return (
    <div className="device-statuses" aria-label="Device statuses">
      <div className={`connection-pill ${tabletOnline ? "" : "offline"}`}>
        <i />
        Tablet {tabletOnline ? "online" : "offline"}
      </div>
      <div className={`connection-pill ${statusClass(hardwareOnline)}`}>
        <i />
        Hardware {statusLabel(hardwareOnline)}
      </div>
      <div className={`connection-pill ${statusClass(displayOnline)}`}>
        <i />
        Display {statusLabel(displayOnline)}
      </div>
    </div>
  );
}
