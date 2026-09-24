import { QUOTE_VALID_MS } from "./config";
import type { Group, PricePart, Product, Quote } from "./types";

export function formatINR(n: number | null | undefined): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function findProduct(products: Product[], code: string): Product | undefined {
  const c = String(code).trim().toLowerCase();
  return products.find((p) => p.code.toLowerCase() === c);
}

export function groupName(groups: Group[], id: string | null): string {
  const g = groups.find((g) => g.id === id);
  return g ? g.name : "(no group)";
}

export function naturalCompare(a: string, b: string): number {
  const na = parseFloat(a),
    nb = parseFloat(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function formatBreakdownText(parts: PricePart[]): string {
  return parts.map((p) => (p.price === null ? `${p.qty} × Ask at Counter` : `${p.qty} × ${formatINR(p.price)}`)).join(" + ");
}

export function quoteExpiryText(q: Quote): string {
  return new Date(q.createdAt + QUOTE_VALID_MS).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Plain-text quote for WhatsApp / email.
export function quoteText(q: Quote): string {
  const lines = [
    `*Twolbox — Quote #${q.number}*`,
    `${new Date(q.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${q.customerName ? ` · ${q.customerName}` : ""}`,
    "",
    ...q.items.map(
      (i) => `${i.code} · ${i.name} × ${i.qty} — ${i.askAtCounter ? "Ask at counter" : i.hasCounterPortion ? formatBreakdownText(i.parts) : `${formatBreakdownText(i.parts)} = ${formatINR(i.lineTotal)}`}`
    ),
    "",
    `*Total: ${formatINR(q.total)}${q.hasCounterItems ? " + counter items" : ""}* (incl. GST)`,
    `Valid until ${quoteExpiryText(q)}. Final price & availability confirmed at the counter.`,
  ];
  return lines.join("\n");
}
