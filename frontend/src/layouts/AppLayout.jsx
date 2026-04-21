import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/header/Header.jsx'
import Sidebar from '../components/nav/Sidebar.jsx'
import TopNavbar from '../components/nav/TopNavbar.jsx'
import Footer from '../components/footer/Footer.jsx'
import PageContentLoader from '../components/common/PageContentLoader.jsx'
import { useAuth } from '../app/providers/AuthProvider.jsx'
import { storage } from '../utils/storage.js'
import { isProfileSetupRequired } from '../utils/auth.js'

const LOCK_KEY = 'one_gms.ui.sidebarLocked'

function shouldShowRouteSkeleton(query) {
  if (!query || query.state?.fetchStatus !== 'fetching') return false
  if (query.options?.meta?.suppressGlobalLoader) return false
  return Number(query.state?.dataUpdatedAt || 0) === 0
}

export function AppLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const [sidebarLocked, setSidebarLocked] = useState(() => storage.get(LOCK_KEY, false))
  const [sidebarHover, setSidebarHover] = useState(false)
  const blockingPageFetchCount = useIsFetching({
    predicate: shouldShowRouteSkeleton
  })
  const routeKey = `${location.pathname}${location.search}`
  const previousRouteKeyRef = useRef(routeKey)
  const routeSkeletonClearTimerRef = useRef(null)
  const [routeLoadingKey, setRouteLoadingKey] = useState(routeKey)

  const setupRequired = isProfileSetupRequired(user)
  const sidebarExpanded = sidebarLocked || sidebarHover
  const showPageSkeleton = routeLoadingKey === routeKey && blockingPageFetchCount > 0

  const ui = useMemo(() => ({
    sidebarLocked,
    sidebarExpanded,
    setSidebarLocked: (value) => {
      storage.set(LOCK_KEY, value)
      setSidebarLocked(value)
      if (!value) setSidebarHover(false)
    },
    onSidebarEnter: () => { if (!sidebarLocked) setSidebarHover(true) },
    onSidebarLeave: () => { if (!sidebarLocked) setSidebarHover(false) },
    onSidebarNavigate: () => { if (!sidebarLocked) setSidebarHover(false) }
  }), [sidebarLocked, sidebarExpanded])

  useEffect(() => {
    if (previousRouteKeyRef.current === routeKey) return
    previousRouteKeyRef.current = routeKey
    setRouteLoadingKey(routeKey)
  }, [routeKey])

  useEffect(() => {
    if (routeSkeletonClearTimerRef.current) {
      window.clearTimeout(routeSkeletonClearTimerRef.current)
      routeSkeletonClearTimerRef.current = null
    }

    if (blockingPageFetchCount > 0) return undefined

    routeSkeletonClearTimerRef.current = window.setTimeout(() => {
      routeSkeletonClearTimerRef.current = null
      setRouteLoadingKey(null)
    }, 160)

    return () => {
      if (routeSkeletonClearTimerRef.current) {
        window.clearTimeout(routeSkeletonClearTimerRef.current)
        routeSkeletonClearTimerRef.current = null
      }
    }
  }, [blockingPageFetchCount, routeKey])

  useEffect(() => () => {
    if (routeSkeletonClearTimerRef.current) {
      window.clearTimeout(routeSkeletonClearTimerRef.current)
      routeSkeletonClearTimerRef.current = null
    }
  }, [])

  return (
    <div className="app-root">
      <Header ui={ui} />
      {!setupRequired ? <TopNavbar /> : null}
      {!setupRequired ? <Sidebar ui={ui} /> : null}

      <main className={`app-content ${setupRequired ? 'without-sidebar' : `${sidebarLocked ? 'with-sidebar' : 'with-sidebar-collapsed'}${sidebarExpanded && !sidebarLocked ? ' sidebar-hover' : ''}`}`.trim()}>
        <div className="app-content-scroll">
          <div className="app-shell-container app-page-container py-3">
            <div className={`app-page-outlet-shell${showPageSkeleton ? ' is-loading' : ''}`}>
              <div key={location.pathname} className="route-transition">
                <Outlet />
              </div>
            </div>
            {showPageSkeleton ? (
              <div className="app-page-loading-layer" key={routeKey}>
                <PageContentLoader cards={4} slowDelayMs={5000} showSlowLoader={false} />
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
