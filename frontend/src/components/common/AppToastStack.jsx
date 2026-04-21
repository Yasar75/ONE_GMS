import React from 'react'

function normalizeToastTone(tone = 'info') {
  const normalized = String(tone || '').trim().toLowerCase()
  if (['success', 'warning', 'danger', 'info'].includes(normalized)) return normalized
  return 'info'
}

export default function AppToastStack({ items = [], onDismiss }) {
  if (!items.length) return null

  return (
    <div className="app-toast-stack" aria-live="polite" aria-atomic="true">
      {items.map((item) => {
        const tone = normalizeToastTone(item?.tone)
        return (
          <div key={item.id} className={`app-toast app-toast--${tone}`.trim()} role="status">
            <div className="app-toast__body">
              {item?.title ? <div className="app-toast__title">{item.title}</div> : null}
              {item?.message ? <div className="app-toast__message">{item.message}</div> : null}
            </div>
            <button type="button" className="app-toast__close" onClick={() => onDismiss?.(item.id)} aria-label="Dismiss notification">
              x
            </button>
          </div>
        )
      })}
    </div>
  )
}
