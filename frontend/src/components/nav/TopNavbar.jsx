import React, { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../app/providers/AuthProvider.jsx'
import { getNavItems } from './NavItems.jsx'
import { ChevronDownIcon } from '../common/AppIcons.jsx'

export default function TopNavbar() {
  const { user } = useAuth()
  const items = getNavItems(user)
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)

  const activeItem = useMemo(() => (
    items.find((item) => location.pathname.startsWith(item.to)) || items[0] || null
  ), [items, location.pathname])

  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname, location.search])

  if (!items.length) return null

  return (
    <nav className="app-topnav d-md-none border-bottom bg-body" aria-label="Mobile navigation">
      <div className="app-shell-container">
        <div className="app-topnav__bar">
          <div className="app-topnav__current">
            <span className="app-topnav__current-icon" aria-hidden="true">{activeItem?.icon || '•'}</span>
            <span className="app-topnav__current-label">{activeItem?.label || 'Navigation'}</span>
          </div>
          <button
            type="button"
            className={`app-topnav__toggle ${isOpen ? 'is-open' : ''}`.trim()}
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            aria-controls="oneGmsTopNav"
          >
            <span>Menu</span>
            <ChevronDownIcon />
          </button>
        </div>

        <div id="oneGmsTopNav" className={`app-topnav__collapse ${isOpen ? 'is-open' : ''}`.trim()}>
          <div className="app-topnav__list">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `app-topnav__link ${isActive ? 'active' : ''}`.trim()}
                onClick={() => setIsOpen(false)}
              >
                <span className="app-topnav__link-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}
