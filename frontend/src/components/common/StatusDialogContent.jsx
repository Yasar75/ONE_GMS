import React from 'react'
import { CheckCircleIcon, XCircleIcon } from './AppIcons.jsx'

function normalizeMessagePart(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.map(normalizeMessagePart).filter(Boolean).join('\n') || null
  }

  if (typeof value === 'object') {
    const location = Array.isArray(value.loc) ? value.loc.filter(Boolean).join(' → ') : null
    if (typeof value.msg === 'string' && value.msg.trim()) {
      return location ? `${location}: ${value.msg}` : value.msg
    }
    if (typeof value.detail === 'string' && value.detail.trim()) {
      return value.detail
    }
    return Object.values(value).map(normalizeMessagePart).filter(Boolean).join('\n') || null
  }

  return null
}

function normalizeStatusMessage(message) {
  return normalizeMessagePart(message) || 'Something went wrong.'
}

export default function StatusDialogContent({ type = 'success', title, message }) {
  const isSuccess = type === 'success'
  const Icon = isSuccess ? CheckCircleIcon : XCircleIcon
  const normalizedMessage = normalizeStatusMessage(message)
  const messageLines = normalizedMessage.split('\n').map((line) => line.trim()).filter(Boolean)

  return (
    <div className="status-dialog text-center py-2">
      <div className={'status-dialog-icon ' + (isSuccess ? 'success' : 'error')}>
        <Icon />
      </div>
      <div className="fw-bold fs-5 mb-2">{title}</div>
      <div className="text-muted status-dialog-message">
        {messageLines.length > 1 ? (
          <ul className="status-dialog-list text-start mb-0">
            {messageLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <span>{messageLines[0] || normalizedMessage}</span>
        )}
      </div>
    </div>
  )
}
