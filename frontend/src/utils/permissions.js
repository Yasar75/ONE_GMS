import { ROLES } from './role.js'

const SYSTEM_ADMIN_ROLE_NAME = 'Admin'
const CRUD_ACTIONS = ['c', 'r', 'u', 'd']

const ROLE_MODULE_ALIAS_MAP = {
  // Canonical module list is taken from backend `.env` MODULES_LIST.
  // Aliases below come from the backend route guards and older stored permission keys.

  // Administrative aliases
  'Manage Roles': 'Roles',
  
  // Employee Management related aliases
  'Employee': 'Employees Management',
  'Employee Management': 'Employees Management',
  'Employees Entries': 'Employees Management',
  'Metadata Entries': 'Employee Metadata',
  'Employee Entries': 'Employees Management',
  'Employee Status': 'Employees Management',

  // Profile Update related aliases
  'Profile Picture': 'Profile Update',
  'Profile': 'Profile Update',
  'Profile Image': 'Profile Update',
  'Profile nickname': 'Profile Update',
  'Employees Skills': 'Employee Skills', 
  'My Skills': 'Employee Skills',
  'Employee Family Details': "Employee's Family Details",
  'Employee Family Detail': "Employee's Family Details",
  'Employees Family Details': "Employee's Family Details",
  'My Family Detail': "My Family Details",
  'Employees Documents': 'Employee Documents',
  'My Documents': 'Employee Documents',
  'Employee Work Experience': 'Employee Work Experience',
  'My Work Experience': 'My Work Experience',

  // Attendance Management related aliases
  'Attendance': 'Attendance Overview',
  'Attendance Management': 'Attendance Overview',
  'Overview': 'Attendance Overview',
  'Shift Roster': 'Shift Roster',
  'Assign Shift': 'Assign Shift',
  'My Shift': 'My Shift',
  'Manage Attendance': 'Attendance Overview',
  'Mark Attendance': 'Attendance Overview',
  'Employees Attendance Punch Logs': 'My Attendance Preview',
  'Attendance Punch Log': 'My Attendance Preview',
  'Attendance Punch Logs': 'My Attendance Preview',
  'My Attendance Punch Log': 'My Attendance Preview',
  'Manage Regularization': 'Manage Regularization',
  'Apply Regularization': 'Manage Regularization',
  'Attendance Regularization': 'Manage Regularization',
  'Attendance Regularization Logs': 'Manage Regularization',
  'Self Regularization Logs': 'Manage Regularization',
  'Employees Regularization Logs': 'Manage Regularization',
  
  // Leave Management related aliases
  'Holiday Calender': 'Holiday Calendar',
  'Holiday Calandar': 'Holiday Calendar',
  'Organization Calandar': 'Holiday Calendar',
  'My Calendar': 'Holiday Calendar',
  'Leave Type Entries': 'Leave Type',
  'Leave Entries': 'Assign Leave',
  'Manage Leaves': 'Manage Leave',
  'Employees Leave Balance': 'Assign Leave',
  'My Leave Balance': 'My Leave Balance',
  'Leave Requests': 'Leave Request',
  'Manage Leaves Requests': 'Leave Request',  
}

export const PERMISSION_ACTIONS = {
  create: 'c',
  read: 'r',
  update: 'u',
  delete: 'd'
}

