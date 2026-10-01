import type { Visitor } from "@/lib/types";

// What this phone is identified as (device, IP, location). Shown on the main page and on the quote
// number, so customers know quotes are traceable — discourages spam with random codes.
export default function DeviceStrip({ visitor, compact }: { visitor: Visitor; compact?: boolean }) {
  const parts = [visitor.device, `IP ${visitor.ip}`, visitor.location !== "unknown location" ? visitor.location : null].filter(Boolean);
  return (
    <div className={"device-strip" + (compact ? " compact" : "")}>
      <span aria-hidden="true">🔒</span>
      <div>
        <b>{parts.join(" · ")}</b>
        <div>Every quote is recorded with your device, IP address and location.</div>
      </div>
    </div>
  );
}
