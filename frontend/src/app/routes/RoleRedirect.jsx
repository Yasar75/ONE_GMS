import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { isProfileSetupRequired } from '../../utils/auth.js'
import { resolveHomePath } from '../../utils/permissions.js'

export function RoleRedirect() {
  const { isAuthReady, user } = useAuth()

  if (!isAuthReady) {
    return <div className="text-muted">Loading session…</div>
  }

  if (isProfileSetupRequired(user)) {
    return <Navigate to="/profile" replace />
  }

  return <Navigate to={resolveHomePath(user)} replace />
}
