import React from 'react'

export default function KpiCard({ label, value, tone }) {
  const toneClass = tone ? ` kpi-${tone}` : ''
  return (
    <div className={'card border-0 shadow-sm kpi-card' + toneClass}>
      <div className="card-body">
        <div className="text-muted small">{label}</div>
        <div className="fs-4 fw-bold">{value}</div>
      </div>
    </div>
  )
}
