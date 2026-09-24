import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { Role } from "@/lib/types";
import { HttpError } from "./http";

const COOKIE = "twolbox_session";
const MAX_AGE_S = 12 * 60 * 60; // one shift

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new HttpError(500, "SESSION_SECRET is not configured");
  return s;
}

function hmac(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a),
    bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

// Manager password is checked first, so a manager never gets a staff-only session.
export function roleForPassword(password: string): Role | null {
  const manager = process.env.MANAGER_PASSWORD;
  const staff = process.env.STAFF_PASSWORD;
  if (manager && safeEqual(password, manager)) return "manager";
  if (staff && safeEqual(password, staff)) return "staff";
  return null;
}

export async function setSession(role: Role) {
  const payload = Buffer.from(JSON.stringify({ role, exp: Date.now() + MAX_AGE_S * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${hmac(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getRole(): Promise<Role | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !safeEqual(sig, hmac(payload))) return null;
  try {
    const { role, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || exp < Date.now()) return null;
    return role === "manager" || role === "staff" ? role : null;
  } catch {
    return null;
  }
}

// Manager can do everything staff can.
export async function requireRole(min: Role): Promise<Role> {
  const role = await getRole();
  if (!role) throw new HttpError(401, "Please log in again.");
  if (min === "manager" && role !== "manager") throw new HttpError(403, "Manager access required.");
  return role;
}
