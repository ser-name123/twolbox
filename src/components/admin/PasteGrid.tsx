"use client";

import { useState } from "react";
import { useAdmin } from "@/lib/client/admin";

type GridRow = { name: string; price: string; hsn: string; narration: string; group: string };
const COLS: (keyof GridRow)[] = ["name", "price", "hsn", "narration", "group"];
const emptyRow = (): GridRow => ({ name: "", price: "", hsn: "", narration: "", group: "" });
const START_ROWS = 5;

// Bulk Add — paste a block straight from Excel/Google Sheets into any cell and it spreads across rows/columns.
export default function PasteGrid() {
  const admin = useAdmin();
  const groups = admin.data?.groups ?? [];
  const [rows, setRows] = useState<GridRow[]>(() => Array.from({ length: START_ROWS }, emptyRow));
  const [defaultGroupId, setDefaultGroupId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const setCell = (r: number, col: keyof GridRow, value: string) =>
    setRows((prev) => prev.map((row, i) => (i === r ? { ...row, [col]: value } : row)));

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return; // single value — let the browser handle it
    e.preventDefault();
    const block = text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    setRows((prev) => {
      const next = [...prev];
      block.forEach((cells, dr) => {
        const ri = r + dr;
        while (next.length <= ri) next.push(emptyRow());
        const row = { ...next[ri] };
        cells.forEach((val, dc) => {
          const col = COLS[c + dc];
          if (col) row[col] = val.trim();
        });
        next[ri] = row;
      });
      return next;
    });
  };

  const importAll = async () => {
    const filled = rows.filter((r) => r.name.trim());
    if (!filled.length) return alert("Nothing to import — type or paste at least one product name.");
    setBusy(true);
    const added = await admin.bulkImport(filled, defaultGroupId || groups[0]?.id || null);
    setBusy(false);
    if (added !== null) {
      setRows(Array.from({ length: START_ROWS }, emptyRow));
      alert(`${added} product(s) imported.`);
    }
  };

  return (
    <div className="card">
      <h3>Bulk Add (Excel-style — paste straight from Excel/Sheets, or type into the cells)</h3>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>
        Serial codes are generated automatically — don&apos;t type a code. Mention the group name in the Group cell and it will land in
        that group (a new group is created automatically if it doesn&apos;t exist yet). Paste a whole block copied from Excel directly into
        any cell — it will spread across rows and columns automatically. Prices are GST-inclusive.
      </div>
      <div className="grid-wrap" style={{ maxHeight: 280 }}>
        <table className="xl">
          <thead>
            <tr>
              <th style={{ minWidth: 150 }}>Name</th>
              <th style={{ width: 90 }}>Price</th>
              <th style={{ width: 80 }}>HSN</th>
              <th style={{ minWidth: 160 }}>Narration</th>
              <th style={{ width: 130 }}>Group</th>
              <th style={{ width: 34 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {COLS.map((col, c) => (
                  <td key={col} className={col === "narration" ? "col-narration" : undefined}>
                    <input value={row[col]} onChange={(e) => setCell(r, col, e.target.value)} onPaste={(e) => onPaste(e, r, c)} />
                  </td>
                ))}
                <td className="del-cell">
                  <button onClick={() => setRows(rows.length > 1 ? rows.filter((_, i) => i !== r) : [emptyRow()])}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-flex" style={{ marginTop: 8 }}>
        <button className="small-btn grey" onClick={() => setRows([...rows, emptyRow()])}>+ Add Row</button>
        <button className="small-btn grey" onClick={() => setRows(Array.from({ length: START_ROWS }, emptyRow))}>Clear Grid</button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>Default group if left blank:</span>
        <select value={defaultGroupId || groups[0]?.id || ""} onChange={(e) => setDefaultGroupId(e.target.value)}>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button className="small-btn orange" onClick={importAll} disabled={busy}>{busy ? "Importing…" : "Import All Rows"}</button>
      </div>
    </div>
  );
}