export const PERMISSION_MODULES = {
  roles: ['Roles', 'Manage Roles'],
  employeeMetadata: ['Employee Metadata', 'Metadata Entries'],
  employeeManagement: ['Employees Management', 'Employee Management', 'Employee', 'Employees Entries', 'Employee Entries', 'Employee Status'],
  employeeDirectory: ['Employees Management', 'Employee Management', 'Employee', 'Employees Entries', 'Employee Entries', 'Employee Status'],
  profileUpdate: ['Profile Update', 'Profile Picture', 'Profile', 'Profile Image', 'Profile Photo', 'Profile nickname'],
  profilePicture: ['Profile Update', 'Profile Picture', 'Profile', 'Profile Image', 'Profile Photo', 'Profile nickname'],
  employeeDocuments: ['Employee Documents', 'Employees Documents', 'My Documents'],
  employeeSkills: ['Employee Skills', 'My Skills', 'Employees Skills'],
  mySkills: ['Employee Skills', 'My Skills', 'Employees Skills'],
  employeeFamilyDetails: ["Employee's Family Details", 'Employee Family Details', 'Employee Family Detail', 'Employees Family Details', 'Family Details'],
  myFamilyDetails: ['My Family Details', 'My Family Detail', 'Employee Family Details', 'Employee Family Detail', 'Employees Family Details', 'Family Details'],
  employeeWorkExperience: ['Employee Work Experience'],
  myWorkExperience: ['My Work Experience', 'Employee Work Experience'],
  employeeRequests: ['Employee Requests', 'Employee Request', 'Employees Request'],
  attendanceOverview: ['Attendance Overview', 'Attendance', 'Attendance Entries', 'Attendance Management', 'Overview', 'Manage Attendance', 'Mark Attendance'],
  attendance: ['Attendance Overview', 'Attendance', 'Attendance Entries', 'Attendance Management', 'Overview', 'Manage Attendance', 'Mark Attendance'],
  myAttendancePreview: ['My Attendance Preview', 'Attendance Punch Log', 'Attendance Punch Logs', 'Employees Attendance Punch Logs', 'My Attendance Punch Log'],
  attendanceLogs: ['My Attendance Preview', 'Attendance Punch Log', 'Attendance Punch Logs', 'Employees Attendance Punch Logs', 'My Attendance Punch Log'],
  manageRegularization: ['Manage Regularization', 'Attendance Regularization', 'Apply Regularization', 'Employees Regularization Logs'],
  attendanceRegularization: ['Manage Regularization', 'Attendance Regularization', 'Apply Regularization', 'Employees Regularization Logs'],
  selfRegularizationLogs: ['Manage Regularization', 'Self Regularization Logs', 'Attendance Regularization Logs', 'Apply Regularization', 'Employees Regularization Logs'],
  attendanceRegularizationLogs: ['Manage Regularization', 'Self Regularization Logs', 'Attendance Regularization Logs', 'Apply Regularization', 'Employees Regularization Logs'],
  shiftRoster: ['Shift Roster'],
  assignShift: ['Assign Shift', 'Assign Shifts'],
  myShift: ['My Shift'],
  holidayCalendar: ['Holiday Calendar', 'Holiday Calender', 'Holiday Calandar', 'Organization Calandar', 'My Calendar'],
  leaveType: ['Leave Type', 'Leave Type Entries'],
  assignLeave: ['Assign Leave', 'Assign Leaves', 'Leave Entries', 'Leave Balance', 'Employee Leave Balance', 'Employees Leave Balance'],
  myLeaveBalance: ['My Leave Balance', 'Leave Balance', 'Employee Leave Balance', 'Employees Leave Balance'],
  leaveRequest: ['Leave Request', 'Leave Requests', 'Manage Leaves Requests'],
  manageLeave: ['Manage Leave', 'Manage Leaves']
}

export const ROLE_MATRIX_MODULES = dedupePermissionModules([
  'Employees Management',
  'Profile Update',
  'Employee Documents',
  'Employee Metadata',
  'Attendance Overview',
  'Employee Work Experience',
  'My Work Experience',
  'My Attendance Preview',
  'Manage Regularization',
  'Assign Shift',
  'My Shift',
  'Employee Skills',
  'My Family Details',
  "Employee's Family Details",
  'Assign Leave',
  'My Leave Balance',
  'Holiday Calendar',
  'Leave Request',
  'Manage Leave',
  'Leave Type',
  'Shift Roster',
  'Roles'
])

export const EMPLOYEE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.roles,
  ...PERMISSION_MODULES.employeeMetadata,
  ...PERMISSION_MODULES.employeeManagement
])

export const ATTENDANCE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.attendanceOverview,
  ...PERMISSION_MODULES.manageRegularization,
  ...PERMISSION_MODULES.shiftRoster,
  ...PERMISSION_MODULES.assignShift
])

