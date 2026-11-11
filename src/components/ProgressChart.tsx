import { useState } from 'react'
import { fmtShortDate, fmtWeight } from '../format'

export interface Point {
  date: number
  value: number
}

/** Schlichtes Liniendiagramm als SVG. Antippen zeigt den Wert. */
export function ProgressChart({ points, unit }: { points: Point[]; unit: string }) {
  const [sel, setSel] = useState<number | null>(null)
  if (points.length === 0) return <p className="muted center">Noch keine Daten.</p>

  const W = 340
  const H = 170
  const pad = { l: 36, r: 12, t: 14, b: 22 }
  const values = points.map((p) => p.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) {
    min -= 5
    max += 5
  }
  const span = max - min
  min = Math.max(0, min - span * 0.1)
  max = max + span * 0.1
  const t0 = points[0].date
  const t1 = points[points.length - 1].date
  const x = (d: number) => (t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((d - t0) / (t1 - t0)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)

  const ticks = [min, (min + max) / 2, max]
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const active = sel !== null ? points[sel] : points[points.length - 1]

  function onPointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i
    })
    setSel(best)
  }

  return (
    <div className="chart">
      <div className="chart-readout">
        <span className="chart-value">
          {fmtWeight(Math.round(active.value * 10) / 10)} {unit}
        </span>
        <span className="muted small">{fmtShortDate(active.date)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onPointerDown={onPointer} onPointerMove={(e) => e.buttons && onPointer(e)} role="img" aria-label="Verlauf">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="chart-axis">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <text x={pad.l} y={H - 4} className="chart-axis">
          {fmtShortDate(t0)}
        </text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="chart-axis">
          {fmtShortDate(t1)}
        </text>
        <path d={path} className="chart-line" />
        {points.length <= 60 && points.map((p, i) => <circle key={i} cx={x(p.date)} cy={y(p.value)} r={2.5} className="chart-dot" />)}
        <line x1={x(active.date)} x2={x(active.date)} y1={pad.t} y2={H - pad.b} className="chart-cursor" />
        <circle cx={x(active.date)} cy={y(active.value)} r={5} className="chart-dot-active" />
      </svg>
    </div>
  )
}
