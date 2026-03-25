import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider.jsx'
import { roleLabel } from '../../utils/role.js'

export default function ProfileWidget() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.nickname || user?.firstName || user?.username || 'User'
  const userName = user?.username || 'User'
  const initials = String(displayName || 'U').charAt(0).toUpperCase()
  const role = String(user?.roleName || '').trim() || roleLabel(user?.role)

  return (
    <div className="dropdown">
      <button className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2" data-bs-toggle="dropdown">
        <span className="profile-avatar">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt="Profile" /> : <span className="profile-initial">{initials}</span>}
        </span>
        <span className="text-start d-none d-sm-block">
          <div className="fw-bold lh-1">{displayName}</div>
          <div className="text-muted small lh-1">{role}</div>
        </span>
      </button>
      <ul className="dropdown-menu dropdown-menu-end">
        <li><span className="dropdown-item-text small text-muted">Username: {userName}</span></li>
        <li><hr className="dropdown-divider" /></li>
        <li><button className="dropdown-item" onClick={() => navigate('/profile')}>Profile</button></li>
        <li><button className="dropdown-item" onClick={logout}>Logout</button></li>
      </ul>
    </div>
  )
}
