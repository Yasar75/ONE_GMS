import { ROLES } from '../../utils/role.js'

export function getNavItems(role) {
  if (role === ROLES.ADMIN) {
    return [
      { label: 'Dashboard', to: '/admin/dashboard', icon: '🏠' },
      { label: 'Employees Management', to: '/admin/employees-management', icon: '👥' },
      { label: 'Attendance Management', to: '/admin/attendance-management', icon: '🕒' },
      { label: 'Leave Management', to: '/admin/leave-management', icon: '🗓️' }
    ]
  }
  return [
    { label: 'Dashboard', to: '/employee/dashboard', icon: '🏠' },
    { label: 'Attendance', to: '/employee/attendance', icon: '🕒' },
    { label: 'Apply Leave', to: '/employee/apply-leave', icon: '🗓️' }
  ]
}
