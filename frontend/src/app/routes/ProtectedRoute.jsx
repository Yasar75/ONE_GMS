import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'

export function ProtectedRoute() {
  const { isAuthenticated, isAuthReady, user } = useAuth()
  const location = useLocation()

  if (!isAuthReady) {
    return <div className="d-flex align-items-center justify-content-center min-vh-100 text-muted">Restoring session…</div>
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const setupRequired = Boolean(user?.mustChangePassword || user?.mustCompleteProfile)
  const onProfileRoute = location.pathname === '/profile'
  if (setupRequired && !onProfileRoute) {
    return <Navigate to="/profile" replace />
  }

  return <Outlet />
}
