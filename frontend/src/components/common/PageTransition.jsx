import React from 'react'
import { useLocation } from 'react-router-dom'

export default function PageTransition({ children, className = '' }) {
  const location = useLocation()

  return (
    <div key={location.pathname} className={'page-transition-shell ' + className}>
      {children}
    </div>
  )
}
