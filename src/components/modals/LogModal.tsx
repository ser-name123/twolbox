"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { LogEntry } from "@/lib/types";
import Modal from "./Modal";

const FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "price_change", label: "Pricing" },
  { id: "edit", label: "Edits" },
  { id: "add", label: "Added" },
  { id: "delete", label: "Removed" },
  { id: "bulk", label: "Bulk" },
  { id: "group", label: "Groups" },
  { id: "settings", label: "Settings" },
];

const ACTOR_LABEL: Record<string, string> = { manager: "Manager", staff: "Staff", customer: "Auto (customer quote)", system: "System" };

// Change history: what changed, when, and by whom. The "Pricing" filter is the price history.
export default function LogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLogs(null);
    api<{ logs: LogEntry[] }>(`/api/admin/logs${filter ? `?action=${filter}` : ""}`)
      .then((r) => !cancelled && (setLogs(r.logs), setError(null)))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [open, filter]);

  return (
    <Modal open={open} boxStyle={{ maxWidth: 560 }}>
      <h2>Change History</h2>
      <div className="group-pills" style={{ marginBottom: 8 }}>
        {FILTERS.map((f) => (
          <button key={f.id} className={"group-pill" + (filter === f.id ? " active" : "")} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, maxHeight: "60vh", overflowY: "auto" }}>
        {error && <p className="err-text" style={{ marginTop: 0 }}>{error}</p>}
        {!error && logs === null && <p style={{ color: "var(--muted)" }}>Loading…</p>}
        {logs && !logs.length && <p style={{ color: "var(--muted)" }}>No changes recorded yet.</p>}
        {logs?.map((l) => (
          <div key={l.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ color: "var(--muted)", fontSize: 11 }}>
              {new Date(l.ts).toLocaleString("en-IN")} · {ACTOR_LABEL[l.actor] ?? l.actor}
            </div>
            <div>{l.details}</div>
          </div>
        ))}
      </div>
      <button className="btn-secondary" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}
