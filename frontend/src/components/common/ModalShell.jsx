import React from 'react'

export default function ModalShell({
  open,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
  onClose,
  hideClose = false,
  tone = 'default'
}) {
  if (!open) return null

  return (
    <div className="app-modal-backdrop" role="presentation">
      <div className="app-modal-layer" />
      <div
        className={`app-modal app-modal-${size} app-modal-${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="app-modal-header">
          <div>
            <div className="app-modal-title">{title}</div>
            {subtitle ? <div className="app-modal-subtitle">{subtitle}</div> : null}
          </div>
          {!hideClose ? (
            <button type="button" className="app-modal-close" onClick={onClose} aria-label="Close dialog">
              ×
            </button>
          ) : null}
        </div>

        <div className="app-modal-body">{children}</div>

        {footer ? <div className="app-modal-footer">{footer}</div> : null}
      </div>
    </div>
  )
}
