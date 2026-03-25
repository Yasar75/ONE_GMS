const SYSTEM_ADMIN_ROLE_NAME = 'Admin'
const CRUD_ACTIONS = ['c', 'r', 'u', 'd']

const ROLE_MODULE_ALIAS_MAP = {
  'Holiday Calandar': 'Holiday Calender',
  'Assign Shifts': 'Assign Shift',
  'Attendance Punch Logs': 'Attendance Punch Log',
  'Leave Requests': 'Leave Request',
  'Assign Leaves': 'Assign Leave',
  'Leave Type Entries': 'Leave Type',
  'Leave Balance': 'Assign Leave',
  'Employee Leave Balance': 'Assign Leave',
  'Employees Leave Balance': 'Assign Leave',
  'Metadata Entries': 'Employee Metadata',
  'Employees Entries': 'Employee',
  'Employee Request': 'Employee Requests',
  'Employees Request': 'Employee Requests',
  'Profile': 'Profile Picture',
  'Profile Image': 'Profile Picture',
  'Profile Photo': 'Profile Picture',
  'Employees Skills': 'Employee Skills',
  'Employees Documents': 'Employee Documents',
  'Family Details': 'Employee Family Details',
  'Employee Family Detail': 'Employee Family Details',
  'Employees Family Details': 'Employee Family Details'
}

export const PERMISSION_ACTIONS = {
  create: 'c',
  read: 'r',
  update: 'u',
  delete: 'd'
}

export const PERMISSION_MODULES = {
  roles: ['Roles'],
  employeeMetadata: ['Employee Metadata', 'Metadata Entries'],
  employeeDirectory: ['Employee', 'Employees Entries'],
  employeeRequests: ['Employee Requests', 'Employee Request', 'Employees Request'],
  employeeSkills: ['Employee Skills', 'Employees Skills'],
  employeeDocuments: ['Employee Documents', 'Employees Documents'],
  employeeFamilyDetails: ['Employee Family Details', 'Employee Family Detail', 'Employees Family Details', 'Family Details'],
  profilePicture: ['Profile Picture', 'Profile', 'Profile Image', 'Profile Photo'],
  attendance: ['Attendance'],
  attendanceLogs: ['Attendance Punch Log', 'Attendance Punch Logs'],
  attendanceRegularization: ['Attendance Regularization'],
  attendanceRegularizationLogs: ['Attendance Regularization Logs'],
  shiftRoster: ['Shift Roster'],
  assignShift: ['Assign Shift', 'Assign Shifts'],
  holidayCalendar: ['Holiday Calender', 'Holiday Calandar'],
  leaveType: ['Leave Type', 'Leave Type Entries'],
  assignLeave: ['Assign Leave', 'Assign Leaves', 'Leave Balance', 'Employee Leave Balance', 'Employees Leave Balance'],
  leaveRequest: ['Leave Request', 'Leave Requests']
}

export const EMPLOYEE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.roles,
  ...PERMISSION_MODULES.employeeMetadata,
  ...PERMISSION_MODULES.employeeDirectory,
  ...PERMISSION_MODULES.employeeRequests
])

export const ATTENDANCE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.attendance,
  ...PERMISSION_MODULES.attendanceLogs,
  ...PERMISSION_MODULES.attendanceRegularization,
  ...PERMISSION_MODULES.attendanceRegularizationLogs,
  ...PERMISSION_MODULES.shiftRoster,
  ...PERMISSION_MODULES.assignShift
])

export const LEAVE_MANAGEMENT_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.holidayCalendar,
  ...PERMISSION_MODULES.leaveType,
  ...PERMISSION_MODULES.assignLeave,
  ...PERMISSION_MODULES.leaveRequest
])

export const SELF_SERVICE_ATTENDANCE_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.attendance,
  ...PERMISSION_MODULES.attendanceLogs,
  ...PERMISSION_MODULES.attendanceRegularization
])

export const SELF_SERVICE_LEAVE_ROUTE_MODULES = dedupePermissionModules([
  ...PERMISSION_MODULES.holidayCalendar,
  ...PERMISSION_MODULES.leaveRequest
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

  if (!normalizedPath || normalizedPath === '/' || normalizedPath === '/dashboard' || normalizedPath === '/profile') {
    return true
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
