import { canAccessAppPath, resolveDashboardVariant } from '../../utils/permissions.js'

export function getNavItems(user) {
  const dashboardVariant = resolveDashboardVariant(user)
  const items = []

  if (dashboardVariant === 'management') {
    items.push({ label: 'Dashboard', to: '/admin/dashboard', icon: '🏠' })
    if (canAccessAppPath(user, '/admin/employees-management')) {
      items.push({ label: 'Employees Management', to: '/admin/employees-management', icon: '👥' })
    }
    if (canAccessAppPath(user, '/admin/attendance-management')) {
      items.push({ label: 'Attendance Management', to: '/admin/attendance-management', icon: '🕒' })
    }
    if (canAccessAppPath(user, '/admin/leave-management')) {
      items.push({ label: 'Leave Management', to: '/admin/leave-management', icon: '🗓️' })
    }
    return items
  }

  if (dashboardVariant === 'employee') {
    items.push({ label: 'Dashboard', to: '/employee/dashboard', icon: '🏠' })
  }
  if (canAccessAppPath(user, '/employee/attendance')) {
    items.push({ label: 'Attendance', to: '/employee/attendance', icon: '🕒' })
  }
  if (canAccessAppPath(user, '/employee/apply-leave')) {
    items.push({ label: 'Apply Leave', to: '/employee/apply-leave', icon: '🗓️' })
  }

  return items
}
