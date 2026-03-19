import React from 'react'
import ModalShell from './ModalShell.jsx'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  confirmVariant = 'primary'
}) {
  return (
    <ModalShell
      open={open}
      title={title}
      subtitle="Please confirm before proceeding."
      size="sm"
      onClose={onCancel}
      tone="warning"
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary px-4" onClick={onCancel}>{cancelText}</button>
          <button type="button" className={`btn btn-${confirmVariant} px-4`} onClick={onConfirm}>{confirmText}</button>
        </>
      )}
    >
      <div className="confirm-modal-copy">{message}</div>
    </ModalShell>
  )
}
