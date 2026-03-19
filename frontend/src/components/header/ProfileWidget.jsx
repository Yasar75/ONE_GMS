import React from 'react'
import { useAuth } from '../../app/providers/AuthProvider.jsx'
import { roleInitial, roleLabel } from '../../utils/role.js'

export default function ProfileWidget() {
  const { user, logout } = useAuth()
  const initials = roleInitial(user?.role)
  const name = user?.firstName || 'User'
  const role = roleLabel(user?.role)

  return (
    <div className="dropdown">
      <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2" data-bs-toggle="dropdown">
        <span className="profile-avatar">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="Profile" /> : <span className="profile-initial">{initials}</span>}
        </span>
        <span className="text-start d-none d-sm-block">
          <div className="fw-bold lh-1">{name}</div>
          <div className="text-muted small lh-1">{role}</div>
        </span>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        <li><span className="dropdown-item-text small text-muted">Signed in as {name}</span></li>
        <li><hr className="dropdown-divider" /></li>
        <li><button className="dropdown-item" onClick={logout}>Logout</button></li>
      </ul>
    </div>
  )
}
