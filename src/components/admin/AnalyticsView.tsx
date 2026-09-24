"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Analytics, ProductStat } from "@/lib/types";
import { formatINR } from "@/lib/utils";
import ColumnChart from "./ColumnChart";

const RANGES = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "14d", label: "Last 14 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "all", label: "All Time" },
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const dayLabel = (date: string) =>
  new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export default function AnalyticsView() {
  const [range, setRange] = useState("14d");
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api<Analytics>(`/api/admin/analytics?range=${range}`)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const t = data?.totals;
  const tiles = t
    ? [
        { lbl: "Visitors", val: t.visits },
        { lbl: "Quotes Finalized", val: t.quotes },
        { lbl: "Visit → Quote", val: t.visits ? Math.round((t.quotes / t.visits) * 100) + "%" : "—" },
        { lbl: "Quote Value", val: formatINR(t.quoteValue) },
        { lbl: "Products Added", val: t.adds },
        { lbl: "Removed Again", val: t.removes },
      ]
    : [];

  return (
    <div id="analyticsView">
      <div className="group-pills">
        {RANGES.map((r) => (
          <button key={r.id} className={"group-pill" + (range === r.id ? " active" : "")} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>

      {error && <div className="warn">{error}</div>}
      {!data && !error && <p className="empty-text">Loading analytics…</p>}

      {data && (
        <div style={{ opacity: data.range === range ? 1 : 0.5 }}>
          <div className="stat-grid">
            {tiles.map((x) => (
              <div className="stat-box" key={x.lbl}>
                <div className="stat-lbl">{x.lbl}</div>
                <div className="stat-val">{x.val}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Footfall — Last 2 Weeks</h3>
            <div className="chart-pair">
              <ColumnChart
                title="Visitors per day"
                labelEvery={2}
                data={data.last14Days.map((d) => ({ label: dayLabel(d.date), value: d.visits, tip: `${dayLabel(d.date)}: ${plural(d.visits, "visitor")}` }))}
              />
              <ColumnChart
                title="Quotes per day"
                labelEvery={2}
                data={data.last14Days.map((d) => ({ label: dayLabel(d.date), value: d.quotes, tip: `${dayLabel(d.date)}: ${plural(d.quotes, "quote")}` }))}
              />
            </div>
          </div>

          <div className="card">
            <h3>Busiest Times <span className="h3-sub">({RANGES.find((r) => r.id === range)?.label})</span></h3>
            <div className="chart-pair">
              <ColumnChart
                title="Visitors by hour of day"
                labelEvery={3}
                data={data.byHour.map((h) => ({ label: hourLabel(h.hour), value: h.visits, tip: `${hourLabel(h.hour)}–${hourLabel((h.hour + 1) % 24)}: ${plural(h.visits, "visitor")}, ${plural(h.quotes, "quote")}` }))}
              />
              <ColumnChart
                title="Visitors by day of week"
                data={data.byWeekday.map((d) => ({ label: WEEKDAYS[d.day], value: d.visits, tip: `${WEEKDAYS[d.day]}: ${plural(d.visits, "visitor")}, ${plural(d.quotes, "quote")}` }))}
              />
            </div>
          </div>

          <StatTable title="Most Added Products" rows={data.topAdded} empty="No products added in this period yet." />
          <StatTable
            title="Added, Then Removed (Reconsidered)"
            rows={data.mostRemoved}
            empty="No products were removed after adding in this period."
            note="Customers added these to their list and then took them out — often a price or availability question."
          />
          <StatTable
            title="Rarely Selected"
            rows={data.rarelySelected}
            empty="No products in the catalog."
            note="Current catalog products with the fewest adds in this period."
          />
        </div>
      )}
    </div>
  );
}

function StatTable({ title, rows, empty, note }: { title: string; rows: ProductStat[]; empty: string; note?: string }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {note && <div style={{ fontSize: 12, color: "var(--muted)", margin: "-4px 0 8px" }}>{note}</div>}
      {!rows.length ? (
        <div className="empty-text">{empty}</div>
      ) : (
        <div className="grid-wrap">
          <table className="xl">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Code</th>
                <th>Name</th>
                <th style={{ width: 80 }}>Added</th>
                <th style={{ width: 90 }}>Removed</th>
                <th style={{ width: 100 }}>Units Quoted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.code}>
                  <td className="ro" style={{ fontWeight: 700 }}>{s.code}</td>
                  <td className="ro">{s.name}</td>
                  <td className="ro">{s.added}</td>
                  <td className="ro">{s.removed}</td>
                  <td className="ro">{s.quotedQty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
