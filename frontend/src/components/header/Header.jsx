import React from 'react'
import ThemeToggle from './ThemeToggle.jsx'
import ProfileWidget from './ProfileWidget.jsx'
import HeaderPunchCard from './HeaderPunchCard.jsx'
import NotificationCenter from './NotificationCenter.jsx'
import logoLight from '../../asserts/headerLogo.svg'
import logoDark from '../../asserts/headerLogo_white.svg'
import faviconPng from '../../asserts/favicon.png'
import { useTheme } from '../../app/providers/ThemeProvider.jsx'

export default function Header({ ui }) {
  const { theme } = useTheme()
  const fullLogo = theme === 'dark' ? logoDark : logoLight
  const brandSrc = ui?.sidebarExpanded ? fullLogo : faviconPng
  const isFavicon = !ui?.sidebarExpanded

  return (
    <header className="app-header border-bottom bg-body">
      <div className="app-shell-container app-shell-container--header h-100 d-flex align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-2">
          <div className="app-brand">
            <img
              src={brandSrc}
              alt="Giantmind"
              className={isFavicon ? 'brand-favicon' : ''}
            />
            <span className="app-brand-title text-muted">ONE GMS</span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 app-header-actions">
          <HeaderPunchCard />
          <ThemeToggle />
          <NotificationCenter />
          <ProfileWidget />
        </div>
      </div>
    </header>
  )
}
