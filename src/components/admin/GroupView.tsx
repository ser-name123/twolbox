"use client";

import { useRef, useState, type ComponentProps } from "react";
import { useAdmin } from "@/lib/client/admin";
import { slabLabel } from "@/lib/pricing";
import type { Group } from "@/lib/types";
import { naturalCompare } from "@/lib/utils";
import QtyDiscountModal from "../modals/QtyDiscountModal";
import ProductsTable from "./ProductsTable";

type TableHandlers = Omit<ComponentProps<typeof ProductsTable>, "products" | "groups">;

export default function GroupView({ tableHandlers }: { tableHandlers: TableHandlers }) {
  const admin = useAdmin();
  const groups = admin.data?.groups ?? [];
  const products = admin.data?.products ?? [];
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const [newHsn, setNewHsn] = useState("");
  const [discountOpen, setDiscountOpen] = useState(false);
  const [search, setSearch] = useState("");

  const active = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;
  const groupProducts = active ? products.filter((p) => p.groupId === active.id).sort((a, b) => naturalCompare(a.code, b.code)) : [];
  const q = search.trim().toLowerCase();
  const shown = q ? groupProducts.filter((p) => [p.code, p.name, p.hsn, p.narration, p.adminNote].some((v) => v.toLowerCase().includes(q))) : groupProducts;

  const addGroup = async () => {
    if (!newName.trim()) return;
    const id = await admin.addGroup(newName, newHsn);
    if (id) {
      setNewName("");
      setNewHsn("");
      setActiveId(id);
    }
  };

  return (
    <div id="groupView">
      <div className="card">
        <h3>Add New Group</h3>
        <div className="row-flex">
          <input type="text" placeholder="Group name (e.g. Fasteners)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input type="text" placeholder="HSN code" style={{ width: 110 }} value={newHsn} onChange={(e) => setNewHsn(e.target.value)} />
          <button className="small-btn orange" onClick={addGroup}>+ Add Group</button>
        </div>
      </div>

      <div className="group-pills">
        {groups.map((g) => (
          <button
            key={g.id}
            className={"group-pill" + (active?.id === g.id ? " active" : "")}
            onClick={() => {
              setActiveId(g.id);
              setSearch("");
            }}
          >
            {g.name} ({products.filter((p) => p.groupId === g.id).length})
          </button>
        ))}
      </div>

      {active && (
        <div>
          <GroupSettings key={active.id + active.name + active.hsn} group={active} productCount={groupProducts.length} onDeleted={() => setActiveId(null)} />
          <BulkPriceAdjust key={"adj" + active.id} group={active} productCount={groupProducts.length} />

          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Quantity Discount (whole group)</h3>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {active.qtyDiscount?.length
                  ? `${active.qtyDiscount.map(slabLabel).join(" · ")} — on every product in this group, except products with their own discount or that opt out.`
                  : "No group discount set. Individual products can still have their own."}
              </div>
            </div>
            <button className="small-btn orange" style={{ flexShrink: 0 }} onClick={() => setDiscountOpen(true)}>
              {active.qtyDiscount?.length ? "Edit Discount" : "Set Discount"}
            </button>
          </div>

          <div className="row-flex" style={{ marginBottom: 10 }}>
            <button className="small-btn" onClick={() => admin.addProduct(active.id)}>+ Add Product to this Group</button>
          </div>
          <div className="search-wrap">
            <input type="text" placeholder={`Search within ${active.name}`} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <ProductsTable products={shown} groups={groups} {...tableHandlers} />
        </div>
      )}

      {discountOpen && active && (
        <QtyDiscountModal
          key={active.id}
          title={`Group quantity discount — ${active.name}`}
          mode="percent"
          initial={(active.qtyDiscount ?? []).map((s) => ({ minQty: s.minQty, value: s.percent }))}
          onClose={() => setDiscountOpen(false)}
          onSave={async (slabs) => {
            await admin.setGroupDiscount(active.id, slabs.map((s) => ({ minQty: s.minQty, percent: s.value })));
            setDiscountOpen(false);
          }}
          onRemove={async () => {
            await admin.setGroupDiscount(active.id, []);
            setDiscountOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Name + HSN with an explicit Save, and Delete. Remounted per group (key), so the fields start fresh.
function GroupSettings({ group, productCount, onDeleted }: { group: Group; productCount: number; onDeleted: () => void }) {
  const admin = useAdmin();
  const nameRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const name = nameRef.current?.value.trim() ?? "";
    const hsn = hsnRef.current?.value.trim() ?? "";
    if (!name) return alert("Group name cannot be empty.");
    if (name !== group.name || hsn !== group.hsn) admin.updateGroup(group.id, { name, hsn });
  };

  return (
    <div className="card">
      <h3>Group Settings</h3>
      <div className="row-flex">
        <input ref={nameRef} type="text" defaultValue={group.name} placeholder="Group name" />
        <input ref={hsnRef} type="text" defaultValue={group.hsn} placeholder="HSN code" style={{ width: 110 }} />
        <button className="small-btn" onClick={save}>Save</button>
        <button
          className="small-btn red"
          onClick={async () => {
            if (productCount) return alert("This group still has products. Move or delete them first.");
            if (await admin.deleteGroup(group.id)) onDeleted();
          }}
        >
          Delete Group
        </button>
      </div>
    </div>
  );
}

// Permanently raise or lower every product price in the group by a percentage (rounded to ₹0.50).
function BulkPriceAdjust({ group, productCount }: { group: Group; productCount: number }) {
  const admin = useAdmin();
  const [percent, setPercent] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async (direction: "increase" | "decrease") => {
    const p = parseFloat(percent);
    if (!Number.isFinite(p) || p <= 0) return alert("Enter a percentage, e.g. 5");
    if (direction === "decrease" && p >= 100) return alert("A decrease must be less than 100%.");
    if (!productCount) return alert("This group has no products.");
    const msg =
      `${direction === "increase" ? "Increase" : "Decrease"} the price of all ${productCount} product(s) in "${group.name}" by ${p}%?\n\n` +
      "New prices are rounded to the nearest ₹0.50. This changes the saved prices (it's recorded in Change Log → Pricing).";
    if (!confirm(msg)) return;
    setBusy(true);
    const updated = await admin.adjustGroupPrices(group.id, p, direction);
    setBusy(false);
    if (updated !== null) {
      setPercent("");
      alert(`${updated} price(s) ${direction === "increase" ? "increased" : "decreased"} by ${p}%.`);
    }
  };

  return (
    <div className="card">
      <h3>Bulk % Price Adjustment (this group)</h3>
      <div className="row-flex">
        <input type="number" min={0} step="0.5" placeholder="e.g. 5" style={{ width: 110 }} value={percent} onChange={(e) => setPercent(e.target.value)} />
        <button className="small-btn orange" disabled={busy} onClick={() => apply("increase")}>Increase %</button>
        <button className="small-btn blue" disabled={busy} onClick={() => apply("decrease")}>Decrease %</button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Applies to all {productCount} product(s) · rounded to nearest ₹0.50</span>
      </div>
    </div>
  );
}
