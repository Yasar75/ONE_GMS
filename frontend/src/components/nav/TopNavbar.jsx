import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider.jsx'
import { getNavItems } from './NavItems.jsx'
import logoLight from '../../assets/headerLogo.svg'
import logoDark from '../../assets/headerLogo_white.svg'
import { useTheme } from '../../app/providers/ThemeProvider.jsx'

export default function TopNavbar() {
  const { user } = useAuth()
  const items = getNavItems(user?.role)
  const { theme } = useTheme()
  const logoUrl = theme === 'dark' ? logoDark : logoLight

  return (
    <nav className="navbar navbar-expand-md d-md-none border-bottom bg-body app-topnav">
      <div className="container-fluid d-flex align-items-center">
        <button className="navbar-toggler ms-auto" type="button" data-bs-toggle="collapse" data-bs-target="#lmsTopNav">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="lmsTopNav">
          <ul className="navbar-nav ms-auto mb-2 mb-md-0">
            {items.map((it) => (
              <li className="nav-item" key={it.to}>
                <NavLink className="nav-link" to={it.to}>{it.label}</NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  )
}
