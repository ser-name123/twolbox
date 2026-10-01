"use client";

import { useState } from "react";
import Modal from "./Modal";

type Row = { minQty: string; value: string };

type Props = {
  title: string;
  mode: "price" | "percent"; // product slabs set an exact price; group slabs take % off
  initial: { minQty: number; value: number }[];
  // Product only: "Don't apply the group's discount to this product".
  ignoreGroup?: { value: boolean; groupName: string | null };
  onSave: (slabs: { minQty: number; value: number }[], ignoreGroupDiscount: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
};

const lbl = { fontSize: 12.5, color: "var(--muted)" } as const;

// Quantity discount editor: "Buy [10] or more → price becomes ₹[42] each" (or "→ [5]% off" for a group).
// Parent mounts it fresh per product/group (key), so initial values come straight from props.
export default function QtyDiscountModal({ title, mode, initial, ignoreGroup, onSave, onRemove, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.length ? initial.map((s) => ({ minQty: String(s.minQty), value: String(s.value) })) : [{ minQty: "", value: "" }]
  );
  const [ignore, setIgnore] = useState(ignoreGroup?.value ?? false);
  const [error, setError] = useState<string | null>(null);

  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = () => {
    const filled = rows.filter((r) => r.minQty.trim() || r.value.trim());
    const slabs = [];
    for (const [i, r] of filled.entries()) {
      const minQty = parseInt(r.minQty, 10);
      const value = parseFloat(r.value);
      if (!Number.isInteger(minQty) || minQty < 2) return setError(`Slab ${i + 1}: quantity must be 2 or more.`);
      if (!Number.isFinite(value) || value < 0 || (mode === "percent" && (value <= 0 || value >= 100)))
        return setError(`Slab ${i + 1}: enter a valid ${mode === "price" ? "price" : "percentage (1–99)"}.`);
      slabs.push({ minQty, value });
    }
    if (new Set(slabs.map((s) => s.minQty)).size !== slabs.length) return setError("Two slabs use the same quantity.");
    onSave(slabs, ignore);
  };

  return (
    <Modal open boxStyle={{ maxWidth: 480 }}>
      <h2>{title}</h2>
      <p style={{ ...lbl, marginTop: -6 }}>
        {mode === "price" ? (
          <>
            These rules apply to this product only. Set the exact price per unit once a quantity is reached — e.g. buy 10+ and the
            price drops to ₹42 each instead of the usual price.
          </>
        ) : (
          <>
            Applies to every product in this group (except products with their own discount, or that opt out) — e.g. buy 10+ of a
            product and get 5% off its price.
          </>
        )}{" "}
        Customers see this price ladder as soon as they add the product. If several slabs qualify, the highest one applies to all units.
      </p>

      {rows.map((r, i) => (
        <div key={i} className="slab-row">
          <span style={lbl}>Buy</span>
          <input type="number" min={2} placeholder="qty" value={r.minQty} onChange={(e) => set(i, "minQty", e.target.value)} />
          <span style={lbl}>or more →</span>
          {mode === "price" ? (
            <>
              <span style={lbl}>price becomes ₹</span>
              <input type="number" step="0.01" min={0} placeholder="price each" value={r.value} onChange={(e) => set(i, "value", e.target.value)} />
              <span style={lbl}>each</span>
            </>
          ) : (
            <>
              <input type="number" step="0.5" min={1} max={99} placeholder="%" value={r.value} onChange={(e) => set(i, "value", e.target.value)} />
              <span style={lbl}>% off</span>
            </>
          )}
          <button className="small-btn red slab-del" aria-label="Remove slab" onClick={() => setRows(rows.length > 1 ? rows.filter((_, j) => j !== i) : [{ minQty: "", value: "" }])}>
            ✕
          </button>
        </div>
      ))}
      <button className="small-btn grey" style={{ marginBottom: 12 }} onClick={() => setRows([...rows, { minQty: "", value: "" }])}>
        + Add slab
      </button>

      {ignoreGroup && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12 }}>
          <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
          Don&apos;t apply the group&apos;s discount to this product{ignoreGroup.groupName ? ` (${ignoreGroup.groupName})` : ""}
        </label>
      )}

      {error && <div className="err-text" style={{ marginTop: 0 }}>{error}</div>}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
      <button className="small-btn red" style={{ width: "100%", marginTop: 8 }} onClick={onRemove}>
        Remove discount rules
      </button>
    </Modal>
  );
}
