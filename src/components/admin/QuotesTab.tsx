"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { usePrint } from "@/lib/client/print";
import { QUOTE_VALID_MS, QUOTES_REFRESH_MS } from "@/lib/config";
import { downloadQuotePdf, quoteHtml } from "@/lib/printTemplates";
import type { Quote } from "@/lib/types";
import { formatBreakdownText, formatINR, quoteText } from "@/lib/utils";

export default function QuotesTab({ onUnauthorized }: { onUnauthorized: () => void }) {
  const printHtml = usePrint();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ quotes: Quote[] }>("/api/quotes");
      setQuotes(r.quotes);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onUnauthorized();
      else setError((e as Error).message);
    }
    setNow(Date.now());
  }, [onUnauthorized]);

  // New quotes show up automatically; valid/expired status stays current.
  useEffect(() => {
    load();
    const t = setInterval(load, QUOTES_REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const q = search.trim().toLowerCase();
  const list = (quotes ?? []).filter((x) => !q || String(x.number).includes(q) || x.customerName.toLowerCase().includes(q));

  const clearExpired = async () => {
    if (!confirm("Clear all expired quotes from this list?")) return;
    try {
      await api("/api/quotes/clear-expired", { method: "POST" });
    } catch (e) {
      alert((e as Error).message);
    }
    load();
  };

  const del = async (quote: Quote) => {
    if (!confirm(`Remove quote #${quote.number} from the list?`)) return;
    try {
      await api(`/api/quotes/${quote.id}`, { method: "DELETE" });
    } catch (e) {
      alert((e as Error).message);
    }
    load();
  };

  const copy = async (quote: Quote) => {
    try {
      await navigator.clipboard.writeText(quoteText(quote));
      setCopiedId(quote.id);
      setTimeout(() => setCopiedId((c) => (c === quote.id ? null : c)), 1500);
    } catch {
      prompt("Copy this text:", quoteText(quote));
    }
  };

  return (
    <div id="quotesTab">
      <div className="row-flex" style={{ marginBottom: 12 }}>
        <input type="text" placeholder="Search by number or name" style={{ flex: 1 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="small-btn grey" onClick={load}>Refresh</button>
        <button className="small-btn grey" onClick={clearExpired}>Clear Expired</button>
      </div>
      {error && <div className="warn">{error}</div>}
      <div id="quotesList">
        {quotes === null && !error && <p className="empty-text">Loading quotes…</p>}
        {quotes !== null && !list.length && <p className="empty-text">No quotes yet today.</p>}
        {list.map((quote) => {
          const valid = now - quote.createdAt < QUOTE_VALID_MS;
          const created = new Date(quote.createdAt);
          const text = encodeURIComponent(quoteText(quote));
          return (
            <div className="quote-card" key={quote.id}>
              <div className="qc-top">
                <div>
                  <div className="qc-number">#{quote.number}</div>
                  <div className="qc-meta">
                    {created.toLocaleDateString("en-IN")} · {created.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {quote.customerName && <div className="qc-name">{quote.customerName}</div>}
                  {quote.device && (
                    <div className="qc-meta" title={`IP ${quote.ip}`}>
                      📱 {quote.device} · {quote.location !== "unknown location" ? quote.location : `IP ${quote.ip}`}
                    </div>
                  )}
                </div>
                <span className={valid ? "status-valid" : "status-expired"} style={{ fontSize: 11.5 }}>
                  {valid ? "VALID" : "EXPIRED"}
                </span>
              </div>
              <div className="qc-items">
                {quote.items.map((i) => (
                  <div className="qc-item-row" key={i.code}>
                    <span>
                      {i.code} · {i.name} x{i.qty}
                      {i.discount && <span className="qc-discount"> · {i.discount}</span>}
                    </span>
                    <span>{i.askAtCounter ? "Counter" : i.hasCounterPortion ? formatBreakdownText(i.parts) : formatINR(i.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="qc-total">
                <span>Total</span>
                <span>{formatINR(quote.total)}{quote.hasCounterItems ? " +" : ""}</span>
              </div>
              {quote.hasCounterItems && <div className="qc-meta" style={{ color: "var(--accent-dark)", marginTop: 2 }}>Has counter-priced items</div>}
              <div className="qc-actions">
                <button className="small-btn grey" onClick={() => printHtml(quoteHtml(quote))}>Print</button>
                <button className="small-btn" onClick={() => downloadQuotePdf(quote)}>PDF</button>
                <button className="small-btn grey" onClick={() => copy(quote)}>{copiedId === quote.id ? "Copied ✓" : "Copy Text"}</button>
              </div>
              <div className="qc-actions" style={{ marginTop: 6 }}>
                <a className="small-btn grey qc-link" href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                <a className="small-btn grey qc-link" href={`mailto:?subject=${encodeURIComponent(`Twolbox Quote #${quote.number}`)}&body=${text}`}>Email</a>
                <button className="small-btn red" onClick={() => del(quote)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
