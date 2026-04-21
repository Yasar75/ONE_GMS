import React from 'react'

export default function CardShell({ title, children, right, className = '', headerClassName = '', bodyClassName = '' }) {
  return (
    <div className={`card border-0 shadow-sm h-100 ${className}`.trim()}>
      <div className={`card-header bg-body border-0 d-flex align-items-center justify-content-between ${headerClassName}`.trim()}>
        <div className="fw-semibold">{title}</div>
        {right || null}
      </div>
      <div className={`card-body ${bodyClassName}`.trim()}>{children}</div>
    </div>
  )
}
