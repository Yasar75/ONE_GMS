import React from 'react'
import ModalShell from './ModalShell.jsx'

function StatusIcon({ variant }) {
  if (variant === 'success') {
    return <div className="status-icon status-success">✓</div>
  }
  if (variant === 'warning') {
    return <div className="status-icon status-warning">!</div>
  }
  return <div className="status-icon status-error">×</div>
}

export default function StatusDialog({
  open,
  title,
  message,
  variant = 'error',
  buttonText = 'Close',
  onClose,
  showButton = true
}) {
  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={variant === 'success' ? 'Action completed successfully.' : 'Please review the message below.'}
      size="sm"
      onClose={onClose}
      footer={showButton ? <button type="button" className="btn btn-primary px-4" onClick={onClose}>{buttonText}</button> : null}
    >
      <div className="status-modal-content">
        <StatusIcon variant={variant} />
        <div className="status-modal-copy">{message}</div>
      </div>
    </ModalShell>
  )
}
