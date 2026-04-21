import React, { useEffect, useState } from 'react'

function SkeletonBlock({ className = '' }) {
  return <div className={'skeleton-block ' + className} />
}

export default function PageContentLoader({ cards = 4, slowDelayMs = 2200, showSlowLoader = true }) {
  const [showSlowState, setShowSlowState] = useState(false)

  useEffect(() => {
    if (!showSlowLoader) {
      setShowSlowState(false)
      return undefined
    }

    const timerId = window.setTimeout(() => setShowSlowState(true), Math.max(900, Number(slowDelayMs) || 2200))
    return () => window.clearTimeout(timerId)
  }, [showSlowLoader, slowDelayMs])

  return (
    <div className="d-flex flex-column gap-3 page-content-loader">
      <div className="page-content-loader__header content-reveal">
        <div className="page-header-animated">
          <SkeletonBlock className="skeleton-title" />
          <SkeletonBlock className="skeleton-subtitle" />
        </div>
        <div className="page-content-loader__actions">
          <SkeletonBlock className="skeleton-chip" />
          <SkeletonBlock className="skeleton-chip skeleton-chip--accent" />
        </div>
      </div>

      <div className="page-content-loader__tabs content-reveal" style={{ animationDelay: '50ms' }}>
        <SkeletonBlock className="skeleton-tab skeleton-tab--active" />
        <SkeletonBlock className="skeleton-tab" />
        <SkeletonBlock className="skeleton-tab" />
      </div>

      <div className="row g-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div className="col-12 col-sm-6 col-xl-3" key={index}>
            <div className="card border-0 shadow-sm h-100 content-reveal" style={{ animationDelay: `${index * 70}ms` }}>
              <div className="card-body d-flex flex-column gap-2">
                <SkeletonBlock className="skeleton-line short mb-1" />
                <SkeletonBlock className="skeleton-kpi" />
                <SkeletonBlock className="skeleton-line short" />
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
              <SkeletonBlock className="skeleton-control-row mb-3" />
              <SkeletonBlock className="skeleton-chart" />
            </div>
          </div>
        </div>
        <div className="col-12 col-lg-5">
          <div className="card border-0 shadow-sm content-reveal" style={{ animationDelay: '180ms' }}>
            <div className="card-body p-4">
              <SkeletonBlock className="skeleton-line medium mb-4" />
              <SkeletonBlock className="skeleton-chart small" />
              <SkeletonBlock className="skeleton-line short mt-3" />
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm content-reveal page-content-loader__table-card" style={{ animationDelay: '240ms' }}>
        <div className="card-body p-4 d-flex flex-column gap-3">
          <div className="page-content-loader__table-head">
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBlock key={`head-${index}`} className="skeleton-table-head-cell" />
            ))}
          </div>
          <div className="page-content-loader__table-body">
            {Array.from({ length: 5 }).map((_, index) => (
              <SkeletonBlock key={`row-${index}`} className="skeleton-row" />
            ))}
          </div>
        </div>
      </div>

      {showSlowLoader && showSlowState ? (
        <div className="page-content-loader__slow-state content-reveal" style={{ animationDelay: '300ms' }}>
          <div className="global-loader-spinner mb-2"><span /><span /></div>
          <div className="fw-semibold">Fetching live data…</div>
          <div className="text-muted small">Still loading your workspace layout from the API.</div>
        </div>
      ) : null}
    </div>
  )
}
