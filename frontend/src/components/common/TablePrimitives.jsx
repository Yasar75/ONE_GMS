import React from 'react'

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

export function TableCellStack({ title, subtitle, meta = null, className = '', align = 'start' }) {
  return (
    <div className={`employee-cell-stack table-cell-stack table-cell-stack-${align} ${className}`.trim()}>
      <div className="employee-cell-primary table-cell-primary">{title || '—'}</div>
      {subtitle ? <div className="employee-cell-secondary table-cell-secondary">{subtitle}</div> : null}
      {meta ? <div className="employee-cell-meta table-cell-meta">{meta}</div> : null}
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

  const maxLabelChars = actionItems.reduce((longest, item) => {
    if (!React.isValidElement(item)) return longest
    const candidate = String(item.props?.label || item.props?.['aria-label'] || '').trim()
    const clampedLength = Math.min(Math.max(candidate.length, 4), 26)
    return Math.max(longest, clampedLength)
  }, 4)

  const collapsedButtonWidthRem = 2.72
  const actionGapRem = 0.42
  const expansionExtraRem = (maxLabelChars * 0.52) + 0.82
  const reservedClusterWidthRem = (actionCount * collapsedButtonWidthRem) + ((actionCount - 1) * actionGapRem) + expansionExtraRem

  return (
    <div
      className={`employee-action-cluster table-action-cluster ${className}`.trim()}
      style={{
        '--table-action-count': actionCount,
        '--table-action-min-width': `${reservedClusterWidthRem.toFixed(2)}rem`,
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
