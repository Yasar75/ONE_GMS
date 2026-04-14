import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { storage } from '../../utils/storage.js'
import { ROLES } from '../../utils/role.js'
import { authService } from '../../api/services/auth.service.js'
import { AUTH_STORAGE_KEYS, DEFAULT_EMPLOYEE_PASSWORD, SESSION_IDLE_TIMEOUT_MS } from '../../utils/auth.js'
import { dashboardService } from '../../api/services/dashboard.service.js'
import { employeeService } from '../../api/services/employee.service.js'
import { attendanceService } from '../../api/services/attendance.service.js'
import { getTodayDateInput } from '../../utils/attendance.js'
import { useModal } from './ModalProvider.jsx'
import { canAccessAppPath, isAdminBypassUser, resolveDashboardVariant } from '../../utils/permissions.js'
import { clearPersistentQueryCache } from '../../utils/queryCache.js'

const AuthContext = createContext(null)
const ACTIVITY_EVENTS = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart']
const ACTIVITY_WRITE_THROTTLE_MS = 10 * 1000

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const idleTimerRef = useRef(null)
  const lastActivitySyncRef = useRef(0)

  const [user, setUser] = useState(() => storage.get(AUTH_STORAGE_KEYS.user, null))
  const [token, setToken] = useState(() => storage.get(AUTH_STORAGE_KEYS.accessToken, null))
  const [refreshToken, setRefreshToken] = useState(() => storage.get(AUTH_STORAGE_KEYS.refreshToken, null))

  const clearBrowserSessionStorage = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      window.sessionStorage?.clear()
    } catch {
      // Best-effort cleanup only.
    }
  }, [])

  const clearBrowserRuntimeCache = useCallback(async () => {
    if (typeof window === 'undefined' || !window.caches) return

    try {
      const cacheKeys = await window.caches.keys()
      await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)))
    } catch {
      // Best-effort cache cleanup only.
    }
  }, [])

  const hydrateEmployeeSetupState = useCallback(async (baseUser) => {
    if (!baseUser) return baseUser

    const passwordSetupEmail = String(storage.get(AUTH_STORAGE_KEYS.passwordSetupEmail, '') || '').trim().toLowerCase()
    const mustChangePassword = Boolean(baseUser.email) && passwordSetupEmail === String(baseUser.email).trim().toLowerCase()

    try {
      const profile = await employeeService.getMyProfile()
      const hasEmployeeLink = Boolean(profile?.employee?.uid)
      const setupIncomplete = hasEmployeeLink && !profile?.profileCompletedAt
      const nickname = profile?.nickname ?? baseUser.nickname ?? ''
      const fallbackFirstName = profile?.employee?.firstName || baseUser.firstName || 'User'

      return {
        ...baseUser,
        nickname,
        displayName: nickname || fallbackFirstName,
        avatarUrl: profile?.profileImageUrl || baseUser.avatarUrl || '',
        profileImageUrl: profile?.profileImageUrl || baseUser.profileImageUrl || '',
        canEditProfileDetails: isAdminBypassUser(baseUser) ? true : setupIncomplete,
        canEditProfilePicture: baseUser.canEditProfilePicture ?? null,
        mustCompleteProfile: setupIncomplete,
        mustChangePassword,
        profileCompletedAt: profile?.profileCompletedAt ?? baseUser.profileCompletedAt ?? null,
        firstLoginDeadlineAt: profile?.firstLoginDeadlineAt ?? baseUser.firstLoginDeadlineAt ?? null
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        return {
          ...baseUser,
          mustChangePassword
        }
      }
      return {
        ...baseUser,
        mustChangePassword
      }
    }
  }, [])

  const syncCurrentUser = useCallback((nextUser) => {
    if (!nextUser) return
    storage.set(AUTH_STORAGE_KEYS.user, nextUser)
    setUser(nextUser)
    queryClient.setQueryData(['auth', 'me'], nextUser)
  }, [queryClient])

  const sessionQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => hydrateEmployeeSetupState(await authService.getCurrentUser()),
    enabled: Boolean(token),
    retry: false,
    staleTime: 0,
    meta: { suppressGlobalLoader: true }
  })

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const clearAuthState = useCallback(({ purgeBrowserState = false } = {}) => {
    clearIdleTimer()
    lastActivitySyncRef.current = 0
    storage.remove(AUTH_STORAGE_KEYS.user)
    storage.remove(AUTH_STORAGE_KEYS.accessToken)
    storage.remove(AUTH_STORAGE_KEYS.refreshToken)
    storage.remove(AUTH_STORAGE_KEYS.lastActivityAt)
    storage.remove(AUTH_STORAGE_KEYS.passwordSetupEmail)
    clearPersistentQueryCache()
    employeeService.clearDirectoryCache()

    if (purgeBrowserState) {
      clearBrowserSessionStorage()
      void clearBrowserRuntimeCache()
    }

    setUser(null)
    setToken(null)
    setRefreshToken(null)
    queryClient.clear()
  }, [clearBrowserRuntimeCache, clearBrowserSessionStorage, clearIdleTimer, queryClient])

  const handleIdleTimeout = useCallback(() => {
    clearAuthState({ purgeBrowserState: true })
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

    const now = Date.now()
    if ((now - lastActivitySyncRef.current) < ACTIVITY_WRITE_THROTTLE_MS) return

    lastActivitySyncRef.current = now
    storage.set(AUTH_STORAGE_KEYS.lastActivityAt, now)
    scheduleIdleTimeout()
  }, [scheduleIdleTimeout])

  useEffect(() => {
    if (sessionQuery.data) {
      syncCurrentUser(sessionQuery.data)
    }
  }, [sessionQuery.data, syncCurrentUser])

  useEffect(() => {
    if (sessionQuery.isError) {
      clearAuthState({ purgeBrowserState: true })
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
    const dashboardVariant = resolveDashboardVariant(nextUser)
    const canAccessEmployeeDirectory = canAccessAppPath(nextUser, '/admin/employees-management')
    const canAccessAttendanceManagement = canAccessAppPath(nextUser, '/admin/attendance-management')
    const canAccessSelfAttendance = canAccessAppPath(nextUser, '/employee/attendance') || canAccessAppPath(nextUser, '/employee/dashboard')

    const prefetchTasks = []

    if (dashboardVariant === 'management') {
      prefetchTasks.push(client.prefetchQuery({
        queryKey: ['dashboard', 'admin'],
        queryFn: dashboardService.getAdminDashboard,
        staleTime: 0,
        meta: { suppressGlobalLoader: true }
      }))
      client.removeQueries({ queryKey: ['dashboard', 'employee'], exact: true })
    }

    if (dashboardVariant === 'employee') {
      prefetchTasks.push(client.prefetchQuery({
        queryKey: ['dashboard', 'employee'],
        queryFn: dashboardService.getEmployeeDashboard,
        staleTime: 0,
        meta: { suppressGlobalLoader: true }
      }))
      client.removeQueries({ queryKey: ['dashboard', 'admin'], exact: true })
    }

    if (canAccessEmployeeDirectory) {
      prefetchTasks.push(client.prefetchQuery({
        queryKey: ['employees', 'directory'],
        queryFn: employeeService.getDirectory,
        staleTime: 0,
        meta: { suppressGlobalLoader: true }
      }))
    } else {
      client.removeQueries({ queryKey: ['employees'], exact: false })
    }

    if (canAccessAttendanceManagement) {
      prefetchTasks.push(
        client.prefetchQuery({
          queryKey: ['attendance', 'admin', 'directory'],
          queryFn: () => attendanceService.getAllAttendance(),
          staleTime: 0,
          meta: { suppressGlobalLoader: true }
        }),
        client.prefetchQuery({
          queryKey: ['attendance', 'admin', 'regularizations', 'pending'],
          queryFn: attendanceService.getManagerPendingRegularizations,
          staleTime: 0,
          meta: { suppressGlobalLoader: true }
        })
      )
    }

    if (canAccessSelfAttendance) {
      prefetchTasks.push(
        client.prefetchQuery({
          queryKey: ['attendance', 'employee', 'my-logs', todayDate],
          queryFn: () => attendanceService.getMyPunchLogs(todayDate),
          staleTime: 0,
          meta: { suppressGlobalLoader: true }
        }),
        client.prefetchQuery({
          queryKey: ['attendance', 'employee', 'regularizations', 'mine'],
          queryFn: attendanceService.getMyRegularizations,
          staleTime: 0,
          meta: { suppressGlobalLoader: true }
        })
      )
    }

    await Promise.all(prefetchTasks)
  }, [queryClient])

  const login = useCallback(async ({ email, password, role }) => {
    try {
      clearPersistentQueryCache()
      employeeService.clearDirectoryCache()
      queryClient.clear()
      const loginResult = await authService.login({ email, password })

      storage.set(AUTH_STORAGE_KEYS.accessToken, loginResult.access_token)
      storage.set(AUTH_STORAGE_KEYS.refreshToken, loginResult.refresh_token)
      const now = Date.now()
      lastActivitySyncRef.current = now
      storage.set(AUTH_STORAGE_KEYS.lastActivityAt, now)

      const currentUser = await authService.getCurrentUser()
      const requiresPasswordSetup = password === DEFAULT_EMPLOYEE_PASSWORD

      if (requiresPasswordSetup) {
        storage.set(AUTH_STORAGE_KEYS.passwordSetupEmail, String(currentUser.email || '').trim().toLowerCase())
      } else {
        storage.remove(AUTH_STORAGE_KEYS.passwordSetupEmail)
      }

      const profile = await hydrateEmployeeSetupState(currentUser)

      if (role && profile.role !== role) {
        clearAuthState()
        throw new Error(`This account belongs to ${profile.roleName}, not the selected role.`)
      }

      setToken(loginResult.access_token)
      setRefreshToken(loginResult.refresh_token)
      syncCurrentUser(profile)
      await prefetchRoleDependencies(profile)
      scheduleIdleTimeout()

      return { ...loginResult, user: profile }
    } catch (error) {
      clearAuthState()
      throw error
    }
  }, [clearAuthState, hydrateEmployeeSetupState, prefetchRoleDependencies, scheduleIdleTimeout, syncCurrentUser])

  const logout = useCallback(async (reason = 'manual') => {
    if (reason === 'idle') {
      clearAuthState({ purgeBrowserState: true })
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
        clearAuthState({ purgeBrowserState: true })
        navigate('/login', { replace: true })
      },
      {
        title: 'Logging out',
        message: 'Closing your session securely and returning to the login page.',
        minVisibleMs: 900,
        delayMs: 0
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
    registerActivity,
    syncCurrentUser
  }), [user, token, refreshToken, sessionQuery.status, sessionQuery.refetch, login, logout, prefetchRoleDependencies, registerActivity, syncCurrentUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
