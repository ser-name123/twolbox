"use client";

import { useState } from "react";
import type { PriceTransition, Product } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import Modal from "./Modal";

const lbl = { fontSize: 12, color: "var(--muted)" } as const;

type Props = {
  product: Product | null;
  onSave: (t: PriceTransition) => void;
  onClear: () => void;
  onClose: () => void;
};

// Inventory Price Update: old stock about to run out at the current price.
export default function TiersModal({ product, onSave, onClear, onClose }: Props) {
  // Parent remounts this modal (key) per product, so initial values come straight from it.
  const t = product?.priceTransition;
  const [remainingQty, setRemainingQty] = useState(t ? String(t.remainingQty) : "");
  const [mode, setMode] = useState<"price" | "counter">(t?.nextMode ?? "price");
  const [newPrice, setNewPrice] = useState(t?.newPrice != null ? String(t.newPrice) : "");
  const [newPriceQty, setNewPriceQty] = useState(t?.newPriceQty != null ? String(t.newPriceQty) : "");

  if (!product) return null;

  const save = () => {
    const rq = parseInt(remainingQty, 10);
    if (isNaN(rq) || rq < 0) return alert("Enter how many units are left at the current price.");
    if (mode === "price") {
      const np = parseFloat(newPrice);
      if (isNaN(np) || np < 0) return alert("Enter the new price per unit.");
      const nq = parseInt(newPriceQty, 10);
      onSave({ remainingQty: rq, nextMode: "price", newPrice: np, newPriceQty: isNaN(nq) || nq <= 0 ? null : nq });
    } else {
      onSave({ remainingQty: rq, nextMode: "counter", newPrice: null, newPriceQty: null });
    }
  };

  return (
    <Modal open>
      <h2>Price Update — Code {product.code}</h2>
      <p style={{ ...lbl, marginTop: -6 }}>
        For old stock that&apos;s about to run out at the current price. Set how many units are left at the current price, then choose
        what happens once that runs out. The change applies automatically, using each customer&apos;s final quantity when they finalize.
      </p>

      <div style={{ ...lbl, margin: "10px 0 4px" }}>Current price</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{formatINR(product.price)}</div>

      <div style={{ ...lbl, marginBottom: 4 }}>Units left at current price</div>
      <input type="number" placeholder="e.g. 10" min={0} value={remainingQty} onChange={(e) => setRemainingQty(e.target.value)} />

      <div style={{ ...lbl, margin: "10px 0 6px" }}>Once that runs out —</div>
      <div className="row-flex" style={{ marginBottom: 10 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="radio" name="tierNextMode" checked={mode === "price"} onChange={() => setMode("price")} /> Switch to a new price
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="radio" name="tierNextMode" checked={mode === "counter"} onChange={() => setMode("counter")} /> Ask at Counter
        </label>
      </div>

      {mode === "price" && (
        <div>
          <div style={{ ...lbl, marginBottom: 4 }}>New price per unit (₹)</div>
          <input type="number" step="0.01" placeholder="e.g. 12.00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          <div style={{ ...lbl, margin: "10px 0 4px" }}>Units at this new price (optional — leave blank if it doesn&apos;t expire)</div>
          <input type="number" placeholder="leave blank = stays at this price" value={newPriceQty} onChange={(e) => setNewPriceQty(e.target.value)} />
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            If you give a quantity here, once that also runs out it will automatically switch to Ask at Counter.
          </div>
        </div>
      )}

      <div className="modal-actions" style={{ marginTop: 14 }}>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save}>Save</button>
      </div>
      <button className="small-btn red" style={{ width: "100%", marginTop: 8 }} onClick={onClear}>
        Cancel Pending Price Update
      </button>
    </Modal>
  );
}
