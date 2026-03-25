import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { isProfileSetupRequired } from '../../utils/auth.js'
import { canAccessAppPath, resolveHomePath } from '../../utils/permissions.js'

export function ProtectedRoute() {
  const { isAuthenticated, isAuthReady, user } = useAuth()
  const location = useLocation()

  if (!isAuthReady) {
    return <div className="d-flex align-items-center justify-content-center min-vh-100 text-muted">Restoring session…</div>
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const setupRequired = isProfileSetupRequired(user)
  const onProfileRoute = location.pathname === '/profile'
  if (setupRequired && !onProfileRoute) {
    return <Navigate to="/profile" replace />
  }

  if (!onProfileRoute && !canAccessAppPath(user, location.pathname)) {
    return <Navigate to={resolveHomePath(user)} replace />
  }

  return <Outlet />
}
