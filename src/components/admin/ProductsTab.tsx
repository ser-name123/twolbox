"use client";

import { useState } from "react";
import { useAdmin } from "@/lib/client/admin";
import { usePrint } from "@/lib/client/print";
import { catalogHtml } from "@/lib/printTemplates";
import { groupName, naturalCompare } from "@/lib/utils";
import LogModal from "../modals/LogModal";
import PhotoModal, { type PhotoView } from "../modals/PhotoModal";
import QtyDiscountModal from "../modals/QtyDiscountModal";
import TiersModal from "../modals/TiersModal";
import AnalyticsView from "./AnalyticsView";
import GroupView from "./GroupView";
import PasteGrid from "./PasteGrid";
import ProductsTable from "./ProductsTable";

type Subtab = "serial" | "group" | "analytics";

export default function ProductsTab() {
  const admin = useAdmin();
  const printHtml = usePrint();
  const [subtab, setSubtab] = useState<Subtab>("serial");
  const [search, setSearch] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [photo, setPhoto] = useState<PhotoView>(null);
  const [tiersCode, setTiersCode] = useState<string | null>(null);
  const [discountCode, setDiscountCode] = useState<string | null>(null);

  const { data } = admin;
  if (!data) {
    return admin.error ? (
      <div className="warn">
        {admin.error} <button className="small-btn grey" onClick={admin.refresh}>Retry</button>
      </div>
    ) : (
      <p className="empty-text">Loading products…</p>
    );
  }
  const { products, groups, settings, idleCodes, nextCode } = data;

  const q = search.trim().toLowerCase();
  const sorted = [...products].sort((a, b) => naturalCompare(a.code, b.code));
  const filtered = q
    ? sorted.filter((p) =>
        [p.code, p.name, p.hsn, p.narration, p.adminNote, groupName(groups, p.groupId)].some((v) => String(v).toLowerCase().includes(q))
      )
    : sorted;

  const tableHandlers = {
    onUpdate: admin.updateProduct,
    onDelete: admin.deleteProduct,
    onPhotoUpload: admin.uploadPhoto,
    onPhotoView: (code: string) => {
      const p = products.find((x) => x.code === code);
      if (p?.photoUrl) setPhoto({ title: `Code ${code} — ${p.name}`, src: p.photoUrl });
    },
    onPhotoRemove: admin.removePhoto,
    onTiers: setTiersCode,
    onDiscount: setDiscountCode,
  };

  const tiersProduct = tiersCode ? (products.find((p) => p.code === tiersCode) ?? null) : null;
  const discountProduct = discountCode ? (products.find((p) => p.code === discountCode) ?? null) : null;

  return (
    <div id="productsTab">
      <div className="subtabs">
        <button className={"subtab-btn" + (subtab === "serial" ? " active" : "")} onClick={() => setSubtab("serial")}>
          All Products (Serial No. wise)
        </button>
        <button className={"subtab-btn" + (subtab === "group" ? " active" : "")} onClick={() => setSubtab("group")}>
          By Group
        </button>
        <button className={"subtab-btn" + (subtab === "analytics" ? " active" : "")} onClick={() => setSubtab("analytics")}>
          Analytics
        </button>
        <button className="subtab-btn" style={{ marginLeft: "auto" }} onClick={() => setLogOpen(true)}>
          Change Log
        </button>
      </div>

      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h3 style={{ margin: "0 0 4px" }}>Customer Product Search</h3>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            {settings.orderingEnabled
              ? "ON — customers can search product codes and make quotes."
              : "OFF — customers see a “temporarily paused” message (stock counting, price update, closing)."}
          </div>
        </div>
        <button
          className={"power-btn " + (settings.orderingEnabled ? "on" : "off")}
          title="Turn the customer product code search on/off"
          aria-label={settings.orderingEnabled ? "Turn customer search off" : "Turn customer search on"}
          onClick={() => admin.setOrdering(!settings.orderingEnabled)}
        >
          ⏻
        </button>
      </div>

      <div className="card" style={{ fontSize: 12.5, color: "var(--muted)" }}>
        {idleCodes.length ? (
          <>
            <b>Available codes to reuse:</b> {idleCodes.join(", ")} &nbsp;·&nbsp; next new product will get code <b>{nextCode}</b>.
          </>
        ) : (
          <>
            No deleted/idle codes right now. Next new product will get code <b>{nextCode}</b>.
          </>
        )}
      </div>

      {subtab === "serial" && (
        <div id="serialView">
          <PasteGrid />
          <div className="row-flex" style={{ marginBottom: 10 }}>
            <button className="small-btn" onClick={() => admin.addProduct(groups[0]?.id ?? null)}>+ Add Single Product</button>
            <button className="small-btn grey" onClick={() => printHtml(catalogHtml(products, groups))}>Print Full Catalog</button>
          </div>
          <div className="row-flex" style={{ marginBottom: 10 }}>
            <button className="small-btn orange" onClick={() => admin.setAllCounter(true)}>Mark ALL as Ask at Counter</button>
            <button className="small-btn grey" onClick={() => admin.setAllCounter(false)}>Clear ALL (Back to Fixed Price)</button>
          </div>
          <div className="search-wrap">
            <input
              type="text"
              placeholder="Search by code, name, HSN, narration, note or group..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <ProductsTable products={filtered} groups={groups} {...tableHandlers} />
        </div>
      )}

      {subtab === "group" && <GroupView tableHandlers={tableHandlers} />}
      {subtab === "analytics" && <AnalyticsView />}

      <LogModal open={logOpen} onClose={() => setLogOpen(false)} />
      <PhotoModal photo={photo} onClose={() => setPhoto(null)} />
      {discountProduct && (
        <QtyDiscountModal
          key={discountProduct.code}
          title={`Quantity discount — ${discountProduct.name} (Code ${discountProduct.code})`}
          mode="price"
          initial={(discountProduct.qtyDiscount ?? []).map((s) => ({ minQty: s.minQty, value: s.price }))}
          ignoreGroup={{
            value: discountProduct.ignoreGroupDiscount,
            groupName: groups.find((g) => g.id === discountProduct.groupId)?.name ?? null,
          }}
          onClose={() => setDiscountCode(null)}
          onSave={async (slabs, ignore) => {
            await admin.setProductDiscount(discountProduct.code, slabs.map((s) => ({ minQty: s.minQty, price: s.value })), ignore);
            setDiscountCode(null);
          }}
          onRemove={async () => {
            await admin.setProductDiscount(discountProduct.code, [], false);
            setDiscountCode(null);
          }}
        />
      )}
      <TiersModal
        key={tiersCode ?? "none"}
        product={tiersProduct}
        onClose={() => setTiersCode(null)}
        onSave={async (t) => {
          if (tiersCode) await admin.setTransition(tiersCode, t);
          setTiersCode(null);
        }}
        onClear={async () => {
          if (tiersCode && tiersProduct?.priceTransition) await admin.setTransition(tiersCode, null);
          setTiersCode(null);
        }}
      />
    </div>
  );
}
