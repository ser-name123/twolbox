import { QUOTE_VALID_MS } from "./config";
import type { Group, Product, Quote } from "./types";
import { escapeHtml, formatBreakdownText, formatINR, groupName, naturalCompare } from "./utils";

const tableStyle = "width:100%; border-collapse:collapse; font-size:12px; font-family:Arial,sans-serif;";
const th = "border:1px solid #999; padding:6px; text-align:left; background:#eee;";
const td = "border:1px solid #999; padding:6px;";

// Absolute URL so both window.print() and html2pdf can load the logo.
const logoHtml = () => `<img src="${window.location.origin}/logo.png" alt="Twolbox" style="height:40px; border-radius:6px; margin-bottom:4px;">`;

export function quoteHtml(q: Quote): string {
  const created = new Date(q.createdAt);
  const expiry = new Date(q.createdAt + QUOTE_VALID_MS);
  const rows = q.items
    .map(
      (i) => `<tr>
        <td style="${td}">${escapeHtml(i.code)}</td>
        <td style="${td}">${escapeHtml(i.name)}</td>
        <td style="${td}">${i.qty}</td>
        <td style="${td}">${escapeHtml(i.askAtCounter ? "Ask at counter" : formatBreakdownText(i.parts))}</td>
        <td style="${td} text-align:right;">${i.askAtCounter ? "—" : formatINR(i.lineTotal)}</td>
      </tr>`
    )
    .join("");
  return `
  <div style="font-family:Arial,sans-serif; color:#1a2332; padding:10px;">
    ${logoHtml()}
    <div style="font-size:11px; letter-spacing:2px; color:#6b7280; margin-bottom:14px;">QUOTATION</div>
    <div style="font-size:14px; margin-bottom:4px;"><b>Quote No:</b> ${q.number}</div>
    <div style="font-size:12px; margin-bottom:4px;"><b>Date:</b> ${created.toLocaleString("en-IN")}</div>
    ${q.customerName ? `<div style="font-size:12px; margin-bottom:4px;"><b>Customer:</b> ${escapeHtml(q.customerName)}</div>` : ""}
    <div style="font-size:12px; margin-bottom:12px;"><b>Valid until:</b> ${expiry.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
    <table style="${tableStyle}">
      <thead><tr><th style="${th}">Code</th><th style="${th}">Item</th><th style="${th}">Qty</th><th style="${th}">Rate</th><th style="${th} text-align:right;">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right; font-size:15px; font-weight:800; margin-top:10px;">
      Total: ${formatINR(q.total)}${q.hasCounterItems ? " + counter items" : ""}
    </div>
    <p style="font-size:11px; color:#6b7280; margin-top:14px;">All prices are inclusive of GST. Final price and product availability will be confirmed at the delivery counter. This quotation is valid for 1 hour from the time of finalization.</p>
  </div>`;
}

export function catalogHtml(products: Product[], groups: Group[]): string {
  const rows = [...products]
    .sort((a, b) => naturalCompare(a.code, b.code))
    .map(
      (p) => `<tr>
        <td style="${td}">${escapeHtml(p.code)}</td>
        <td style="${td}">${escapeHtml(p.name)}${p.narration ? `<div style="font-size:10px; color:#666; font-style:italic;">${escapeHtml(p.narration)}</div>` : ""}</td>
        <td style="${td}">${escapeHtml(groupName(groups, p.groupId))}</td>
        <td style="${td}">${escapeHtml(p.hsn)}</td>
        <td style="${td} text-align:right;">${p.askAtCounter ? "Ask at Counter" : formatINR(p.price)}</td>
      </tr>`
    )
    .join("");
  return `
  <div style="font-family:Arial,sans-serif; color:#1a2332;">
    ${logoHtml()}
    <div style="font-size:11px; letter-spacing:2px; color:#6b7280; margin-bottom:14px;">PRODUCT CATALOG · ${new Date().toLocaleDateString("en-IN")}</div>
    <table style="${tableStyle}">
      <thead><tr><th style="${th}">Code</th><th style="${th}">Name</th><th style="${th}">Group</th><th style="${th}">HSN</th><th style="${th} text-align:right;">Price (incl. GST)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

export async function downloadQuotePdf(q: Quote): Promise<void> {
  const html2pdf = (await import("html2pdf.js")).default;
  await html2pdf()
    .set({ margin: 10, filename: `quote-${q.dateKey}-${q.number}.pdf`, jsPDF: { unit: "mm", format: "a4" } })
    .from(quoteHtml(q))
    .save();
}
