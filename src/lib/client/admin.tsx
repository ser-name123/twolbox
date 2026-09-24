"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AdminData, PriceTransition, Product } from "@/lib/types";
import { api, resizeImage } from "./api";

type Actions = {
  data: AdminData | null;
  error: string | null;
  refresh: () => Promise<void>;
  updateProduct: (code: string, patch: Partial<Product>) => Promise<void>;
  addProduct: (groupId: string | null) => Promise<void>;
  deleteProduct: (code: string) => Promise<void>;
  uploadPhoto: (code: string, file: File) => Promise<void>;
  removePhoto: (code: string) => Promise<void>;
  setTransition: (code: string, t: PriceTransition | null) => Promise<void>;
  setAllCounter: (value: boolean) => Promise<void>;
  setOrdering: (enabled: boolean) => Promise<void>;
  addGroup: (name: string, hsn: string) => Promise<string | null>;
  updateGroup: (id: string, patch: { name?: string; hsn?: string }) => Promise<void>;
  deleteGroup: (id: string) => Promise<boolean>;
  bulkImport: (rows: Record<string, string>[], defaultGroupId: string | null) => Promise<number | null>;
};

const AdminContext = createContext<Actions | null>(null);

export function useAdmin(): Actions {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminDataProvider>");
  return ctx;
}

// Manager's catalog state. Each action calls the API, shows any error, then reloads from the server
// so the screen always reflects what's actually saved.
export function AdminDataProvider({ children, onUnauthorized }: { children: ReactNode; onUnauthorized: () => void }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api<AdminData>("/api/admin/bootstrap"));
      setError(null);
    } catch (e) {
      if ((e as { status?: number }).status === 401 || (e as { status?: number }).status === 403) onUnauthorized();
      else setError((e as Error).message);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Runs one mutation; returns its result, or null if it failed (after telling the user why).
  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        const out = await fn();
        await refresh();
        return out;
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 401) onUnauthorized();
        else alert((e as Error).message);
        await refresh();
        return null;
      }
    },
    [refresh, onUnauthorized]
  );

  const products = data?.products ?? [];
  const name = (code: string) => products.find((p) => p.code === code)?.name ?? "";

  const actions: Actions = {
    data,
    error,
    refresh,
    updateProduct: async (code, patch) => {
      await run(() => api(`/api/admin/products/${code}`, { method: "PATCH", body: patch }));
    },
    addProduct: async (groupId) => {
      await run(() => api("/api/admin/products", { body: { groupId } }));
    },
    deleteProduct: async (code) => {
      if (!confirm(`Delete code ${code} (${name(code)})? The code will become available to reuse.`)) return;
      await run(() => api(`/api/admin/products/${code}`, { method: "DELETE" }));
    },
    uploadPhoto: async (code, file) => {
      await run(async () => {
        const form = new FormData();
        form.append("photo", await resizeImage(file));
        return api(`/api/admin/products/${code}/photo`, { form });
      });
    },
    removePhoto: async (code) => {
      if (!confirm("Remove this photo?")) return;
      await run(() => api(`/api/admin/products/${code}/photo`, { method: "DELETE" }));
    },
    setTransition: async (code, transition) => {
      await run(() => api(`/api/admin/products/${code}/transition`, { method: "PUT", body: { transition } }));
    },
    setAllCounter: async (value) => {
      if (!confirm(value ? "Mark ALL products as Ask at Counter?" : "Set ALL products back to fixed price?")) return;
      await run(() => api("/api/admin/products/ask-at-counter", { body: { value } }));
    },
    setOrdering: async (orderingEnabled) => {
      await run(() => api("/api/admin/settings", { method: "PATCH", body: { orderingEnabled } }));
    },
    addGroup: async (name, hsn) => {
      const r = await run(() => api<{ group: { id: string } }>("/api/admin/groups", { body: { name, hsn } }));
      return r?.group.id ?? null;
    },
    updateGroup: async (id, patch) => {
      await run(() => api(`/api/admin/groups/${id}`, { method: "PATCH", body: patch }));
    },
    deleteGroup: async (id) => {
      const g = data?.groups.find((x) => x.id === id);
      if (!g || !confirm(`Delete group "${g.name}"?`)) return false;
      return (await run(() => api(`/api/admin/groups/${id}`, { method: "DELETE" }))) !== null;
    },
    bulkImport: async (rows, defaultGroupId) => {
      const r = await run(() => api<{ added: number }>("/api/admin/products/bulk", { body: { rows, defaultGroupId } }));
      return r?.added ?? null;
    },
  };

  return <AdminContext.Provider value={actions}>{children}</AdminContext.Provider>;
}
