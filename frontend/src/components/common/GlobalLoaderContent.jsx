import React from 'react'

export default function GlobalLoaderContent({ title, message, completed = false }) {
  return (
    <div className={`global-loader-dialog text-center py-2${completed ? ' is-complete' : ''}`}>
      <div className="global-loader-spinner" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="fw-bold fs-5 mb-2">{title}</div>
      <div className="text-muted">{message}</div>
      <div className="global-loader-progress" aria-hidden="true">
        <div className="global-loader-progress-track">
          <span className="global-loader-progress-fill" />
          <span className="global-loader-progress-glow" />
          {/* <span className="global-loader-progress-checkpoints">
            <i />
            <i />
            <i />
          </span> */}
        </div>
        {/* <div className="global-loader-progress-steps">
          <span>Preparing</span>
          <span>Syncing</span>
          <span>Verifying</span>
        </div> */}
      </div>
    </div>
  )
}
