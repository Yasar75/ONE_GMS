import React from 'react'
import { useLocation } from 'react-router-dom'

export default function RouteTransition({ children, className = '' }) {
  const location = useLocation()

  return (
    <div key={location.pathname} className={`route-transition ${className}`.trim()}>
      {children}
    </div>
  )
}
