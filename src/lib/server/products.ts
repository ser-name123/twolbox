import "server-only";
import type { Prisma } from "@/generated/client/client";
import type { PriceTransition } from "@/lib/types";
import { HttpError } from "./http";

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

export function parsePrice(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 99999999) throw new HttpError(400, "Invalid price");
  return Math.round(n * 100) / 100;
}

// Editable product fields, validated. Only keys present in `body` are returned.
export function productPatch(body: Record<string, unknown>): Prisma.ProductUncheckedUpdateInput {
  const data: Prisma.ProductUncheckedUpdateInput = {};
  if ("name" in body) {
    const name = str(body.name, 200);
    if (!name) throw new HttpError(400, "Name cannot be empty");
    data.name = name;
  }
  if ("price" in body) data.price = parsePrice(body.price);
  if ("hsn" in body) data.hsn = str(body.hsn, 20);
  if ("narration" in body) data.narration = str(body.narration, 500);
  if ("adminNote" in body) data.adminNote = str(body.adminNote, 1000);
  if ("askAtCounter" in body) data.askAtCounter = body.askAtCounter === true;
  if ("groupId" in body) data.groupId = body.groupId ? String(body.groupId) : null;
  return data;
}

export function parseTransition(v: unknown): PriceTransition {
  const t = (v ?? {}) as Record<string, unknown>;
  const remainingQty = Math.floor(Number(t.remainingQty));
  if (!Number.isFinite(remainingQty) || remainingQty < 0) throw new HttpError(400, "Enter how many units are left at the current price.");
  if (t.nextMode === "counter") return { remainingQty, nextMode: "counter", newPrice: null, newPriceQty: null };
  if (t.nextMode !== "price") throw new HttpError(400, "Invalid price update mode");
  const newPrice = parsePrice(t.newPrice);
  const q = t.newPriceQty == null || t.newPriceQty === "" ? null : Math.floor(Number(t.newPriceQty));
  return { remainingQty, nextMode: "price", newPrice, newPriceQty: q && q > 0 ? q : null };
}
