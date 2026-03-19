import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'
import { ROLES } from '../../utils/role.js'

export function RoleRedirect() {
  const { role, isAuthReady } = useAuth()

  if (!isAuthReady) {
    return <div className="text-muted">Loading session…</div>
  }

  if (role === ROLES.ADMIN) return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/employee/dashboard" replace />
}
