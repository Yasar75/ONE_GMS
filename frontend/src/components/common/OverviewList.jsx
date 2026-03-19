import React from 'react'

export default function OverviewList({ items = [], compact = false }) {
  return (
    <div className={'overview-grid' + (compact ? ' compact' : '')}>
      {items.map((item) => (
        <div className="overview-item" key={item.label}>
          <div className="overview-label">{item.label}</div>
          <div className="overview-value">{item.value || '—'}</div>
        </div>
      ))}
    </div>
  )
}
