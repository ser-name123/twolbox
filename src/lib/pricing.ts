import type { Group, PricePart, Product } from "./types";
import { formatINR, groupName } from "./utils";

export type Breakdown = { parts: PricePart[]; lineTotal: number; hasCounterPortion: boolean };

// Splits a requested quantity across whichever price stages it crosses, without changing stored data —
// used for live display while the customer is still browsing.
export function computeBreakdown(prod: Product, qty: number): Breakdown {
  if (qty <= 0) return { parts: [], lineTotal: 0, hasCounterPortion: false };
  if (prod.askAtCounter) return { parts: [{ qty, price: null }], lineTotal: 0, hasCounterPortion: true };
  const t = prod.priceTransition;
  if (!t) return { parts: [{ qty, price: prod.price }], lineTotal: prod.price * qty, hasCounterPortion: false };

  let remaining = qty;
  const parts: PricePart[] = [];
  const atCurrent = Math.min(remaining, Math.max(0, t.remainingQty));
  if (atCurrent > 0) {
    parts.push({ qty: atCurrent, price: prod.price });
    remaining -= atCurrent;
  }
  if (remaining > 0) {
    if (t.nextMode === "counter") {
      parts.push({ qty: remaining, price: null });
    } else if (t.newPriceQty) {
      const atNew = Math.min(remaining, t.newPriceQty);
      if (atNew > 0) {
        parts.push({ qty: atNew, price: t.newPrice });
        remaining -= atNew;
      }
      // new price's own stock also ran out — falls back to counter
      if (remaining > 0) parts.push({ qty: remaining, price: null });
    } else {
      parts.push({ qty: remaining, price: t.newPrice });
    }
  }
  const lineTotal = parts.reduce((s, p) => s + (p.price === null ? 0 : p.qty * p.price), 0);
  return { parts, lineTotal, hasCounterPortion: parts.some((p) => p.price === null) };
}

// Called at Finalize time with the FINAL quantity ordered: consumes units from whichever price stage(s)
// they fall into and advances the product's state once a stage runs out — including falling through to
// Ask at Counter. Returns an updated copy plus the change-log messages to record.
export function consumeAndAdvance(prodIn: Product, qty: number): { product: Product; logs: string[] } {
  const prod: Product = { ...prodIn, priceTransition: prodIn.priceTransition ? { ...prodIn.priceTransition } : null };
  const logs: string[] = [];
  if (!prod.priceTransition || qty <= 0 || prod.askAtCounter) return { product: prod, logs };
  const t = prod.priceTransition;
  const label = `Code ${prod.code} (${prod.name})`;
  let remaining = qty;
  const usedAtCurrent = Math.min(remaining, t.remainingQty);
  t.remainingQty -= usedAtCurrent;
  remaining -= usedAtCurrent;

  if (t.remainingQty > 0) {
    logs.push(`${label}: ${usedAtCurrent} unit(s) consumed at current price (₹${prod.price.toFixed(2)}) — ${t.remainingQty} left before it changes`);
    return { product: prod, logs };
  }

  const oldPrice = prod.price;
  if (t.nextMode === "counter") {
    prod.askAtCounter = true;
    prod.priceTransition = null;
    logs.push(`${label}: current-price stock used up — now set to Ask at Counter`);
    return { product: prod, logs };
  }

  const newPrice = t.newPrice ?? prod.price;
  if (!t.newPriceQty) {
    prod.price = newPrice;
    prod.priceTransition = null;
    logs.push(`${label}: price permanently updated to ₹${newPrice.toFixed(2)} (was ₹${oldPrice.toFixed(2)})`);
    return { product: prod, logs };
  }

  const usedAtNew = Math.min(remaining, t.newPriceQty);
  const newPriceRemaining = t.newPriceQty - usedAtNew;
  prod.price = newPrice;
  if (newPriceRemaining > 0) {
    prod.priceTransition = { remainingQty: newPriceRemaining, nextMode: "counter", newPrice: null, newPriceQty: null };
    logs.push(`${label}: price now ₹${newPrice.toFixed(2)} — ${newPriceRemaining} unit(s) left at this price before it switches to Ask at Counter`);
  } else {
    prod.askAtCounter = true;
    prod.priceTransition = null;
    logs.push(`${label}: price ₹${newPrice.toFixed(2)} stock also used up — now set to Ask at Counter`);
  }
  return { product: prod, logs };
}

const FIELD_LABELS: Partial<Record<keyof Product, string>> = {
  name: "Name",
  groupId: "Group",
  price: "Price",
  hsn: "HSN",
  narration: "Narration",
  askAtCounter: "Ask at Counter",
  adminNote: "Private Note",
};

// Returns a change-log line describing what changed, or null if nothing did.
export function diffProduct(groups: Group[], before: Product, after: Product): string | null {
  const changes: string[] = [];
  (Object.keys(FIELD_LABELS) as (keyof Product)[]).forEach((f) => {
    let bv: unknown = before[f],
      av: unknown = after[f];
    if (f === "groupId") {
      bv = groupName(groups, before.groupId);
      av = groupName(groups, after.groupId);
    }
    if (f === "askAtCounter") {
      bv = bv ? "Yes" : "No";
      av = av ? "Yes" : "No";
    }
    if (f === "price") {
      bv = formatINR(before.price);
      av = formatINR(after.price);
    }
    if (String(bv) !== String(av)) changes.push(`${FIELD_LABELS[f]}: "${bv}" → "${av}"`);
  });
  return changes.length ? `Code ${after.code} (${after.name}): ${changes.join("; ")}` : null;
}
