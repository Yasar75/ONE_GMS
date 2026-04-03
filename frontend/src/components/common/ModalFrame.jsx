import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from './AppIcons.jsx'

export default function ModalFrame({
  open,
  title,
  onClose,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
  hideHeader = false,
  centered = true,
  dismissible = true,
  hideCloseButton = false,
  closeOnBackdrop = true,
  variant = 'default'
}) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    const onKeyDown = (event) => {
      if (dismissible && event.key === 'Escape') onClose?.()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dismissible, open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-frame-layer" role="dialog" aria-modal="true" aria-label={title || 'Dialog'}>
      <div className="modal-frame-backdrop" onClick={() => { if (dismissible && closeOnBackdrop) onClose?.() }} />
      <div className={`modal-frame modal-${size} modal-variant-${variant}${centered ? ' centered' : ''}`}>
        <div className="modal-frame-card glass shadow-lg">
          {!hideHeader ? (
            <div className="modal-frame-header">
              <div>
                <h2 className="h5 fw-bold mb-0">{title}</h2>
              </div>
              {!hideCloseButton && dismissible ? (
                <button type="button" className="modal-frame-close" onClick={onClose} aria-label={closeLabel}>
                  <XIcon />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="modal-frame-body">{children}</div>
          {footer ? <div className="modal-frame-footer">{footer}</div> : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
