"use client";

import { useState } from "react";
import Modal from "./Modal";

// What a failed login returns: the error, plus the security warning for wrong passwords.
export type LoginError = { error: string; warning?: string };

type Props = {
  open: boolean;
  title: string;
  description?: string;
  placeholder: string;
  submitLabel: string;
  // Returns null on success.
  onSubmit: (password: string) => Promise<LoginError | null>;
  onCancel: () => void;
};

// Used for both "Staff Login" and "Manager Access" — same layout; the server checks the password.
// Mounted only while open, so the field and error always start fresh.
export default function PasswordModal(props: Props) {
  return props.open ? <PasswordForm {...props} /> : null;
}

function PasswordForm({ title, description, placeholder, submitLabel, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<LoginError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!value || busy) return;
    setBusy(true);
    const err = await onSubmit(value);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <Modal open>
      <h2>{title}</h2>
      {description && <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: -6 }}>{description}</p>}
      <input
        type="password"
        placeholder={placeholder}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {error && <div className="err-text">{error.error}</div>}
      {error?.warning && (
        <div className="security-nudge" role="alert">
          <span aria-hidden="true">⚠</span> {error.warning}
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? "Checking…" : submitLabel}
        </button>
      </div>
    </Modal>
  );
}
