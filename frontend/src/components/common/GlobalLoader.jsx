import React from 'react'

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 50 50" aria-hidden="true">
      <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="80 140" />
    </svg>
  )
}

export default function GlobalLoader({ visible, title, message }) {
  return (
    <div className={'ui-overlay' + (visible ? ' is-visible' : '')} aria-hidden={!visible}>
      <div className="ui-loader-modal" role="status" aria-live="polite" aria-busy={visible}>
        <div className="ui-loader-spinner">
          <SpinnerIcon />
        </div>
        <div className="ui-loader-title">{title || 'Please wait'}</div>
        {message ? <div className="ui-loader-message">{message}</div> : null}
      </div>
    </div>
  )
}
