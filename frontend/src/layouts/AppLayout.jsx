import React, { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/header/Header.jsx'
import Sidebar from '../components/nav/Sidebar.jsx'
import TopNavbar from '../components/nav/TopNavbar.jsx'
import Footer from '../components/footer/Footer.jsx'
import { useAuth } from '../app/providers/AuthProvider.jsx'
import { storage } from '../utils/storage.js'

const LOCK_KEY = 'one_gms.ui.sidebarLocked'

export function AppLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const [sidebarLocked, setSidebarLocked] = useState(() => storage.get(LOCK_KEY, false))
  const [sidebarHover, setSidebarHover] = useState(false)

  const setupRequired = !Boolean(user?.firstLoginAt) && Boolean(user?.firstLoginDeadlineAt || user?.mustChangePassword || user?.mustCompleteProfile)
  const sidebarExpanded = sidebarLocked || sidebarHover

  const ui = useMemo(() => ({
    sidebarLocked,
    sidebarExpanded,
    setSidebarLocked: (value) => {
      storage.set(LOCK_KEY, value)
      setSidebarLocked(value)
      if (!value) setSidebarHover(false)
    },
    onSidebarEnter: () => { if (!sidebarLocked) setSidebarHover(true) },
    onSidebarLeave: () => { if (!sidebarLocked) setSidebarHover(false) }
  }), [sidebarLocked, sidebarExpanded])

  return (
    <div className="app-root">
      <Header ui={ui} />
      <TopNavbar />
      {!setupRequired ? <Sidebar ui={ui} /> : null}

      <main className={`app-content ${setupRequired ? 'without-sidebar' : `${sidebarLocked ? 'with-sidebar' : 'with-sidebar-collapsed'}${sidebarExpanded && !sidebarLocked ? ' sidebar-hover' : ''}`}`.trim()}>
        <div className="app-content-scroll">
          <div className="container-fluid py-3">
            <div key={location.pathname} className="route-transition">
              <Outlet />
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
