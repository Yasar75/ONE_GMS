import React from 'react'

export default function TableActionButton({
  icon,
  label,
  variant = 'view',
  onClick,
  className = '',
  disabled = false,
  buttonClassName = '',
  style = {}
}) {
  const safeLabel = String(label || '')
  const labelChars = Math.min(Math.max(safeLabel.length, 4), 26)

  return (
    <button
      type="button"
      className={`employee-action-btn employee-action-btn-${variant} ${buttonClassName} ${className}`.trim()}
      onClick={onClick}
      aria-label={safeLabel}
      title={safeLabel}
      disabled={disabled}
      style={{ '--action-label-chars': labelChars, ...style }}
    >
      {icon ? <span className="employee-action-btn__icon" aria-hidden="true">{icon}</span> : null}
      <span className="employee-action-btn__label">{safeLabel}</span>
    </button>
  )
}