export const LEAVE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.holidayCalendar,
  ...PERMISSION_MODULES.leaveType,
  ...PERMISSION_MODULES.assignLeave,
  ...PERMISSION_MODULES.manageLeave
])

export const SELF_SERVICE_ATTENDANCE_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.myShift,
  ...PERMISSION_MODULES.myAttendancePreview,
  ...PERMISSION_MODULES.manageRegularization
])

export const SELF_SERVICE_LEAVE_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.holidayCalendar,
  ...PERMISSION_MODULES.leaveRequest,
  ...PERMISSION_MODULES.myLeaveBalance
])

const APP_ROUTE_ACCESS = {
  '/admin/dashboard': dedupePermissionModules([
    ...EMPLOYEE_MANAGEMENT_ROUTE_MODULES,
    ...ATTENDANCE_MANAGEMENT_ROUTE_MODULES,
    ...LEAVE_MANAGEMENT_ROUTE_MODULES
  ]),
  '/admin/employees-management': EMPLOYEE_MANAGEMENT_ROUTE_MODULES,
  '/admin/attendance-management': ATTENDANCE_MANAGEMENT_ROUTE_MODULES,
  '/admin/leave-management': LEAVE_MANAGEMENT_ROUTE_MODULES,
  '/employee/dashboard': dedupePermissionModules([
    ...SELF_SERVICE_ATTENDANCE_ROUTE_MODULES,
    ...SELF_SERVICE_LEAVE_ROUTE_MODULES
  ]),
  '/employee/attendance': SELF_SERVICE_ATTENDANCE_ROUTE_MODULES,
  '/employee/apply-leave': SELF_SERVICE_LEAVE_ROUTE_MODULES
}

const HOME_ROUTE_ORDER = [
  '/admin/dashboard',
  '/admin/employees-management',
  '/admin/attendance-management',
  '/admin/leave-management',
  '/employee/dashboard',
  '/employee/attendance',
  '/employee/apply-leave'
]

export function isSystemAdminRoleName(roleName) {
  return String(roleName || '').trim().toLowerCase() === SYSTEM_ADMIN_ROLE_NAME.toLowerCase()
}

export function isAdminBypassUser(user) {
  return isSystemAdminRoleName(user?.roleName ?? user?.role_name ?? '')
}

