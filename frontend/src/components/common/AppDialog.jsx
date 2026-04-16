import React from 'react'

function StatusIcon({ tone }) {
  const isDanger = tone === 'danger'
  const isSuccess = tone === 'success'

  return (
    <div className={'ui-dialog-icon' + (isDanger ? ' danger' : isSuccess ? ' success' : '')}>
      {isDanger ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : isSuccess ? (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="m8.5 12 2.3 2.4 4.7-5.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

export default function AppDialog({ dialog, onClose, onConfirm }) {
  if (!dialog) return null

  const isConfirm = dialog.kind === 'confirm'

  return (
    <div className="ui-overlay is-visible" role="presentation">
      <div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="ui-dialog-title">
        <div className="ui-dialog-header">
          <div>
            <div className="ui-dialog-kicker">Attention</div>
            <h2 className="ui-dialog-title" id="ui-dialog-title">{dialog.title}</h2>
          </div>
          <button type="button" className="ui-dialog-close" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>

        <div className="ui-dialog-body">
          <StatusIcon tone={dialog.tone} />
          <div className="ui-dialog-message">{dialog.message}</div>
          {dialog.detail ? <div className="ui-dialog-detail">{dialog.detail}</div> : null}
          {dialog.content ? <div className="ui-dialog-content-slot">{dialog.content}</div> : null}
        </div>

        {dialog.hideFooter ? null : (
          <div className="ui-dialog-footer">
            {isConfirm ? (
              <>
                <button type="button" className="btn btn-light px-4" onClick={onClose}>
                  {dialog.cancelText || 'Cancel'}
                </button>
                <button type="button" className={'btn px-4 ' + (dialog.confirmVariant || 'btn-primary')} onClick={onConfirm}>
                  {dialog.confirmText || 'Confirm'}
                </button>
              </>
            ) : (
              <button type="button" className={'btn px-4 ' + (dialog.confirmVariant || 'btn-primary')} onClick={onClose}>
                {dialog.confirmText || 'Close'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
