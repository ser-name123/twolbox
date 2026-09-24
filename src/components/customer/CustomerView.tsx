"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, track } from "@/lib/client/api";
import { computeBreakdown } from "@/lib/pricing";
import type { CartLine, Catalog, Product, Quote } from "@/lib/types";
import { findProduct, formatINR } from "@/lib/utils";
import PhotoModal, { type PhotoView } from "../modals/PhotoModal";
import QuoteResultModal from "../modals/QuoteResultModal";
import CartItem from "./CartItem";

const CATALOG_REFRESH_MS = 60000; // pick up price/stock changes while the page stays open

export default function CustomerView() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [code, setCode] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [resultQuote, setResultQuote] = useState<Quote | null>(null);
  const [photo, setPhoto] = useState<PhotoView>(null);
  const [busy, setBusy] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalog(await api<Catalog>("/api/catalog"));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    const t = setInterval(loadCatalog, CATALOG_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadCatalog]);

  // One visit per browser session (footfall), not per reload.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("twolbox_visit")) return;
      sessionStorage.setItem("twolbox_visit", "1");
    } catch {
      /* private mode — still count it */
    }
    track("visit");
  }, []);

  const products: Product[] = catalog?.products ?? [];

  const addByCode = () => {
    const c = code.trim();
    if (!c || !catalog) return; // still loading — don't claim "not found" on a slow connection
    const prod = findProduct(products, c);
    if (!prod) {
      setNotFound(true);
      codeInputRef.current?.select();
      return;
    }
    setNotFound(false);
    if (!cart.find((l) => l.code === prod.code)) {
      setCart([{ code: prod.code, qty: 1 }, ...cart]);
      track("add", prod.code);
    }
    setCode("");
    codeInputRef.current?.focus();
  };

  const setQty = (c: string, qty: number) => setCart(cart.map((l) => (l.code === c ? { ...l, qty } : l)));
  const remove = (c: string) => {
    setCart(cart.filter((l) => l.code !== c));
    track("remove", c);
  };

  let total = 0;
  let hasCounterItems = false;
  let totalQty = 0;
  const lines = cart.flatMap((line) => {
    const prod = findProduct(products, line.code);
    return prod ? [{ line, prod }] : [];
  });
  lines.forEach(({ line, prod }) => {
    totalQty += line.qty;
    const bd = computeBreakdown(prod, line.qty);
    if (!prod.askAtCounter) total += bd.lineTotal;
    if (bd.hasCounterPortion && line.qty > 0) hasCounterItems = true;
  });

  // The server recalculates every price from the latest data — the browser only sends codes + quantities.
  const finalize = async () => {
    const items = cart.filter((c) => c.qty > 0);
    if (!items.length || busy) return;
    setBusy(true);
    try {
      const r = await api<{ quote: Quote }>("/api/quotes", { body: { customerName, items } });
      setResultQuote(r.quote);
      setCart([]);
      setCustomerName("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
      loadCatalog(); // stock-pricing stages may have advanced
    }
  };

  const paused = catalog !== null && !catalog.orderingEnabled;

  return (
    <>
      <main id="customerView">
        {loadError && !catalog && (
          <div className="warn" style={{ textAlign: "center" }}>
            {loadError}{" "}
            <button className="small-btn grey" style={{ marginLeft: 6 }} onClick={loadCatalog}>Retry</button>
          </div>
        )}
        {paused ? (
          <div className="warn" style={{ textAlign: "center", padding: "20px 14px", fontSize: 14 }}>
            Product search is temporarily paused. Please check with our staff.
          </div>
        ) : (
          <div>
            <div className="name-box">
              <span className="lbl">Your name (optional)</span>
              <input placeholder="e.g. Rajesh" autoComplete="off" maxLength={80} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="search-box">
              <input
                ref={codeInputRef}
                placeholder={catalog ? "Enter product code e.g. 1001, 1002" : "Loading products…"}
                inputMode="numeric"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addByCode()}
              />
              <button onClick={addByCode} disabled={!catalog}>Add</button>
            </div>
            {notFound && <div className="warn">Product code not found. Please check the number on the display.</div>}
            <div>
              {lines.map(({ line, prod }) => (
                <CartItem
                  key={prod.code}
                  product={prod}
                  qty={line.qty}
                  onQty={(q) => setQty(line.code, q)}
                  onRemove={() => remove(line.code)}
                  onPhoto={() => prod.photoUrl && setPhoto({ title: prod.name, src: prod.photoUrl })}
                />
              ))}
            </div>
          </div>
        )}
        <div className="notice">
          <b>Note:</b> All prices shown are inclusive of GST. Final price and product availability will be confirmed at the delivery counter.
          This quotation is valid for <b>1 hour</b> only from the time of finalization.
        </div>
      </main>

      {cart.length > 0 && !paused && (
        <div className="cart-summary">
          {hasCounterItems && (
            <div className="counter-notice">⚠ Confirm at counter — your list has product(s) that need price confirmation there.</div>
          )}
          <div className="cart-summary-row">
            <div>
              <div className="total-label">Total (incl. GST)</div>
              <div className="total-amt">{formatINR(total)}</div>
            </div>
            <button className="finalize-btn" disabled={totalQty <= 0 || busy} onClick={finalize}>
              {busy ? "Please wait…" : "Finalize Quote"}
            </button>
          </div>
        </div>
      )}

      <QuoteResultModal quote={resultQuote} onClose={() => setResultQuote(null)} />
      <PhotoModal photo={photo} onClose={() => setPhoto(null)} />
    </>
  );
}