export function sanitizePermissionModuleName(moduleName) {
  const normalizedValue = String(moduleName || '')
    .replace(/^\s*[\[({<]+/, '')
    .replace(/[\])}>]+\s*$/, '')
    .replace(/^['"`]+|['"`,;:]+$/g, '')
    .trim()

  return /[A-Za-z0-9]/.test(normalizedValue) ? normalizedValue : ''
}

export function toCanonicalPermissionModuleName(moduleName) {
  const sanitizedModuleName = sanitizePermissionModuleName(moduleName)
  if (!sanitizedModuleName) return ''
  return ROLE_MODULE_ALIAS_MAP[sanitizedModuleName] || sanitizedModuleName
}

export function normalizePermissionAction(action) {
  const rawAction = String(action || '').trim().toLowerCase()

  if (!rawAction) return ''
  if (['c', 'create'].includes(rawAction)) return PERMISSION_ACTIONS.create
  if (['r', 'read', 'view'].includes(rawAction)) return PERMISSION_ACTIONS.read
  if (['u', 'update', 'edit'].includes(rawAction)) return PERMISSION_ACTIONS.update
  if (['d', 'delete', 'remove'].includes(rawAction)) return PERMISSION_ACTIONS.delete
  if (rawAction === '*' || rawAction === 'all') return '*'

  return ''
}

export function dedupePermissionModules(modules = []) {
  return Array.from(new Set((Array.isArray(modules) ? modules : [])
    .map(toCanonicalPermissionModuleName)
    .filter(Boolean)))
}

export function normalizePermissionAccess(access = {}) {
  if (!access || typeof access !== 'object' || Array.isArray(access)) return {}

  return Object.entries(access).reduce((accumulator, [moduleName, accessLevels]) => {
    const canonicalModuleName = toCanonicalPermissionModuleName(moduleName)
    if (!canonicalModuleName) return accumulator

    const normalizedLevels = Array.from(new Set((Array.isArray(accessLevels) ? accessLevels : [])
      .map(normalizePermissionAction)
      .filter(Boolean)))

    if (normalizedLevels.length) {
      accumulator[canonicalModuleName] = normalizedLevels
    }

    return accumulator
  }, {})
}

export function buildPermissionLookup(permissionSource = {}) {
  if (permissionSource instanceof Map) return permissionSource

  const permissions = permissionSource?.permissions ?? permissionSource
  const normalizedAccess = normalizePermissionAccess(permissions)
  const lookup = new Map()

  Object.entries(normalizedAccess).forEach(([moduleName, actions]) => {
    lookup.set(moduleName, new Set(actions))
  })

  return lookup
}

export function hasAnyModulePermission(permissionSource, modules = [], requiredActions = []) {
  if (isAdminBypassUser(permissionSource)) return true

  const lookup = buildPermissionLookup(permissionSource)
  if (!lookup.size) return false

  const normalizedModules = dedupePermissionModules(modules)
  if (!normalizedModules.length) return false

  const normalizedActions = Array.from(new Set((Array.isArray(requiredActions) ? requiredActions : [requiredActions])
    .map(normalizePermissionAction)
    .filter(Boolean)))

  if (!normalizedActions.length) return false

  return normalizedModules.some((moduleName) => {
    const actions = lookup.get(moduleName)
    if (!actions?.size) return false
    if (actions.has('*')) return true
    return normalizedActions.some((action) => actions.has(action))
  })
}

export function hasModulePermission(permissionSource, modules = [], requiredAction = PERMISSION_ACTIONS.read) {
  return hasAnyModulePermission(permissionSource, modules, [requiredAction])
}

export function hasModuleVisibility(permissionSource, modules = []) {
  return hasAnyModulePermission(permissionSource, modules, CRUD_ACTIONS)
}

export function normalizeAppPath(pathname = '') {
  const normalizedPath = String(pathname || '').trim()
  if (!normalizedPath || normalizedPath === '/') return normalizedPath || '/'
  return normalizedPath.replace(/\/+$/, '')
}

export function canAccessAppPath(user, pathname = '') {
  const normalizedPath = normalizeAppPath(pathname)
  const isAdminUser = user?.role === ROLES.ADMIN || isAdminBypassUser(user)

  if (!normalizedPath || normalizedPath === '/' || normalizedPath === '/dashboard' || normalizedPath === '/profile') {
    return true
  }

  if (normalizedPath.startsWith('/admin/') && !isAdminUser) {
    return false
  }

  if (normalizedPath.startsWith('/employee/') && isAdminUser) {
    return false
  }

  const requiredModules = APP_ROUTE_ACCESS[normalizedPath]
  if (!requiredModules) return false

  return hasModuleVisibility(user, requiredModules)
}

export function getAccessibleRoutePaths(user) {
  return HOME_ROUTE_ORDER.filter((pathname) => canAccessAppPath(user, pathname))
}

export function resolveHomePath(user) {
  return getAccessibleRoutePaths(user)[0] || '/profile'
}

export function resolveDashboardVariant(user) {
  if (canAccessAppPath(user, '/admin/dashboard')) return 'management'
  if (canAccessAppPath(user, '/employee/dashboard')) return 'employee'
  return null
}

export function filterAccessibleTabs(tabs = [], canAccessTab = () => true) {
  return (Array.isArray(tabs) ? tabs : []).filter((tab) => canAccessTab(tab?.key))
}

export function resolveAccessibleTab(tabs = [], currentTab = '', canAccessTab = () => true, fallback = '') {
  const accessibleTabs = filterAccessibleTabs(tabs, canAccessTab)
  if (!accessibleTabs.length) return fallback
  if (accessibleTabs.some((tab) => tab.key === currentTab)) return currentTab
  return accessibleTabs[0].key
}
