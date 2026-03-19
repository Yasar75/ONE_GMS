import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { storage } from '../../utils/storage.js'
import { ROLES } from '../../utils/role.js'
import { authService } from '../../api/services/auth.service.js'
import { AUTH_STORAGE_KEYS, SESSION_IDLE_TIMEOUT_MS } from '../../utils/auth.js'
import { dashboardService } from '../../api/services/dashboard.service.js'
import { employeeService } from '../../api/services/employee.service.js'
import { attendanceService } from '../../api/services/attendance.service.js'
import { getTodayDateInput } from '../../utils/attendance.js'
import { useModal } from './ModalProvider.jsx'

const AuthContext = createContext(null)
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const idleTimerRef = useRef(null)

  const [user, setUser] = useState(() => storage.get(AUTH_STORAGE_KEYS.user, null))
  const [token, setToken] = useState(() => storage.get(AUTH_STORAGE_KEYS.accessToken, null))
  const [refreshToken, setRefreshToken] = useState(() => storage.get(AUTH_STORAGE_KEYS.refreshToken, null))

  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.getCurrentUser,
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000
  })

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const clearAuthState = useCallback(() => {
    clearIdleTimer()
    storage.remove(AUTH_STORAGE_KEYS.user)
    storage.remove(AUTH_STORAGE_KEYS.accessToken)
    storage.remove(AUTH_STORAGE_KEYS.refreshToken)
    storage.remove(AUTH_STORAGE_KEYS.lastActivityAt)
    setUser(null)
    setToken(null)
    setRefreshToken(null)
    queryClient.removeQueries({ queryKey: ['auth'] })
    queryClient.removeQueries({ queryKey: ['dashboard'] })
    queryClient.removeQueries({ queryKey: ['employees'] })
    queryClient.removeQueries({ queryKey: ['attendance'] })
  }, [clearIdleTimer, queryClient])

  const handleIdleTimeout = useCallback(() => {
    clearAuthState()
    showStatus({
      type: 'error',
      title: 'Session expired',
      message: 'Due to 15 minutes of idle inactivity, you were logged out. Please sign in again to continue.',
      ctaLabel: 'Sign in again'
    })
  }, [clearAuthState, showStatus])

  const scheduleIdleTimeout = useCallback(() => {
    clearIdleTimer()
    if (!storage.get(AUTH_STORAGE_KEYS.accessToken, null)) return

    const lastActivityAt = Number(storage.get(AUTH_STORAGE_KEYS.lastActivityAt, Date.now()))
    const elapsed = Date.now() - lastActivityAt
    const remaining = SESSION_IDLE_TIMEOUT_MS - elapsed

    if (remaining <= 0) {
      handleIdleTimeout()
      return
    }

    idleTimerRef.current = window.setTimeout(handleIdleTimeout, remaining)
  }, [clearIdleTimer, handleIdleTimeout])

  const registerActivity = useCallback(() => {
    if (!storage.get(AUTH_STORAGE_KEYS.accessToken, null)) return
    storage.set(AUTH_STORAGE_KEYS.lastActivityAt, Date.now())
    scheduleIdleTimeout()
  }, [scheduleIdleTimeout])

  useEffect(() => {
    if (sessionQuery.data) {
      storage.set(AUTH_STORAGE_KEYS.user, sessionQuery.data)
      setUser(sessionQuery.data)
    }
  }, [sessionQuery.data])

  useEffect(() => {
    if (sessionQuery.isError) {
      clearAuthState()
    }
  }, [clearAuthState, sessionQuery.isError])

  useEffect(() => {
    if (!token) {
      clearIdleTimer()
      return undefined
    }

    scheduleIdleTimeout()

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true })
    })

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, registerActivity)
      })
      clearIdleTimer()
    }
  }, [clearIdleTimer, registerActivity, scheduleIdleTimeout, token])

  const prefetchRoleDependencies = useCallback(async (nextUser, client = queryClient) => {
    if (!nextUser) return

    const todayDate = getTodayDateInput()

    if (nextUser.role === ROLES.ADMIN) {
      await Promise.all([
        client.prefetchQuery({
          queryKey: ['dashboard', 'admin'],
          queryFn: dashboardService.getAdminDashboard,
          staleTime: 5 * 60 * 1000
        }),
        client.prefetchQuery({
          queryKey: ['employees', 'directory'],
          queryFn: employeeService.getDirectory,
          staleTime: 5 * 60 * 1000
        }),
        client.prefetchQuery({
          queryKey: ['attendance', 'admin', 'directory'],
          queryFn: () => attendanceService.getDirectoryAttendance(),
          staleTime: 60 * 1000
        }),
        client.prefetchQuery({
          queryKey: ['attendance', 'admin', 'regularizations', 'pending'],
          queryFn: attendanceService.getManagerPendingRegularizations,
          staleTime: 30 * 1000
        })
      ])
      client.removeQueries({ queryKey: ['dashboard', 'employee'], exact: true })
      return
    }

    await Promise.all([
      client.prefetchQuery({
        queryKey: ['dashboard', 'employee'],
        queryFn: dashboardService.getEmployeeDashboard,
        staleTime: 5 * 60 * 1000
      }),
      client.prefetchQuery({
        queryKey: ['attendance', 'employee', 'my-logs', todayDate],
        queryFn: () => attendanceService.getMyPunchLogs(todayDate),
        staleTime: 30 * 1000
      }),
      client.prefetchQuery({
        queryKey: ['attendance', 'employee', 'regularizations', 'mine'],
        queryFn: attendanceService.getMyRegularizations,
        staleTime: 60 * 1000
      })
    ])
    client.removeQueries({ queryKey: ['dashboard', 'admin'], exact: true })
    client.removeQueries({ queryKey: ['employees'], exact: false })
  }, [queryClient])

  const login = useCallback(async ({ email, password, role }) => {
    try {
      const loginResult = await authService.login({ email, password })

      storage.set(AUTH_STORAGE_KEYS.accessToken, loginResult.access_token)
      storage.set(AUTH_STORAGE_KEYS.refreshToken, loginResult.refresh_token)
      storage.set(AUTH_STORAGE_KEYS.lastActivityAt, Date.now())

      const profile = await authService.getCurrentUser()

      if (role && profile.role !== role) {
        clearAuthState()
        throw new Error(`This account belongs to ${profile.roleName}, not the selected role.`)
      }

      storage.set(AUTH_STORAGE_KEYS.user, profile)
      setToken(loginResult.access_token)
      setRefreshToken(loginResult.refresh_token)
      setUser(profile)
      queryClient.setQueryData(['auth', 'me'], profile)
      await prefetchRoleDependencies(profile)
      scheduleIdleTimeout()

      return { ...loginResult, user: profile }
    } catch (error) {
      clearAuthState()
      throw error
    }
  }, [clearAuthState, prefetchRoleDependencies, queryClient, scheduleIdleTimeout])

  const logout = useCallback(async (reason = 'manual') => {
    if (reason === 'idle') {
      clearAuthState()
      showStatus({
        type: 'error',
        title: 'Session expired',
        message: 'Due to 15 minutes of idle inactivity, you were logged out. Please sign in again to continue.',
        ctaLabel: 'Sign in again'
      })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Logout',
      title: 'Are you sure you want to log out?',
      message: 'Your current session will be closed and protected pages will no longer remain accessible.',
      note: 'Unsaved changes on the current screen may be lost.',
      confirmLabel: 'Logout',
      cancelLabel: 'Stay signed in'
    })

    if (!accepted) return

    await runWithLoader(
      async () => {
        clearAuthState()
        navigate('/login', { replace: true })
      },
      {
        title: 'Logging out',
        message: 'Closing your session securely and returning to the login page.',
        minVisibleMs: 900
      }
    )
  }, [clearAuthState, navigate, runWithLoader, showConfirm, showStatus])

  const value = useMemo(() => ({
    user,
    token,
    refreshToken,
    isAuthenticated: Boolean(user && token),
    isAuthReady: !token || sessionQuery.status !== 'pending',
    isBootstrapping: Boolean(token) && sessionQuery.status === 'pending',
    role: user?.role ?? ROLES.EMPLOYEE,
    login,
    logout,
    refreshSession: sessionQuery.refetch,
    prefetchRoleDependencies,
    registerActivity
  }), [user, token, refreshToken, sessionQuery.status, sessionQuery.refetch, login, logout, prefetchRoleDependencies, registerActivity])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
