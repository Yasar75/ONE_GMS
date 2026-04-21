import React from 'react'

export default function GlobalLoaderContent({ title, message }) {
  return (
    <div className="global-loader-dialog text-center py-2">
      <div className="global-loader-spinner" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="fw-bold fs-5 mb-2">{title}</div>
      <div className="text-muted">{message}</div>
    </div>
  )
}
