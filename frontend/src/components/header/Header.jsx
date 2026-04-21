import React from 'react'
import ThemeToggle from './ThemeToggle.jsx'
import ProfileWidget from './ProfileWidget.jsx'
import HeaderPunchCard from './HeaderPunchCard.jsx'
import NotificationCenter from './NotificationCenter.jsx'
import logoLightTheme from '../../asserts/one_gms_logo_dark.svg'
import logoDarkTheme from '../../asserts/one_gms_logo_light.svg'
import iconLightTheme from '../../asserts/one_gms_icon_dark.svg'
import iconDarkTheme from '../../asserts/one_gms_icon_light.svg'
import { useTheme } from '../../app/providers/ThemeProvider.jsx'

export default function Header({ ui }) {
  const { theme } = useTheme()
  const fullLogo = theme === 'dark' ? logoDarkTheme : logoLightTheme
  const brandIcon = theme === 'dark' ? iconDarkTheme : iconLightTheme
  const isSidebarExpanded = Boolean(ui?.sidebarExpanded)

  return (
    <header className="app-header border-bottom bg-body">
      <div className="app-shell-container app-shell-container--header h-100 d-flex align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-2">
          <div className={`app-brand ${isSidebarExpanded ? 'app-brand--expanded' : 'app-brand--collapsed'}`.trim()}>
            <div className="app-brand-stack" aria-hidden="true">
              <img src={brandIcon} alt="" className="brand-icon" />
              <span className="app-brand-title text-muted">ONE GMS</span>
              <img src={fullLogo} alt="" className="brand-logo" />
            </div>
            <span className="visually-hidden">ONE GMS</span>
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
