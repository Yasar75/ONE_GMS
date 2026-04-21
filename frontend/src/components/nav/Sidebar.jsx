import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider.jsx'
import { getNavItems } from './NavItems.jsx'

function LockIcon({ locked }) {
  // Simple inline icons to avoid external deps.
  return locked ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17 10V8a5 5 0 0 0-9.8-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 14v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar({ ui }) {
  const { user } = useAuth()
  const items = getNavItems(user)
  const expanded = ui.sidebarExpanded

  return (
    <aside
      className={'app-sidebar d-none d-md-flex flex-column border-end bg-body ' + (expanded ? 'expanded' : 'collapsed') + (!ui.sidebarLocked && expanded ? ' hovering' : '')}
      onMouseEnter={ui.onSidebarEnter}
      onMouseLeave={ui.onSidebarLeave}
      aria-label="Sidebar navigation"
    >
      <button
        type="button"
        className={'sidebar-lock-btn' + (ui.sidebarLocked ? ' locked' : '')}
        onClick={() => ui.setSidebarLocked(!ui.sidebarLocked)}
        title={ui.sidebarLocked ? 'Unlock: expand on hover' : 'Lock: keep expanded'}
        aria-label={ui.sidebarLocked ? 'Unlock sidebar' : 'Lock sidebar'}
      >
        <LockIcon locked={!!ui.sidebarLocked} />
      </button>
      <div className="sidebar-scroll py-2">
        <div className="sidebar-divider" />
        <nav className="nav flex-column px-2 pb-2 gap-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) => `sidebar-link d-flex align-items-center gap-2 px-2 py-2 rounded ${isActive ? 'active' : ''}`.trim()}
              onClick={ui.onSidebarNavigate}
            >
              <span className="sidebar-icon">{it.icon}</span>
              <span className={`sidebar-link-label small fw-semibold ${expanded ? 'is-visible' : ''}`.trim()}>{it.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}
