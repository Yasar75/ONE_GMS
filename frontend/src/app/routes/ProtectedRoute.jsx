import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider.jsx'

export function ProtectedRoute() {
  const { isAuthenticated, isAuthReady } = useAuth()

  if (!isAuthReady) {
    return <div className="d-flex align-items-center justify-content-center min-vh-100 text-muted">Restoring session…</div>
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}
