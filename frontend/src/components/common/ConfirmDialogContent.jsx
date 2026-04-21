import React from 'react'

export default function ConfirmDialogContent({ title, message, note }) {
  return (
    <div className="confirm-dialog d-flex flex-column gap-3">
      <div className="confirm-dialog-badge">Confirmation required</div>
      <div>
        <div className="fw-bold fs-5 mb-2">{title}</div>
        <div className="text-muted">{message}</div>
      </div>
      {note ? <div className="confirm-dialog-note">{note}</div> : null}
    </div>
  )
}
