"use client";

import { useState } from "react";

export type Column = { label: string; value: number; tip: string };

// Single-series column chart: thin bars, 4px rounded tops on the baseline, recessive axis,
// hover/tap tooltip on every bar. Labels thin out automatically when there are many columns.
export default function ColumnChart({ title, data, height = 120, labelEvery = 1 }: { title: string; data: Column[]; height?: number; labelEvery?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <figure className="col-chart" aria-label={title}>
      <figcaption className="col-chart-title">
        {title}
        <span className="col-chart-sub">peak {max === 1 && !total ? 0 : max}</span>
      </figcaption>
      <div className="col-chart-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div
            key={d.label + i}
            className="col-chart-slot"
            onMouseEnter={() => setHover(i)}
            onClick={() => setHover(hover === i ? null : i)}
            aria-label={d.tip}
            role="img"
          >
            <div className={"col-chart-bar" + (hover === i ? " is-hover" : "")} style={{ height: d.value ? `${Math.max(3, (d.value / max) * 100)}%` : 0 }} />
            {hover === i && <div className="col-chart-tip">{d.tip}</div>}
          </div>
        ))}
      </div>
      <div className="col-chart-axis">
        {data.map((d, i) => (
          <span key={d.label + i}>{i % labelEvery === 0 ? d.label : ""}</span>
        ))}
      </div>
    </figure>
  );
}
