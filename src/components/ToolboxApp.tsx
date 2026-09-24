"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client/api";
import { PrintProvider } from "@/lib/client/print";
import type { Role } from "@/lib/types";
import AdminPanel from "./admin/AdminPanel";
import CustomerView from "./customer/CustomerView";
import PasswordModal, { type LoginError } from "./modals/PasswordModal";

export default function ToolboxApp() {
  return (
    <PrintProvider>
      <Shell />
    </PrintProvider>
  );
}

function Shell() {
  const [role, setRole] = useState<Role | null>(null);
  const [inPanel, setInPanel] = useState(false);
  const [askLogin, setAskLogin] = useState(false);

  // Resume an existing staff/manager session (cookie) without asking again.
  useEffect(() => {
    api<{ role: Role | null }>("/api/auth/session")
      .then((r) => setRole(r.role))
      .catch(() => {});
  }, []);

  const login = async (password: string, requireManager = false): Promise<LoginError | null> => {
    try {
      const r = await api<{ role: Role }>("/api/auth/login", { body: { password, requireManager } });
      setRole(r.role);
      return null;
    } catch (e) {
      const warning = e instanceof ApiError && typeof e.data.warning === "string" ? e.data.warning : undefined;
      return { error: (e as Error).message, warning };
    }
  };

  const openPanel = () => (role ? setInPanel(true) : setAskLogin(true));

  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setRole(null);
    setInPanel(false);
  }, []);

  // Session expired mid-use → back to the store with the login closed.
  const onUnauthorized = useCallback(() => {
    setRole(null);
    setInPanel(false);
    alert("Your session has expired. Please log in again.");
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <Image src="/logo.png" alt="Twolbox" width={118} height={36} priority className="brand-logo" />
          <span>QUOTE MAKER</span>
        </div>
        {!inPanel && (
          <button className="admin-btn" onClick={openPanel}>
            {role ? (role === "manager" ? "Manager" : "Staff") : "Staff Login"}
          </button>
        )}
      </header>

      {inPanel && role ? (
        <AdminPanel
          role={role}
          onBack={() => setInPanel(false)}
          onLogout={logout}
          onUnauthorized={onUnauthorized}
          upgrade={(pw) => login(pw, true)}
        />
      ) : (
        <CustomerView />
      )}

      <PasswordModal
        open={askLogin}
        title="Staff Login"
        description="Staff and manager passwords both work here."
        placeholder="Enter password"
        submitLabel="Login"
        onCancel={() => setAskLogin(false)}
        onSubmit={async (pw) => {
          const err = await login(pw);
          if (!err) {
            setAskLogin(false);
            setInPanel(true);
          }
          return err;
        }}
      />
    </>
  );
}
