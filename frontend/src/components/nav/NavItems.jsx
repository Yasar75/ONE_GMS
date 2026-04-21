import React from 'react'
import { canAccessAppPath, resolveDashboardVariant } from '../../utils/permissions.js'
import { BriefcaseIcon, CalendarIcon, ChecklistIcon, ClockIcon, HomeIcon, UsersIcon } from '../common/AppIcons.jsx'

export function getNavItems(user) {
  const dashboardVariant = resolveDashboardVariant(user)
  const items = []

  if (dashboardVariant === 'management') {
    items.push({ label: 'Dashboard', to: '/admin/dashboard', icon: <HomeIcon /> })
    if (canAccessAppPath(user, '/admin/employees-management')) {
      items.push({ label: 'Employee Management', to: '/admin/employees-management', icon: <UsersIcon /> })
    }
    if (canAccessAppPath(user, '/admin/attendance-management')) {
      items.push({ label: 'Attendance Management', to: '/admin/attendance-management', icon: <ClockIcon /> })
    }
    if (canAccessAppPath(user, '/admin/leave-management')) {
      items.push({ label: 'Leave Management', to: '/admin/leave-management', icon: <CalendarIcon /> })
    }
    if (canAccessAppPath(user, '/admin/project-management')) {
      items.push({ label: 'Project Management', to: '/admin/project-management', icon: <BriefcaseIcon /> })
    }
    if (canAccessAppPath(user, '/admin/task-management')) {
      items.push({ label: 'Task Management', to: '/admin/task-management', icon: <ChecklistIcon /> })
    }
    return items
  }

  if (dashboardVariant === 'employee') {
    items.push({ label: 'Dashboard', to: '/employee/dashboard', icon: <HomeIcon /> })
  }
  if (canAccessAppPath(user, '/employee/attendance')) {
    items.push({ label: 'Attendance', to: '/employee/attendance', icon: <ClockIcon /> })
  }
  if (canAccessAppPath(user, '/employee/apply-leave')) {
    items.push({ label: 'Leave', to: '/employee/apply-leave', icon: <CalendarIcon /> })
  }

  return items
}
