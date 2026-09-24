import { QUOTE_VALID_MS } from "@/lib/config";
import type { Quote } from "@/lib/types";
import { formatBreakdownText, formatINR } from "@/lib/utils";
import Modal from "./Modal";

export default function QuoteResultModal({ quote, onClose }: { quote: Quote | null; onClose: () => void }) {
  if (!quote) return null;
  const expiry = new Date(quote.createdAt + QUOTE_VALID_MS);
  return (
    <Modal open>
      <div className="quote-code-display">
        <div className="lbl">YOUR QUOTE NUMBER</div>
        <div className="code">{quote.number}</div>
        <div className="expiry">Valid until {expiry.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
      </div>
      <div>
        {quote.items.map((i) => (
          <div className="qsummary-row" key={i.code}>
            <span>{i.name} x{i.qty}</span>
            <span>{i.askAtCounter ? "Ask at counter" : formatBreakdownText(i.parts)}</span>
          </div>
        ))}
      </div>
      <div className="qsummary-total">
        <span>Total</span>
        <span>{quote.hasCounterItems ? formatINR(quote.total) + " + counter items" : formatINR(quote.total)}</span>
      </div>
      {quote.hasCounterItems && (
        <div className="counter-notice" style={{ marginTop: 10 }}>
          ⚠ Confirm at counter — this quote has product(s) that need price confirmation there.
        </div>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
        Show this number at the delivery counter. Final pricing &amp; stock availability will be confirmed there.
      </p>
      <button className="btn-primary" style={{ width: "100%", marginTop: 10 }} onClick={onClose}>
        Start New Quote
      </button>
    </Modal>
  );
}
