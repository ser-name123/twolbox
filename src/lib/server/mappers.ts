import "server-only";
import type { Group as DbGroup, Product as DbProduct, Quote as DbQuote } from "@/generated/client/client";
import type { Group, PriceTransition, Product, Quote, QuoteItem } from "@/lib/types";

export function toProduct(p: DbProduct): Product {
  return {
    code: String(p.code),
    groupId: p.groupId,
    name: p.name,
    price: Number(p.price),
    hsn: p.hsn,
    narration: p.narration,
    askAtCounter: p.askAtCounter,
    adminNote: p.adminNote,
    photoUrl: p.photoUrl,
    priceTransition: (p.priceTransition as PriceTransition | null) ?? null,
  };
}

// What customers get: no private notes.
export function toPublicProduct(p: DbProduct): Product {
  return { ...toProduct(p), adminNote: "" };
}

export function toGroup(g: DbGroup): Group {
  return { id: g.id, name: g.name, hsn: g.hsn };
}

export function toQuote(q: DbQuote): Quote {
  return {
    id: q.id,
    number: q.number,
    dateKey: q.dateKey,
    customerName: q.customerName,
    createdAt: q.createdAt.getTime(),
    items: q.items as QuoteItem[],
    total: Number(q.total),
    hasCounterItems: q.hasCounterItems,
  };
}
