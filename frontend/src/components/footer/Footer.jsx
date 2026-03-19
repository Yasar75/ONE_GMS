import React from 'react'

export default function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="app-footer border-top bg-body">
      <div className="container-fluid h-100 d-flex align-items-center justify-content-center">
        <div className="text-muted small text-center">© {year} One GMS. All rights reserved.</div>
      </div>
    </footer>
  )
}
