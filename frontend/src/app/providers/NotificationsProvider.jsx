import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './AuthProvider.jsx'
import { dashboardService } from '../../api/services/dashboard.service.js'
import { attendanceService } from '../../api/services/attendance.service.js'
import { leaveService } from '../../api/services/leave.service.js'
import { employeeService } from '../../api/services/employee.service.js'
import { storage } from '../../utils/storage.js'
import { canAccessAppPath, resolveDashboardVariant } from '../../utils/permissions.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

const NotificationsContext = createContext(null)
const NOTIFICATION_STATE_KEY_PREFIX = 'one_gms.notifications.state.v1.'
const NOTIFICATION_REFRESH_MS = 3 * 60 * 1000
const NOTIFICATION_STALE_MS = 2 * 60 * 1000
const NOTIFICATION_PEEK_AUTO_HIDE_MS = 6200

function parseTimestamp(value) {
  const parsedValue = Date.parse(value || '')
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function buildNotificationStateKey(user) {
  const identifier = String(user?.uid || user?.email || '').trim().toLowerCase()
  return identifier ? `${NOTIFICATION_STATE_KEY_PREFIX}${identifier}` : ''
}

function normalizeNotificationState(value) {
  const items = value?.items && typeof value.items === 'object' && !Array.isArray(value.items)
    ? value.items
    : {}

  return {
    items: Object.entries(items).reduce((accumulator, [id, status]) => {
      if (!id) return accumulator
      accumulator[id] = {
        openedAt: Number(status?.openedAt) || 0,
        readAt: Number(status?.readAt) || 0
      }
      return accumulator
    }, {})
  }
}

function areNotificationStatesEqual(leftState, rightState) {
  const leftItems = normalizeNotificationState(leftState).items
  const rightItems = normalizeNotificationState(rightState).items
  const leftIds = Object.keys(leftItems)
  const rightIds = Object.keys(rightItems)

  if (leftIds.length !== rightIds.length) return false

  return leftIds.every((id) => (
    Object.prototype.hasOwnProperty.call(rightItems, id)
    && leftItems[id]?.openedAt === rightItems[id]?.openedAt
    && leftItems[id]?.readAt === rightItems[id]?.readAt
  ))
}

function readNotificationState(storageKey) {
  if (!storageKey) return { items: {} }
  return normalizeNotificationState(storage.get(storageKey, { items: {} }))
}

function pruneNotificationState(currentState, activeIds = []) {
  const allowedIds = new Set((Array.isArray(activeIds) ? activeIds : []).filter(Boolean))
  const currentEntries = Object.entries(currentState?.items || {})
  const nextItems = currentEntries.reduce((accumulator, [id, status]) => {
    if (allowedIds.has(id)) accumulator[id] = status
    return accumulator
  }, {})

  return currentEntries.length === Object.keys(nextItems).length
    ? currentState
    : { items: nextItems }
}

function markOpenedInState(currentState, notificationIds = []) {
  const timestamp = Date.now()
  let didChange = false
  const nextItems = { ...(currentState?.items || {}) }

  notificationIds.forEach((notificationId) => {
    if (!notificationId) return
    const current = nextItems[notificationId] || { openedAt: 0, readAt: 0 }
    if (current.openedAt) return
    nextItems[notificationId] = { ...current, openedAt: timestamp }
    didChange = true
  })

  return didChange ? { items: nextItems } : currentState
}

function markReadInState(currentState, notificationIds = []) {
  const timestamp = Date.now()
  let didChange = false
  const nextItems = { ...(currentState?.items || {}) }

  notificationIds.forEach((notificationId) => {
    if (!notificationId) return
    const current = nextItems[notificationId] || { openedAt: 0, readAt: 0 }
    if (current.readAt) return
    nextItems[notificationId] = {
      ...current,
      openedAt: current.openedAt || timestamp,
      readAt: timestamp
    }
    didChange = true
  })

  return didChange ? { items: nextItems } : currentState
}

function createNotification({
  id,
  tone = 'info',
  category = 'Updates',
  title,
  message,
  to,
  createdAt = 0,
  priority = 0
}) {
  return {
    id,
    tone,
    category,
    title,
    message,
    to,
    createdAt,
    priority
  }
}

function buildAdminNotifications({ dashboard = {}, pendingLeaveRequests = [], pendingRegularizations = [], profileRequests = [] }) {
  const notifications = []
  const widgets = dashboard?.widgets || {}
  const sortedPendingRegularizations = [...pendingRegularizations].sort((left, right) => (
    parseTimestamp(right.updatedAt || right.createdAt) - parseTimestamp(left.updatedAt || left.createdAt)
  ))
  const sortedPendingLeaveRequests = [...pendingLeaveRequests].sort((left, right) => (
    parseTimestamp(right.reviewedAt || right.startDate) - parseTimestamp(left.reviewedAt || left.startDate)
  ))
  const employeeAttention = profileRequests.reduce((summary, item) => {
    if (item?.isBackendLocked) summary.locked += 1
    if (!item?.firstLoginAt) summary.pendingFirstLogin += 1
    return summary
  }, { locked: 0, pendingFirstLogin: 0 })
  const employeeAttentionCount = employeeAttention.locked + employeeAttention.pendingFirstLogin

  if (sortedPendingLeaveRequests.length) {
    notifications.push(createNotification({
      id: `admin-pending-leaves-${sortedPendingLeaveRequests.length}-${sortedPendingLeaveRequests[0]?.uid || 'queue'}`,
      tone: 'warning',
      category: 'Pending approvals',
      title: `${sortedPendingLeaveRequests.length} leave request${sortedPendingLeaveRequests.length === 1 ? '' : 's'} waiting review`,
      message: 'Open Manage Leaves to approve or reject the current queue.',
      to: '/admin/leave-management?tab=apply',
      createdAt: parseTimestamp(sortedPendingLeaveRequests[0]?.reviewedAt || sortedPendingLeaveRequests[0]?.startDate),
      priority: 5
    }))
  }

  if (sortedPendingRegularizations.length) {
    notifications.push(createNotification({
      id: `admin-pending-regularizations-${sortedPendingRegularizations.length}-${sortedPendingRegularizations[0]?.uid || 'queue'}`,
      tone: 'warning',
      category: 'Pending approvals',
      title: `${sortedPendingRegularizations.length} regularization request${sortedPendingRegularizations.length === 1 ? '' : 's'} awaiting action`,
      message: 'Open Manage Regularization to verify attendance corrections.',
      to: '/admin/attendance-management?tab=regularization',
      createdAt: parseTimestamp(sortedPendingRegularizations[0]?.updatedAt || sortedPendingRegularizations[0]?.createdAt),
      priority: 5
    }))
  }

  if (employeeAttentionCount) {
    notifications.push(createNotification({
      id: `admin-employee-status-${employeeAttention.locked}-${employeeAttention.pendingFirstLogin}`,
      tone: 'info',
      category: 'Employee status',
      title: `${employeeAttentionCount} employee account${employeeAttentionCount === 1 ? '' : 's'} need attention`,
      message: `${employeeAttention.pendingFirstLogin} pending first login • ${employeeAttention.locked} locked account${employeeAttention.locked === 1 ? '' : 's'}.`,
      to: '/admin/employees-management?tab=requests',
      priority: 4
    }))
  }

  ;(widgets.upcomingEvents || []).slice(0, 3).forEach((event, index) => {
    notifications.push(createNotification({
      id: `admin-event-${String(event?.title || '').toLowerCase()}-${String(event?.date || '').toLowerCase()}`,
      tone: 'info',
      category: 'Events',
      title: event?.title || `Upcoming event ${index + 1}`,
      message: event?.date ? `Scheduled for ${event.date}. Open the dashboard for the latest overview.` : 'Open the dashboard for the latest overview.',
      to: '/admin/dashboard',
      priority: 3
    }))
  })

  ;(widgets.holidayCalendar || []).slice(0, 3).forEach((holiday, index) => {
    notifications.push(createNotification({
      id: `admin-holiday-${String(holiday?.title || '').toLowerCase()}-${String(holiday?.date || '').toLowerCase()}`,
      tone: 'success',
      category: 'Calendar',
      title: holiday?.title || `Holiday update ${index + 1}`,
      message: holiday?.date ? `Marked on ${holiday.date}. Open Holiday Calendar to review the calendar.` : 'Open Holiday Calendar to review the calendar.',
      to: '/admin/leave-management?tab=holiday',
      priority: 2
    }))
  })

  ;(widgets.updates || []).slice(0, 3).forEach((update, index) => {
    notifications.push(createNotification({
      id: `admin-update-${index}-${String(update || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      tone: 'info',
      category: 'Updates',
      title: 'Workspace update',
      message: String(update || '').trim() || 'Open the dashboard for the latest workspace update.',
      to: '/admin/dashboard',
      priority: 1
    }))
  })

  return notifications
}

function buildEmployeeNotifications({ dashboard = {}, myLeaveRequests = [], myRegularizations = [] }) {
  const notifications = []
  const widgets = dashboard?.widgets || {}
  const pendingLeaveRequests = myLeaveRequests.filter((item) => !['approved', 'rejected'].includes(String(item?.status || '').trim().toLowerCase()))
  const pendingRegularizations = myRegularizations.filter((item) => !['approved', 'rejected'].includes(String(item?.status || '').trim().toLowerCase()))
  const latestResolvedLeave = [...myLeaveRequests]
    .filter((item) => ['approved', 'rejected'].includes(String(item?.status || '').trim().toLowerCase()))
    .sort((left, right) => parseTimestamp(right.reviewedAt || right.startDate) - parseTimestamp(left.reviewedAt || left.startDate))[0] || null
  const latestResolvedRegularization = [...myRegularizations]
    .filter((item) => ['approved', 'rejected'].includes(String(item?.status || '').trim().toLowerCase()))
    .sort((left, right) => parseTimestamp(right.reviewedAt || right.updatedAt || right.createdAt) - parseTimestamp(left.reviewedAt || left.updatedAt || left.createdAt))[0] || null

  if (pendingLeaveRequests.length) {
    notifications.push(createNotification({
      id: `employee-pending-leaves-${pendingLeaveRequests.length}-${pendingLeaveRequests[0]?.uid || 'queue'}`,
      tone: 'warning',
      category: 'Leave',
      title: `${pendingLeaveRequests.length} leave request${pendingLeaveRequests.length === 1 ? '' : 's'} still in progress`,
      message: 'Open Apply Leave to track approvals and updated balances.',
      to: '/employee/apply-leave?tab=apply',
      createdAt: parseTimestamp(pendingLeaveRequests[0]?.reviewedAt || pendingLeaveRequests[0]?.startDate),
      priority: 5
    }))
  }

  if (pendingRegularizations.length) {
    notifications.push(createNotification({
      id: `employee-pending-regularizations-${pendingRegularizations.length}-${pendingRegularizations[0]?.uid || 'queue'}`,
      tone: 'warning',
      category: 'Attendance',
      title: `${pendingRegularizations.length} regularization request${pendingRegularizations.length === 1 ? '' : 's'} pending`,
      message: 'Open Apply Regularization to review reviewer progress and notes.',
      to: '/employee/attendance?tab=regularization',
      createdAt: parseTimestamp(pendingRegularizations[0]?.updatedAt || pendingRegularizations[0]?.createdAt),
      priority: 5
    }))
  }

  if (latestResolvedLeave) {
    const normalizedStatus = String(latestResolvedLeave.status || '').trim().toLowerCase()
    notifications.push(createNotification({
      id: `employee-leave-resolution-${latestResolvedLeave.uid}-${normalizedStatus}-${latestResolvedLeave.reviewedAt || latestResolvedLeave.startDate || 'latest'}`,
      tone: normalizedStatus === 'approved' ? 'success' : 'danger',
      category: 'Leave',
      title: `Leave request ${normalizedStatus}`,
      message: normalizedStatus === 'approved'
        ? 'One of your leave requests was approved. Open Apply Leave to review the final note.'
        : 'One of your leave requests was rejected. Open Apply Leave to review the reviewer note.',
      to: '/employee/apply-leave?tab=apply',
      createdAt: parseTimestamp(latestResolvedLeave.reviewedAt || latestResolvedLeave.startDate),
      priority: 4
    }))
  }

  if (latestResolvedRegularization) {
    const normalizedStatus = String(latestResolvedRegularization.status || '').trim().toLowerCase()
    notifications.push(createNotification({
      id: `employee-regularization-resolution-${latestResolvedRegularization.uid}-${normalizedStatus}-${latestResolvedRegularization.reviewedAt || latestResolvedRegularization.updatedAt || latestResolvedRegularization.createdAt || 'latest'}`,
      tone: normalizedStatus === 'approved' ? 'success' : 'danger',
      category: 'Attendance',
      title: `Regularization ${normalizedStatus}`,
      message: normalizedStatus === 'approved'
        ? 'An attendance correction was approved. Open Apply Regularization for the full timeline.'
        : 'An attendance correction was rejected. Open Apply Regularization for the reviewer details.',
      to: '/employee/attendance?tab=regularization',
      createdAt: parseTimestamp(latestResolvedRegularization.reviewedAt || latestResolvedRegularization.updatedAt || latestResolvedRegularization.createdAt),
      priority: 4
    }))
  }

  ;(widgets.upcomingEvents || []).slice(0, 3).forEach((event, index) => {
    notifications.push(createNotification({
      id: `employee-event-${String(event?.title || '').toLowerCase()}-${String(event?.date || '').toLowerCase()}`,
      tone: 'info',
      category: 'Events',
      title: event?.title || `Upcoming event ${index + 1}`,
      message: event?.date ? `Scheduled for ${event.date}. Open the dashboard for details.` : 'Open the dashboard for details.',
      to: '/employee/dashboard',
      priority: 3
    }))
  })

  ;(widgets.holidayCalendar || []).slice(0, 3).forEach((holiday, index) => {
    notifications.push(createNotification({
      id: `employee-holiday-${String(holiday?.title || '').toLowerCase()}-${String(holiday?.date || '').toLowerCase()}`,
      tone: 'success',
      category: 'Calendar',
      title: holiday?.title || `Holiday update ${index + 1}`,
      message: holiday?.date ? `Marked on ${holiday.date}. Open Holiday Calendar for the full schedule.` : 'Open Holiday Calendar for the full schedule.',
      to: '/employee/apply-leave?tab=holiday',
      priority: 2
    }))
  })

  ;(widgets.updates || []).slice(0, 3).forEach((update, index) => {
    notifications.push(createNotification({
      id: `employee-update-${index}-${String(update || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      tone: 'info',
      category: 'Updates',
      title: 'Workspace update',
      message: String(update || '').trim() || 'Open the dashboard for the latest update.',
      to: '/employee/dashboard',
      priority: 1
    }))
  })

  return notifications
}

function enrichNotifications(items = [], currentState = { items: {} }) {
  return items
    .filter((item) => item?.id && item?.title && item?.to)
    .map((item) => {
      const status = currentState?.items?.[item.id] || { openedAt: 0, readAt: 0 }
      return {
        ...item,
        openedAt: status.openedAt,
        readAt: status.readAt,
        isOpened: Boolean(status.openedAt),
        isRead: Boolean(status.readAt),
        isNewUnread: !status.openedAt && !status.readAt
      }
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority
      if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt
      return String(left.title || '').localeCompare(String(right.title || ''))
    })
}

function buildNotificationQueryOptions({ queryKey, queryFn, enabled }) {
  return {
    queryKey,
    queryFn: () => withPersistentCache(queryKey, queryFn),
    enabled,
    retry: false,
    initialData: () => readCachedQuery(queryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(queryKey),
    staleTime: NOTIFICATION_STALE_MS,
    gcTime: 15 * 60 * 1000,
    refetchInterval: enabled ? NOTIFICATION_REFRESH_MS : false,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: true,
    meta: {
      suppressGlobalLoader: true
    }
  }
}

export function NotificationsProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const dashboardVariant = resolveDashboardVariant(user)
  const notificationStateKey = useMemo(() => buildNotificationStateKey(user), [user])
  const [notificationState, setNotificationState] = useState(() => readNotificationState(notificationStateKey))
  const [peekNotification, setPeekNotification] = useState(null)
  const surfacedNotificationIdsRef = useRef(new Set())

  const canViewAdminDashboard = isAuthenticated && dashboardVariant === 'management'
  const canViewEmployeeDashboard = isAuthenticated && dashboardVariant === 'employee'
  const canViewAdminLeave = isAuthenticated && canAccessAppPath(user, '/admin/leave-management')
  const canViewAdminAttendance = isAuthenticated && canAccessAppPath(user, '/admin/attendance-management')
  const canViewAdminEmployees = isAuthenticated && canAccessAppPath(user, '/admin/employees-management')
  const canViewEmployeeLeave = isAuthenticated && canAccessAppPath(user, '/employee/apply-leave')
  const canViewEmployeeAttendance = isAuthenticated && canAccessAppPath(user, '/employee/attendance')

  const dashboardQueryKey = ['dashboard', canViewAdminDashboard ? 'admin' : 'employee']

  const dashboardQuery = useQuery({
    ...buildNotificationQueryOptions({
      queryKey: dashboardQueryKey,
      queryFn: canViewAdminDashboard ? dashboardService.getAdminDashboard : dashboardService.getEmployeeDashboard,
      enabled: canViewAdminDashboard || canViewEmployeeDashboard
    })
  })

  const pendingLeaveQuery = useQuery({
    ...buildNotificationQueryOptions({
      queryKey: ['leave', 'requests', 'pending'],
      queryFn: leaveService.getPendingLeaveRequests,
      enabled: canViewAdminLeave
    })
  })

  const pendingRegularizationsQuery = useQuery({
    ...buildNotificationQueryOptions({
      queryKey: ['attendance', 'admin', 'regularizations', 'pending'],
      queryFn: attendanceService.getManagerPendingRegularizations,
      enabled: canViewAdminAttendance
    })
  })

  const profileRequestsQuery = useQuery({
    ...buildNotificationQueryOptions({
      queryKey: ['employees', 'profile-requests'],
      queryFn: employeeService.getProfileRequests,
      enabled: canViewAdminEmployees
    })
  })

  const myLeaveRequestsQuery = useQuery({
    ...buildNotificationQueryOptions({
      queryKey: ['leave', 'requests', 'mine'],
      queryFn: leaveService.getMyLeaveRequests,
      enabled: canViewEmployeeLeave
    })
  })

  const myRegularizationsQuery = useQuery({
    ...buildNotificationQueryOptions({
      queryKey: ['attendance', 'employee', 'regularizations', 'mine'],
      queryFn: attendanceService.getMyRegularizations,
      enabled: canViewEmployeeAttendance
    })
  })

  useEffect(() => {
    setNotificationState(readNotificationState(notificationStateKey))
    setPeekNotification(null)
    surfacedNotificationIdsRef.current.clear()
  }, [notificationStateKey])

  useEffect(() => {
    if (!notificationStateKey) return undefined

    function handleStorage(event) {
      if (event.key !== notificationStateKey) return

      try {
        setNotificationState(normalizeNotificationState(event.newValue ? JSON.parse(event.newValue) : { items: {} }))
      } catch {
        setNotificationState({ items: {} })
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [notificationStateKey])

  const updateNotificationState = useCallback((updater) => {
    setNotificationState((currentState) => {
      const nextState = normalizeNotificationState(typeof updater === 'function' ? updater(currentState) : updater)
      if (areNotificationStatesEqual(currentState, nextState)) return currentState
      if (notificationStateKey) storage.set(notificationStateKey, nextState)
      return nextState
    })
  }, [notificationStateKey])

  const baseNotifications = useMemo(() => {
    if (canViewAdminDashboard) {
      return buildAdminNotifications({
        dashboard: dashboardQuery.data || {},
        pendingLeaveRequests: pendingLeaveQuery.data || [],
        pendingRegularizations: pendingRegularizationsQuery.data || [],
        profileRequests: profileRequestsQuery.data || []
      })
    }

    if (canViewEmployeeDashboard) {
      return buildEmployeeNotifications({
        dashboard: dashboardQuery.data || {},
        myLeaveRequests: myLeaveRequestsQuery.data || [],
        myRegularizations: myRegularizationsQuery.data || []
      })
    }

    return []
  }, [
    canViewAdminDashboard,
    canViewEmployeeDashboard,
    dashboardQuery.data,
    myLeaveRequestsQuery.data,
    myRegularizationsQuery.data,
    pendingLeaveQuery.data,
    pendingRegularizationsQuery.data,
    profileRequestsQuery.data
  ])

  useEffect(() => {
    updateNotificationState((currentState) => pruneNotificationState(currentState, baseNotifications.map((item) => item.id)))
  }, [baseNotifications, updateNotificationState])

  const notifications = useMemo(() => enrichNotifications(baseNotifications, notificationState), [baseNotifications, notificationState])
  const unreadCount = useMemo(() => notifications.filter((item) => item.isNewUnread).length, [notifications])
  const hasOpenedUnread = useMemo(() => notifications.some((item) => item.isOpened && !item.isRead), [notifications])
  const isLoading = (canViewAdminDashboard || canViewEmployeeDashboard) && (
    dashboardQuery.isPending
    || pendingLeaveQuery.isPending
    || pendingRegularizationsQuery.isPending
    || profileRequestsQuery.isPending
    || myLeaveRequestsQuery.isPending
    || myRegularizationsQuery.isPending
  )

  useEffect(() => {
    notifications.forEach((notification) => {
      const notificationId = String(notification?.id || '')
      if (!notificationId || surfacedNotificationIdsRef.current.has(notificationId)) return

      surfacedNotificationIdsRef.current.add(notificationId)

      const isEmployeeResolutionNotification = notificationId.startsWith('employee-leave-resolution-')
        || notificationId.startsWith('employee-regularization-resolution-')

      if (!isEmployeeResolutionNotification || !notification.isNewUnread) return

      setPeekNotification({
        id: notificationId,
        tone: notification.tone,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        to: notification.to
      })
    })
  }, [notifications])

  useEffect(() => {
    if (!peekNotification?.id) return undefined

    const timeoutId = window.setTimeout(() => {
      setPeekNotification((currentNotification) => {
        if (!currentNotification?.id || currentNotification.id !== peekNotification.id) return currentNotification
        return null
      })
    }, NOTIFICATION_PEEK_AUTO_HIDE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [peekNotification])

  const markNotificationsOpened = useCallback((notificationIds = []) => {
    updateNotificationState((currentState) => markOpenedInState(currentState, notificationIds))
  }, [updateNotificationState])

  const markNotificationRead = useCallback((notificationId) => {
    if (!notificationId) return
    setPeekNotification((currentNotification) => (currentNotification?.id === notificationId ? null : currentNotification))
    updateNotificationState((currentState) => markReadInState(currentState, [notificationId]))
  }, [updateNotificationState])

  const markAllAsRead = useCallback(() => {
    setPeekNotification(null)
    updateNotificationState((currentState) => markReadInState(currentState, notifications.map((item) => item.id)))
  }, [notifications, updateNotificationState])

  const dismissPeekNotification = useCallback(() => {
    setPeekNotification(null)
  }, [])

  const value = useMemo(() => ({
    notifications,
    peekNotification,
    unreadCount,
    hasOpenedUnread,
    isLoading,
    markNotificationsOpened,
    markNotificationRead,
    markAllAsRead,
    dismissPeekNotification
  }), [
    notifications,
    peekNotification,
    unreadCount,
    hasOpenedUnread,
    isLoading,
    markNotificationsOpened,
    markNotificationRead,
    markAllAsRead,
    dismissPeekNotification
  ])

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider')
  return context
}
