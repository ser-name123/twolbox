"use client";

import { useState, type ComponentProps } from "react";
import { useAdmin } from "@/lib/client/admin";
import { naturalCompare } from "@/lib/utils";
import ProductsTable from "./ProductsTable";

type TableHandlers = Omit<ComponentProps<typeof ProductsTable>, "products" | "groups">;

export default function GroupView({ tableHandlers }: { tableHandlers: TableHandlers }) {
  const admin = useAdmin();
  const groups = admin.data?.groups ?? [];
  const products = admin.data?.products ?? [];
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null);
  const [newName, setNewName] = useState("");
  const [newHsn, setNewHsn] = useState("");

  const active = groups.find((g) => g.id === activeId) ?? groups[0] ?? null;
  const groupProducts = active ? products.filter((p) => p.groupId === active.id).sort((a, b) => naturalCompare(a.code, b.code)) : [];

  const addGroup = async () => {
    if (!newName.trim()) return;
    const id = await admin.addGroup(newName, newHsn);
    if (id) {
      setNewName("");
      setNewHsn("");
      setActiveId(id);
    }
  };

  const updateGroup = (field: "name" | "hsn", value: string) => {
    if (active && active[field] !== value.trim()) admin.updateGroup(active.id, { [field]: value });
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
          <button key={g.id} className={"group-pill" + (active?.id === g.id ? " active" : "")} onClick={() => setActiveId(g.id)}>
            {g.name} ({products.filter((p) => p.groupId === g.id).length})
          </button>
        ))}
      </div>

      {active && (
        <div>
          <div className="card">
            <h3>{active.name}</h3>
            <div className="row-flex">
              <input key={"n" + active.id + active.name} type="text" defaultValue={active.name} placeholder="Group name" onBlur={(e) => updateGroup("name", e.target.value)} />
              <input key={"h" + active.id + active.hsn} type="text" defaultValue={active.hsn} placeholder="HSN code" style={{ width: 110 }} onBlur={(e) => updateGroup("hsn", e.target.value)} />
              <button className="small-btn" onClick={() => admin.addProduct(active.id)}>+ Add Product to this Group</button>
              <button
                className="small-btn red"
                onClick={async () => {
                  if (groupProducts.length) return alert("This group still has products. Move or delete them first.");
                  if (await admin.deleteGroup(active.id)) setActiveId(null);
                }}
              >
                Delete Group
              </button>
            </div>
          </div>
          <ProductsTable products={groupProducts} groups={groups} {...tableHandlers} />
        </div>
      )}
    </div>
  );
}
