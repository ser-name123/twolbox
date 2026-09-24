import { computeBreakdown } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { formatBreakdownText, formatINR } from "@/lib/utils";

type Props = {
  product: Product;
  qty: number;
  onQty: (qty: number) => void;
  onRemove: () => void;
  onPhoto: () => void;
};

export default function CartItem({ product: prod, qty, onQty, onRemove, onPhoto }: Props) {
  const bd = computeBreakdown(prod, qty);
  const isFullyCounter = prod.askAtCounter;
  const priceLabel = isFullyCounter ? "Price: Ask at Counter" : formatINR(prod.price) + " / unit";

  let splitNote = null;
  if (!isFullyCounter && prod.priceTransition) {
    const t = prod.priceTransition;
    if (bd.parts.length > 1) {
      // the quantity crosses into a later price stage — show the exact breakdown
      splitNote = (
        <div className="ci-narration" style={{ color: "var(--accent-dark)" }}>
          {formatBreakdownText(bd.parts)} (price update applies)
        </div>
      );
    } else {
      const nextDesc = t.nextMode === "counter" ? "then Ask at Counter" : `then ₹${(t.newPrice ?? 0).toFixed(2)}`;
      splitNote = <div className="ci-narration">Only {t.remainingQty} left at this price, {nextDesc}</div>;
    }
  }

  const lineDisplay =
    qty <= 0
      ? ""
      : bd.hasCounterPortion
        ? bd.lineTotal > 0
          ? `${formatINR(bd.lineTotal)} + confirm rest at counter`
          : "Confirm at counter"
        : formatINR(bd.lineTotal);

  const commit = (raw: string) => {
    const val = parseInt(raw, 10);
    onQty(isNaN(val) || val < 0 ? 0 : val);
  };

  return (
    <div className="cart-item">
      {prod.photoUrl && (
        <button className="ci-thumb" onClick={onPhoto} aria-label={`View photo of ${prod.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Blob/data URL, already resized on upload */}
          <img src={prod.photoUrl} alt="" loading="lazy" />
        </button>
      )}
      <div className="ci-info">
        <div className="ci-code">CODE {prod.code}</div>
        <div className="ci-name">{prod.name}</div>
        {prod.narration && <div className="ci-narration">{prod.narration}</div>}
        <div className={"ci-price" + (isFullyCounter ? " counter-tag" : "")}>{priceLabel}</div>
        {splitNote}
        <div className="ci-linetotal">{lineDisplay}</div>
      </div>
      <div className="ci-controls">
        <button className="qty-btn" onClick={() => onQty(Math.max(0, qty - 1))}>−</button>
        {/* uncontrolled + keyed on qty so typing isn't interrupted; commits on change (blur/enter) like the original */}
        <input
          key={qty}
          type="number"
          className="qty-input"
          defaultValue={qty}
          min={0}
          inputMode="numeric"
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
        />
        <button className="qty-btn" onClick={() => onQty(qty + 1)}>+</button>
      </div>
      <button className="ci-remove" onClick={onRemove}>Remove</button>
    </div>
  );
}
