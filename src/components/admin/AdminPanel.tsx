"use client";

import { useState } from "react";
import { AdminDataProvider } from "@/lib/client/admin";
import type { Role } from "@/lib/types";
import PasswordModal, { type LoginError } from "../modals/PasswordModal";
import ProductsTab from "./ProductsTab";
import QuotesTab from "./QuotesTab";

type Props = {
  role: Role;
  onBack: () => void;
  onLogout: () => void;
  onUnauthorized: () => void;
  upgrade: (password: string) => Promise<LoginError | null>;
};

// Staff: Quotes only. Manager: Quotes + Products (catalog, pricing, analytics, settings).
export default function AdminPanel({ role, onBack, onLogout, onUnauthorized, upgrade }: Props) {
  const [tab, setTab] = useState<"quotes" | "products">("quotes");
  const [askManager, setAskManager] = useState(false);

  const openProducts = () => (role === "manager" ? setTab("products") : setAskManager(true));

  return (
    <div id="adminPanel">
      <div className="admin-header">
        <h2>{role === "manager" ? "Manager Panel" : "Staff Panel"}</h2>
        <div className="row-flex">
          <button className="logout-btn" onClick={onBack}>Back to Store</button>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>
      <div className="tabs">
        <button className={"tab-btn" + (tab === "quotes" ? " active" : "")} onClick={() => setTab("quotes")}>Quotes</button>
        <button className={"tab-btn" + (tab === "products" ? " active" : "")} onClick={openProducts}>
          Products{role !== "manager" ? " 🔒" : ""}
        </button>
      </div>

      {tab === "products" && role === "manager" ? (
        <AdminDataProvider onUnauthorized={onUnauthorized}>
          <ProductsTab />
        </AdminDataProvider>
      ) : (
        <QuotesTab onUnauthorized={onUnauthorized} />
      )}

      <PasswordModal
        open={askManager}
        title="Manager Access"
        description="A manager password is needed to view or edit products, prices and analytics."
        placeholder="Enter manager password"
        submitLabel="Unlock"
        onCancel={() => setAskManager(false)}
        onSubmit={async (pw) => {
          const err = await upgrade(pw);
          if (!err) {
            setAskManager(false);
            setTab("products");
          }
          return err;
        }}
      />
    </div>
  );
}
