import React from 'react'

function SkeletonBlock({ className = '' }) {
  return <div className={'skeleton-block ' + className} />
}

export default function PageContentLoader({ cards = 4 }) {
  return (
    <div className="d-flex flex-column gap-3 page-content-loader">
      <div className="page-header-animated">
        <SkeletonBlock className="skeleton-title" />
        <SkeletonBlock className="skeleton-subtitle" />
      </div>

      <div className="row g-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div className="col-12 col-sm-6 col-xl-3" key={index}>
            <div className="card border-0 shadow-sm h-100 content-reveal" style={{ animationDelay: `${index * 70}ms` }}>
              <div className="card-body d-flex flex-column gap-2">
                <SkeletonBlock className="skeleton-line short" />
                <SkeletonBlock className="skeleton-kpi" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <div className="card border-0 shadow-sm content-reveal" style={{ animationDelay: '120ms' }}>
            <div className="card-body p-4">
              <SkeletonBlock className="skeleton-line medium mb-4" />
              <SkeletonBlock className="skeleton-chart" />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm content-reveal" style={{ animationDelay: '180ms' }}>
            <div className="card-body p-4">
              <SkeletonBlock className="skeleton-line medium mb-4" />
              <SkeletonBlock className="skeleton-chart small" />
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm content-reveal" style={{ animationDelay: '240ms' }}>
        <div className="card-body p-4 d-flex flex-column gap-3">
          <SkeletonBlock className="skeleton-line medium" />
          <SkeletonBlock className="skeleton-row" />
          <SkeletonBlock className="skeleton-row" />
          <SkeletonBlock className="skeleton-row" />
        </div>
      </div>
    </div>
  )
}
