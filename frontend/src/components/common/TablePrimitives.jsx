import React from 'react'
import SearchHighlight from './SearchHighlight.jsx'

function sanitizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function TableBadge({ value, tone = 'neutral', className = '' }) {
  const safeTone = sanitizeToken(tone) || 'neutral'
  return (
    <span className={`employee-badge table-badge table-badge-${safeTone} ${className}`.trim()}>
      {value || '—'}
    </span>
  )
}

function renderHighlightableValue(value, query = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return value
  return <SearchHighlight text={value} query={query} />
}

export function TableCellStack({ title, subtitle, meta = null, className = '', align = 'start', highlightQuery = '' }) {
  return (
    <div className={`employee-cell-stack table-cell-stack table-cell-stack-${align} ${className}`.trim()}>
      <div className="employee-cell-primary table-cell-primary">{title ? renderHighlightableValue(title, highlightQuery) : '—'}</div>
      {subtitle ? <div className="employee-cell-secondary table-cell-secondary">{renderHighlightableValue(subtitle, highlightQuery)}</div> : null}
      {meta ? <div className="employee-cell-meta table-cell-meta">{renderHighlightableValue(meta, highlightQuery)}</div> : null}
    </div>
  )
}

export function TableBadgeStack({ children, className = '' }) {
  return <div className={`employee-badge-stack table-badge-stack ${className}`.trim()}>{children}</div>
}

export function TableActionButton({ icon, label, variant = 'view', className = '', style = {}, ...props }) {
  const safeLabel = String(label || '')
  const labelChars = Math.min(Math.max(safeLabel.length, 4), 26)

  return (
    <button
      type="button"
      className={`employee-action-btn employee-action-btn-${variant} ${className}`.trim()}
      aria-label={safeLabel}
      data-label={safeLabel}
      style={{ '--action-label-chars': labelChars, ...style }}
      {...props}
    >
      {icon ? <span className="employee-action-btn__icon" aria-hidden="true">{icon}</span> : null}
      <span className="employee-action-btn__label" aria-hidden="true">{safeLabel}</span>
    </button>
  )
}

export function TableActionCluster({ children, className = '', style = {} }) {
  const actionItems = React.Children.toArray(children).filter(Boolean)
  const actionCount = Math.max(actionItems.length, 1)

  return (
    <div
      className={`employee-action-cluster table-action-cluster ${className}`.trim()}
      style={{
        '--table-action-count': actionCount,
        ...style
      }}
    >
      {children}
    </div>
  )
}

export function getValueTone(value, toneMap = {}, fallback = 'neutral') {
  const safeValue = sanitizeToken(value)
  return toneMap[safeValue] || fallback
}
