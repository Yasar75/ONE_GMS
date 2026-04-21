import React from 'react'

export default function PageHeader({ title, tagline }) {
  return (
    <div className="page-header-shell mb-3">
      <h1 className="fw-bold mb-1">{title}</h1>
      {tagline ? <div className="text-muted small">{tagline}</div> : null}
    </div>
  )
}
