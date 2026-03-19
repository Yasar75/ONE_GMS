import React from 'react'

export function DashboardSkeleton() {
  return (
    <div className="d-flex flex-column gap-3">
      <div className="skeleton-line skeleton-line-title" />
      <div className="skeleton-line skeleton-line-copy" />

      <div className="row g-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="col-12 col-sm-6 col-xl-3" key={index}>
            <div className="skeleton-card" />
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7"><div className="skeleton-panel" /></div>
        <div className="col-12 col-lg-5"><div className="skeleton-panel" /></div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6"><div className="skeleton-panel" /></div>
        <div className="col-12 col-lg-6"><div className="skeleton-panel" /></div>
      </div>
    </div>
  )
}
