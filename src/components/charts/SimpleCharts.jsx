// Dependency-free SVG charts for the KPI visualization tab.
// Deliberately minimal: flat fills, no animation libraries, colors passed in
// by the caller so semantics stay with the data, not the chart.
// Colors are CSS values (theme tokens), so they are applied via style, not SVG attributes.

import { chartColor } from '../../constants/chartColors'

export function HBarChart({ items = [], unit = '', height = 30 }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-40 flex-none truncate text-right text-xs font-medium text-fg-secondary" title={item.label}>
            {item.label}
          </span>
          <div className="h-[18px] flex-1 overflow-hidden rounded-full bg-raised" style={{ height }}>
            <div
              className="flex h-full items-center justify-end rounded-full pr-2 transition-all"
              style={{
                width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%`,
                background: item.color || chartColor(1),
                minWidth: item.value > 0 ? '2rem' : 0,
                height,
              }}
            >
              {item.value > 0 ? (
                <span className="text-[11px] font-semibold text-bg">{item.value}{unit}</span>
              ) : null}
            </div>
          </div>
          <span className="w-14 flex-none text-xs tabular-nums text-fg-muted">{item.hint || ''}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendChart({ labels = [], series = [], height = 200 }) {
  const width = 640
  const padX = 34
  const padY = 18
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const max = Math.max(1, ...series.flatMap((line) => line.points))
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : innerW

  const toXY = (value, index) => [
    padX + index * stepX,
    padY + innerH - (value / max) * innerH,
  ]

  return (
    <svg viewBox={`0 0 ${width} ${height + 22}`} className="w-full" role="img" aria-label="Trend chart">
      {[0, 0.5, 1].map((fraction) => (
        <line
          key={fraction}
          x1={padX}
          x2={width - padX}
          y1={padY + innerH * fraction}
          y2={padY + innerH * fraction}
          style={{ stroke: 'rgb(var(--line))' }}
          strokeWidth="1"
        />
      ))}
      {[0, 0.5, 1].map((fraction) => (
        <text key={`t${fraction}`} x={padX - 6} y={padY + innerH * fraction + 4} textAnchor="end" fontSize="10" style={{ fill: 'rgb(var(--fg-muted))' }}>
          {Math.round(max * (1 - fraction))}
        </text>
      ))}
      {series.map((line) => {
        const pts = line.points.map((value, index) => toXY(value, index))
        const path = pts.map(([x, y]) => `${x},${y}`).join(' ')
        return (
          <g key={line.label}>
            {line.fill ? (
              <polygon
                points={`${padX},${padY + innerH} ${path} ${padX + (line.points.length - 1) * stepX},${padY + innerH}`}
                style={{ fill: line.color }}
                opacity="0.12"
              />
            ) : null}
            <polyline
              points={path}
              fill="none"
              style={{ stroke: line.color }}
              strokeWidth="2"
              strokeDasharray={line.dashed ? '5 3' : 'none'}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {pts.map(([x, y], index) => (
              <circle key={index} cx={x} cy={y} r={line.dashed ? 3 : 0} style={{ fill: line.color }} />
            ))}
          </g>
        )
      })}
      {labels.map((label, index) => (
        <text key={label + index} x={padX + index * stepX} y={height + 14} textAnchor="middle" fontSize="10" style={{ fill: 'rgb(var(--fg-muted))' }}>
          {label}
        </text>
      ))}
    </svg>
  )
}

export function ColumnChart({ items = [], height = 170 }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div className="flex items-end justify-around gap-3" style={{ height }}>
      {items.map((item) => (
        <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-sm font-semibold tabular-nums text-fg">{item.value}</span>
          <div
            className="w-full max-w-[64px] rounded-t-control"
            style={{ height: `${Math.max((item.value / max) * 75, item.value > 0 ? 4 : 1)}%`, background: item.color }}
          />
          <span className="text-center text-[11px] leading-tight text-fg-muted">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function ChartLegend({ entries = [] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-fg-secondary">
      {entries.map((entry) => (
        <span key={entry.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: entry.color }} />
          {entry.label}
        </span>
      ))}
    </div>
  )
}
