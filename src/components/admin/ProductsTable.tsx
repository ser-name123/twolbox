"use client";

import { useRef } from "react";
import type { Group, Product } from "@/lib/types";

type Handlers = {
  onUpdate: (code: string, patch: Partial<Product>) => void;
  onDelete: (code: string) => void;
  onPhotoUpload: (code: string, file: File) => void;
  onPhotoView: (code: string) => void;
  onPhotoRemove: (code: string) => void;
  onTiers: (code: string) => void;
  onDiscount: (code: string) => void;
};

const miniBtn = { padding: "5px 8px", fontSize: 11 } as const;

// Excel-like editable grid. Cells are uncontrolled and commit on blur, keyed on the saved value
// so an external change (another save, a finalize) refreshes the cell.
export default function ProductsTable({ products, groups, ...h }: { products: Product[]; groups: Group[] } & Handlers) {
  return (
    <div className="grid-wrap">
      <table className="xl">
        <thead>
          <tr>
            <th style={{ width: 60 }}>Code</th>
            <th style={{ minWidth: 160 }}>Name</th>
            <th style={{ width: 150 }}>Group</th>
            <th style={{ width: 90 }}>Price (₹)</th>
            <th style={{ width: 80 }}>HSN</th>
            <th style={{ minWidth: 180 }}>Narration</th>
            <th style={{ width: 70 }}>Ask at Counter</th>
            <th style={{ minWidth: 160 }}>Private Note (you only)</th>
            <th style={{ width: 110 }}>Photo</th>
            <th style={{ width: 130 }}>Price Update</th>
            <th style={{ width: 100 }}>Qty Discount</th>
            <th style={{ width: 34 }}></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <Row key={p.code} p={p} groups={groups} {...h} />
          ))}
          {!products.length && (
            <tr>
              <td colSpan={12} className="ro empty-text">No products found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Row({ p, groups, onUpdate, onDelete, onPhotoUpload, onPhotoView, onPhotoRemove, onTiers, onDiscount }: { p: Product; groups: Group[] } & Handlers) {
  const own = p.qtyDiscount?.length ?? 0;
  const groupHas = !own && !p.ignoreGroupDiscount && !!groups.find((g) => g.id === p.groupId)?.qtyDiscount?.length;
  const fileRef = useRef<HTMLInputElement>(null);
  const text = (field: "name" | "hsn" | "narration" | "adminNote") => ({

    defaultValue: p[field],
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      if (e.target.value !== p[field]) onUpdate(p.code, { [field]: e.target.value });
    },
  });

  return (
    <tr>
      <td className="ro" style={{ fontWeight: 700 }}>{p.code}</td>
      <td><input key={"name" + p.name} {...text("name")} /></td>
      <td>
        <select value={p.groupId ?? ""} onChange={(e) => onUpdate(p.code, { groupId: e.target.value || null })}>
          {!p.groupId && <option value="">(no group)</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          key={"price" + p.price}
          type="number"
          step="0.01"
          defaultValue={p.price}
          onBlur={(e) => {
            const v = parseFloat(e.target.value) || 0;
            if (v !== p.price) onUpdate(p.code, { price: v });
          }}
        />
      </td>
      <td><input key={"hsn" + p.hsn} {...text("hsn")} /></td>
      <td className="col-narration"><input key={"narration" + p.narration} {...text("narration")} /></td>
      <td>
        <select value={p.askAtCounter ? "yes" : "no"} onChange={(e) => onUpdate(p.code, { askAtCounter: e.target.value === "yes" })}>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </td>
      <td><input key={"adminNote" + p.adminNote} {...text("adminNote")} /></td>
      <td style={{ padding: 4 }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPhotoUpload(p.code, f);
            e.target.value = "";
          }}
        />
        <button className="small-btn grey" style={miniBtn} onClick={() => fileRef.current?.click()}>
          {p.photoUrl ? "Change" : "Add"}
        </button>
        {p.photoUrl && (
          <>
            <button className="small-btn grey" style={{ ...miniBtn, marginTop: 3 }} onClick={() => onPhotoView(p.code)}>View</button>
            <button className="small-btn red" style={{ ...miniBtn, marginTop: 3 }} onClick={() => onPhotoRemove(p.code)}>✕</button>
          </>
        )}
      </td>
      <td style={{ padding: 4 }}>
        <button className={"small-btn " + (p.priceTransition ? "orange" : "grey")} style={miniBtn} onClick={() => onTiers(p.code)}>
          {p.priceTransition ? `Change pending (${p.priceTransition.remainingQty} left)` : "Flat Price"}
        </button>
      </td>
      <td style={{ padding: 4 }}>
        <button className={"small-btn " + (own ? "orange" : "grey")} style={miniBtn} onClick={() => onDiscount(p.code)}>
          {own ? `Own (${own})` : groupHas ? "Group" : "None"}
        </button>
      </td>
      <td className="del-cell">
        <button title="Delete" onClick={() => onDelete(p.code)}>✕</button>
      </td>
    </tr>
  );
}
