import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { isProfileSetupRequired } from '../../utils/auth.js'
import { canAccessAppPath, resolveHomePath } from '../../utils/permissions.js'

export function ProtectedRoute() {
  const { isAuthenticated, isAuthReady, user } = useAuth()
  const location = useLocation()

  if (!isAuthReady) {
    return (
      <div className="protected-route-restore min-vh-100" role="status" aria-live="polite" aria-busy="true">
        <div className="protected-route-restore__content">
          <div className="protected-route-restore__title">Restoring session...</div>
          <div className="protected-route-restore__bar" aria-hidden="true">
            <span className="protected-route-restore__fill" />
          </div>
        </div>
      </div>
    )
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
