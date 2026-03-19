import React from 'react'

export default function TableActionButton({
  icon,
  label,
  variant = 'view',
  onClick,
  className = '',
  disabled = false,
  buttonClassName = ''
}) {
  return (
    <button
      type="button"
      className={`employee-action-btn employee-action-btn-${variant} ${buttonClassName} ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
