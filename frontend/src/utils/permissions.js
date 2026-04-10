import { ROLES } from './role.js'

const SYSTEM_ADMIN_ROLE_NAME = 'Admin'
const CRUD_ACTIONS = ['c', 'r', 'u', 'd']

const ROLE_MODULE_ALIAS_MAP = {
  // Canonical keys come from backend `.env` MODULES_LIST.
  // Values below map the custom role-matrix labels back to those canonical module names.
  'Manage Roles': 'Roles',
  'Metadata Entries': 'Employee Metadata',
  'Employee Entries': 'Employees Management',
  'Employee Status': 'User Status',
  'Employee Employee Attendance Logs': 'Attendance Overview',
  'Mark Attendance': 'My Attendance Preview',
  'Manage Regularization Requests': 'Manage Regularization',
  'Create Leaves': 'Leave type',
  'Leave Allocations': 'Assign Leave',
  'My Leave Balances': 'My Leave Balance',
  'Apply Leave Requests': 'Leave Request',
  'Manage Leave Requests': 'Manage Leave',
  'Project Management': 'Project',
  'Project Mapping': 'Project Assignment',
  'Project Assignments': 'Project Assignment',
  'Task Management': 'Project Task',
  'Project Tasks': 'Project Task'
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
  employeeStatus: ['User Status', 'Employee Status'],
  employeeManagement: ['Employees Management', 'Employee Entries'],
  employeeDirectory: ['Employees Management', 'Employee Entries'],
  employeeDocuments: ['Employee Documents'],
  myDocuments: ['My Documents'],
  employeeSkills: ['Employee Skills'],
  mySkills: ['My Skills'],
  employeeFamilyDetails: ["Employee's Family Details"],
  myFamilyDetails: ['My Family Details'],
  employeeWorkExperience: ['Employee Work Experience'],
  myWorkExperience: ['My Work Experience'],
  attendanceOverview: ['Attendance Overview', 'Employee Attendance Logs'],
  attendance: ['Attendance Overview', 'Employee Attendance Logs'],
  attendanceLogs: ['Attendance Overview', 'Employee Attendance Logs'],
  myAttendancePreview: ['My Attendance Preview', 'Mark Attendance'],
  manageRegularization: ['Manage Regularization', 'Manage Regularization Requests'],
  attendanceRegularization: ['Manage Regularization', 'Manage Regularization Requests'],
  selfRegularizationLogs: ['Manage Regularization', 'Manage Regularization Requests'],
  attendanceRegularizationLogs: ['Manage Regularization', 'Manage Regularization Requests'],
  shiftRoster: ['Shift Roster'],
  assignShift: ['Assign Shift'],
  myShift: ['My Shift'],
  holidayCalendar: ['Holiday Calendar'],
  leaveType: ['Leave type', 'Create Leaves'],
  assignLeave: ['Assign Leave', 'Leave Allocations'],
  myLeaveBalance: ['My Leave Balance', 'My Leave Balances'],
  leaveRequest: ['Leave Request', 'Apply Leave Requests'],
  manageLeave: ['Manage Leave', 'Manage Leave Requests'],
  project: ['Project', 'Project Management'],
  projectAssignment: ['Project Assignment', 'Project Mapping', 'Project Assignments'],
  projectTask: ['Project Task', 'Task Management', 'Project Tasks']
}

export const ROLE_MATRIX_MODULES = dedupePermissionModules([
  'Roles',
  'Employee Metadata',
  'User Status',
  'Employees Management',
  'My Skills',
  'Employee Skills',
  'My Documents',
  'Employee Documents',
  'My Family Details',
  "Employee's Family Details",
  'My Work Experience',
  'Employee Work Experience',
  'Attendance Overview',
  'My Attendance Preview',
  'Manage Regularization',
  'Shift Roster',
  'Assign Shift',
  'My Shift',
  'Holiday Calendar',
  'Leave type',
  'Assign Leave',
  'My Leave Balance',
  'Leave Request',
  'Manage Leave',
  'Project',
  'Project Assignment',
  'Project Task'
])

export const EMPLOYEE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.roles,
  ...PERMISSION_MODULES.employeeMetadata,
  ...PERMISSION_MODULES.employeeManagement,
  ...PERMISSION_MODULES.employeeStatus
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

export const PROJECT_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.project,
  ...PERMISSION_MODULES.projectAssignment
])

export const TASK_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.projectTask
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
    ...LEAVE_MANAGEMENT_ROUTE_MODULES,
    ...PROJECT_MANAGEMENT_ROUTE_MODULES,
    ...TASK_MANAGEMENT_ROUTE_MODULES
  ]),
  '/admin/employees-management': EMPLOYEE_MANAGEMENT_ROUTE_MODULES,
  '/admin/attendance-management': ATTENDANCE_MANAGEMENT_ROUTE_MODULES,
  '/admin/leave-management': LEAVE_MANAGEMENT_ROUTE_MODULES,
  '/admin/project-management': PROJECT_MANAGEMENT_ROUTE_MODULES,
  '/admin/task-management': TASK_MANAGEMENT_ROUTE_MODULES,
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
  '/admin/project-management',
  '/admin/task-management',
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

  if (normalizedPath === '/admin/dashboard') return isAdminUser
  if (normalizedPath === '/employee/dashboard') return !isAdminUser
  if (normalizedPath === '/employee/attendance') return !isAdminUser
  if (normalizedPath === '/employee/apply-leave') return !isAdminUser

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
  if (isAdminBypassUser(user) || user?.role === ROLES.ADMIN) return 'management'
  if (user) return 'employee'
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
