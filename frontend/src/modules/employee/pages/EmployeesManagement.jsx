import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import PageHeader from '../../../components/common/PageHeader.jsx'
import PageContentLoader from '../../../components/common/PageContentLoader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import AppDateRangeField from '../../../components/common/AppDateRangeField.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import SearchHighlight from '../../../components/common/SearchHighlight.jsx'
import EmployeeAdditionalDetailsEditor from '../components/EmployeeAdditionalDetailsEditor.jsx'
import { AttendanceTabs } from '../../attendance/components/AttendanceShared.jsx'
import { useEmployeesQuery } from '../../../hooks/employees/useEmployeesQuery.js'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'
import { useEmployeeDirectoryActions } from '../../../hooks/employees/useEmployeeDirectoryActions.js'
import { useEmployeeMetadataQuery, useRoleDirectoryQuery, useRoleModulesQuery } from '../../../hooks/employees/useEmployeeMetadataQuery.js'
import { usePhoneCountryOptionsQuery } from '../../../hooks/employees/usePhoneCountryOptionsQuery.js'
import { useProjectAssignmentsQuery } from '../../../hooks/project/useProjectAssignmentsQuery.js'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import {
  buildDepartmentScopedPositionOptions,
  buildEmployeePayload,
  buildEmployeeMetadataCatalog,
  buildMetadataOptions,
  buildPhoneCountrySelectOptions,
  buildPhoneValue,
  downloadEmployeeImportTemplateCsv,
  downloadEmployeeImportTemplateExcel,
  downloadEmployeesAsCsv,
  downloadEmployeesAsExcel,
  findMetadataEntryByInput,
  findPhoneCountryOptionByInput,
  formatReportingAssignmentLabel,
  formatPhoneLengthRule,
  formatDate,
  formatEmployeeAge,
  getDefaultPhoneCountryOption,
  getEmployeeAge,
  getMetadataDisplayLabel,
  getPhoneCountryOptions,
  getPhoneCountryLengthRule,
  isPositionMappedToDepartment,
  isIsoDateInput,
  normalizeDateInput,
  normalizeReportingAssignments,
  toReportingAssignmentKey,
  parseStoredPhoneValue
} from '../../../utils/employee.js'
import {
  getDateValidationMessage,
  getEmailValidationMessage,
  getPhoneValidationMessage,
  getRequiredFieldMessage,
  getTextValidationMessage,
  hasValidationErrors,
  markFieldsTouched
} from '../../../utils/validation.js'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExportIcon,
  FilterIcon,
  ImportIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  PlusIcon,
  RotateCcwIcon,
  TrashIcon,
  UserPlusIcon,
  ViewIcon
} from '../../../components/common/AppIcons.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { authService } from '../../../api/services/auth.service.js'
import { metadataService } from '../../../api/services/metadata.service.js'
import { employeeService } from '../../../api/services/employee.service.js'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  dedupePermissionModules,
  filterAccessibleTabs,
  hasAnyModulePermission,
  hasModulePermission,
  resolveAccessibleTab,
  toCanonicalPermissionModuleName
} from '../../../utils/permissions.js'
import { filterCollectionByQuery } from '../../../utils/search.js'

const TAB_ITEMS = [
  { key: 'metadata', label: 'Metadata Entries', helper: 'Backend-driven master data' },
  { key: 'entries', label: 'Employee Entries', helper: 'Directory, create, update, export' },
  { key: 'mapping', label: 'Employee Mapping', helper: 'Department-wise reporting structure mapping' },
  { key: 'requests', label: 'Employee Status', helper: 'Backend lock state and first-login status' }
]

const EMPLOYEE_VIEW_TABS = [
  { key: 'basic', label: 'Basic Details', helper: 'Admin-managed identity and organization details' },
  { key: 'additional', label: 'Additional Details', helper: 'Employee-managed profile details' }
]

const EMPLOYEE_PREVIEW_TABS = [
  { key: 'basic-info', label: 'Basic Info', helper: 'Identity, contact, role, and status' },
  { key: 'basic-details', label: 'Basic Details', helper: 'Organization and reporting details' },
  { key: 'additional-details', label: 'Additional Details', helper: 'Personal profile and history' },
  { key: 'documents-uploaded', label: 'Documents Uploaded', helper: 'Uploaded files and downloads' }
]

const METADATA_SECTIONS = [
  { key: 'roles', title: 'Roles', description: 'Auth roles used for login signup and employee assignment.' },
  { key: 'department', title: 'Department', description: 'Business units used in employee records.' },
  { key: 'position', title: 'Position', description: 'Job positions mapped to departments for employee records.' },
  { key: 'status', title: 'Status', description: 'Employment lifecycle statuses.' },
  { key: 'work_location', title: 'Work Location', description: 'Onsite, remote, hybrid, and future location modes.' },
  { key: 'employee_type', title: 'Employee Type', description: 'Engagement model such as full time or contract.' },
  { key: 'blood_group', title: 'Blood Group', description: 'Blood group values available for employee records.' }
]

const ACCESS_LEVEL_OPTIONS = [
  { key: 'c', label: 'Create', shortLabel: 'C' },
  { key: 'r', label: 'Read', shortLabel: 'R' },
  { key: 'u', label: 'Update', shortLabel: 'U' },
  { key: 'd', label: 'Delete', shortLabel: 'D' }
]

const ROLE_ACCESS_EXPANDED_GROUPS_CACHE_KEY = 'one-gms:role-access-expanded-groups:v1'
const ROLE_BADGE_ASSIGNMENTS_CACHE_KEY = 'one-gms:employee-role-badge-assignments:v1'
const ROLE_BADGE_HUE_PALETTE = [214, 174, 26, 352, 128, 262, 44, 192, 14, 286, 92, 226, 168, 334, 58, 204, 140, 8]
const SYSTEM_ADMIN_ROLE_NAME = 'Admin'
const BILLABLE_ASSIGNMENT_STATUSES = new Set(['assigned', 'active'])
const NON_BILLABLE_ASSIGNMENT_STATUSES = new Set(['released', 'hold', 'terminated', 'inactive', 'completed'])
const EMPTY_LIST = Object.freeze([])
const MAPPING_DRAFT_FIELDS = ['managerEmployeeUid', 'hrEmployeeUid', 'teamLeadEmployeeUid', 'coordinatorEmployeeUid']
const REPORTING_ASSIGNMENT_OPTION_ORDER = ['manager_employee_uid', 'hr_employee_uid', 'team_lead_employee_uid', 'coordinator_employee_uid']
const MAPPING_ASSIGNMENT_FIELD_CONFIG = {
  managerEmployeeUid: { assignmentKey: 'manager_employee_uid', label: 'Manager' },
  hrEmployeeUid: { assignmentKey: 'hr_employee_uid', label: 'HR' },
  teamLeadEmployeeUid: { assignmentKey: 'team_lead_employee_uid', label: 'Team Lead' },
  coordinatorEmployeeUid: { assignmentKey: 'coordinator_employee_uid', label: 'Coordinator' }
}
const ROLE_MODULE_VISUAL_GROUP_ORDER = ['Administrative', 'Profile Management', 'Employees Management', 'Attendance Management', 'Leave Management', 'Project Management', 'Task Management', 'Other']
const ROLE_MODULE_VISUAL_CONFIG = [
  {
    title: 'Administrative',
    modules: [
      { key: 'Roles', label: 'Manage Roles' },
      { key: 'Employee Metadata', label: 'Metadata Entries' }
    ]
  },
    {
      title: 'Profile Management',
      modules: [
        { key: 'Profile Update', label: 'Profile Update', hidden: true },
        { key: 'My Skills', label: 'My Skills' },
        { key: 'Employee Skills', label: 'Employee Skills' },
        { key: 'My Documents', label: 'My Documents' },
      { key: 'Employee Documents', label: 'Employee Documents' },
      { key: 'My Family Details', label: 'My Family Details' },
      { key: "Employee's Family Details", label: "Employee's Family Details" },
      { key: 'My Work Experience', label: 'My Work Experience' },
      { key: 'Employee Work Experience', label: 'Employee Work Experience' }
    ]
  },
  {
    title: 'Employees Management',
    modules: [
      { key: 'Employees Management', label: 'Employee Entries' },
      { key: 'Employee Mapping', label: 'Employee Mapping' },
      { key: 'User Status', label: 'Employee Status' }
    ]
  },
  {
    title: 'Attendance Management',
    modules: [
      { key: 'Attendance Overview', label: 'All Employees Attendance Logs' },
      { key: 'My Attendance Preview', label: 'Mark Attendance' },
      { key: 'Manage Regularization', label: 'Manage Regularization Requests' },
      { key: 'Shift Roster', label: 'Shift Roster' },
      { key: 'Assign Shift', label: 'Assign Shift' },
      { key: 'My Shift', label: 'My Shift' }
    ]
  },
  {
    title: 'Leave Management',
    modules: [
      { key: 'Holiday Calendar', label: 'Holiday Calendar' },
      { key: 'Leave type', label: 'Create Leaves' },
      { key: 'Assign Leave', label: 'Leave Allocations' },
      { key: 'My Leave Balance', label: 'My Leave Balances' },
      { key: 'Leave Request', label: 'Apply Leave Requests' },
      { key: 'Manage Leave', label: 'Manage Leave Requests' }
    ]
  },
  {
    title: 'Project Management',
    modules: [
      { key: 'Project', label: 'Manage Projects' },
      { key: 'Project Assignment', label: 'Assign Projects' }
    ]
  },
  {
    title: 'Task Management',
    modules: [
      { key: 'Project Task', label: 'Manage Tasks' }
    ]
  }
]

const ROLE_MODULE_VISUAL_META = (() => {
  const displayNameByKey = {}
  const groupNameByKey = {}
  const sortOrderByKey = {}
  const hiddenModuleKeys = new Set()
  let sortOrder = 0

  ROLE_MODULE_VISUAL_CONFIG.forEach((group) => {
    group.modules.forEach((moduleConfig) => {
      displayNameByKey[moduleConfig.key] = moduleConfig.label
      groupNameByKey[moduleConfig.key] = group.title
      sortOrderByKey[moduleConfig.key] = sortOrder
      sortOrder += 1

      if (moduleConfig.hidden) hiddenModuleKeys.add(moduleConfig.key)
    })
  })

  return { displayNameByKey, groupNameByKey, sortOrderByKey, hiddenModuleKeys }
})()

function createEmptyRoleDraft() {
  return { uid: null, roleName: '', description: '', access: {} }
}

function isSystemAdminRoleName(roleName) {
  return String(roleName || '').trim().toLowerCase() === SYSTEM_ADMIN_ROLE_NAME.toLowerCase()
}

function normalizeEmployeeRoleName(roleName) {
  return String(roleName || '').trim().toLowerCase()
}

function isEmployeeMapped(employee = {}) {
  const reportingAssignments = normalizeReportingAssignments(employee)
  return Boolean(String(reportingAssignments.manager_employee_uid || '').trim())
}

function toCanonicalRoleModuleName(moduleName) {
  return toCanonicalPermissionModuleName(moduleName)
}

function getRoleModuleDisplayName(moduleName) {
  const rawModuleName = String(moduleName || '').trim()
  if (ROLE_MODULE_VISUAL_META.displayNameByKey[rawModuleName]) {
    return ROLE_MODULE_VISUAL_META.displayNameByKey[rawModuleName]
  }

  const canonicalModuleName = toCanonicalRoleModuleName(rawModuleName)
  if (!canonicalModuleName) return ''
  return ROLE_MODULE_VISUAL_META.displayNameByKey[canonicalModuleName] || canonicalModuleName
}

function getRoleModuleSortOrder(moduleName) {
  const rawModuleName = String(moduleName || '').trim()
  if (rawModuleName && ROLE_MODULE_VISUAL_META.sortOrderByKey[rawModuleName] != null) {
    return ROLE_MODULE_VISUAL_META.sortOrderByKey[rawModuleName]
  }

  const canonicalModuleName = toCanonicalRoleModuleName(rawModuleName)
  if (!canonicalModuleName) return Number.MAX_SAFE_INTEGER
  return ROLE_MODULE_VISUAL_META.sortOrderByKey[canonicalModuleName] ?? Number.MAX_SAFE_INTEGER
}

function getRoleModuleAccessKey(moduleName) {
  return toCanonicalRoleModuleName(moduleName) || String(moduleName || '').trim()
}

function getRoleModuleSelectedAccess(access = {}, moduleName = '') {
  return access[getRoleModuleAccessKey(moduleName)] || []
}

function buildFullRoleAccess(modules = []) {
  return dedupeRoleModules(modules).reduce((accumulator, moduleName) => {
    accumulator[moduleName] = ACCESS_LEVEL_OPTIONS.map((option) => option.key)
    return accumulator
  }, {})
}

function getEffectiveRoleAccess(access = {}, roleName = '', modules = []) {
  return isSystemAdminRoleName(roleName) ? buildFullRoleAccess(modules) : normalizeRoleAccess(access)
}

function normalizeRoleAccess(access = {}) {
  if (!access || typeof access !== 'object' || Array.isArray(access)) return {}

  return Object.entries(access).reduce((accumulator, [moduleName, accessLevels]) => {
    const normalizedLevels = ACCESS_LEVEL_OPTIONS
      .map((option) => option.key)
      .filter((level) => Array.isArray(accessLevels) && accessLevels.includes(level))

    const canonicalModuleName = toCanonicalRoleModuleName(moduleName)
    if (canonicalModuleName && normalizedLevels.length) {
      accumulator[canonicalModuleName] = normalizedLevels
    }
    return accumulator
  }, {})
}

function getRoleAccessSummary(access = {}) {
  const configuredModules = Object.entries(normalizeRoleAccess(access))
  if (!configuredModules.length) return 'No access assigned'

  const preview = configuredModules
    .slice(0, 2)
    .map(([moduleName, accessLevels]) => `${getRoleModuleDisplayName(moduleName)} (${accessLevels.map((level) => level.toUpperCase()).join('/')})`)
    .join(', ')

  return `${configuredModules.length} module${configuredModules.length === 1 ? '' : 's'} • ${preview}${configuredModules.length > 2 ? ` +${configuredModules.length - 2} more` : ''}`
}

function buildRoleAccessMeta(access = {}) {
  const configuredModules = Object.values(normalizeRoleAccess(access))
  const permissionCount = configuredModules.reduce((total, accessLevels) => total + accessLevels.length, 0)
  return { moduleCount: configuredModules.length, permissionCount }
}

function toEndUserMetadataSaveError(error) {
  const responseDetail = error?.response?.data?.detail
  const responseMessage = typeof responseDetail === 'string' ? responseDetail : ''
  const flattened = String(responseMessage || error?.message || '').trim()
  const normalized = flattened.toLowerCase()

  if (!normalized) return 'The metadata entry could not be saved. Please try again.'
  if (normalized.includes('value') && normalized.includes('field required')) {
    return 'The entry label is required before saving.'
  }

  return flattened
}

function dedupeRoleModules(modules = []) {
  return dedupePermissionModules(modules)
}

function getRoleModuleGroupName(moduleName) {
  const rawModuleName = String(moduleName || '').trim()
  const configuredGroup = ROLE_MODULE_VISUAL_META.groupNameByKey[rawModuleName]
  if (configuredGroup) return configuredGroup

  const canonicalModuleName = toCanonicalRoleModuleName(rawModuleName)
  if (!canonicalModuleName) return 'Other'

  if (['Roles', 'Employee Metadata'].includes(canonicalModuleName)) return 'Administrative'
  if (['Profile Update', 'My Skills', 'Employee Skills', 'My Documents', 'Employee Documents', "Employee's Family Details", 'My Family Details', 'Employee Work Experience', 'My Work Experience'].includes(canonicalModuleName)) return 'Profile Management'
  if (['Employees Management', 'Employee Mapping', 'User Status'].includes(canonicalModuleName)) return 'Employees Management'
  if (['Attendance Overview', 'My Attendance Preview', 'Manage Regularization', 'Shift Roster', 'Assign Shift', 'My Shift'].includes(canonicalModuleName)) return 'Attendance Management'
  if (['Holiday Calendar', 'Assign Leave', 'My Leave Balance', 'Leave Request', 'Manage Leave', 'Leave type'].includes(canonicalModuleName)) return 'Leave Management'
  return 'Other'
}

function buildRoleModuleGroups(modules = []) {
  const visualModules = dedupeRoleModules(modules)
  if (visualModules.includes('Employees Management') && !visualModules.includes('Employee Mapping')) {
    visualModules.push('Employee Mapping')
  }

  const groupedModules = visualModules.reduce((accumulator, moduleName) => {
    if (ROLE_MODULE_VISUAL_META.hiddenModuleKeys.has(moduleName)) return accumulator
    const groupName = getRoleModuleGroupName(moduleName)
    accumulator[groupName] = accumulator[groupName] || []
    accumulator[groupName].push(moduleName)
    return accumulator
  }, {})

  return ROLE_MODULE_VISUAL_GROUP_ORDER
    .filter((groupName) => Array.isArray(groupedModules[groupName]) && groupedModules[groupName].length)
    .map((groupName) => ({
      key: groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: groupName,
      modules: groupedModules[groupName].sort((leftModule, rightModule) => {
        const leftSortOrder = getRoleModuleSortOrder(leftModule)
        const rightSortOrder = getRoleModuleSortOrder(rightModule)
        if (leftSortOrder !== rightSortOrder) return leftSortOrder - rightSortOrder
        return getRoleModuleDisplayName(leftModule).localeCompare(getRoleModuleDisplayName(rightModule))
      })
    }))
}

function getExpandedGroupKeys(moduleGroups = []) {
  return moduleGroups.map((group) => group.key)
}

function readCachedExpandedGroupKeys() {
  if (typeof window === 'undefined') return []

  try {
    const rawValue = window.localStorage.getItem(ROLE_ACCESS_EXPANDED_GROUPS_CACHE_KEY)
    const parsedValue = rawValue ? JSON.parse(rawValue) : []
    return Array.isArray(parsedValue) ? parsedValue.filter(Boolean) : []
  } catch {
    return []
  }
}

function writeCachedExpandedGroupKeys(groupKeys = []) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(ROLE_ACCESS_EXPANDED_GROUPS_CACHE_KEY, JSON.stringify(Array.from(new Set(groupKeys.filter(Boolean)))))
  } catch {
    // Ignore cache write failures and keep the UI responsive.
  }
}

function hashTextValue(value = '') {
  const normalizedValue = String(value || '')
  let hash = 0

  for (let index = 0; index < normalizedValue.length; index += 1) {
    hash = ((hash << 5) - hash) + normalizedValue.charCodeAt(index)
    hash |= 0
  }

  return Math.abs(hash)
}

function sanitizeRoleBadgeAssignments(rawAssignments = {}) {
  if (!rawAssignments || typeof rawAssignments !== 'object' || Array.isArray(rawAssignments)) return {}

  return Object.entries(rawAssignments).reduce((accumulator, [rawRoleName, rawPaletteIndex]) => {
    const roleName = normalizeEmployeeRoleName(rawRoleName)
    const paletteIndex = Number(rawPaletteIndex)

    if (!roleName || roleName === 'unassigned') return accumulator
    if (!Number.isInteger(paletteIndex)) return accumulator
    if (paletteIndex < 0 || paletteIndex >= ROLE_BADGE_HUE_PALETTE.length) return accumulator

    accumulator[roleName] = paletteIndex
    return accumulator
  }, {})
}

function readCachedRoleBadgeAssignments() {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(ROLE_BADGE_ASSIGNMENTS_CACHE_KEY)
    const parsedValue = rawValue ? JSON.parse(rawValue) : {}
    return sanitizeRoleBadgeAssignments(parsedValue)
  } catch {
    return {}
  }
}

function writeCachedRoleBadgeAssignments(assignments = {}) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(ROLE_BADGE_ASSIGNMENTS_CACHE_KEY, JSON.stringify(sanitizeRoleBadgeAssignments(assignments)))
  } catch {
    // Ignore cache write failures and keep the UI responsive.
  }
}

function buildRoleBadgeAssignments(roleNames = [], cachedAssignments = {}) {
  const paletteSize = ROLE_BADGE_HUE_PALETTE.length || 1
  const normalizedRoleNames = Array.from(new Set(
    roleNames
      .map((roleName) => normalizeEmployeeRoleName(roleName))
      .filter((roleName) => roleName && roleName !== 'unassigned')
  ))
  if (!normalizedRoleNames.length) return {}

  const sanitizedCache = sanitizeRoleBadgeAssignments(cachedAssignments)
  const assignments = {}
  const usedPaletteIndexes = new Set()

  normalizedRoleNames.forEach((roleName) => {
    const cachedIndex = sanitizedCache[roleName]
    if (!Number.isInteger(cachedIndex) || usedPaletteIndexes.has(cachedIndex)) return

    assignments[roleName] = cachedIndex
    usedPaletteIndexes.add(cachedIndex)
  })

  normalizedRoleNames
    .filter((roleName) => assignments[roleName] == null)
    .sort((leftRole, rightRole) => leftRole.localeCompare(rightRole))
    .forEach((roleName) => {
      const startIndex = hashTextValue(roleName) % paletteSize
      let selectedIndex = startIndex

      if (usedPaletteIndexes.size < paletteSize) {
        for (let offset = 0; offset < paletteSize; offset += 1) {
          const candidateIndex = (startIndex + offset) % paletteSize
          if (!usedPaletteIndexes.has(candidateIndex)) {
            selectedIndex = candidateIndex
            break
          }
        }
      }

      assignments[roleName] = selectedIndex
      usedPaletteIndexes.add(selectedIndex)
    })

  return assignments
}

function getRoleBadgeStyleFromPaletteIndex(index = 0) {
  const paletteSize = ROLE_BADGE_HUE_PALETTE.length || 1
  const safeIndex = Number.isInteger(index) ? Math.abs(index) % paletteSize : 0
  const hue = ROLE_BADGE_HUE_PALETTE[safeIndex] ?? ROLE_BADGE_HUE_PALETTE[0]

  return {
    color: `hsl(${hue} 72% 42%)`,
    background: `hsla(${hue}, 82%, 52%, 0.16)`,
    borderColor: `hsla(${hue}, 80%, 46%, 0.32)`
  }
}

function resolveExpandedGroupKeys(moduleGroups = [], preferredKeys = []) {
  const availableKeys = moduleGroups.map((group) => group.key)
  const filteredKeys = preferredKeys.filter((groupKey) => availableKeys.includes(groupKey))
  return filteredKeys.length ? filteredKeys : getExpandedGroupKeys(moduleGroups)
}

function estimateMetadataPanelWeight(section) {
  const entryCount = Array.isArray(section?.entries) ? section.entries.length : 0
  const safeCount = Math.max(entryCount, 1)
  return 3 + safeCount + (section?.key === 'roles' ? 2 : 0)
}

function buildMetadataPanelColumns(sections = [], columnCount = 2) {
  const normalizedColumnCount = Math.max(Number(columnCount) || 0, 1)
  const columns = Array.from({ length: normalizedColumnCount }, () => ({ items: [], weight: 0 }))

  sections.forEach((section) => {
    const targetColumn = columns.reduce((lightestColumn, currentColumn) => (
      currentColumn.weight < lightestColumn.weight ? currentColumn : lightestColumn
    ), columns[0])

    targetColumn.items.push(section)
    targetColumn.weight += estimateMetadataPanelWeight(section)
  })

  return columns.map((column) => column.items)
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateOfBirthBounds() {
  const today = new Date()
  const minDate = new Date(today)
  const maxDate = new Date(today)
  minDate.setFullYear(today.getFullYear() - 65)
  maxDate.setFullYear(today.getFullYear() - 21)
  return { min: toDateInputValue(minDate), max: toDateInputValue(maxDate) }
}

function isDateOfBirthWithinAllowedRange(dateOfBirth) {
  if (!dateOfBirth) return true
  const { min, max } = getDateOfBirthBounds()
  return dateOfBirth >= min && dateOfBirth <= max
}

const EMPLOYEE_FORM_REQUIRED_FIELDS = ['employeeCode', 'email', 'firstName', 'lastName', 'roleType', 'position', 'department', 'phoneLocal', 'joinDate', 'status']

function buildEmployeeFormErrors(draft, formMode) {
  const phone = buildPhoneValue(draft.phoneCountryCode, draft.phoneLocal)
  const emergencyContact = buildPhoneValue(draft.emergencyContactCountryCode, draft.emergencyContactLocal)
  const mobileRule = getPhoneCountryLengthRule(draft.phoneCountryCode)
  const emergencyContactRule = getPhoneCountryLengthRule(draft.emergencyContactCountryCode)

  return {
    employeeCode: formMode === 'create'
      ? getTextValidationMessage(draft.employeeCode, {
        required: true,
        label: 'Employee code',
        pattern: /^[A-Z0-9-]+$/,
        patternMessage: 'Employee code can contain only uppercase letters, numbers, and hyphens.'
      })
      : '',
    email: getEmailValidationMessage(draft.email, { required: true }),
    clientEmail: draft.clientEmail ? getEmailValidationMessage(draft.clientEmail, { label: 'Client email' }) : '',
    firstName: getRequiredFieldMessage(draft.firstName, 'First name'),
    lastName: getRequiredFieldMessage(draft.lastName, 'Last name'),
    roleType: getRequiredFieldMessage(draft.roleType, 'Role'),
    position: getRequiredFieldMessage(draft.position, 'Position'),
    department: getRequiredFieldMessage(draft.department, 'Department'),
    phoneLocal: getPhoneValidationMessage(draft.phoneLocal, {
      required: true,
      label: 'Mobile number',
      min: mobileRule.minLength,
      max: mobileRule.maxLength,
      countryLabel: mobileRule.label,
      countryDialCode: mobileRule.dialCode
    }),
    joinDate: getDateValidationMessage(draft.joinDate, { required: true, label: 'Join date' }),
    status: getRequiredFieldMessage(draft.status, 'Status'),
    dateOfBirth: draft.dateOfBirth && !isDateOfBirthWithinAllowedRange(draft.dateOfBirth)
      ? 'The selected date of birth must keep the employee age between 21 and 65 years.'
      : '',
    emergencyContactLocal: (() => {
      const phoneError = getPhoneValidationMessage(draft.emergencyContactLocal, {
        label: 'Emergency contact',
        min: emergencyContactRule.minLength,
        max: emergencyContactRule.maxLength,
        countryLabel: emergencyContactRule.label,
        countryDialCode: emergencyContactRule.dialCode
      })
      if (phoneError) return phoneError
      if (phone && emergencyContact && phone === emergencyContact) {
        return 'Mobile number and emergency contact cannot be the same.'
      }
      return ''
    })()
  }
}

function buildMetadataFormErrors(draft) {
  return {
    label: getRequiredFieldMessage(draft.label, 'Label'),
    departmentUid: draft.category === 'position'
      ? getRequiredFieldMessage(draft.departmentUid, 'Department')
      : ''
  }
}

function buildRoleFormErrors(draft) {
  return {
    roleName: getRequiredFieldMessage(draft.roleName, 'Role name')
  }
}

function formatTenure(joinDate) {
  if (!joinDate) return '—'
  const start = new Date(joinDate)
  if (Number.isNaN(start.getTime())) return '—'

  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()

  if (now.getDate() < start.getDate()) {
    months -= 1
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years <= 0 && months <= 0) return 'Less than a month'
  if (years <= 0) return `${months} mo`
  if (months <= 0) return `${years} yr`
  return `${years} yr ${months} mo`
}

function calculateExperienceMonths(startDate, endDate = '', isCurrent = false) {
  const start = startDate ? new Date(startDate) : null
  const end = isCurrent || !endDate ? new Date() : new Date(endDate)
  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() >= start.getDate()) months += 1
  return Math.max(months, 1)
}

function formatExperienceDuration(startDate, endDate = '', isCurrent = false) {
  const totalMonths = calculateExperienceMonths(startDate, endDate, isCurrent)
  if (!totalMonths) return '—'

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (!years) return `${months} mo`
  if (!months) return `${years} yr`
  return `${years} yr ${months} mo`
}

function getEmployeeProfileQueryKey(employeeUid) {
  return ['employees', 'profile', String(employeeUid || '')]
}

function createEmptyEmployeeDraft() {
  const defaultPhoneCountry = getDefaultPhoneCountryOption()
  return {
    employeeCode: '',
    firstName: '',
    lastName: '',
    email: '',
    clientEmail: '',
    phoneCountryCode: defaultPhoneCountry.dialCode,
    phoneLocal: '',
    roleType: '',
    department: '',
    position: '',
    joinDate: '',
    status: '',
    employeeType: '',
    workLocation: '',
    dateOfBirth: '',
    gender: '',
    caste: '',
    emergencyContactCountryCode: defaultPhoneCountry.dialCode,
    emergencyContactLocal: '',
    bloodGroup: '',
    address: ''
  }
}

function buildEmployeeDraft(employee) {
  const fallback = createEmptyEmployeeDraft()
  const phone = parseStoredPhoneValue(employee.phone)
  const emergencyContact = parseStoredPhoneValue(employee.emergencyContact)

  return {
    ...fallback,
    employeeCode: employee.employeeCode || employee.id || '',
    firstName: employee.firstName || '',
    lastName: employee.lastName || '',
    email: employee.email || '',
    clientEmail: employee.clientEmail || '',
    phoneCountryCode: phone.countryDialCode || fallback.phoneCountryCode,
    phoneLocal: phone.localNumber || '',
    roleType: employee.roleType || '',
    department: employee.department || '',
    position: employee.position || '',
    joinDate: employee.joinDate || '',
    status: employee.status || '',
    employeeType: employee.employeeType || '',
    workLocation: employee.workLocation || '',
    dateOfBirth: employee.dateOfBirth || '',
    gender: employee.gender || '',
    caste: employee.caste || '',
    emergencyContactCountryCode: emergencyContact.countryDialCode || fallback.emergencyContactCountryCode,
    emergencyContactLocal: emergencyContact.localNumber || '',
    bloodGroup: employee.bloodGroup || '',
    address: employee.address || ''
  }
}

function createMappingDraft(employee) {
  const reportingAssignments = normalizeReportingAssignments(employee)
  return {
    managerEmployeeUid: String(reportingAssignments.manager_employee_uid || ''),
    hrEmployeeUid: String(reportingAssignments.hr_employee_uid || ''),
    teamLeadEmployeeUid: String(reportingAssignments.team_lead_employee_uid || ''),
    coordinatorEmployeeUid: String(reportingAssignments.coordinator_employee_uid || '')
  }
}

function areMappingDraftsEqual(left = {}, right = {}) {
  return MAPPING_DRAFT_FIELDS.every((fieldName) => String(left?.[fieldName] || '') === String(right?.[fieldName] || ''))
}

function buildMappingAssignmentsPayload(draft = {}) {
  const normalizedAssignments = {
    manager_employee_uid: String(draft.managerEmployeeUid || '').trim(),
    hr_employee_uid: String(draft.hrEmployeeUid || '').trim(),
    team_lead_employee_uid: String(draft.teamLeadEmployeeUid || '').trim(),
    coordinator_employee_uid: String(draft.coordinatorEmployeeUid || '').trim()
  }

  return Object.fromEntries(
    Object.entries(normalizedAssignments).filter(([, employeeUid]) => Boolean(employeeUid))
  )
}

function buildSelectOptions(values = [], placeholderLabel = 'All', placeholderValue = 'All') {
  return [
    { value: placeholderValue, label: placeholderLabel, description: 'No filter applied' },
    ...values.map((entry) => {
      if (typeof entry === 'object' && entry !== null) {
        return {
          value: entry.value,
          label: entry.label || String(entry.value || ''),
          description: entry.description || ''
        }
      }
      return { value: entry, label: entry, description: `${entry} records` }
    })
  ]
}

function normalizeAssignmentStatus(status) {
  return String(status || '').trim().toLowerCase()
}

function formatAssignmentStatus(status) {
  const normalized = normalizeAssignmentStatus(status)
  if (!normalized) return ''
  return normalized
    .split(/\s+/)
    .map((part) => (part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : ''))
    .join(' ')
}

function resolveBillingStatus(assignmentStatuses = []) {
  const normalizedStatuses = Array.from(new Set((Array.isArray(assignmentStatuses) ? assignmentStatuses : [])
    .map(normalizeAssignmentStatus)
    .filter(Boolean)))

  if (normalizedStatuses.some((status) => BILLABLE_ASSIGNMENT_STATUSES.has(status))) {
    return 'Billable'
  }

  if (normalizedStatuses.length && normalizedStatuses.every((status) => NON_BILLABLE_ASSIGNMENT_STATUSES.has(status))) {
    return 'Non Billable'
  }

  return 'Non Billable'
}

function mergeOptionValues(seedOptions = [], records = []) {
  return Array.from(new Set([...seedOptions, ...records.filter(Boolean)])).filter(Boolean)
}

function isJoinDateInRange(joinDate, range) {
  if (!joinDate) return !range?.start && !range?.end
  const value = String(joinDate)
  if (range?.start && value < range.start) return false
  if (range?.end && value > range.end) return false
  return true
}

function parseCsvLine(line = '') {
  const values = []
  let current = ''
  let isQuoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        current += '"'
        index += 1
      } else {
        isQuoted = !isQuoted
      }
      continue
    }

    if (char === ',' && !isQuoted) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

function normalizeImportHeader(header = '') {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseBulkEmployeeCsv(content = '') {
  const lines = String(content || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  if (lines.length <= 1) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0]).map(normalizeImportHeader)
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const mappedRow = headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] || ''
      return accumulator
    }, {})
    return Object.values(mappedRow).some((value) => String(value || '').trim()) ? mappedRow : null
  })

  return { headers, rows: rows.filter(Boolean) }
}

async function parseBulkEmployeeXlsx(file) {
  const workbookBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(workbookBuffer, { type: 'array', raw: true, cellDates: false })
  const [firstSheetName] = workbook.SheetNames
  if (!firstSheetName) return { headers: [], rows: [] }

  const firstSheet = workbook.Sheets[firstSheetName]
  const sheetRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: '' })
  if (!Array.isArray(sheetRows) || sheetRows.length <= 1) return { headers: [], rows: [] }

  const headers = (Array.isArray(sheetRows[0]) ? sheetRows[0] : []).map(normalizeImportHeader)
  const rows = sheetRows.slice(1).map((sheetRow) => {
    const values = Array.isArray(sheetRow) ? sheetRow : []
    const mappedRow = headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] ?? ''
      return accumulator
    }, {})
    return Object.values(mappedRow).some((value) => String(value || '').trim()) ? mappedRow : null
  }).filter(Boolean)

  return { headers, rows }
}

function getImportFileExtension(fileName = '') {
  const segments = String(fileName || '').toLowerCase().trim().split('.')
  return segments.length > 1 ? segments.pop() : ''
}

async function parseBulkEmployeeFile(file) {
  const extension = getImportFileExtension(file?.name || '')

  if (extension === 'csv') {
    const content = await file.text()
    return parseBulkEmployeeCsv(content)
  }

  if (extension === 'xls') {
    throw new Error('Legacy Excel .xls is no longer supported. Please upload an .xlsx file.')
  }

  if (extension === 'xlsx') {
    return parseBulkEmployeeXlsx(file)
  }

  throw new Error('Unsupported file format. Upload CSV or Excel (.xlsx).')
}

function pickCsvValue(row, aliases) {
  const selectedValue = aliases.reduce((selected, alias) => {
    if (String(selected ?? '').trim()) return selected
    return row[normalizeImportHeader(alias)] ?? ''
  }, '')

  return String(selectedValue ?? '')
}

function resolveImportedPhoneValue({ rawNumber = '', rawCountryCode = '', fieldLabel = 'Phone' } = {}) {
  const numberValue = String(rawNumber || '').trim()
  const countryCodeValue = String(rawCountryCode || '').trim()
  if (!numberValue) return { value: '', error: '' }

  const normalizedNumberValue = numberValue.replace(/[^\d+]/g, '')
  const hasExplicitDialCode = /^\+/.test(normalizedNumberValue)
  const selectedCountry = countryCodeValue ? findPhoneCountryOptionByInput(countryCodeValue) : null
  if (countryCodeValue && !selectedCountry) {
    return { value: '', error: `${fieldLabel} country code "${countryCodeValue}" is invalid.` }
  }

  if (hasExplicitDialCode) {
    const detectedCountry = [...getPhoneCountryOptions()]
      .sort((left, right) => right.dialCode.length - left.dialCode.length)
      .find((option) => normalizedNumberValue.startsWith(option.dialCode))

    if (!detectedCountry) {
      return { value: '', error: `${fieldLabel} country code could not be recognized.` }
    }

    if (selectedCountry && selectedCountry.dialCode !== detectedCountry.dialCode) {
      return {
        value: '',
        error: `${fieldLabel} country code "${countryCodeValue}" does not match the prefix used in ${fieldLabel.toLowerCase()}.`
      }
    }

    const parsedPhone = {
      countryDialCode: detectedCountry.dialCode,
      localNumber: normalizedNumberValue.slice(detectedCountry.dialCode.length).replace(/\D/g, '')
    }
    const rule = getPhoneCountryLengthRule(detectedCountry.dialCode)
    const validationError = getPhoneValidationMessage(parsedPhone.localNumber, {
      required: true,
      label: fieldLabel,
      min: rule.minLength,
      max: rule.maxLength,
      countryLabel: detectedCountry.label,
      countryDialCode: detectedCountry.dialCode
    })
    if (validationError) return { value: '', error: validationError }

    return { value: buildPhoneValue(detectedCountry.dialCode, parsedPhone.localNumber), error: '' }
  }

  if (!selectedCountry) {
    return {
      value: '',
      error: `${fieldLabel} must include a +country prefix or provide a Country Code value in the import file.`
    }
  }

  const localNumber = numberValue.replace(/\D/g, '')
  const rule = getPhoneCountryLengthRule(selectedCountry.dialCode)
  const validationError = getPhoneValidationMessage(localNumber, {
    required: true,
    label: fieldLabel,
    min: rule.minLength,
    max: rule.maxLength,
    countryLabel: rule.label,
    countryDialCode: rule.dialCode
  })
  if (validationError) return { value: '', error: validationError }

  return { value: buildPhoneValue(selectedCountry.dialCode, localNumber), error: '' }
}

function buildImportPayloads(rows = [], employees = [], roleDirectory = new Map(), metadataCatalog = {}) {
  const existingCodes = new Set(employees.map((employee) => String(employee.employeeCode || employee.id || '').trim().toUpperCase()).filter(Boolean))
  const pendingCodes = new Set()
  const payloads = []
  const errors = []
  const roleLookup = new Map(
    [...roleDirectory.entries()]
      .filter(([, roleName]) => String(roleName || '').trim())
      .map(([roleUid, roleName]) => [String(roleName || '').trim().toLowerCase(), [roleUid, roleName]])
  )

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const employeeCode = pickCsvValue(row, ['Employee Code']).trim().toUpperCase()
    const firstName = pickCsvValue(row, ['First Name']).trim()
    const lastName = pickCsvValue(row, ['Last Name']).trim()
    const email = pickCsvValue(row, ['Email', 'Personal Email']).trim()
    const clientEmail = pickCsvValue(row, ['Client Email']).trim()
    const phone = pickCsvValue(row, ['Phone']).trim()
    const phoneCountryCode = pickCsvValue(row, ['Country Code', 'Phone Country Code', 'Mobile Country Code']).trim()
    const roleInput = pickCsvValue(row, ['Role']).trim()
    const position = pickCsvValue(row, ['Position']).trim()
    const department = pickCsvValue(row, ['Department']).trim()
    const status = pickCsvValue(row, ['Status']).trim()
    const workLocation = pickCsvValue(row, ['Work Location']).trim()
    const joinDateInput = pickCsvValue(row, ['Join Date']).trim()
    const dateOfBirthInput = pickCsvValue(row, ['Date Of Birth']).trim()
    const joinDate = normalizeDateInput(joinDateInput)
    const dateOfBirth = normalizeDateInput(dateOfBirthInput)
    const employeeType = pickCsvValue(row, ['Employee Type']).trim()
    const gender = pickCsvValue(row, ['Gender']).trim()
    const caste = pickCsvValue(row, ['Caste']).trim()
    const emergencyContact = pickCsvValue(row, ['Emergency Contact']).trim()
    const emergencyContactCountryCode = pickCsvValue(row, ['Emergency Contact Country Code']).trim()
    const bloodGroup = pickCsvValue(row, ['Blood Group']).trim()
    const address = pickCsvValue(row, ['Address']).trim()

    if (joinDateInput && !isIsoDateInput(joinDate)) {
      errors.push(`Row ${rowNumber}: invalid Join Date "${joinDateInput}". Use YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or Excel serial date.`)
      return
    }

    if (dateOfBirthInput && !isIsoDateInput(dateOfBirth)) {
      errors.push(`Row ${rowNumber}: invalid Date Of Birth "${dateOfBirthInput}". Use YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or Excel serial date.`)
      return
    }

    const requiredChecks = [
      ['Employee Code', employeeCode],
      ['First Name', firstName],
      ['Last Name', lastName],
      ['Email', email],
      ['Phone', phone],
      ['Role', roleInput],
      ['Position', position],
      ['Department', department],
      ['Join Date', joinDate],
      ['Status', status]
    ]

    const missing = requiredChecks.filter(([, value]) => !value).map(([label]) => label)
    if (missing.length) {
      errors.push(`Row ${rowNumber}: missing ${missing.join(', ')}.`)
      return
    }

    const emailError = getEmailValidationMessage(email, { required: true })
    if (emailError) {
      errors.push(`Row ${rowNumber}: ${emailError}`)
      return
    }

    if (clientEmail) {
      const clientEmailError = getEmailValidationMessage(clientEmail, { label: 'Client email' })
      if (clientEmailError) {
        errors.push(`Row ${rowNumber}: ${clientEmailError}`)
        return
      }
    }

    if (existingCodes.has(employeeCode) || pendingCodes.has(employeeCode)) {
      errors.push(`Row ${rowNumber}: employee code ${employeeCode} already exists.`)
      return
    }

    if (dateOfBirth && !isDateOfBirthWithinAllowedRange(dateOfBirth)) {
      errors.push(`Row ${rowNumber}: date of birth keeps age outside the 21-65 range.`)
      return
    }

    const roleMatch = roleLookup.get(roleInput.toLowerCase())
    if (!roleMatch) {
      errors.push(`Row ${rowNumber}: role ${roleInput} was not found in metadata entries.`)
      return
    }

    const departmentEntry = findMetadataEntryByInput(metadataCatalog, 'department', department)
    if (!departmentEntry) {
      errors.push(`Row ${rowNumber}: department ${department} was not found in metadata entries.`)
      return
    }

    const positionEntry = findMetadataEntryByInput(metadataCatalog, 'position', position)
    if (!positionEntry) {
      errors.push(`Row ${rowNumber}: position ${position} was not found in metadata entries.`)
      return
    }

    if (!positionEntry.departmentUid) {
      errors.push(`Row ${rowNumber}: position ${positionEntry.label || position} is not mapped to any department in metadata entries.`)
      return
    }

    if (String(positionEntry.departmentUid) !== String(departmentEntry.uid)) {
      errors.push(`Row ${rowNumber}: position ${positionEntry.label || position} does not belong to department ${departmentEntry.label || department}.`)
      return
    }

    const statusEntry = findMetadataEntryByInput(metadataCatalog, 'status', status)
    if (!statusEntry) {
      errors.push(`Row ${rowNumber}: status ${status} was not found in metadata entries.`)
      return
    }

    const workLocationEntry = workLocation ? findMetadataEntryByInput(metadataCatalog, 'work_location', workLocation) : null
    if (workLocation && !workLocationEntry) {
      errors.push(`Row ${rowNumber}: work location ${workLocation} was not found in metadata entries.`)
      return
    }

    const employeeTypeEntry = employeeType ? findMetadataEntryByInput(metadataCatalog, 'employee_type', employeeType) : null
    if (employeeType && !employeeTypeEntry) {
      errors.push(`Row ${rowNumber}: employee type ${employeeType} was not found in metadata entries.`)
      return
    }

    const bloodGroupEntry = bloodGroup ? findMetadataEntryByInput(metadataCatalog, 'blood_group', bloodGroup) : null
    if (bloodGroup && !bloodGroupEntry) {
      errors.push(`Row ${rowNumber}: blood group ${bloodGroup} was not found in metadata entries.`)
      return
    }

    const preparedPhoneResult = resolveImportedPhoneValue({
      rawNumber: phone,
      rawCountryCode: phoneCountryCode,
      fieldLabel: 'Phone'
    })
    if (preparedPhoneResult.error) {
      errors.push(`Row ${rowNumber}: ${preparedPhoneResult.error}`)
      return
    }

    const preparedEmergencyResult = resolveImportedPhoneValue({
      rawNumber: emergencyContact,
      rawCountryCode: emergencyContactCountryCode,
      fieldLabel: 'Emergency Contact'
    })
    if (preparedEmergencyResult.error) {
      errors.push(`Row ${rowNumber}: ${preparedEmergencyResult.error}`)
      return
    }

    const preparedPhone = preparedPhoneResult.value
    const preparedEmergency = preparedEmergencyResult.value

    if (preparedPhone && preparedEmergency && preparedPhone === preparedEmergency) {
      errors.push(`Row ${rowNumber}: mobile number and emergency contact cannot be the same.`)
      return
    }

    pendingCodes.add(employeeCode)
    payloads.push(buildEmployeePayload({
      employeeCode,
      firstName,
      lastName,
      email,
      clientEmail,
      roleType: roleMatch[0],
      roleName: roleMatch[1],
      position: positionEntry.value,
      department: departmentEntry.value,
      status: statusEntry.value,
      workLocation: workLocationEntry?.value || '',
      joinDate,
      dateOfBirth,
      employeeType: employeeTypeEntry?.value || '',
      gender,
      caste,
      bloodGroup: bloodGroupEntry?.value || '',
      address,
      phone: preparedPhone,
      emergencyContact: preparedEmergency
    }))
  })

  return { payloads, errors }
}

function DirectoryMetricCard({ title, value, helper, tone }) {
  return (
    <div className="card border-0 shadow-sm employee-metric-card h-100">
      <div className={`employee-metric-accent tone-${tone}`} />
      <div className="card-body">
        <div className="text-muted small mb-2">{title}</div>
        <div className="fs-4 fw-bold mb-1">{value}</div>
        <div className="small text-muted">{helper}</div>
      </div>
    </div>
  )
}

function EmployeeBadge({ value, type = 'status', roleBadgeStyleMap = null }) {
  const safeValue = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const roleStyle = type === 'role' ? getGeneratedRoleBadgeStyle(value, roleBadgeStyleMap) : undefined
  return <span className={`employee-badge ${type} ${safeValue}`.trim()} style={roleStyle}>{value || '—'}</span>
}

function getGeneratedRoleBadgeStyle(value, roleBadgeStyleMap = null) {
  const normalized = String(value || '').trim()
  if (!normalized || normalizeEmployeeRoleName(normalized) === 'unassigned') return undefined

  const normalizedRoleName = normalizeEmployeeRoleName(normalized)
  if (roleBadgeStyleMap?.has(normalizedRoleName)) return roleBadgeStyleMap.get(normalizedRoleName)

  const fallbackIndex = hashTextValue(normalizedRoleName) % (ROLE_BADGE_HUE_PALETTE.length || 1)
  return getRoleBadgeStyleFromPaletteIndex(fallbackIndex)
}

function highlightSearchValue(value, query = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return value
  return <SearchHighlight text={value} query={query} />
}

function CellStack({ title, subtitle, meta = null, className = '', highlightQuery = '' }) {
  return (
    <div className={`employee-cell-stack ${className}`.trim()}>
      <div className="employee-cell-primary">{title ? highlightSearchValue(title, highlightQuery) : '—'}</div>
      {subtitle ? <div className="employee-cell-secondary">{highlightSearchValue(subtitle, highlightQuery)}</div> : null}
      {meta ? <div className="employee-cell-meta">{highlightSearchValue(meta, highlightQuery)}</div> : null}
    </div>
  )
}

function ActionButton({ icon, label, variant = 'view', onClick, disabled = false }) {
  const safeLabel = String(label || '')
  const baseLabelChars = Math.min(Math.max(safeLabel.length, 4), 30)
  const labelChars = variant === 'delete' ? Math.min(baseLabelChars + 3, 30) : baseLabelChars

  return (
    <button
      type="button"
      className={`employee-action-btn employee-action-btn-${variant}`}
      onClick={onClick}
      aria-label={safeLabel}
      title={safeLabel}
      disabled={disabled}
      style={{ '--action-label-chars': labelChars }}
    >
      {icon ? <span className="employee-action-btn__icon" aria-hidden="true">{icon}</span> : null}
      <span className="employee-action-btn__label">{safeLabel}</span>
    </button>
  )
}

function AccountLockToggle({ isLocked, label, onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`employee-lock-toggle ${isLocked ? 'is-locked' : 'is-unlocked'}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
    >
      <span className="employee-lock-toggle-content">
        <span className="employee-lock-toggle-icon">
          {isLocked ? <LockClosedIcon /> : <LockOpenIcon />}
        </span>
        <span className="employee-lock-toggle-label">{label}</span>
      </span>
    </button>
  )
}

function AccountStateIndicator({ label, tone = 'unlocked' }) {
  const icon = tone === 'unlocked' ? <LockOpenIcon /> : <LockClosedIcon />

  return (
    <div className={`employee-lock-state-indicator is-${tone}`.trim()} title={label} aria-label={label}>
      <span className="employee-lock-state-indicator-icon">{icon}</span>
      <span className="employee-lock-state-indicator-label">{label}</span>
    </div>
  )
}

function EmployeeFormFields({
  draft,
  onChange,
  onBlur,
  formMode,
  errors = {},
  touched = {},
  roleOptions,
  positionOptions,
  departmentOptions,
  statusOptions,
  employeeTypeOptions,
  workLocationOptions,
  phoneCountryOptions
}) {
  const dobBounds = getDateOfBirthBounds()
  const ageLabel = draft.dateOfBirth ? formatEmployeeAge(draft.dateOfBirth) : '—'
  const tenureLabel = draft.joinDate ? formatTenure(draft.joinDate) : '—'
  const mobileRule = getPhoneCountryLengthRule(draft.phoneCountryCode)
  const emergencyContactRule = getPhoneCountryLengthRule(draft.emergencyContactCountryCode)
  const showError = (fieldName) => touched[fieldName] && errors[fieldName]

  return (
    <div className="row g-3">
      <div className="col-12 col-md-6">
        <label className="form-label">Employee Code*</label>
        <input className={`form-control${showError('employeeCode') ? ' is-invalid' : ''}`} name="employeeCode" value={draft.employeeCode} onChange={onChange} onBlur={onBlur} maxLength="20" required disabled={formMode === 'edit'} />
        {formMode === 'edit' ? <div className="form-text">Employee code is locked after creation and cannot be modified.</div> : null}
        {showError('employeeCode') ? <div className="invalid-feedback d-block">{errors.employeeCode}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Role*</label>
        <AppSelect name="roleType" value={draft.roleType} onChange={onChange} onBlur={onBlur} options={roleOptions} placeholder="Select role" invalid={Boolean(showError('roleType'))} />
        {showError('roleType') ? <div className="invalid-feedback d-block">{errors.roleType}</div> : null}
      </div>


      <div className="col-12 col-md-6">
        <label className="form-label">First Name*</label>
        <input className={`form-control${showError('firstName') ? ' is-invalid' : ''}`} name="firstName" value={draft.firstName} onChange={onChange} onBlur={onBlur} maxLength="120" required />
        {showError('firstName') ? <div className="invalid-feedback d-block">{errors.firstName}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Last Name*</label>
        <input className={`form-control${showError('lastName') ? ' is-invalid' : ''}`} name="lastName" value={draft.lastName} onChange={onChange} onBlur={onBlur} maxLength="120" required />
        {showError('lastName') ? <div className="invalid-feedback d-block">{errors.lastName}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Personal Email*</label>
        <input className={`form-control${showError('email') ? ' is-invalid' : ''}`} type="email" name="email" value={draft.email} onChange={onChange} onBlur={onBlur} required />
        {showError('email') ? <div className="invalid-feedback d-block">{errors.email}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Client Email</label>
        <input className={`form-control${showError('clientEmail') ? ' is-invalid' : ''}`} type="email" name="clientEmail" value={draft.clientEmail} onChange={onChange} onBlur={onBlur} />
        {showError('clientEmail') ? <div className="invalid-feedback d-block">{errors.clientEmail}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Mobile*</label>
        <div className="phone-input-shell">
          <AppSelect name="phoneCountryCode" value={draft.phoneCountryCode} onChange={onChange} onBlur={onBlur} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" />
          <input className={`form-control${showError('phoneLocal') ? ' is-invalid' : ''}`} name="phoneLocal" value={draft.phoneLocal} onChange={onChange} onBlur={onBlur} inputMode="numeric" placeholder="Enter mobile number" minLength={mobileRule.minLength} maxLength={mobileRule.maxLength} pattern={`[0-9]{${mobileRule.minLength},${mobileRule.maxLength}}`} required />
        </div>
        <div className="form-text">Expected local length for {mobileRule.label} ({mobileRule.dialCode}): {formatPhoneLengthRule(mobileRule)}.</div>
        {showError('phoneLocal') ? <div className="invalid-feedback d-block">{errors.phoneLocal}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Department*</label>
        <AppSelect name="department" value={draft.department} onChange={onChange} onBlur={onBlur} options={departmentOptions} placeholder="Select department" invalid={Boolean(showError('department'))} />
        {showError('department') ? <div className="invalid-feedback d-block">{errors.department}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Position*</label>
        <AppSelect
          name="position"
          value={draft.position}
          onChange={onChange}
          onBlur={onBlur}
          options={positionOptions}
          placeholder={draft.department ? 'Select position' : 'Select department first'}
          invalid={Boolean(showError('position'))}
          disabled={!draft.department}
        />
        {!draft.department ? <div className="form-text">Choose a department first to load the mapped positions.</div> : null}
        {showError('position') ? <div className="invalid-feedback d-block">{errors.position}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Join Date*</label>
        <input className={`form-control${showError('joinDate') ? ' is-invalid' : ''}`} type="date" name="joinDate" value={draft.joinDate} onChange={onChange} onBlur={onBlur} required />
        {showError('joinDate') ? <div className="invalid-feedback d-block">{errors.joinDate}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Tenure in Organization</label>
        <input className="form-control" value={tenureLabel} disabled placeholder="Calculated from join date" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Status*</label>
        <AppSelect name="status" value={draft.status} onChange={onChange} onBlur={onBlur} options={statusOptions} placeholder="Select status" invalid={Boolean(showError('status'))} />
        {showError('status') ? <div className="invalid-feedback d-block">{errors.status}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Employee Type</label>
        <AppSelect name="employeeType" value={draft.employeeType} onChange={onChange} onBlur={onBlur} options={employeeTypeOptions} placeholder="Select type" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Work Location</label>
        <AppSelect name="workLocation" value={draft.workLocation} onChange={onChange} onBlur={onBlur} options={workLocationOptions} placeholder="Select work location" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Date of Birth</label>
        <input className={`form-control${showError('dateOfBirth') ? ' is-invalid' : ''}`} type="date" name="dateOfBirth" value={draft.dateOfBirth} onChange={onChange} onBlur={onBlur} min={dobBounds.min} max={dobBounds.max} />
        <div className="form-text">Allowed age band: 21 to 65 years.</div>
        {showError('dateOfBirth') ? <div className="invalid-feedback d-block">{errors.dateOfBirth}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Age</label>
        <input className="form-control" value={ageLabel} disabled placeholder="Calculated from date of birth" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Gender</label>
        <input className="form-control" name="gender" value={draft.gender} onChange={onChange} onBlur={onBlur} maxLength="120" placeholder="Enter gender manually" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Caste</label>
        <input className="form-control" name="caste" value={draft.caste} onChange={onChange} onBlur={onBlur} maxLength="120" placeholder="Enter caste manually" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Emergency Contact</label>
        <div className="phone-input-shell">
          <AppSelect name="emergencyContactCountryCode" value={draft.emergencyContactCountryCode} onChange={onChange} onBlur={onBlur} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" />
          <input className={`form-control${showError('emergencyContactLocal') ? ' is-invalid' : ''}`} name="emergencyContactLocal" value={draft.emergencyContactLocal} onChange={onChange} onBlur={onBlur} inputMode="numeric" placeholder="Enter emergency contact number" maxLength={emergencyContactRule.maxLength} pattern={`([0-9]{${emergencyContactRule.minLength},${emergencyContactRule.maxLength}})?`} />
        </div>
        <div className="form-text">Emergency contact must differ from the employee mobile number. Expected local length for {emergencyContactRule.label} ({emergencyContactRule.dialCode}): {formatPhoneLengthRule(emergencyContactRule)}.</div>
        {showError('emergencyContactLocal') ? <div className="invalid-feedback d-block">{errors.emergencyContactLocal}</div> : null}
      </div>

      <div className="col-12">
        <label className="form-label">Address</label>
        <textarea className="form-control" rows="3" name="address" value={draft.address} onChange={onChange} onBlur={onBlur} />
      </div>
    </div>
  )
}

function EmployeeAdditionalDetailsPanel({ employee, profile }) {
  const skills = profile?.skills || []
  const workExperiences = profile?.workExperiences || []
  const familyDetails = profile?.familyDetails || []

  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-2">
        <div className="col-12 col-md-6"><strong>Gender:</strong> {employee?.genderLabel || employee?.gender || '—'}</div>
        <div className="col-12 col-md-6"><strong>Date of Birth:</strong> {formatDate(employee?.dateOfBirth)}</div>
        <div className="col-12 col-md-6"><strong>Age:</strong> {formatEmployeeAge(employee?.dateOfBirth)}</div>
        <div className="col-12 col-md-6"><strong>Blood Group:</strong> {employee?.bloodGroupLabel || employee?.bloodGroup || '—'}</div>
        <div className="col-12 col-md-6"><strong>Emergency Contact:</strong> {employee?.emergencyContact || '—'}</div>
        <div className="col-12"><strong>Address:</strong> {employee?.address || '—'}</div>
      </div>

      <div className="profile-form-divider" />

      <div>
        <div className="fw-semibold mb-2">Skills</div>
        <div className="text-muted small">
          {skills.length ? skills.map((entry) => entry.skill).join(', ') : 'No skills added yet.'}
        </div>
      </div>

      <div className="profile-form-divider" />

      <div className="d-flex flex-column gap-2">
        <div className="fw-semibold">Work Experience</div>
        {workExperiences.length ? workExperiences.map((experience) => (
          <div key={experience.uid} className="profile-doc-item">
            <span className="profile-doc-item-title">{experience.companyName || 'Company'}</span>
            <span className="text-muted small">
              {[experience.jobTitle || '', experience.employmentType || '', experience.location || ''].filter(Boolean).join(' • ') || 'Work experience entry'}
            </span>
            <span className="text-muted small">
              {[
                `${formatDate(experience.startDate)} - ${experience.isCurrent ? 'Present' : formatDate(experience.endDate)}`,
                formatExperienceDuration(experience.startDate, experience.endDate, experience.isCurrent)
              ].filter(Boolean).join(' • ')}
            </span>
            {(experience.responsibilities || experience.reasonForLeaving || experience.remarks) ? (
              <span className="text-muted small">
                {[experience.responsibilities || '', experience.reasonForLeaving || '', experience.remarks || ''].filter(Boolean).join(' • ')}
              </span>
            ) : null}
          </div>
        )) : <div className="text-muted small">No work experience added yet.</div>}
      </div>

      <div className="profile-form-divider" />

      <div className="d-flex flex-column gap-2">
        <div className="fw-semibold">Family Details</div>
        {familyDetails.length ? familyDetails.map((detail) => (
          <div key={detail.uid} className="profile-doc-item">
            <span className="profile-doc-item-title">{[detail.relation, detail.fullName].filter(Boolean).join(': ') || 'Family detail'}</span>
            <span className="text-muted small">
              {[detail.phone || '', detail.occupation || '', detail.isDependent ? 'Dependent' : '', detail.dateOfBirth ? formatDate(detail.dateOfBirth) : ''].filter(Boolean).join(' • ') || 'No extra details'}
            </span>
            {(detail.address || detail.remarks) ? (
              <span className="text-muted small">{[detail.address || '', detail.remarks || ''].filter(Boolean).join(' • ')}</span>
            ) : null}
          </div>
        )) : <div className="text-muted small">No family details added yet.</div>}
      </div>
    </div>
  )
}

function EmployeePreviewBasicInfoPanel({ employee, profile }) {
  return (
    <div className="row g-3 align-items-start">
      <div className="col-12 col-md-4">
        <div className="profile-photo-preview">
          {profile?.profileImageUrl
            ? <img src={profile.profileImageUrl} alt={employee?.fullName || 'Employee'} />
            : <span>{String(employee?.fullName || 'E').charAt(0).toUpperCase()}</span>}
        </div>
      </div>
      <div className="col-12 col-md-8">
        <div className="row g-2">
          <div className="col-12 col-md-6"><strong>Employee Code:</strong> {employee?.employeeCode || '—'}</div>
          <div className="col-12 col-md-6"><strong>Name:</strong> {employee?.fullName || '—'}</div>
          <div className="col-12 col-md-6"><strong>Email:</strong> {employee?.email || '—'}</div>
          <div className="col-12 col-md-6"><strong>Mobile:</strong> {employee?.phone || '—'}</div>
          <div className="col-12 col-md-6"><strong>Role:</strong> {employee?.roleName || '—'}</div>
          <div className="col-12 col-md-6"><strong>Status:</strong> <EmployeeBadge value={employee?.status || '—'} type="status" /></div>
        </div>
      </div>
    </div>
  )
}

function EmployeePreviewBasicDetailsPanel({ employee }) {
  const reportingAssignments = Array.isArray(employee?.reportingAssignmentEntries) ? employee.reportingAssignmentEntries : []

  return (
    <div className="row g-2">
      <div className="col-12 col-md-6"><strong>Department:</strong> {employee?.departmentLabel || employee?.department || '—'}</div>
      <div className="col-12 col-md-6"><strong>Position:</strong> {employee?.positionLabel || employee?.position || '—'}</div>
      <div className="col-12 col-md-6"><strong>Date of Joining:</strong> {formatDate(employee?.joinDate)}</div>
      <div className="col-12 col-md-6"><strong>Work Location:</strong> {employee?.workLocationLabel || employee?.workLocation || '—'}</div>
      <div className="col-12 col-md-6"><strong>Employee Type:</strong> {employee?.employeeTypeLabel || employee?.employeeType || '—'}</div>
      <div className="col-12 col-md-6"><strong>Billing Status:</strong> <EmployeeBadge value={employee?.billingStatus || 'Non Billable'} type="billingStatus" /></div>
      <div className="col-12"><strong>Assignment Statuses:</strong> {employee?.assignmentStatusSummary || 'No assignment'}</div>
      <div className="col-12">
        <strong>Reporting Assignments:</strong>{' '}
        {reportingAssignments.length
          ? reportingAssignments.map((entry) => `${entry.label}: ${entry.employeeName || 'Unassigned'}`).join(', ')
          : 'No reporting assignments'}
      </div>
    </div>
  )
}

function EmployeePreviewDocumentsPanel({ documents = [] }) {
  return (
    <div className="d-flex flex-column gap-2">
      {documents.length ? documents.map((document) => (
        <div key={document.uid} className="profile-doc-item profile-doc-item-modern">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
            <div className="d-flex flex-column gap-1">
              <span className="profile-doc-item-title">{document.name || 'Document'}</span>
              <span className="text-muted small">
                {document.documentType || 'OTHER'} • {document.uploadDateLabel || '—'}
              </span>
            </div>
            <a
              href={document.fileUrl || '#'}
              target="_blank"
              rel="noreferrer"
              download={document.name || 'employee-document'}
              className="btn btn-sm btn-outline-secondary btn-icon-inline"
            >
              <DownloadIcon />
              <span>Download</span>
            </a>
          </div>
        </div>
      )) : <div className="text-muted small">No documents uploaded for this employee.</div>}
    </div>
  )
}

function MetadataCard({ title, description, entries, onAdd, onEdit, onDelete, roleCard = false, roleModules = [] }) {
  const { items: sortedEntries, sortConfig: metadataSortConfig, requestSort: requestMetadataSort } = useSortableData(entries, {
    initialKey: 'label',
    initialDirection: 'asc',
    accessors: {
      label: (entry) => roleCard ? (entry.roleName || '') : (entry.label || ''),
      value: (entry) => roleCard
        ? getRoleAccessSummary(getEffectiveRoleAccess(entry.access, entry.roleName, roleModules))
        : (entry.description || ''),
      description: (entry) => entry.description || '',
      status: (entry) => (entry.isActive === false ? 'Inactive' : 'Active')
    }
  })

  return (
    <div className="card border-0 shadow-sm glass employee-directory-shell metadata-card-shell">
      <div className="card-body d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div>
            <div className="fw-semibold">{title}</div>
            <div className="text-muted small">{description}</div>
          </div>
          {onAdd ? (
            <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={onAdd}>
              <PlusIcon />
              <span>Add Entry</span>
            </button>
          ) : null}
        </div>

        <PaginatedTable rows={sortedEntries} className="metadata-table-wrap">
          {({ rows: paginatedRows }) => (
            <table className="table align-middle mb-0 employee-table employee-table-dense metadata-table">
              <thead>
                <tr>
                  <th><SortableHeader label={roleCard ? 'Role' : 'Label'} sortKey="label" sortConfig={metadataSortConfig} onSort={requestMetadataSort} /></th>
                  <th><SortableHeader label={roleCard ? 'Access Summary' : 'Description'} sortKey="value" sortConfig={metadataSortConfig} onSort={requestMetadataSort} /></th>
                  <th><SortableHeader label="Status" sortKey="status" sortConfig={metadataSortConfig} onSort={requestMetadataSort} /></th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length ? paginatedRows.map((entry) => {
                  const effectiveAccess = roleCard ? getEffectiveRoleAccess(entry.access, entry.roleName, roleModules) : null
                  const accessMeta = roleCard ? buildRoleAccessMeta(effectiveAccess) : null
                  return (
                    <tr key={entry.uid}>
                      <td className="employee-cell-wrap">
                        <CellStack
                          title={roleCard ? entry.roleName : entry.label}
                          subtitle={roleCard
                            ? `${accessMeta.moduleCount} module${accessMeta.moduleCount === 1 ? '' : 's'} configured • ${accessMeta.permissionCount} permission${accessMeta.permissionCount === 1 ? '' : 's'}`
                            : (entry.departmentLabel ? `Department: ${entry.departmentLabel}` : null)}
                        />
                      </td>
                      <td className="employee-cell-wrap">
                        {roleCard ? (
                          <div className="metadata-role-summary">
                            <div className="fw-semibold small">{getRoleAccessSummary(effectiveAccess)}</div>
                            {isSystemAdminRoleName(entry.roleName) ? <div className="metadata-role-flag">Backend-managed full access</div> : null}
                          </div>
                        ) : (entry.description || '—')}
                      </td>
                      <td><EmployeeBadge value={entry.isActive === false ? 'Inactive' : 'Active'} type="status" /></td>
                      <td className="employee-actions-cell">
                        {onEdit || onDelete ? (
                          <div className="employee-action-cluster metadata-action-cluster">
                            {onEdit ? <ActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => onEdit(entry)} /> : null}
                            {onDelete ? <ActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => onDelete(entry)} /> : null}
                          </div>
                        ) : <span className="text-muted small">Read only</span>}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan="4">
                      <div className="employee-empty-state text-center py-4">
                        <div className="fw-semibold mb-1">No entries available.</div>
                        <div className="text-muted small">Create the first entry to make this catalog available in employee forms.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </PaginatedTable>
      </div>
    </div>
  )
}

function MetadataEntryModal({ open, title, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, departmentOptions = [] }) {
  const isPositionCategory = draft.category === 'position'

  return (
    <ModalFrame
      open={open}
      title={title}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>Save</button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label">Label*</label>
          <input className={`form-control${touched.label && errors.label ? ' is-invalid' : ''}`} name="label" value={draft.label} onChange={onChange} onBlur={onBlur} maxLength="120" />
          {touched.label && errors.label ? <div className="invalid-feedback d-block">{errors.label}</div> : null}
        </div>
        {isPositionCategory ? (
          <div className="col-12">
            <label className="form-label">Department*</label>
            <AppSelect
              name="departmentUid"
              value={draft.departmentUid}
              onChange={onChange}
              onBlur={onBlur}
              options={departmentOptions}
              placeholder="Select department"
              invalid={Boolean(touched.departmentUid && errors.departmentUid)}
            />
            {touched.departmentUid && errors.departmentUid ? <div className="invalid-feedback d-block">{errors.departmentUid}</div> : null}
          </div>
        ) : null}
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows="3" name="description" value={draft.description} onChange={onChange} onBlur={onBlur} maxLength={isPositionCategory ? 150 : 255} />
          {isPositionCategory ? <div className="form-text">Position notes are stored together with the department mapping, so keep the note concise.</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Sort Order</label>
          <input className="form-control" type="number" name="sortOrder" value={draft.sortOrder} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-6 d-flex align-items-end">
          <div className="form-check form-switch">
            <input className="form-check-input" id="metadataIsActive" type="checkbox" checked={Boolean(draft.isActive)} onChange={(event) => onChange({ target: { name: 'isActive', value: event.target.checked } })} />
            <label className="form-check-label" htmlFor="metadataIsActive">Keep entry active</label>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function RoleEntryModal({ open, title, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, moduleGroups, modulesLoading = false, allModules = [], isSaving = false, isSystemAdminRole = false, backendModulesUnavailable = false }) {
  const [expandedGroups, setExpandedGroups] = useState(() => resolveExpandedGroupKeys(moduleGroups, readCachedExpandedGroupKeys()))
  const contentRef = useRef(null)
  const shouldNormalizeScrollRef = useRef(false)

  useEffect(() => {
    if (!open) return

    setExpandedGroups((current) => resolveExpandedGroupKeys(moduleGroups, current.length ? current : readCachedExpandedGroupKeys()))
  }, [open, moduleGroups])

  useEffect(() => {
    writeCachedExpandedGroupKeys(expandedGroups)
  }, [expandedGroups])

  useLayoutEffect(() => {
    if (!open || !shouldNormalizeScrollRef.current) return

    const modalBody = contentRef.current?.closest('.modal-frame-body')
    if (!modalBody) {
      shouldNormalizeScrollRef.current = false
      return
    }

    let firstFrameId = 0
    let secondFrameId = 0

    const normalizeScroll = () => {
      const maxScrollTop = Math.max(modalBody.scrollHeight - modalBody.clientHeight, 0)
      if (modalBody.scrollTop > maxScrollTop) {
        modalBody.scrollTop = maxScrollTop
      }
      shouldNormalizeScrollRef.current = false
    }

    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(normalizeScroll)
    })

    return () => {
      window.cancelAnimationFrame(firstFrameId)
      window.cancelAnimationFrame(secondFrameId)
    }
  }, [draft.access, expandedGroups, open])

  function updateRoleField(name, value) {
    onChange({ target: { name, value } })
  }

  function handlePermissionToggle(moduleName, accessLevel) {
    if (isSystemAdminRole) return
    shouldNormalizeScrollRef.current = true
    const currentAccess = normalizeRoleAccess(draft.access)
    const accessKey = getRoleModuleAccessKey(moduleName)
    const currentLevels = currentAccess[accessKey] || []
    const nextLevels = currentLevels.includes(accessLevel)
      ? currentLevels.filter((level) => level !== accessLevel)
      : ACCESS_LEVEL_OPTIONS.map((option) => option.key).filter((level) => currentLevels.includes(level) || level === accessLevel)

    const nextAccess = { ...currentAccess }
    if (nextLevels.length) nextAccess[accessKey] = nextLevels
    else delete nextAccess[accessKey]

    updateRoleField('access', nextAccess)
  }

  function handleGroupPermissionToggle(groupModules, accessLevel) {
    if (isSystemAdminRole) return
    shouldNormalizeScrollRef.current = true
    const currentAccess = normalizeRoleAccess(draft.access)
    const groupAccessKeys = Array.from(new Set(groupModules.map((moduleName) => getRoleModuleAccessKey(moduleName)).filter(Boolean)))
    const shouldClear = groupAccessKeys.every((moduleName) => (currentAccess[moduleName] || []).includes(accessLevel))
    const nextAccess = { ...currentAccess }

    groupAccessKeys.forEach((moduleName) => {
      const currentLevels = currentAccess[moduleName] || []
      const nextLevels = shouldClear
        ? currentLevels.filter((level) => level !== accessLevel)
        : ACCESS_LEVEL_OPTIONS.map((option) => option.key).filter((level) => currentLevels.includes(level) || level === accessLevel)

      if (nextLevels.length) nextAccess[moduleName] = nextLevels
      else delete nextAccess[moduleName]
    })

    updateRoleField('access', nextAccess)
  }

  function toggleGroup(groupKey) {
    shouldNormalizeScrollRef.current = true
    setExpandedGroups((current) => {
      const nextGroups = current.includes(groupKey)
        ? current.filter((key) => key !== groupKey)
        : [...current, groupKey]

      return resolveExpandedGroupKeys(moduleGroups, nextGroups)
    })
  }

  const selectedAccessMap = isSystemAdminRole ? buildFullRoleAccess(allModules) : normalizeRoleAccess(draft.access)

  return (
    <ModalFrame
      open={open}
      title={title}
      onClose={onClose}
      size="xl"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose} disabled={isSaving}>Cancel</button>
          {!isSystemAdminRole ? <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={isSaving || backendModulesUnavailable}>{isSaving ? 'Saving…' : 'Save'}</button> : null}
        </>
      )}
    >
      <div ref={contentRef} className="row g-3 role-entry-modal">
        <div className="col-12 col-md-6">
          <label className="form-label">Role Name*</label>
          <input className={`form-control${touched.roleName && errors.roleName ? ' is-invalid' : ''}`} name="roleName" value={draft.roleName} onChange={onChange} onBlur={onBlur} maxLength="100" readOnly={isSystemAdminRole || isSaving} />
          {touched.roleName && errors.roleName ? <div className="invalid-feedback d-block">{errors.roleName}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Description</label>
          <input className="form-control" name="description" value={draft.description} onChange={onChange} onBlur={onBlur} maxLength="500" readOnly={isSystemAdminRole || isSaving} />
        </div>
        <div className="col-12">
          <div className="attendance-note-card role-access-note-card">
            <div className="fw-semibold mb-1">Role access matrix</div>
            <div className="text-muted small">Expand a main module, select the required access on its sub-modules or tabs, and save the short codes <strong>C</strong>, <strong>R</strong>, <strong>U</strong>, and <strong>D</strong> for each permission.</div>
            {isSystemAdminRole ? (
              <div className="role-access-state-banner">This system role is managed automatically. Full access is shown for reference, and editing is locked here.</div>
            ) : null}
            {backendModulesUnavailable ? (
              <div className="role-access-state-banner">
                Role modules are currently unavailable. Role access cannot be saved until a valid module list is available.
              </div>
            ) : null}
          </div>
        </div>
        <div className="col-12">
          {modulesLoading ? (
            <div className="role-access-loading text-muted small">Loading role module permissions…</div>
          ) : moduleGroups.length ? (
            <div className="role-access-accordion d-flex flex-column gap-3">
              {moduleGroups.map((group) => {
                const isExpanded = expandedGroups.includes(group.key)
                const configuredCount = group.modules.filter((moduleName) => getRoleModuleSelectedAccess(selectedAccessMap, moduleName).length).length
                return (
                  <div className="role-access-group" key={group.key}>
                    <button type="button" className="role-access-group__trigger" onClick={() => toggleGroup(group.key)}>
                      <div>
                        <div className="fw-semibold">{group.title}</div>
                        <div className="text-muted small">{configuredCount} / {group.modules.length} sub-modules configured</div>
                      </div>
                      <span className="role-access-group__icon">{isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}</span>
                    </button>

                    {isExpanded ? (
                      <div className="role-access-group__body">
                        <div className="role-access-grid role-access-grid__header">
                          <div className="text-muted small fw-semibold">Sub-module / Tab</div>
                          {ACCESS_LEVEL_OPTIONS.map((option) => {
                            const selectedCount = group.modules.filter((moduleName) => getRoleModuleSelectedAccess(selectedAccessMap, moduleName).includes(option.key)).length
                            const allSelected = selectedCount === group.modules.length && group.modules.length > 0
                            const partiallySelected = selectedCount > 0 && selectedCount < group.modules.length

                            return (
                              <button
                                type="button"
                                key={option.key}
                                className={`role-access-bulk-toggle ${allSelected ? 'is-active' : ''} ${partiallySelected ? 'is-partial' : ''}`.trim()}
                                onClick={() => handleGroupPermissionToggle(group.modules, option.key)}
                                title={`${option.label} for all ${group.title} sub-modules`}
                                disabled={isSystemAdminRole || isSaving}
                              >
                                <span>{option.shortLabel}</span>
                                <small>All</small>
                              </button>
                            )
                          })}
                        </div>

                        {group.modules.map((moduleName) => {
                          const selectedAccess = getRoleModuleSelectedAccess(selectedAccessMap, moduleName)
                          return (
                            <div className="role-access-grid role-access-grid__row" key={moduleName}>
                              <div className="role-access-grid__module">
                                <div className="fw-semibold">{getRoleModuleDisplayName(moduleName)}</div>
                                <div className="text-muted small">{selectedAccess.length ? `${selectedAccess.map((level) => level.toUpperCase()).join(' / ')} enabled` : 'No access selected'}</div>
                              </div>
                              {ACCESS_LEVEL_OPTIONS.map((option) => (
                                <label className="role-access-check" key={option.key}>
                                  <input
                                    type="checkbox"
                                    checked={selectedAccess.includes(option.key)}
                                    onChange={() => handlePermissionToggle(moduleName, option.key)}
                                    disabled={isSystemAdminRole || isSaving}
                                  />
                                  <span>{option.shortLabel}</span>
                                </label>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-muted small">No modules are available for permission mapping yet.</div>
          )}
        </div>
      </div>
    </ModalFrame>
  )
}

function MappingModal({
  open,
  employee,
  draft,
  onChange,
  onClose,
  onSubmit,
  selectedEmployeeUid,
  employeeOptions,
  onEmployeeChange,
  managerOptions,
  hrOptions,
  teamLeadOptions,
  coordinatorOptions,
  hiddenEmployeeOptions,
  warnings = {}
}) {
  const hiddenHrOptions = hrOptions || hiddenEmployeeOptions
  const hiddenTeamLeadOptions = teamLeadOptions || hiddenEmployeeOptions
  const hiddenCoordinatorOptions = coordinatorOptions || hiddenEmployeeOptions

  return (
    <ModalFrame
      open={open}
      title={employee ? `Assign Manager • ${employee.fullName}` : 'Assign Manager'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>Save Mapping</button>
        </>
      )}
    >
      <div className="row g-3 employee-mapping-modal-shell">
        <div className="col-12">
          <div className="attendance-note-card">
            <div className="fw-semibold">{employee ? employee.fullName : 'Select the employee to map'}</div>
            <div className="small text-muted">
              {employee
                ? `${employee.employeeCode} • ${employee.roleName || 'No role assigned'} • ${employee.departmentLabel || employee.department || 'No department'}`
                : 'Choose an employee first, then assign their manager.'}
            </div>
            <div className="small text-muted mt-1">
              {employee
                ? 'Manager-position employees are prioritized, but any employee can be selected.'
                : 'Any employee can be selected for reporting assignment mapping.'}
            </div>
          </div>
        </div>
        <div className="col-12">
          <label className="form-label">Employee</label>
          <AppSelect
            value={selectedEmployeeUid}
            onChange={onEmployeeChange}
            options={employeeOptions}
            placeholder="Select employee"
          />
        </div>
        {employee ? (
          <>
            <div className="col-12">
              <label className="form-label">Manager</label>
              <AppSelect
                value={draft.managerEmployeeUid || ''}
                onChange={(nextValue) => onChange('managerEmployeeUid', nextValue)}
                options={managerOptions}
                placeholder="Select manager"
              />
              {warnings.managerEmployeeUid ? (
                <div className="employee-mapping-warning mt-2">{warnings.managerEmployeeUid}</div>
              ) : null}
            </div>

            <div className="col-12 d-none" aria-hidden>
              <label className="form-label">HR</label>
              <AppSelect
                value={draft.hrEmployeeUid || ''}
                onChange={(nextValue) => onChange('hrEmployeeUid', nextValue)}
                options={hiddenHrOptions}
                placeholder="Select HR"
              />
              {warnings.hrEmployeeUid ? (
                <div className="employee-mapping-warning mt-2">{warnings.hrEmployeeUid}</div>
              ) : null}
            </div>

            <div className="col-12 d-none" aria-hidden>
              <label className="form-label">Team Lead</label>
              <AppSelect
                value={draft.teamLeadEmployeeUid || ''}
                onChange={(nextValue) => onChange('teamLeadEmployeeUid', nextValue)}
                options={hiddenTeamLeadOptions}
                placeholder="Select team lead"
              />
              {warnings.teamLeadEmployeeUid ? (
                <div className="employee-mapping-warning mt-2">{warnings.teamLeadEmployeeUid}</div>
              ) : null}
            </div>

            <div className="col-12 d-none" aria-hidden>
              <label className="form-label">Coordinator</label>
              <AppSelect
                value={draft.coordinatorEmployeeUid || ''}
                onChange={(nextValue) => onChange('coordinatorEmployeeUid', nextValue)}
                options={hiddenCoordinatorOptions}
                placeholder="Select coordinator"
              />
              {warnings.coordinatorEmployeeUid ? (
                <div className="employee-mapping-warning mt-2">{warnings.coordinatorEmployeeUid}</div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="col-12">
            <div className="text-muted small">Choose an employee to load and edit their reporting assignments.</div>
          </div>
        )}
      </div>
    </ModalFrame>
  )
}

export default function EmployeesManagement() {
  const formRef = useRef(null)
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const exportMenuId = 'employeesExportMenu'
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const { user } = useAuth()
  const canReadRoles = hasModulePermission(user, PERMISSION_MODULES.roles, PERMISSION_ACTIONS.read)
  const canReadEmployeeMetadata = hasModulePermission(user, PERMISSION_MODULES.employeeMetadata, PERMISSION_ACTIONS.read)
  const canReadEmployeeDirectory = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.read)
  const canReadEmployeeStatus = hasModulePermission(user, PERMISSION_MODULES.employeeStatus, PERMISSION_ACTIONS.read)
  const canReadEmployeeMapping = hasModulePermission(user, PERMISSION_MODULES.employeeMapping, PERMISSION_ACTIONS.read)
  const canViewMetadata = canReadRoles || canReadEmployeeMetadata
  const canViewEntries = canReadEmployeeDirectory
  const canViewMapping = canReadEmployeeMapping
  const canViewRequests = canReadEmployeeStatus
  const canCreateEmployees = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.create)
  const canUpdateEmployees = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.update)
  const canDeleteEmployees = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.delete)
  const canCreateEmployeeMapping = hasModulePermission(user, PERMISSION_MODULES.employeeMapping, PERMISSION_ACTIONS.create)
  const canUpdateEmployeeMapping = hasModulePermission(user, PERMISSION_MODULES.employeeMapping, PERMISSION_ACTIONS.update)
  const canDeleteEmployeeMapping = hasModulePermission(user, PERMISSION_MODULES.employeeMapping, PERMISSION_ACTIONS.delete)
  const canManageEmployeeRequests = hasModulePermission(user, PERMISSION_MODULES.employeeStatus, PERMISSION_ACTIONS.update)
  const { data: employeesData = EMPTY_LIST, isLoading, isError, error, refetch, isFetching } = useEmployeesQuery(canViewEntries)
  const directoryErrorStatus = Number(error?.response?.status || 0)
  const directoryErrorMessage = String(error?.message || error?.response?.data?.detail || '')
  const isDirectoryAccessBlocked = isError
    && (
      directoryErrorStatus === 401
      || directoryErrorStatus === 403
      || /\b401\b/i.test(directoryErrorMessage)
      || /\b403\b/i.test(directoryErrorMessage)
      || /unauthorized/i.test(directoryErrorMessage)
      || /forbidden/i.test(directoryErrorMessage)
    )
  const canViewEntriesTab = canViewEntries
  const canViewMappingTab = canViewMapping
  const defaultTab = canViewEntriesTab
    ? 'entries'
    : (canViewMetadata
      ? 'metadata'
      : (canViewRequests ? 'requests' : ''))
  const { data: employeeLookup = EMPTY_LIST } = useEmployeeLookupQuery(canViewEntries || canViewMapping)
  const { data: metadataEntries = EMPTY_LIST } = useEmployeeMetadataQuery(canReadEmployeeMetadata)
  const shouldLoadRoleDirectory = canReadRoles || canViewEntries || canViewMapping || canViewRequests
  const { data: roles = EMPTY_LIST } = useRoleDirectoryQuery(shouldLoadRoleDirectory)
  const projectAssignmentsQuery = useProjectAssignmentsQuery(canViewEntries || canViewMapping)
  const { data: roleModules = EMPTY_LIST, isFetching: roleModulesFetching } = useRoleModulesQuery(canReadRoles)
  const { data: phoneCountryOptionsData = EMPTY_LIST } = usePhoneCountryOptionsQuery(canViewEntriesTab || canViewMetadata || canViewRequests)
  const {
    bulkAddEmployees,
    addEmployeeOptimistic,
    updateEmployeeOptimistic,
    deleteEmployeeOptimistic
  } = useEmployeeDirectoryActions()
  const {
    data: profileRequests = EMPTY_LIST,
    isFetching: profileRequestsFetching,
    isError: profileRequestsErrorState,
    error: profileRequestsError
  } = useQuery({
    queryKey: ['employees', 'profile-requests'],
    queryFn: employeeService.getProfileRequests,
    enabled: canViewRequests,
    retry: false,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => requestedTab || defaultTab)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [workLocationFilter, setWorkLocationFilter] = useState('All')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [positionFilter, setPositionFilter] = useState('All')
  const [roleFilter, setRoleFilter] = useState('All')
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState('All')
  const [genderFilter, setGenderFilter] = useState('All')
  const [bloodGroupFilter, setBloodGroupFilter] = useState('All')
  const [billingStatusFilter, setBillingStatusFilter] = useState('All')
  const [managerFilter, setManagerFilter] = useState('All')
  const [hrFilter, setHrFilter] = useState('All')
  const [teamLeadFilter, setTeamLeadFilter] = useState('All')
  const [coordinatorFilter, setCoordinatorFilter] = useState('All')
  const [joinDateRange, setJoinDateRange] = useState({ start: '', end: '' })
  const [mappingSearch, setMappingSearch] = useState('')
  const [mappingDepartmentFilter, setMappingDepartmentFilter] = useState('All')
  const [mappingPositionFilter, setMappingPositionFilter] = useState('All')
  const [mappingEmployeeFilter, setMappingEmployeeFilter] = useState('All')
  const [mappingManagerFilter, setMappingManagerFilter] = useState('All')

  const [isEmployeeFormOpen, setIsEmployeeFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [employeeFormMode, setEmployeeFormMode] = useState('create')
  const [importFile, setImportFile] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [employeeDraft, setEmployeeDraft] = useState(() => createEmptyEmployeeDraft())
  const [employeeFormTouched, setEmployeeFormTouched] = useState({})
  const [employeeFormTab, setEmployeeFormTab] = useState('basic')
  const [employeeFormProfile, setEmployeeFormProfile] = useState(null)
  const [employeeFormProfileLoading, setEmployeeFormProfileLoading] = useState(false)
  const [previewEmployee, setPreviewEmployee] = useState(null)
  const [previewEmployeeProfile, setPreviewEmployeeProfile] = useState(null)
  const [previewEmployeeProfileLoading, setPreviewEmployeeProfileLoading] = useState(false)
  const [previewEmployeeTab, setPreviewEmployeeTab] = useState('basic-info')

  const [metadataModal, setMetadataModal] = useState(null)
  const [metadataDraft, setMetadataDraft] = useState({ category: '', label: '', description: '', departmentUid: '', isActive: true, sortOrder: 0 })
  const [metadataTouched, setMetadataTouched] = useState({})
  const [roleDraft, setRoleDraft] = useState(() => createEmptyRoleDraft())
  const [roleTouched, setRoleTouched] = useState({})
  const [isRoleSaving, setIsRoleSaving] = useState(false)

  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [mappingEmployee, setMappingEmployee] = useState(null)
  const [mappingSelectedEmployeeUid, setMappingSelectedEmployeeUid] = useState('')
  const [mappingDraft, setMappingDraft] = useState(() => createMappingDraft(null))

  const canManageMetadataSection = (category, action) => {
    if (category === 'roles') {
      if (action === PERMISSION_ACTIONS.read) return canReadRoles
      return hasModulePermission(user, PERMISSION_MODULES.roles, action)
    }

    return hasModulePermission(user, PERMISSION_MODULES.employeeMetadata, action)
  }

  const metadataByCategory = useMemo(() => {
    return metadataEntries.reduce((accumulator, entry) => {
      const key = entry.category
      accumulator[key] = accumulator[key] || []
      accumulator[key].push(entry)
      return accumulator
    }, {})
  }, [metadataEntries])
  const metadataCatalog = useMemo(() => buildEmployeeMetadataCatalog(metadataEntries), [metadataEntries])

  const backendRoleModulesUnavailable = canReadRoles && !roleModulesFetching && Array.isArray(roleModules) && roleModules.length === 0
  const rolePermissionModules = useMemo(() => dedupeRoleModules([
    ...roleModules,
    ...roles.flatMap((role) => Object.keys(normalizeRoleAccess(role.access)))
  ]), [roleModules, roles])
  const roleModuleGroups = useMemo(() => buildRoleModuleGroups(rolePermissionModules), [rolePermissionModules])
  const availableTabs = useMemo(() => filterAccessibleTabs(TAB_ITEMS, (tabKey) => {
    if (tabKey === 'metadata') return canViewMetadata
    if (tabKey === 'entries') return canViewEntriesTab
    if (tabKey === 'mapping') return canViewMappingTab
    if (tabKey === 'requests') return canViewRequests
    return false
  }), [canViewEntriesTab, canViewMappingTab, canViewMetadata, canViewRequests])
  const updateTabSearchParam = useCallback((nextTab) => {
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current)
      if (nextTab) nextParams.set('tab', nextTab)
      else nextParams.delete('tab')
      return nextParams
    }, { replace: true })
  }, [setSearchParams])
  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab)
    updateTabSearchParam(nextTab)
  }, [updateTabSearchParam])
  const isEditingSystemAdminRole = metadataModal?.kind === 'role' && metadataModal?.mode === 'edit' && isSystemAdminRoleName(metadataModal?.entry?.roleName || roleDraft.roleName)
  const employeeFormErrors = useMemo(() => buildEmployeeFormErrors(employeeDraft, employeeFormMode), [employeeDraft, employeeFormMode])
  const metadataErrors = useMemo(() => buildMetadataFormErrors(metadataDraft), [metadataDraft])
  const roleErrors = useMemo(() => buildRoleFormErrors(roleDraft), [roleDraft])
  const getCachedEmployeeProfile = useCallback((employeeUid) => {
    if (!employeeUid) return null
    return queryClient.getQueryData(getEmployeeProfileQueryKey(employeeUid)) || null
  }, [queryClient])
  const fetchEmployeeProfile = useCallback((employeeUid) => {
    if (!employeeUid) return Promise.resolve(null)
    return queryClient.fetchQuery({
      queryKey: getEmployeeProfileQueryKey(employeeUid),
      queryFn: () => employeeService.getEmployeeProfile(employeeUid),
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000
    })
  }, [queryClient])

  const directoryRows = useMemo(() => {
    const mergedDirectory = new Map()
    const toDirectoryKey = (employee = {}) => (
      String(employee.uid || '').trim()
      || `user:${String(employee.userUid || '').trim()}`
      || `email:${String(employee.email || '').trim().toLowerCase()}`
      || `code:${String(employee.employeeCode || employee.id || '').trim()}`
    )
    const hasValue = (value) => {
      if (value == null) return false
      if (typeof value === 'string') return value.trim() !== ''
      if (Array.isArray(value)) return value.length > 0
      return true
    }

    const mergeRecord = (baseRecord = {}, nextRecord = {}) => {
      const mergedRecord = { ...baseRecord }
      Object.entries(nextRecord || {}).forEach(([fieldName, fieldValue]) => {
        if (hasValue(fieldValue)) mergedRecord[fieldName] = fieldValue
      })
      return mergedRecord
    }

    const ingest = (employee, allowReplace = false) => {
      const key = toDirectoryKey(employee)
      if (!key) return
      const current = mergedDirectory.get(key)
      if (!current) {
        mergedDirectory.set(key, employee)
        return
      }
      mergedDirectory.set(key, allowReplace ? mergeRecord(current, employee) : mergeRecord(employee, current))
    }

    employeeLookup.forEach((employee) => ingest(employee, false))
    employeesData.forEach((employee) => ingest(employee, true))
    return Array.from(mergedDirectory.values())
  }, [employeeLookup, employeesData])
  const roleDirectory = useMemo(() => new Map(roles.map((role) => [String(role.uid), role.roleName])), [roles])
  const employeeNameDirectory = useMemo(() => new Map(employeeLookup.map((employee) => [String(employee.uid), employee.fullName])), [employeeLookup])
  const projectAssignments = useMemo(() => (Array.isArray(projectAssignmentsQuery.data?.items) ? projectAssignmentsQuery.data.items : []), [projectAssignmentsQuery.data?.items])
  const assignmentStatusesByEmployeeUid = useMemo(() => {
    const lookup = new Map()

    projectAssignments.forEach((assignment) => {
      const employeeUid = String(assignment?.employeeUid || '').trim()
      const normalizedStatus = normalizeAssignmentStatus(assignment?.status)
      if (!employeeUid || !normalizedStatus) return

      const bucket = lookup.get(employeeUid) || new Set()
      bucket.add(normalizedStatus)
      lookup.set(employeeUid, bucket)
    })

    return new Map(Array.from(lookup.entries()).map(([employeeUid, statusSet]) => [employeeUid, Array.from(statusSet)]))
  }, [projectAssignments])

  const employees = useMemo(() => directoryRows.map((employee) => {
    const reportingAssignments = normalizeReportingAssignments(employee)
    const reportingAssignmentEntries = Object.entries(reportingAssignments).map(([fieldName, employeeUid]) => ({
      key: fieldName,
      label: formatReportingAssignmentLabel(fieldName),
      employeeUid,
      employeeName: employeeNameDirectory.get(String(employeeUid || '')) || ''
    }))
    const assignmentStatuses = assignmentStatusesByEmployeeUid.get(String(employee.uid || '')) || []

    return {
      ...employee,
      reportingAssignments,
      reportingAssignmentEntries,
      reportingAssignmentSummary: reportingAssignmentEntries.length
        ? reportingAssignmentEntries.map((entry) => `${entry.label}: ${entry.employeeName || 'Unassigned'}`).join(', ')
        : 'No reporting assignments',
      reportingAssignmentLabels: reportingAssignmentEntries.map((entry) => entry.label).join(', '),
      roleName: roleDirectory.get(String(employee.roleType || '')) || employee.roleName || '',
      departmentLabel: getMetadataDisplayLabel(metadataCatalog, 'department', employee.department),
      positionLabel: getMetadataDisplayLabel(metadataCatalog, 'position', employee.position),
      statusLabel: getMetadataDisplayLabel(metadataCatalog, 'status', employee.status),
      workLocationLabel: getMetadataDisplayLabel(metadataCatalog, 'work_location', employee.workLocation),
      employeeTypeLabel: getMetadataDisplayLabel(metadataCatalog, 'employee_type', employee.employeeType),
      bloodGroupLabel: getMetadataDisplayLabel(metadataCatalog, 'blood_group', employee.bloodGroup),
      genderLabel: getMetadataDisplayLabel(metadataCatalog, 'gender', employee.gender),
      managerName: employeeNameDirectory.get(String(reportingAssignments.manager_employee_uid || '')) || '',
      hrEmployeeName: employeeNameDirectory.get(String(reportingAssignments.hr_employee_uid || '')) || '',
      teamLeadName: employeeNameDirectory.get(String(reportingAssignments.team_lead_employee_uid || '')) || '',
      coordinatorName: employeeNameDirectory.get(String(reportingAssignments.coordinator_employee_uid || '')) || '',
      assignmentStatuses,
      assignmentStatusSummary: assignmentStatuses.map(formatAssignmentStatus).join(', ') || 'No assignment',
      billingStatus: resolveBillingStatus(assignmentStatuses)
    }
  }), [assignmentStatusesByEmployeeUid, directoryRows, roleDirectory, metadataCatalog, employeeNameDirectory])
  const employeeDirectoryByUid = useMemo(() => new Map(employees.map((employee) => [String(employee.uid), employee])), [employees])
  const mappedEmployees = useMemo(() => employees.filter((employee) => isEmployeeMapped(employee)), [employees])
  const mappingSelectableEmployees = useMemo(() => employees, [employees])
  const roleBadgeAssignments = useMemo(() => buildRoleBadgeAssignments(
    [...roles.map((role) => role.roleName), ...employees.map((employee) => employee.roleName)],
    readCachedRoleBadgeAssignments()
  ), [employees, roles])
  const roleBadgeStyleMap = useMemo(() => new Map(
    Object.entries(roleBadgeAssignments).map(([roleName, paletteIndex]) => [roleName, getRoleBadgeStyleFromPaletteIndex(paletteIndex)])
  ), [roleBadgeAssignments])

  useEffect(() => {
    writeCachedRoleBadgeAssignments(roleBadgeAssignments)
  }, [roleBadgeAssignments])

  const departmentValues = useMemo(
    () => metadataCatalog.departmentEntries.map((entry) => entry.value),
    [metadataCatalog.departmentEntries]
  )

  const roleOptions = useMemo(() => roles.map((role) => ({ value: role.uid, label: role.roleName, description: role.description || 'Auth role' })), [roles])
  const roleFilterOptions = useMemo(() => buildSelectOptions(roles.map((role) => ({ value: role.uid, label: role.roleName, description: role.description || 'Role filter' })), 'All roles'), [roles])
  const departmentMetadataOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.departmentEntries),
    [metadataCatalog.departmentEntries]
  )
  const metadataDepartmentOptions = useMemo(
    () => metadataCatalog.departmentEntries.map((entry) => ({
      value: entry.uid,
      label: entry.label || entry.value || '',
      description: entry.description || ''
    })),
    [metadataCatalog.departmentEntries]
  )
  const scopedPositionFilterOptions = useMemo(
    () => (
      departmentFilter === 'All'
        ? buildMetadataOptions(metadataCatalog.positionEntries, positionFilter === 'All' ? '' : positionFilter)
        : buildDepartmentScopedPositionOptions(metadataCatalog, departmentFilter, positionFilter === 'All' ? '' : positionFilter)
    ),
    [departmentFilter, metadataCatalog, positionFilter]
  )
  const positionFilterOptions = useMemo(() => buildSelectOptions(scopedPositionFilterOptions, 'All positions'), [scopedPositionFilterOptions])
  const departmentFilterOptions = useMemo(() => buildSelectOptions(departmentMetadataOptions), [departmentMetadataOptions])
  const mappingDepartmentFilterOptions = useMemo(() => buildSelectOptions(
    mergeOptionValues([], mappedEmployees.map((employee) => employee.department)),
    'All departments'
  ), [mappedEmployees])
  const statusFilterOptions = useMemo(() => buildSelectOptions(buildMetadataOptions(metadataCatalog.byCategory.status || [])), [metadataCatalog.byCategory.status])
  const workLocationFilterOptions = useMemo(() => buildSelectOptions(buildMetadataOptions(metadataCatalog.byCategory.work_location || [])), [metadataCatalog.byCategory.work_location])
  const employeeTypeFilterOptions = useMemo(() => buildSelectOptions(buildMetadataOptions(metadataCatalog.byCategory.employee_type || [])), [metadataCatalog.byCategory.employee_type])
  const genderFilterOptions = useMemo(() => buildSelectOptions(mergeOptionValues([], employees.map((employee) => employee.gender)), 'All genders'), [employees])
  const bloodGroupFilterOptions = useMemo(() => buildSelectOptions(buildMetadataOptions(metadataCatalog.byCategory.blood_group || [])), [metadataCatalog.byCategory.blood_group])
  const billingStatusFilterOptions = useMemo(() => buildSelectOptions([
    { value: 'Billable', label: 'Billable', description: 'Project assignment status is assigned or active.' },
    { value: 'Non Billable', label: 'Non Billable', description: 'Project assignment status is released, hold, terminated, inactive, or completed.' }
  ], 'All billing'), [])
  const managerFilterOptions = useMemo(() => buildSelectOptions(mergeOptionValues([], employees.map((employee) => employee.managerName)), 'All managers'), [employees])
  const hrFilterOptions = useMemo(() => buildSelectOptions(mergeOptionValues([], employees.map((employee) => employee.hrEmployeeName)), 'All HRs'), [employees])
  const teamLeadFilterOptions = useMemo(() => buildSelectOptions(mergeOptionValues([], employees.map((employee) => employee.teamLeadName)), 'All team leads'), [employees])
  const coordinatorFilterOptions = useMemo(() => buildSelectOptions(mergeOptionValues([], employees.map((employee) => employee.coordinatorName)), 'All coordinators'), [employees])

  const positionFormOptions = useMemo(
    () => buildDepartmentScopedPositionOptions(metadataCatalog, employeeDraft.department, employeeDraft.position),
    [employeeDraft.department, employeeDraft.position, metadataCatalog]
  )
  const departmentFormOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.departmentEntries, employeeDraft.department),
    [employeeDraft.department, metadataCatalog.departmentEntries]
  )
  const statusFormOptions = useMemo(() => buildMetadataOptions(metadataCatalog.byCategory.status || [], employeeDraft.status), [employeeDraft.status, metadataCatalog.byCategory.status])
  const workLocationFormOptions = useMemo(() => buildMetadataOptions(metadataCatalog.byCategory.work_location || [], employeeDraft.workLocation), [employeeDraft.workLocation, metadataCatalog.byCategory.work_location])
  const employeeTypeFormOptions = useMemo(() => buildMetadataOptions(metadataCatalog.byCategory.employee_type || [], employeeDraft.employeeType), [employeeDraft.employeeType, metadataCatalog.byCategory.employee_type])
  const phoneCountryFormOptions = useMemo(() => buildPhoneCountrySelectOptions(phoneCountryOptionsData), [phoneCountryOptionsData])
  const employeeFormTabs = useMemo(
    () => employeeFormMode === 'edit'
      ? EMPLOYEE_VIEW_TABS
      : EMPLOYEE_VIEW_TABS.filter((tab) => tab.key === 'basic'),
    [employeeFormMode]
  )
  const deferredSearch = useDeferredValue(search)
  const deferredMappingSearch = useDeferredValue(mappingSearch)

  const mappingDepartmentScopedEmployees = useMemo(() => (
    mappedEmployees.filter((employee) => (
      mappingDepartmentFilter === 'All'
      || employee.department === mappingDepartmentFilter
    ))
  ), [mappedEmployees, mappingDepartmentFilter])

  const mappingPositionFilterOptions = useMemo(() => buildSelectOptions(
    mergeOptionValues([], mappingDepartmentScopedEmployees.map((employee) => employee.positionLabel || employee.position)),
    'All positions'
  ), [mappingDepartmentScopedEmployees])
  const mappingPositionScopedEmployees = useMemo(() => mappingDepartmentScopedEmployees.filter((employee) => (
    mappingPositionFilter === 'All'
    || (employee.positionLabel || employee.position) === mappingPositionFilter
  )), [mappingDepartmentScopedEmployees, mappingPositionFilter])
  const mappingEmployeeFilterOptions = useMemo(() => buildSelectOptions(
    mappingPositionScopedEmployees.map((employee) => ({
      value: employee.uid,
      label: employee.fullName || employee.employeeCode || 'Employee',
      description: `${employee.employeeCode || 'No code'} • ${employee.positionLabel || employee.position || 'No position'}`
    })),
    'All employees'
  ), [mappingPositionScopedEmployees])
  const mappingManagerFilterOptions = useMemo(() => {
    const managerEntries = new Map()

    mappingPositionScopedEmployees.forEach((entry) => {
      const managerUid = String(entry.managerEmployeeUid || '').trim()
      if (!managerUid) return

      const managerRecord = employeeDirectoryByUid.get(managerUid)
      managerEntries.set(managerUid, {
        value: managerUid,
        label: managerRecord?.fullName || entry.managerName || 'Manager',
        description: `${managerRecord?.employeeCode || 'No code'} • ${managerRecord?.positionLabel || managerRecord?.position || 'No position'}`
      })
    })

    return buildSelectOptions(Array.from(managerEntries.values()), 'All managers')
  }, [employeeDirectoryByUid, mappingPositionScopedEmployees])

  const mappingModalEmployeeOptions = useMemo(() => {
    const selectedEmployeeValue = String(mappingSelectedEmployeeUid || '').trim()
    const selectedEmployee = selectedEmployeeValue ? employeeDirectoryByUid.get(selectedEmployeeValue) : null

    const optionEmployees = selectedEmployee
      && !mappingSelectableEmployees.some((employee) => String(employee.uid || '') === selectedEmployeeValue)
      ? [...mappingSelectableEmployees, selectedEmployee]
      : mappingSelectableEmployees

    return [...optionEmployees]
      .sort((left, right) => String(left.fullName || left.employeeCode || '').localeCompare(String(right.fullName || right.employeeCode || '')))
      .map((employee) => ({
        value: employee.uid,
        label: employee.fullName || employee.employeeCode || 'Employee',
        description: `${employee.employeeCode || 'No code'} • ${employee.roleName || 'No role'} • ${employee.positionLabel || employee.position || 'No position'}`
      }))
  }, [employeeDirectoryByUid, mappingSelectableEmployees, mappingSelectedEmployeeUid])

  const resolveMappingPositionValue = useCallback((value) => {
    const normalizedValue = String(value || '').trim()
    if (!normalizedValue) return ''

    const normalizedAssignmentKey = toReportingAssignmentKey(normalizedValue)
    const assignmentBase = normalizedAssignmentKey.replace(/_employee_uid$/i, '')
    const candidateValues = Array.from(new Set([
      normalizedValue,
      normalizedAssignmentKey,
      assignmentBase,
      assignmentBase.replace(/_/g, ' '),
      formatReportingAssignmentLabel(normalizedValue),
      formatReportingAssignmentLabel(normalizedAssignmentKey)
    ].map((entry) => String(entry || '').trim()).filter(Boolean)))

    for (const candidateValue of candidateValues) {
      const metadataEntry = findMetadataEntryByInput(metadataCatalog, 'position', candidateValue)
      if (metadataEntry?.value) return String(metadataEntry.value).trim()
    }

    if (/_employee_uid$/i.test(normalizedValue)) {
      return formatReportingAssignmentLabel(normalizedValue) || normalizedValue
    }

    return normalizedValue
  }, [metadataCatalog])

  const getReportingAssignmentOptionRank = useCallback((entry, preferredAssignmentKey = '') => {
    const assignmentKey = toReportingAssignmentKey(resolveMappingPositionValue(entry?.positionLabel || entry?.position || ''))
    const preferredKey = String(preferredAssignmentKey || '').trim()

    if (preferredKey && assignmentKey === preferredKey) return 0

    const orderIndex = REPORTING_ASSIGNMENT_OPTION_ORDER.indexOf(assignmentKey)
    if (orderIndex === -1) return REPORTING_ASSIGNMENT_OPTION_ORDER.length + 1

    return preferredKey ? orderIndex + 1 : orderIndex
  }, [resolveMappingPositionValue])

  const sortMappingAssigneeOptions = useCallback((records = [], preferredAssignmentKey = '') => (
    [...records].sort((left, right) => {
      const rankCompare = getReportingAssignmentOptionRank(left, preferredAssignmentKey) - getReportingAssignmentOptionRank(right, preferredAssignmentKey)
      if (rankCompare !== 0) return rankCompare

      const leftName = String(left.fullName || left.employeeCode || '')
      const rightName = String(right.fullName || right.employeeCode || '')
      return leftName.localeCompare(rightName)
    })
  ), [getReportingAssignmentOptionRank])

  const buildMappingAssigneeOptions = useCallback(({
    selectedEmployeeUid = '',
    preferredAssignmentKey = '',
    unassignedDescription = 'No assignment selected',
    labelFallback = 'Employee'
  } = {}) => {
    const selectedUid = String(selectedEmployeeUid || '').trim()
    const currentEmployeeUid = String(mappingEmployee?.uid || '').trim()
    const selectedRecord = selectedUid ? employeeDirectoryByUid.get(selectedUid) : null
    const candidateEmployees = employees.filter((entry) => String(entry.uid || '') !== currentEmployeeUid)
    const optionEmployees = selectedRecord
      && String(selectedRecord.uid || '') !== currentEmployeeUid
      && !candidateEmployees.some((entry) => String(entry.uid || '') === selectedUid)
      ? [...candidateEmployees, selectedRecord]
      : candidateEmployees

    return [
      { value: '', label: 'Unassigned', description: unassignedDescription },
      ...sortMappingAssigneeOptions(optionEmployees, preferredAssignmentKey)
        .map((entry) => ({
          value: entry.uid,
          label: entry.fullName || entry.employeeCode || labelFallback,
          description: `${entry.employeeCode || 'No code'} • ${entry.positionLabel || entry.position || 'No position'} • ${entry.departmentLabel || entry.department || 'No department'}`
        }))
    ]
  }, [employeeDirectoryByUid, employees, mappingEmployee?.uid, sortMappingAssigneeOptions])

  const hiddenMappingEmployeeOptions = useMemo(() => buildMappingAssigneeOptions({
    unassignedDescription: 'No assignment selected'
  }), [buildMappingAssigneeOptions])

  const mappingManagerOptions = useMemo(() => buildMappingAssigneeOptions({
    selectedEmployeeUid: mappingDraft.managerEmployeeUid,
    preferredAssignmentKey: MAPPING_ASSIGNMENT_FIELD_CONFIG.managerEmployeeUid.assignmentKey,
    unassignedDescription: 'Remove current manager assignment',
    labelFallback: 'Manager'
  }), [buildMappingAssigneeOptions, mappingDraft.managerEmployeeUid])

  const mappingHrOptions = useMemo(() => buildMappingAssigneeOptions({
    selectedEmployeeUid: mappingDraft.hrEmployeeUid,
    preferredAssignmentKey: MAPPING_ASSIGNMENT_FIELD_CONFIG.hrEmployeeUid.assignmentKey,
    unassignedDescription: 'Remove current HR assignment',
    labelFallback: 'HR'
  }), [buildMappingAssigneeOptions, mappingDraft.hrEmployeeUid])

  const mappingTeamLeadOptions = useMemo(() => buildMappingAssigneeOptions({
    selectedEmployeeUid: mappingDraft.teamLeadEmployeeUid,
    preferredAssignmentKey: MAPPING_ASSIGNMENT_FIELD_CONFIG.teamLeadEmployeeUid.assignmentKey,
    unassignedDescription: 'Remove current team lead assignment',
    labelFallback: 'Team Lead'
  }), [buildMappingAssigneeOptions, mappingDraft.teamLeadEmployeeUid])

  const mappingCoordinatorOptions = useMemo(() => buildMappingAssigneeOptions({
    selectedEmployeeUid: mappingDraft.coordinatorEmployeeUid,
    preferredAssignmentKey: MAPPING_ASSIGNMENT_FIELD_CONFIG.coordinatorEmployeeUid.assignmentKey,
    unassignedDescription: 'Remove current coordinator assignment',
    labelFallback: 'Coordinator'
  }), [buildMappingAssigneeOptions, mappingDraft.coordinatorEmployeeUid])

  const getMappingPositionWarning = useCallback((employeeUid, assignmentKey) => {
    const normalizedEmployeeUid = String(employeeUid || '').trim()
    if (!normalizedEmployeeUid) return ''

    const selectedRecord = employeeDirectoryByUid.get(normalizedEmployeeUid)
    if (!selectedRecord) return ''

    const expectedAssignmentKey = toReportingAssignmentKey(assignmentKey)
    const selectedPosition = selectedRecord.positionLabel || selectedRecord.position || ''
    const selectedAssignmentKey = toReportingAssignmentKey(resolveMappingPositionValue(selectedPosition))
    if (selectedAssignmentKey === expectedAssignmentKey) return ''

    const expectedLabel = formatReportingAssignmentLabel(expectedAssignmentKey) || 'selected assignment'
    const selectedPositionLabel = selectedPosition || 'no position'
    return `${selectedRecord.fullName || 'Selected employee'} is currently marked as ${selectedPositionLabel}, not the expected ${expectedLabel} position. You can still save this mapping.`
  }, [employeeDirectoryByUid, resolveMappingPositionValue])

  const mappingAssignmentWarnings = useMemo(() => (
    MAPPING_DRAFT_FIELDS.reduce((warnings, fieldName) => {
      const fieldConfig = MAPPING_ASSIGNMENT_FIELD_CONFIG[fieldName]
      warnings[fieldName] = getMappingPositionWarning(mappingDraft[fieldName], fieldConfig.assignmentKey)
      return warnings
    }, {})
  ), [getMappingPositionWarning, mappingDraft.coordinatorEmployeeUid, mappingDraft.hrEmployeeUid, mappingDraft.managerEmployeeUid, mappingDraft.teamLeadEmployeeUid])

  useEffect(() => {
    if (positionFilter === 'All') return
    if (positionFilterOptions.some((option) => String(option.value) === String(positionFilter))) return
    setPositionFilter('All')
  }, [positionFilter, positionFilterOptions])

  useEffect(() => {
    if (mappingPositionFilter === 'All') return
    if (mappingPositionFilterOptions.some((option) => String(option.value) === String(mappingPositionFilter))) return
    setMappingPositionFilter('All')
  }, [mappingPositionFilter, mappingPositionFilterOptions])

  useEffect(() => {
    if (mappingEmployeeFilter === 'All') return
    if (mappingEmployeeFilterOptions.some((option) => String(option.value) === String(mappingEmployeeFilter))) return
    setMappingEmployeeFilter('All')
  }, [mappingEmployeeFilter, mappingEmployeeFilterOptions])

  useEffect(() => {
    if (mappingManagerFilter === 'All') return
    if (mappingManagerFilterOptions.some((option) => String(option.value) === String(mappingManagerFilter))) return
    setMappingManagerFilter('All')
  }, [mappingManagerFilter, mappingManagerFilterOptions])

  useEffect(() => {
    if (!mappingSelectedEmployeeUid) return
    if (mappingModalEmployeeOptions.some((option) => String(option.value) === String(mappingSelectedEmployeeUid))) return
    setMappingSelectedEmployeeUid('')
  }, [mappingModalEmployeeOptions, mappingSelectedEmployeeUid])

  const filteredEmployees = useMemo(() => filterCollectionByQuery(employees, deferredSearch, [
    'employeeCode',
    'fullName',
    'roleName',
    'position',
    'positionLabel',
    'department',
    'departmentLabel',
    'email',
    'phone',
    'status',
    'statusLabel',
    'workLocation',
    'workLocationLabel',
    'employeeType',
    'employeeTypeLabel',
    'assignmentStatusSummary',
    'billingStatus'
  ]).filter((employee) => {
    const matchesSearch = true

    const matchesStatus = statusFilter === 'All' || employee.status === statusFilter
    const matchesWorkLocation = workLocationFilter === 'All' || employee.workLocation === workLocationFilter
    const matchesDepartment = departmentFilter === 'All' || employee.department === departmentFilter
    const matchesPosition = positionFilter === 'All' || employee.position === positionFilter
    const shouldBypassRoleScopeFilter = canViewEntries && !canCreateEmployees && !canUpdateEmployees && !canDeleteEmployees
    const matchesRole = shouldBypassRoleScopeFilter || roleFilter === 'All' || String(employee.roleType || '') === String(roleFilter)
    const matchesEmployeeType = employeeTypeFilter === 'All' || employee.employeeType === employeeTypeFilter
    const matchesGender = genderFilter === 'All' || employee.gender === genderFilter
    const matchesBloodGroup = bloodGroupFilter === 'All' || employee.bloodGroup === bloodGroupFilter
    const matchesBillingStatus = billingStatusFilter === 'All' || employee.billingStatus === billingStatusFilter
    const matchesManager = managerFilter === 'All' || employee.managerName === managerFilter
    const matchesHr = hrFilter === 'All' || employee.hrEmployeeName === hrFilter
    const matchesTeamLead = teamLeadFilter === 'All' || employee.teamLeadName === teamLeadFilter
    const matchesCoordinator = coordinatorFilter === 'All' || employee.coordinatorName === coordinatorFilter
    const matchesJoinDate = isJoinDateInRange(employee.joinDate, joinDateRange)

    return matchesSearch
      && matchesStatus
      && matchesWorkLocation
      && matchesDepartment
      && matchesPosition
      && matchesRole
      && matchesEmployeeType
      && matchesGender
      && matchesBloodGroup
      && matchesBillingStatus
      && matchesManager
      && matchesHr
      && matchesTeamLead
      && matchesCoordinator
      && matchesJoinDate
  }), [
    canCreateEmployees,
    canDeleteEmployees,
    canUpdateEmployees,
    canViewEntries,
    billingStatusFilter,
    bloodGroupFilter,
    coordinatorFilter,
    deferredSearch,
    departmentFilter,
    employeeTypeFilter,
    employees,
    genderFilter,
    hrFilter,
    joinDateRange,
    managerFilter,
    positionFilter,
    roleFilter,
    statusFilter,
    teamLeadFilter,
    workLocationFilter
  ])

  const { items: sortedEmployees, sortConfig: employeeSortConfig, requestSort: requestEmployeeSort } = useSortableData(filteredEmployees, {
    initialKey: 'employee',
    initialDirection: 'asc',
    accessors: {
      employee: (employee) => `${employee.fullName || ''} ${employee.employeeCode || ''}`.trim(),
      role: (employee) => employee.roleName || '',
      contact: (employee) => `${employee.email || ''} ${employee.phone || ''}`.trim(),
      positionDepartment: (employee) => `${employee.position || ''} ${employee.department || ''}`.trim(),
      statusJoinDate: (employee) => `${employee.status || ''} ${employee.joinDate || ''}`.trim(),
      locationType: (employee) => `${employee.workLocation || ''} ${employee.employeeType || ''}`.trim(),
      billingStatus: (employee) => `${employee.billingStatus || ''} ${employee.assignmentStatusSummary || ''}`.trim()
    }
  })
  const { items: sortedProfileRequests, sortConfig: profileRequestSortConfig, requestSort: requestProfileRequestSort } = useSortableData(profileRequests, {
    initialKey: 'employee',
    initialDirection: 'asc',
    accessors: {
      employee: (entry) => `${entry.fullName || ''} ${entry.employeeCode || entry.username || entry.email || ''}`.trim(),
      email: (entry) => `${entry.email || ''} ${entry.username || ''}`.trim(),
      verification: (entry) => `${entry.status || ''} ${entry.isVerified ? 'verified' : 'unverified'}`.trim(),
      accountStatus: (entry) => `${entry.accountState || (entry.isBackendLocked ? 'Locked' : 'Unlocked')} ${entry.lockedAt || entry.unlockedAt || ''}`.trim(),
      lockDetails: (entry) => `${entry.lockedReason || ''} ${entry.isStatusLocked ? (entry.status || '') : ''}`.trim(),
      firstLogin: (entry) => entry.firstLoginAt || '',
      firstLoginState: (entry) => (entry.firstLoginAt ? 'Completed' : 'Pending')
    }
  })

  const mappingRows = useMemo(() => filterCollectionByQuery(mappedEmployees, deferredMappingSearch, [
    'employeeCode',
    'fullName',
    'roleName',
    'department',
    'departmentLabel',
    'position',
    'positionLabel',
    'managerName'
  ]).filter((employee) => {
    const matchesDepartment = mappingDepartmentFilter === 'All' || employee.department === mappingDepartmentFilter
    const matchesPosition = mappingPositionFilter === 'All' || (employee.positionLabel || employee.position) === mappingPositionFilter
    const matchesEmployee = mappingEmployeeFilter === 'All' || String(employee.uid || '') === String(mappingEmployeeFilter)
    const matchesManager = mappingManagerFilter === 'All' || String(employee.managerEmployeeUid || '') === String(mappingManagerFilter)

    return matchesDepartment
      && matchesPosition
      && matchesEmployee
      && matchesManager
  }), [
    deferredMappingSearch,
    mappedEmployees,
    mappingDepartmentFilter,
    mappingEmployeeFilter,
    mappingManagerFilter,
    mappingPositionFilter,
  ])

  const metrics = useMemo(() => {
    const active = employees.filter((employee) => employee.status === 'Active').length
    const inactive = employees.filter((employee) => employee.status === 'Inactive').length
    const onsite = employees.filter((employee) => employee.workLocation === 'Onsite').length
    const remote = employees.filter((employee) => employee.workLocation === 'Remote').length
    const hybrid = employees.filter((employee) => employee.workLocation === 'Hybrid').length
    const mapped = employees.filter((employee) => employee.managerEmployeeUid).length
    return { active, inactive, onsite, remote, hybrid, mapped }
  }, [employees])

  const profileRequestMetrics = useMemo(() => {
    const now = Date.now()
    const locked = profileRequests.filter((entry) => entry.isBackendLocked).length
    const unlocked = profileRequests.filter((entry) => !entry.isBackendLocked).length
    const pendingFirstLogin = profileRequests.filter((entry) => !entry.firstLoginAt).length
    const expiredWindow = profileRequests.filter((entry) => {
      const deadline = Date.parse(entry.firstLoginDeadlineAt || '')
      return !entry.firstLoginAt && Number.isFinite(deadline) && deadline < now
    }).length

    return { locked, unlocked, pendingFirstLogin, expiredWindow }
  }, [profileRequests])

  useEffect(() => {
    const selectedEmployeeValue = String(mappingSelectedEmployeeUid || '').trim()
    const nextEmployee = selectedEmployeeValue ? (employeeDirectoryByUid.get(selectedEmployeeValue) || null) : null
    const nextDraft = createMappingDraft(nextEmployee)

    setMappingEmployee((currentEmployee) => {
      if (!nextEmployee) return currentEmployee ? null : currentEmployee

      const currentEmployeeUid = String(currentEmployee?.uid || '')
      const nextEmployeeUid = String(nextEmployee.uid || '')
      const currentDraft = createMappingDraft(currentEmployee)

      return currentEmployeeUid === nextEmployeeUid && areMappingDraftsEqual(currentDraft, nextDraft)
        ? currentEmployee
        : nextEmployee
    })
    setMappingDraft((currentDraft) => (areMappingDraftsEqual(currentDraft, nextDraft) ? currentDraft : nextDraft))
  }, [employeeDirectoryByUid, mappingSelectedEmployeeUid])

  useEffect(() => {
    let isMounted = true

    async function loadPreviewProfile() {
      if (!previewEmployee?.uid) {
        setPreviewEmployeeProfile(null)
        setPreviewEmployeeProfileLoading(false)
        setPreviewEmployeeTab('basic-info')
        return
      }

      const cachedProfile = getCachedEmployeeProfile(previewEmployee.uid)
      if (cachedProfile) {
        setPreviewEmployeeProfile(cachedProfile)
      } else {
        setPreviewEmployeeProfile(null)
      }

      setPreviewEmployeeTab('basic-info')
      setPreviewEmployeeProfileLoading(true)
      try {
        const profile = await fetchEmployeeProfile(previewEmployee.uid)
        if (!isMounted) return
        setPreviewEmployeeProfile(profile)
      } catch (error) {
        if (!isMounted) return
        if (!cachedProfile) setPreviewEmployeeProfile(null)
        showStatus({
          type: 'error',
          title: 'Employee profile load failed',
          message: error?.response?.data?.detail || error?.message || 'Could not load employee profile details.'
        })
      } finally {
        if (isMounted) setPreviewEmployeeProfileLoading(false)
      }
    }

    loadPreviewProfile()
    return () => { isMounted = false }
  }, [fetchEmployeeProfile, getCachedEmployeeProfile, previewEmployee, showStatus])

  useEffect(() => {
    let isMounted = true

    async function loadEmployeeFormProfile() {
      if (!isEmployeeFormOpen || employeeFormMode !== 'edit' || !selectedEmployee?.uid) {
        setEmployeeFormProfile(null)
        setEmployeeFormProfileLoading(false)
        setEmployeeFormTab('basic')
        return
      }

      const cachedProfile = getCachedEmployeeProfile(selectedEmployee.uid)
      if (cachedProfile) {
        setEmployeeFormProfile(cachedProfile)
      } else {
        setEmployeeFormProfile(null)
      }

      setEmployeeFormTab('basic')
      setEmployeeFormProfileLoading(true)
      try {
        const profile = await fetchEmployeeProfile(selectedEmployee.uid)
        if (!isMounted) return
        setEmployeeFormProfile(profile)
      } catch (error) {
        if (!isMounted) return
        if (!cachedProfile) setEmployeeFormProfile(null)
        showStatus({
          type: 'error',
          title: 'Employee details load failed',
          message: error?.response?.data?.detail || error?.message || 'Could not load employee additional details.'
        })
      } finally {
        if (isMounted) setEmployeeFormProfileLoading(false)
      }
    }

    loadEmployeeFormProfile()
    return () => { isMounted = false }
  }, [employeeFormMode, fetchEmployeeProfile, getCachedEmployeeProfile, isEmployeeFormOpen, selectedEmployee, showStatus])

  function resetDirectoryFilters() {
    setSearch('')
    setStatusFilter('All')
    setWorkLocationFilter('All')
    setDepartmentFilter('All')
    setPositionFilter('All')
    setRoleFilter('All')
    setEmployeeTypeFilter('All')
    setGenderFilter('All')
    setBloodGroupFilter('All')
    setBillingStatusFilter('All')
    setManagerFilter('All')
    setHrFilter('All')
    setTeamLeadFilter('All')
    setCoordinatorFilter('All')
    setJoinDateRange({ start: '', end: '' })
  }

  function resetMappingFilters() {
    setMappingSearch('')
    setMappingDepartmentFilter('All')
    setMappingPositionFilter('All')
    setMappingEmployeeFilter('All')
    setMappingManagerFilter('All')
  }

  function handleMappingDepartmentFilterChange(nextDepartment) {
    setMappingDepartmentFilter(nextDepartment)
    setMappingPositionFilter('All')
    setMappingEmployeeFilter('All')
    setMappingManagerFilter('All')
  }

  function handleMappingPositionFilterChange(nextPosition) {
    setMappingPositionFilter(nextPosition)
    setMappingEmployeeFilter('All')
    setMappingManagerFilter('All')
  }

  function closeMappingModal() {
    setMappingModalOpen(false)
    setMappingEmployee(null)
    setMappingSelectedEmployeeUid('')
    setMappingDraft(createMappingDraft(null))
  }

  function openCreateEmployee() {
    if (!canCreateEmployees) {
      showStatus({ type: 'error', title: 'Employee access blocked', message: 'Your role does not have permission to create employee records.' })
      return
    }
    setEmployeeFormMode('create')
    setSelectedEmployee(null)
    setEmployeeDraft(createEmptyEmployeeDraft())
    setEmployeeFormTouched({})
    setEmployeeFormTab('basic')
    setEmployeeFormProfile(null)
    setIsEmployeeFormOpen(true)
  }

  function openEditEmployee(employee) {
    if (!canUpdateEmployees) {
      showStatus({ type: 'error', title: 'Employee access blocked', message: 'Your role does not have permission to update employee records.' })
      return
    }

    const cachedProfile = (previewEmployee?.uid && String(previewEmployee.uid) === String(employee?.uid))
      ? (previewEmployeeProfile || getCachedEmployeeProfile(employee?.uid))
      : getCachedEmployeeProfile(employee?.uid)

    setEmployeeFormMode('edit')
    setSelectedEmployee(employee)
    setEmployeeDraft(buildEmployeeDraft(employee))
    setEmployeeFormTouched({})
    setEmployeeFormTab('basic')
    setEmployeeFormProfile(cachedProfile || null)
    setIsEmployeeFormOpen(true)
  }

  function handleEmployeeDraftChange(event) {
    const { name } = event.target
    let { value } = event.target
    if (name === 'employeeCode') value = value.toUpperCase().replace(/[^A-Z0-9-]/g, '')

    setEmployeeDraft((current) => {
      if (name === 'phoneLocal') {
        const { maxLength } = getPhoneCountryLengthRule(current.phoneCountryCode)
        value = String(value).replace(/\D/g, '').slice(0, maxLength)
      }

      if (name === 'emergencyContactLocal') {
        const { maxLength } = getPhoneCountryLengthRule(current.emergencyContactCountryCode)
        value = String(value).replace(/\D/g, '').slice(0, maxLength)
      }

      const nextDraft = { ...current, [name]: value }
      if (name === 'department' && !isPositionMappedToDepartment(metadataCatalog, nextDraft.position, value)) {
        nextDraft.position = ''
      }

      return nextDraft
    })
  }

  function handleEmployeeFieldBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setEmployeeFormTouched((current) => ({ ...current, [fieldName]: true }))
  }

  async function handleSaveEmployee() {
    const canSaveEmployee = employeeFormMode === 'create' ? canCreateEmployees : canUpdateEmployees
    if (!canSaveEmployee) {
      showStatus({
        type: 'error',
        title: 'Employee access blocked',
        message: employeeFormMode === 'create'
          ? 'Your role does not have permission to create employee records.'
          : 'Your role does not have permission to update employee records.'
      })
      return
    }

    const validationFields = [
      ...(employeeFormMode === 'create' ? ['employeeCode'] : []),
      ...EMPLOYEE_FORM_REQUIRED_FIELDS.filter((fieldName) => fieldName !== 'employeeCode'),
      'dateOfBirth',
      'emergencyContactLocal'
    ]
    setEmployeeFormTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(employeeFormErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => employeeFormErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Form has validation errors', message: firstError || 'Resolve the highlighted fields before continuing.' })
      return
    }

    const phone = buildPhoneValue(employeeDraft.phoneCountryCode, employeeDraft.phoneLocal)
    const emergencyContact = buildPhoneValue(employeeDraft.emergencyContactCountryCode, employeeDraft.emergencyContactLocal)

    const payload = buildEmployeePayload({
      ...employeeDraft,
      employeeCode: employeeFormMode === 'edit' ? (selectedEmployee?.employeeCode || employeeDraft.employeeCode) : employeeDraft.employeeCode,
      phone,
      emergencyContact,
      roleName: roleDirectory.get(String(employeeDraft.roleType || '')) || '',
      createdAt: selectedEmployee?.createdAt
    }, selectedEmployee || {})

    try {
      const isCreateMode = employeeFormMode === 'create'
      const { request } = isCreateMode
        ? addEmployeeOptimistic(payload)
        : updateEmployeeOptimistic(selectedEmployee.uid, payload)

      showStatus({
        type: 'success',
        title: isCreateMode ? 'Employee created' : 'Employee updated',
        message: isCreateMode
          ? `${payload.fullName} is visible now. Server sync and linked auth provisioning will finish in the background.`
          : `${payload.fullName} is updated on the table now. Server sync is running in the background.`
      })

      void request
        .then(() => queryClient.invalidateQueries({ queryKey: ['employees', 'profile'], exact: false }))
        .catch((syncError) => {
          showStatus({
            type: 'error',
            title: isCreateMode ? 'Employee creation reverted' : 'Employee update reverted',
            message: syncError?.response?.data?.detail || syncError?.message || 'The server rejected the employee change, so the table was restored.'
          })
        })

      setIsEmployeeFormOpen(false)
      setEmployeeDraft(createEmptyEmployeeDraft())
      setEmployeeFormTouched({})
      setEmployeeFormTab('basic')
      setEmployeeFormProfile(null)
      setSelectedEmployee(null)
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Employee save failed', message: actionError?.response?.data?.detail || actionError?.message || 'The employee request could not be started.' })
    }
  }

  async function handleDeleteEmployee(employee) {
    if (!canDeleteEmployees) {
      showStatus({ type: 'error', title: 'Employee access blocked', message: 'Your role does not have permission to delete employee records.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Employee',
      title: 'Remove this employee record?',
      message: `${employee.fullName} will be deleted from the employee directory.`
    })
    if (!accepted) return

    try {
      const { request } = deleteEmployeeOptimistic(employee.uid)
      showStatus({ type: 'success', title: 'Employee removed', message: `${employee.fullName} was removed from the table. Server sync is running in the background.` })

      void request.catch((syncError) => {
        showStatus({
          type: 'error',
          title: 'Employee removal reverted',
          message: syncError?.response?.data?.detail || syncError?.message || 'The server rejected the delete request, so the employee was restored.'
        })
      })
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Delete failed', message: actionError?.response?.data?.detail || actionError?.message || 'The employee delete request could not be started.' })
    }
  }

  async function handleImportSubmit() {
    if (!canCreateEmployees) {
      showStatus({ type: 'error', title: 'Employee access blocked', message: 'Your role does not have permission to import employee records.' })
      return
    }

    if (!importFile) {
      showStatus({ type: 'error', title: 'No file selected', message: 'Upload the populated CSV or Excel template before starting the bulk import.' })
      return
    }

    let rows = []
    try {
      const parsedFile = await parseBulkEmployeeFile(importFile)
      rows = parsedFile.rows
    } catch (fileParseError) {
      showStatus({ type: 'error', title: 'Unsupported import file', message: fileParseError?.message || 'The selected file could not be parsed.' })
      return
    }

    const { payloads, errors } = buildImportPayloads(rows, employees, roleDirectory, metadataCatalog)

    if (!payloads.length) {
      showStatus({ type: 'error', title: 'Import file is not ready', message: errors[0] || 'The uploaded file did not contain valid employee rows.' })
      return
    }

    if (errors.length) {
      showStatus({ type: 'error', title: 'Import validation failed', message: errors.slice(0, 3).join(' ') })
      return
    }

    try {
      await runWithLoader(() => bulkAddEmployees(payloads), { title: 'Importing employees', message: `Creating ${payloads.length} employee records from the uploaded template.`, minVisibleMs: 900 })
      showStatus({ type: 'success', title: 'Bulk import completed', message: `${payloads.length} employee record${payloads.length === 1 ? '' : 's'} were imported successfully.` })
      setImportFile(null)
      setIsImportOpen(false)
    } catch (importError) {
      showStatus({ type: 'error', title: 'Bulk import failed', message: importError?.response?.data?.detail || importError?.message || 'The selected file could not be imported.' })
    }
  }

  function openMetadataModal(category) {
    if (!canManageMetadataSection(category, PERMISSION_ACTIONS.create)) {
      showStatus({ type: 'error', title: 'Metadata access blocked', message: 'Your role does not have permission to create entries in this section.' })
      return
    }

    if (category === 'roles') {
      setMetadataModal({ kind: 'role', mode: 'create' })
      setRoleDraft(createEmptyRoleDraft())
      setRoleTouched({})
      return
    }
    setMetadataModal({ kind: 'metadata', category, mode: 'create' })
    setMetadataDraft({ category, label: '', description: '', departmentUid: '', isActive: true, sortOrder: 0 })
    setMetadataTouched({})
  }

  function openEditMetadata(category, entry) {
    if (!canManageMetadataSection(category, PERMISSION_ACTIONS.update)) {
      showStatus({ type: 'error', title: 'Metadata access blocked', message: 'Your role does not have permission to update entries in this section.' })
      return
    }

    if (category === 'roles') {
      setMetadataModal({ kind: 'role', mode: 'edit', entry })
      setRoleDraft({ uid: entry.uid || null, roleName: entry.roleName || '', description: entry.description || '', access: getEffectiveRoleAccess(entry.access, entry.roleName, rolePermissionModules) })
      setRoleTouched({})
      return
    }
    setMetadataModal({ kind: 'metadata', category, mode: 'edit', entry })
    setMetadataDraft({
      category,
      label: entry.label || '',
      description: entry.description || '',
      departmentUid: entry.departmentUid || '',
      isActive: entry.isActive !== false,
      sortOrder: entry.sortOrder || 0
    })
    setMetadataTouched({})
  }

  function handleMetadataDraftChange(event) {
    const { name, value } = event.target
    setMetadataDraft((current) => ({ ...current, [name]: name === 'sortOrder' ? Number(value || 0) : value }))
  }

  function handleMetadataFieldBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setMetadataTouched((current) => ({ ...current, [fieldName]: true }))
  }

  function handleRoleDraftChange(event) {
    const { name, value } = event.target
    setRoleDraft((current) => ({
      ...current,
      [name]: name === 'access' ? normalizeRoleAccess(value) : value
    }))
  }

  function handleRoleFieldBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setRoleTouched((current) => ({ ...current, [fieldName]: true }))
  }

  async function handleSaveMetadata() {
    if (metadataModal?.kind === 'role') {
      const requiredAction = metadataModal?.mode === 'create' ? PERMISSION_ACTIONS.create : PERMISSION_ACTIONS.update
      if (!canManageMetadataSection('roles', requiredAction)) {
        showStatus({ type: 'error', title: 'Role access blocked', message: 'Your role does not have permission to save role access entries.' })
        return
      }

      if (backendRoleModulesUnavailable) {
        showStatus({
          type: 'error',
          title: 'Backend modules unavailable',
          message: 'No valid role modules are available right now, so the role matrix cannot be saved.'
        })
        return
      }

      setRoleTouched((current) => ({ ...current, ...markFieldsTouched(['roleName']) }))

      if (hasValidationErrors(roleErrors, ['roleName'])) {
        showStatus({ type: 'error', title: 'Missing role name', message: roleErrors.roleName || 'Role name is required.' })
        return
      }

      if (isEditingSystemAdminRole) {
        showStatus({ type: 'error', title: 'Role locked', message: 'The Admin role is system-managed. Its permissions are shown for reference and cannot be changed here.' })
        return
      }

      const sanitizedRolePayload = {
        roleName: roleDraft.roleName.trim(),
        description: roleDraft.description?.trim() || '',
        access: normalizeRoleAccess(roleDraft.access)
      }
      const targetRoleUid = roleDraft.uid || metadataModal?.entry?.uid

      setIsRoleSaving(true)
      try {
        await runWithLoader(async () => {
          if (metadataModal.mode === 'create') {
            await metadataService.createRole(sanitizedRolePayload)
          } else {
            await metadataService.updateRole(targetRoleUid, sanitizedRolePayload)
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['employees', 'roles'] }),
            queryClient.invalidateQueries({ queryKey: ['employees', 'role-modules', 'v2'] })
          ])
        }, {
          title: metadataModal.mode === 'create' ? 'Creating role' : 'Updating role',
          message: 'Saving the role matrix and syncing permission modules.',
          minVisibleMs: 700,
          delayMs: 0
        })

        showStatus({ type: 'success', title: metadataModal.mode === 'create' ? 'Role created' : 'Role updated', message: `${sanitizedRolePayload.roleName} is now available for employee mapping.` })
        setMetadataModal(null)
        setRoleTouched({})
      } catch (actionError) {
        const responseStatus = actionError?.response?.status
        const responseMessage = actionError?.response?.data?.detail || actionError?.message || 'The role could not be saved.'
        showStatus({
          type: 'error',
          title: 'Role save failed',
          message: responseStatus === 403
            ? responseMessage || 'Your current session is not allowed to update this role.'
            : responseMessage
        })
      } finally {
        setIsRoleSaving(false)
      }
      return
    }

    const metadataAction = metadataModal?.mode === 'create' ? PERMISSION_ACTIONS.create : PERMISSION_ACTIONS.update
    if (!canManageMetadataSection(metadataModal?.category, metadataAction)) {
      showStatus({ type: 'error', title: 'Metadata access blocked', message: 'Your role does not have permission to save metadata entries.' })
      return
    }

    const metadataValidationFields = metadataDraft.category === 'position'
      ? ['label', 'departmentUid']
      : ['label']

    setMetadataTouched((current) => ({ ...current, ...markFieldsTouched(metadataValidationFields) }))

    if (hasValidationErrors(metadataErrors, metadataValidationFields)) {
      const firstError = metadataValidationFields.map((fieldName) => metadataErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Missing metadata value', message: firstError || 'Label is required.' })
      return
    }

    try {
      await runWithLoader(async () => {
        if (metadataModal.mode === 'create') {
          await metadataService.createEntry(metadataDraft)
        } else {
          await metadataService.updateEntry(metadataModal.entry.uid, metadataDraft)
        }
        await queryClient.invalidateQueries({ queryKey: ['employees', 'metadata'] })
      }, { title: metadataModal.mode === 'create' ? 'Creating metadata entry' : 'Updating metadata entry', message: 'Saving master data for employee management.' })
      showStatus({ type: 'success', title: metadataModal.mode === 'create' ? 'Metadata entry created' : 'Metadata entry updated', message: `${metadataDraft.label} is now available in employee management.` })
      setMetadataModal(null)
      setMetadataTouched({})
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Metadata save failed', message: toEndUserMetadataSaveError(actionError) })
    }
  }

  async function handleDeleteMetadata(category, entry) {
    if (!canManageMetadataSection(category, PERMISSION_ACTIONS.delete)) {
      showStatus({ type: 'error', title: 'Metadata access blocked', message: 'Your role does not have permission to delete entries in this section.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: category === 'roles' ? 'Delete Role' : 'Delete Metadata Entry',
      title: `Delete ${category === 'roles' ? entry.roleName : entry.label}?`,
      message: 'This entry will no longer be available in employee management.'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        if (category === 'roles') {
          await metadataService.deleteRole(entry.uid)
          await queryClient.invalidateQueries({ queryKey: ['employees', 'roles'] })
        } else {
          await metadataService.deleteEntry(entry.uid)
          await queryClient.invalidateQueries({ queryKey: ['employees', 'metadata'] })
        }
      }, { title: 'Deleting entry', message: 'Removing the selected metadata entry.' })
      showStatus({ type: 'success', title: 'Entry removed', message: `${category === 'roles' ? entry.roleName : entry.label} has been removed.` })
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Delete failed', message: actionError?.response?.data?.detail || actionError?.message || 'The entry could not be removed.' })
    }
  }

  function openCreateMapping() {
    if (!canCreateEmployeeMapping) {
      showStatus({ type: 'error', title: 'Mapping access blocked', message: 'Your role does not have permission to create employee mapping.' })
      return
    }

    setMappingSelectedEmployeeUid('')
    setMappingEmployee(null)
    setMappingDraft(createMappingDraft(null))
    setMappingModalOpen(true)
  }

  function openMappingModal(employee) {
    if (!canUpdateEmployeeMapping) {
      showStatus({ type: 'error', title: 'Mapping access blocked', message: 'Your role does not have permission to update employee mapping.' })
      return
    }

    setMappingEmployee(employee)
    setMappingSelectedEmployeeUid(String(employee?.uid || ''))
    setMappingDraft(createMappingDraft(employee))
    setMappingModalOpen(true)
  }

  async function handleDeleteMapping(employee) {
    if (!canDeleteEmployeeMapping) {
      showStatus({ type: 'error', title: 'Mapping access blocked', message: 'Your role does not have permission to delete employee mapping.' })
      return
    }

    if (!employee?.uid) {
      showStatus({ type: 'error', title: 'Invalid mapping', message: 'Could not find the selected employee mapping record.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Mapping',
      title: `Remove manager mapping for ${employee.fullName || 'this employee'}?`,
      message: 'This will clear only the manager assignment. Hidden mapping fields are preserved.'
    })
    if (!accepted) return

    try {
      const clearedDraft = {
        ...createMappingDraft(employee),
        managerEmployeeUid: ''
      }
      const optimisticPayload = {
        ...employee,
        managerEmployeeUid: '',
        hrEmployeeUid: clearedDraft.hrEmployeeUid || '',
        teamLeadEmployeeUid: clearedDraft.teamLeadEmployeeUid || '',
        coordinatorEmployeeUid: clearedDraft.coordinatorEmployeeUid || '',
        reportingAssignments: buildMappingAssignmentsPayload(clearedDraft)
      }
      const { request } = updateEmployeeOptimistic(employee.uid, optimisticPayload)

      if (mappingEmployee?.uid && String(mappingEmployee.uid) === String(employee.uid)) {
        closeMappingModal()
      }

      showStatus({
        type: 'success',
        title: 'Mapping removed',
        message: `${employee.fullName || 'The selected employee'} manager mapping was removed from the table. Server sync is running in the background.`
      })

      void request.catch((syncError) => {
        showStatus({
          type: 'error',
          title: 'Mapping removal reverted',
          message: syncError?.response?.data?.detail || syncError?.message || 'The server rejected the mapping removal, so the previous mapping was restored.'
        })
      })
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Mapping removal failed', message: actionError?.response?.data?.detail || actionError?.message || 'The mapping removal request could not be started.' })
    }
  }

  function handleMappingDraftChange(fieldName, value) {
    setMappingDraft((current) => ({
      ...current,
      [fieldName]: value
    }))
  }

  function handleMappingEmployeeChange(nextEmployeeUid) {
    setMappingSelectedEmployeeUid(nextEmployeeUid)
  }

  async function handleSaveMapping() {
    if (!canUpdateEmployeeMapping) {
      showStatus({ type: 'error', title: 'Mapping access blocked', message: 'Your role does not have permission to update employee mapping.' })
      return
    }

    if (!mappingEmployee?.uid) {
      showStatus({ type: 'error', title: 'Missing employee', message: 'Select the employee record to map before saving.' })
      return
    }

    const managerEmployeeUid = String(mappingDraft.managerEmployeeUid || '').trim()
    if (managerEmployeeUid && managerEmployeeUid === String(mappingEmployee.uid)) {
      showStatus({ type: 'error', title: 'Invalid mapping', message: 'An employee cannot be mapped as their own manager.' })
      return
    }

    const selectedManager = managerEmployeeUid ? employeeDirectoryByUid.get(managerEmployeeUid) : null
    if (managerEmployeeUid && !selectedManager) {
      showStatus({ type: 'error', title: 'Invalid manager', message: 'Choose a valid manager from the dropdown.' })
      return
    }

    const nextMappingDraft = {
      managerEmployeeUid,
      hrEmployeeUid: String(mappingDraft.hrEmployeeUid || '').trim(),
      teamLeadEmployeeUid: String(mappingDraft.teamLeadEmployeeUid || '').trim(),
      coordinatorEmployeeUid: String(mappingDraft.coordinatorEmployeeUid || '').trim()
    }

    const nextAssignments = buildMappingAssignmentsPayload(nextMappingDraft)

    try {
      const optimisticPayload = {
        ...mappingEmployee,
        managerEmployeeUid: nextMappingDraft.managerEmployeeUid,
        hrEmployeeUid: nextMappingDraft.hrEmployeeUid,
        teamLeadEmployeeUid: nextMappingDraft.teamLeadEmployeeUid,
        coordinatorEmployeeUid: nextMappingDraft.coordinatorEmployeeUid,
        reportingAssignments: nextAssignments
      }
      const { request } = updateEmployeeOptimistic(mappingEmployee.uid, optimisticPayload)

      showStatus({
        type: 'success',
        title: 'Mapping updated',
        message: `${mappingEmployee.fullName} mapping is updated on the table now. Server sync is running in the background.`
      })
      closeMappingModal()

      void request.catch((syncError) => {
        showStatus({
          type: 'error',
          title: 'Mapping update reverted',
          message: syncError?.response?.data?.detail || syncError?.message || 'The server rejected the mapping update, so the previous mapping was restored.'
        })
      })
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Mapping update failed', message: actionError?.response?.data?.detail || actionError?.message || 'The mapping update request could not be started.' })
    }
  }

  async function refreshProfileSetupRecords() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['employees', 'directory'] }),
      queryClient.invalidateQueries({ queryKey: ['employees', 'lookup-directory'] }),
      queryClient.invalidateQueries({ queryKey: ['employees', 'profile-requests'] })
    ])
  }

  async function handleUnlockUserAccount(requestEntry) {
    if (!canManageEmployeeRequests) {
      showStatus({ type: 'error', title: 'Request access blocked', message: 'Your role does not have permission to unlock employee accounts from this workspace.' })
      return
    }

    if (!requestEntry?.email) {
      showStatus({ type: 'error', title: 'Account unlock failed', message: 'This user does not have a valid email address to unlock.' })
      return
    }

    const requiresBackendUnlock = Boolean(requestEntry?.isBackendLocked)
    if (!requiresBackendUnlock) {
      showStatus({ type: 'error', title: 'User already unlocked', message: `${requestEntry.fullName || requestEntry.email} is already unlocked.` })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Unlock User Account',
      title: `Unlock ${requestEntry.fullName || requestEntry.email}?`,
      message: 'This will unlock the selected account by email.',
      note: 'Manual lock or deactivate is no longer available here. Backend controls the 48-hour auto-lock flow.'
    })
    if (!accepted) return

    try {
      await runWithLoader(
        async () => {
          await authService.unlockUser(requestEntry.email)
          await refreshProfileSetupRecords()
        },
        {
          title: 'Unlocking account',
          message: `Restoring account access for ${requestEntry.fullName || requestEntry.email}.`,
          minVisibleMs: 550
        }
      )

      showStatus({
        type: 'success',
        title: 'Account unlocked',
        message: `${requestEntry.fullName || requestEntry.email} has been unlocked successfully.`
      })
    } catch (error) {
      showStatus({
        type: 'error',
        title: 'Account unlock failed',
        message: error?.response?.data?.detail || error?.message || 'Could not unlock this account.'
      })
    }
  }

  const metadataPanels = useMemo(() => METADATA_SECTIONS.map((section) => {
    if (section.key === 'roles') {
      return { ...section, entries: roles.map((role) => ({ ...role, isActive: true })) }
    }
    const entries = (metadataByCategory[section.key] || []).map((entry) => ({
      ...entry,
      departmentLabel: entry.departmentUid ? (metadataCatalog.departmentLabelByUid.get(String(entry.departmentUid)) || '') : ''
    }))
    return { ...section, entries }
  }).filter((section) => (section.key === 'roles' ? canReadRoles : canReadEmployeeMetadata)), [canReadEmployeeMetadata, canReadRoles, metadataByCategory, metadataCatalog, roles])

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'metadata') return canViewMetadata
      if (tabKey === 'entries') return canViewEntriesTab
      if (tabKey === 'mapping') return canViewMappingTab
      if (tabKey === 'requests') return canViewRequests
      return false
    }, defaultTab)

    if (!nextTab) return
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [activeTab, availableTabs, canViewEntriesTab, canViewMappingTab, canViewMetadata, canViewRequests, defaultTab])

  const shouldShowDirectoryLoader = isLoading && !employeeLookup.length && (activeTab === 'entries' || activeTab === 'mapping')
  if (shouldShowDirectoryLoader) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from a single workspace." />
        <PageContentLoader cards={4} slowDelayMs={5000} showSlowLoader={false} />
      </div>
    )
  }

  if (isError && !isDirectoryAccessBlocked && !employeeLookup.length) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from a single workspace." />
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="fw-semibold mb-2">Employee management could not be loaded.</div>
            <div className="text-muted small mb-3">{error?.response?.data?.detail || error?.message || 'The request could not be completed.'}</div>
            <button type="button" className="btn btn-primary" onClick={() => refetch()}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  if (!availableTabs.length) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from one operational console." />
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="fw-semibold mb-2">No accessible sections for this role.</div>
            <div className="text-muted small">Ask an admin to enable role-matrix permissions for Employee Management tabs.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    // Mapping structure management is temporarily removed to focus on core employee directory features. It will be reintroduced in a future update after further refinement.
    //   <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
    // <PageHeader title="Employee Management" tagline="Administer metadata, employee records, mapping structure, and linked auth signup from one operational console." />
    <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
      <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from one operational console." />

      <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />
      {requestedTab && requestedTab !== activeTab ? (
        <div className="alert alert-info mb-0">
          The requested tab is not available for this role right now, so we moved you to an accessible tab.
        </div>
      ) : null}
      {activeTab === 'metadata' && canViewMetadata ? (
        <>
          <div className="metadata-masonry d-none d-xl-block">
            {metadataPanels.map((section) => (
              <div className="metadata-masonry__item" key={section.key}>
                <MetadataCard
                  title={section.title}
                  description={section.description}
                  entries={section.entries}
                  roleCard={section.key === 'roles'}
                  roleModules={rolePermissionModules}
                  onAdd={canManageMetadataSection(section.key, PERMISSION_ACTIONS.create) ? () => openMetadataModal(section.key) : null}
                  onEdit={canManageMetadataSection(section.key, PERMISSION_ACTIONS.update) ? (entry) => openEditMetadata(section.key, entry) : null}
                  onDelete={canManageMetadataSection(section.key, PERMISSION_ACTIONS.delete) ? (entry) => handleDeleteMetadata(section.key, entry) : null}
                />
              </div>
            ))}
          </div>

          <div className="row g-3 d-xl-none">
            {metadataPanels.map((section) => (
              <div className="col-12" key={section.key}>
                <MetadataCard
                  title={section.title}
                  description={section.description}
                  entries={section.entries}
                  roleCard={section.key === 'roles'}
                  roleModules={rolePermissionModules}
                  onAdd={canManageMetadataSection(section.key, PERMISSION_ACTIONS.create) ? () => openMetadataModal(section.key) : null}
                  onEdit={canManageMetadataSection(section.key, PERMISSION_ACTIONS.update) ? (entry) => openEditMetadata(section.key, entry) : null}
                  onDelete={canManageMetadataSection(section.key, PERMISSION_ACTIONS.delete) ? (entry) => handleDeleteMetadata(section.key, entry) : null}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {activeTab === 'entries' && canViewEntriesTab ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Total Employees" value={employees.length} helper="Registered employee records in directory." tone="blue" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Active / Inactive" value={`${metrics.active} / ${metrics.inactive}`} helper="Current employment status split." tone="orange" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Roles / Departments" value={`${roles.length} / ${departmentValues.length}`} helper="Master data currently available." tone="teal" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Onsite / Remote / Hybrid" value={`${metrics.onsite} / ${metrics.remote} / ${metrics.hybrid}`} helper="Work location split." tone="purple" />
            </div>
          </div>

          <div className="card border-0 shadow-sm glass employee-directory-shell">
            <div className="card-body d-flex flex-column gap-3">
              <div className="employee-toolbar employee-toolbar-top">
                <AppSearchField className="employee-toolbar-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by any table value, including billing status and reporting details" />

                <div className="employee-toolbar-actions">
                  {canCreateEmployees ? (
                    <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-toolbar-btn" onClick={() => { setImportFile(null); setIsImportOpen(true) }}>
                      <ImportIcon />
                      <span>Import</span>
                    </button>
                  ) : null}

                  <div className="dropdown">
                    <button className="btn btn-outline-secondary btn-icon-inline dropdown-toggle employee-toolbar-btn" data-bs-toggle="dropdown" aria-expanded="false" id={exportMenuId}>
                      <ExportIcon />
                      <span>Export</span>
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end" aria-labelledby={exportMenuId}>
                      <li><button type="button" className="dropdown-item" onClick={() => downloadEmployeesAsCsv(sortedEmployees)}>Export CSV</button></li>
                      <li><button type="button" className="dropdown-item" onClick={() => downloadEmployeesAsExcel(sortedEmployees)}>Export Excel</button></li>
                    </ul>
                  </div>

                  {canCreateEmployees ? (
                    <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateEmployee}>
                      <UserPlusIcon />
                      <span>Add Employee</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="employee-toolbar employee-toolbar-filters">
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Status</label>
                  <AppSelect value={statusFilter} onChange={setStatusFilter} options={statusFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Billing Status</label>
                  <AppSelect value={billingStatusFilter} onChange={setBillingStatusFilter} options={billingStatusFilterOptions} placeholder="All billing" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Work Location</label>
                  <AppSelect value={workLocationFilter} onChange={setWorkLocationFilter} options={workLocationFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Department</label>
                  <AppSelect value={departmentFilter} onChange={setDepartmentFilter} options={departmentFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Position</label>
                  <AppSelect value={positionFilter} onChange={setPositionFilter} options={positionFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Role</label>
                  <AppSelect value={roleFilter} onChange={setRoleFilter} options={roleFilterOptions} placeholder="All roles" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Employee Type</label>
                  <AppSelect value={employeeTypeFilter} onChange={setEmployeeTypeFilter} options={employeeTypeFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Gender</label>
                  <AppSelect value={genderFilter} onChange={setGenderFilter} options={genderFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Blood Group</label>
                  <AppSelect value={bloodGroupFilter} onChange={setBloodGroupFilter} options={bloodGroupFilterOptions} placeholder="All" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Manager</label>
                  <AppSelect value={managerFilter} onChange={setManagerFilter} options={managerFilterOptions} placeholder="All managers" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> HR</label>
                  <AppSelect value={hrFilter} onChange={setHrFilter} options={hrFilterOptions} placeholder="All HRs" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Team Lead</label>
                  <AppSelect value={teamLeadFilter} onChange={setTeamLeadFilter} options={teamLeadFilterOptions} placeholder="All team leads" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Coordinator</label>
                  <AppSelect value={coordinatorFilter} onChange={setCoordinatorFilter} options={coordinatorFilterOptions} placeholder="All coordinators" />
                </div>
                <div className="employee-filter-field employee-filter-field-range">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Join Date</label>
                  <AppDateRangeField value={joinDateRange} onChange={setJoinDateRange} className="employee-range-field" placeholder="[Select range]" />
                </div>
                <div className="employee-filter-actions">
                  <button type="button" className="btn btn-outline-secondary btn-sm btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetDirectoryFilters}>
                    <RotateCcwIcon />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {projectAssignmentsQuery.isError ? (
                <div className="alert alert-warning py-2 mb-0">
                  Billing status is currently unavailable because project assignment records could not be loaded.
                </div>
              ) : null}

              <PaginatedTable rows={sortedEmployees}>
                {({ rows: paginatedRows }) => (
                  <table className="table align-middle mb-0 employee-table employee-table-dense">
                    <colgroup>
                      <col className="employee-col-name" />
                      <col className="employee-col-role" />
                      <col className="employee-col-contact" />
                      <col className="employee-col-position" />
                      <col className="employee-col-status" />
                      <col className="employee-col-join" />
                      <col className="employee-col-billing" />
                      <col className="employee-col-actions" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th><SortableHeader label="Employee Name (Code)" sortKey="employee" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap" /></th> 
                        <th className="employee-role-column table-header-center"><SortableHeader label="Role" sortKey="role" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap employee-header-wrap-center" /></th>
                        <th><SortableHeader label="Contact" sortKey="contact" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Position (Dept)" sortKey="positionDepartment" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Status (DOJ)" sortKey="statusJoinDate" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Work Location (Type)" sortKey="locationType" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Billing Status" sortKey="billingStatus" sortConfig={employeeSortConfig} onSort={requestEmployeeSort} className="employee-header-wrap" /></th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? paginatedRows.map((employee) => (
                        <tr key={employee.uid || employee.id}>
                          <td className="employee-cell-wrap">
                            <CellStack title={employee.fullName} subtitle={employee.employeeCode} className="employee-cell-wrap" highlightQuery={deferredSearch} />
                          </td>
                          <td className="employee-cell-wrap employee-role-cell">
                            <CellStack title={<EmployeeBadge value={employee.roleName || 'Unassigned'} type="role" roleBadgeStyleMap={roleBadgeStyleMap} />} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={employee.email || '—'} subtitle={employee.phone || '—'} className="employee-cell-wrap" highlightQuery={deferredSearch} />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={employee.positionLabel || employee.position || '—'} subtitle={employee.departmentLabel || employee.department || '—'} className="employee-cell-wrap" highlightQuery={deferredSearch} />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={<EmployeeBadge value={employee.status || '—'} type="status" />} subtitle={formatDate(employee.joinDate)} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={<EmployeeBadge value={employee.workLocation || '—'} type="workLocation" />} subtitle={<EmployeeBadge value={employee.employeeType || '—'} type="employeeType" />} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack
                              title={<EmployeeBadge value={employee.billingStatus || 'Non Billable'} type="billingStatus" />}
                              subtitle={employee.assignmentStatusSummary || 'No assignment'}
                              className="employee-cell-wrap"
                            />
                          </td>
                          <td className="employee-actions-cell">
                            <div className="employee-action-cluster">
                              <ActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => setPreviewEmployee(employee)} />
                              {canUpdateEmployees ? <ActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditEmployee(employee)} /> : null}
                              {canDeleteEmployees ? <ActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteEmployee(employee)} /> : null}
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="8">
                            <div className="employee-empty-state text-center py-4">
                              <div className="fw-semibold mb-1">No employees matched the current filters.</div>
                              <div className="text-muted small">Reset the search terms or filter criteria to widen the directory view.</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </PaginatedTable>
              {isFetching ? <div className="text-muted small">Refreshing employee management records…</div> : null}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'mapping' && canViewMappingTab ? (
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <div className="fw-semibold">Employee Mapping</div>
                <div className="text-muted small">Only employees with a saved manager assignment are listed here. Use Add Mapping to assign managers from manager-position employees.</div>
              </div>
              <div className="small text-muted">Records: <strong>{mappingRows.length}</strong></div>
            </div>

            <div className="employee-toolbar employee-toolbar-top">
              <AppSearchField
                className="employee-toolbar-search"
                value={mappingSearch}
                onChange={(event) => setMappingSearch(event.target.value)}
                placeholder="Search employee, code, position, or manager"
              />
              <div className="employee-toolbar-actions">
                {canCreateEmployeeMapping ? (
                  <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateMapping}>
                    <PlusIcon />
                    <span>Add Mapping</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="employee-toolbar employee-toolbar-filters">
              <div className="employee-filter-field">
                <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Department</label>
                <AppSelect value={mappingDepartmentFilter} onChange={handleMappingDepartmentFilterChange} options={mappingDepartmentFilterOptions} placeholder="All departments" />
              </div>
              <div className="employee-filter-field">
                <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Position</label>
                <AppSelect
                  value={mappingPositionFilter}
                  onChange={handleMappingPositionFilterChange}
                  options={mappingPositionFilterOptions}
                  placeholder="All positions"
                />
              </div>
              <div className="employee-filter-field">
                <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Employee</label>
                <AppSelect value={mappingEmployeeFilter} onChange={setMappingEmployeeFilter} options={mappingEmployeeFilterOptions} placeholder="All employees" />
              </div>
              <div className="employee-filter-field">
                <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Manager</label>
                <AppSelect
                  value={mappingManagerFilter}
                  onChange={setMappingManagerFilter}
                  options={mappingManagerFilterOptions}
                  placeholder="All managers"
                />
              </div>
              <div className="employee-filter-actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm btn-icon-inline employee-filter-reset-btn employee-toolbar-btn"
                  onClick={resetMappingFilters}
                >
                  <RotateCcwIcon />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <PaginatedTable rows={mappingRows}>
              {({ rows: paginatedRows }) => (
                <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                  <colgroup>
                    <col className="mapping-col-employee" />
                    <col className="mapping-col-role" />
                    <col className="mapping-col-position" />
                    <col className="mapping-col-mapped-positions" />
                    <col className="mapping-col-actions" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Employee (Code)</th>
                      <th className="employee-role-column table-header-center">Role</th>
                      <th>Position (Department)</th>
                      <th>Manager</th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((employee) => (
                      <tr key={employee.uid || employee.id}>
                        <td className="employee-cell-wrap">
                          <CellStack title={employee.fullName || '—'} subtitle={employee.employeeCode || '—'} />
                        </td>
                        <td className="employee-cell-wrap employee-role-cell">
                          <CellStack title={<EmployeeBadge value={employee.roleName || 'Unassigned'} type="role" roleBadgeStyleMap={roleBadgeStyleMap} />} />
                        </td>
                        <td className="employee-cell-wrap">
                          <CellStack title={employee.positionLabel || employee.position || '—'} subtitle={employee.departmentLabel || employee.department || '—'} />
                        </td>
                        <td className="employee-cell-wrap">
                          {(() => {
                            const managerRecord = employeeDirectoryByUid.get(String(employee.managerEmployeeUid || ''))
                            const managerSubtitle = managerRecord
                              ? `${managerRecord.employeeCode || 'No code'} • ${managerRecord.positionLabel || managerRecord.position || 'No position'}`
                              : 'No manager assigned'

                            return (
                              <CellStack
                                title={employee.managerName || 'Unassigned'}
                                subtitle={managerSubtitle}
                              />
                            )
                          })()}
                        </td>
                        <td className="employee-actions-cell">
                          <div className="employee-action-cluster">
                            {canUpdateEmployeeMapping || canDeleteEmployeeMapping ? (
                              <>
                                {canUpdateEmployeeMapping ? <ActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openMappingModal(employee)} /> : null}
                                {canDeleteEmployeeMapping ? <ActionButton icon={<TrashIcon />} label="Delete Mapping" variant="delete" onClick={() => handleDeleteMapping(employee)} /> : null}
                              </>
                            ) : (
                              <div className="text-muted small">Read only</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="5">
                          <div className="employee-empty-state text-center py-4">
                            <div className="fw-semibold mb-1">No manager-mapped employees matched the current filters.</div>
                            <div className="text-muted small">Use Add Mapping or reset the filters to widen the manager mapping list.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
            {isFetching ? <div className="text-muted small">Refreshing employee mapping records…</div> : null}
          </div>
        </div>
      ) : null}

      {activeTab === 'requests' && canViewRequests ? (
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <div className="fw-semibold">Employee Status Controls</div>
                <div className="text-muted small">Live account status for all users. Accounts are auto-locked after 48 hours only if first login was not completed, and admins can unlock by email.</div>
              </div>
              <div className="small text-muted">Records: <strong>{profileRequests.length}</strong></div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-sm-6 col-xl-3">
                <DirectoryMetricCard title="Locked Accounts" value={profileRequestMetrics.locked} helper="Users currently locked by account state." tone="orange" />
              </div>
              <div className="col-12 col-sm-6 col-xl-3">
                <DirectoryMetricCard title="Unlocked Accounts" value={profileRequestMetrics.unlocked} helper="Users currently available to sign in." tone="blue" />
              </div>
              <div className="col-12 col-sm-6 col-xl-3">
                <DirectoryMetricCard title="Pending First Login" value={profileRequestMetrics.pendingFirstLogin} helper="Users who have not completed first sign-in yet." tone="teal" />
              </div>
              <div className="col-12 col-sm-6 col-xl-3">
                <DirectoryMetricCard title="48 Hr Window Crossed" value={profileRequestMetrics.expiredWindow} helper="Accounts that crossed the 48-hour first-login window." tone="purple" />
              </div>
            </div>

            {profileRequestsErrorState ? (
              <div className="alert alert-warning mb-0">
                {profileRequestsError?.response?.data?.detail || profileRequestsError?.message || 'Employee status records could not be loaded right now.'}
              </div>
            ) : null}

            <PaginatedTable rows={sortedProfileRequests}>
              {({ rows: paginatedRows }) => (
                <table className="table align-middle mb-0 employee-table employee-table-dense">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Employee (Code)" sortKey="employee" sortConfig={profileRequestSortConfig} onSort={requestProfileRequestSort} /></th>
                      <th><SortableHeader label="Email (Username)" sortKey="email" sortConfig={profileRequestSortConfig} onSort={requestProfileRequestSort} /></th>
                      <th><SortableHeader label="User Status (Verification)" sortKey="verification" sortConfig={profileRequestSortConfig} onSort={requestProfileRequestSort} /></th>
                      <th><SortableHeader label="Account Status" sortKey="accountStatus" sortConfig={profileRequestSortConfig} onSort={requestProfileRequestSort} /></th>
                      <th><SortableHeader label="Lock Details" sortKey="lockDetails" sortConfig={profileRequestSortConfig} onSort={requestProfileRequestSort} /></th>
                      <th><SortableHeader label="First Login" sortKey="firstLogin" sortConfig={profileRequestSortConfig} onSort={requestProfileRequestSort} /></th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((entry) => {
                      const verificationLabel = entry.isVerified ? 'Verified' : 'Unverified'
                      const accountTimestampLabel = entry.isBackendLocked ? 'Locked At' : 'Unlocked At'
                      const accountTimestampValue = entry.isBackendLocked
                        ? (entry.lockedAt ? formatDate(entry.lockedAt) : '—')
                        : (entry.unlockedAt ? formatDate(entry.unlockedAt) : '—')
                      const actionContent = entry.isBackendLocked
                        ? (canManageEmployeeRequests
                          ? <AccountLockToggle isLocked label="Unlock Account" onClick={() => handleUnlockUserAccount(entry)} />
                          : <AccountStateIndicator label="Read Only" tone="unlocked" />)
                        : <AccountStateIndicator label="Already Unlocked" tone="unlocked" />

                      return (
                        <tr key={entry.rowKey || entry.employeeUid || entry.userUid || entry.email}>
                          <td className="employee-cell-wrap">
                            <CellStack title={entry.fullName || '—'} subtitle={entry.employeeCode || entry.username || entry.email || '—'} />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack
                              title={entry.email || '—'}
                              subtitle={entry.username || '—'}
                            />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack
                              title={(
                                <div className="employee-badge-stack employee-status-badge-stack">
                                  <EmployeeBadge value={entry.status || '—'} type="status" />
                                  <EmployeeBadge value={verificationLabel} type="status" />
                                </div>
                              )}
                            />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack
                              title={<EmployeeBadge value={entry.accountState || (entry.isBackendLocked ? 'Locked' : 'Unlocked')} type="status" />}
                              subtitle={`${accountTimestampLabel}: ${accountTimestampValue}`}
                            />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack
                              title={entry.lockedReason || '—'}
                              subtitle={entry.lockedReason ? 'Account lock reason' : 'No lock reason provided.'}
                              meta={entry.isStatusLocked ? `Linked employee status is ${entry.status || 'Inactive'}.` : null}
                            />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack
                              title={entry.firstLoginAt ? formatDate(entry.firstLoginAt) : <EmployeeBadge value="Pending" type="status" />}
                              subtitle={entry.firstLoginAt ? 'First login completed' : 'No login recorded yet'}
                            />
                          </td>
                          <td className="employee-actions-cell">
                            <div className="employee-profile-setup-actions">
                              {actionContent}
                            </div>
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr>
                        <td colSpan="7">
                          <div className="employee-empty-state text-center py-4">
                            <div className="fw-semibold mb-1">No employee status records found.</div>
                            <div className="text-muted small">Backend lock status and first-login records will appear here.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
            {profileRequestsFetching ? <div className="text-muted small">Refreshing employee status records…</div> : null}
          </div>
        </div>
      ) : null}

      <ModalFrame
        open={isEmployeeFormOpen}
        title={employeeFormMode === 'create' ? 'Add Employee' : 'Edit Employee'}
        onClose={() => {
          setIsEmployeeFormOpen(false)
          setEmployeeFormTouched({})
          setEmployeeFormTab('basic')
          setEmployeeFormProfile(null)
        }}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-light" onClick={() => { setEmployeeDraft(employeeFormMode === 'edit' && selectedEmployee ? buildEmployeeDraft(selectedEmployee) : createEmptyEmployeeDraft()); setEmployeeFormTouched({}) }}>Reset</button>
            <button type="button" className="btn btn-primary" onClick={handleSaveEmployee}>{employeeFormMode === 'create' ? 'Add' : 'Save'}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => {
              setIsEmployeeFormOpen(false)
              setEmployeeFormTouched({})
              setEmployeeFormTab('basic')
              setEmployeeFormProfile(null)
            }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-3">
          {employeeFormMode === 'edit' ? <AttendanceTabs activeTab={employeeFormTab} onChange={setEmployeeFormTab} tabs={employeeFormTabs} /> : null}

          {employeeFormTab === 'basic' ? (
            <form ref={formRef}>
              <EmployeeFormFields
                draft={employeeDraft}
                onChange={handleEmployeeDraftChange}
                onBlur={handleEmployeeFieldBlur}
                formMode={employeeFormMode}
                errors={employeeFormErrors}
                touched={employeeFormTouched}
                roleOptions={roleOptions}
                positionOptions={positionFormOptions}
                departmentOptions={departmentFormOptions}
                statusOptions={statusFormOptions}
                employeeTypeOptions={employeeTypeFormOptions}
                workLocationOptions={workLocationFormOptions}
                phoneCountryOptions={phoneCountryFormOptions}
              />
            </form>
          ) : null}

          {employeeFormMode === 'edit' && employeeFormTab === 'additional' ? (
            employeeFormProfile ? (
              <div className="employee-overview-box">
                <EmployeeAdditionalDetailsEditor employee={selectedEmployee} profile={employeeFormProfile} />
                {employeeFormProfileLoading ? <div className="text-muted small mt-3">Refreshing employee additional details…</div> : null}
              </div>
            ) : employeeFormProfileLoading ? (
              <div className="text-muted small">Loading employee additional details…</div>
            ) : (
              <div className="text-muted small">Additional details are not available for this employee yet.</div>
            )
          ) : null}
        </div>
      </ModalFrame>

      <ModalFrame
        open={isImportOpen}
        title="Import Employees"
        onClose={() => setIsImportOpen(false)}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadEmployeeImportTemplateCsv}><DownloadIcon /><span>CSV Template</span></button>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadEmployeeImportTemplateExcel}><DownloadIcon /><span>Excel Template</span></button>
            <button type="button" className="btn btn-primary" onClick={handleImportSubmit}>Start Import</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-3">
          <div className="employee-import-note">
            <div className="fw-semibold mb-1">Bulk entry template</div>
            <div className="text-muted small">Download the CSV or Excel template, fill one employee per row, use existing metadata values, and upload the completed file here. Linked signup creation still uses the default password Welcome@123.</div>
            <div className="text-muted small mt-2">Validation checks: required fields, unique employee code, role and metadata values must already exist, position must belong to the selected department, phone country codes must be provided when numbers do not include a `+` prefix, date formats are auto-converted (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, and Excel serial dates), and date of birth must keep age between 21 and 65.</div>
          </div>
          <div className="employee-import-upload">
            <label className="form-label">Upload populated template</label>
            <input type="file" className="form-control" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <div className="form-text">Accepted formats: CSV and Excel (.xlsx). The file is validated before records are created.</div>
          </div>
          {importFile ? <div className="employee-import-file-chip"><span className="fw-semibold">Selected file:</span> {importFile.name}</div> : null}
        </div>
      </ModalFrame>

      <ModalFrame
        open={Boolean(previewEmployee)}
        title="Employee Overview"
        onClose={() => {
          setPreviewEmployee(null)
          setPreviewEmployeeProfile(null)
          setPreviewEmployeeTab('basic-info')
        }}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => { setPreviewEmployee(null); setPreviewEmployeeProfile(null); setPreviewEmployeeTab('basic-info') }}>Close</button>
            {previewEmployee && canUpdateEmployees ? <button type="button" className="btn btn-primary btn-icon-inline" onClick={() => { const current = previewEmployee; setPreviewEmployee(null); openEditEmployee(current) }}><PencilIcon /><span>Edit</span></button> : null}
          </>
        )}
      >
        {previewEmployee ? (
          <div className="d-flex flex-column gap-3">
            <AttendanceTabs
              activeTab={previewEmployeeTab}
              onChange={setPreviewEmployeeTab}
              tabs={EMPLOYEE_PREVIEW_TABS}
            />

            <div className="employee-overview-box">
              {previewEmployeeTab === 'basic-info' ? <EmployeePreviewBasicInfoPanel employee={previewEmployee} profile={previewEmployeeProfile} /> : null}
              {previewEmployeeTab === 'basic-details' ? <EmployeePreviewBasicDetailsPanel employee={previewEmployee} /> : null}
              {previewEmployeeTab === 'additional-details' ? (
                previewEmployeeProfile ? (
                  <EmployeeAdditionalDetailsPanel employee={previewEmployee} profile={previewEmployeeProfile} />
                ) : (
                  <div className="text-muted small">{previewEmployeeProfileLoading ? 'Loading additional details…' : 'Additional details are not available for this employee yet.'}</div>
                )
              ) : null}
              {previewEmployeeTab === 'documents-uploaded' ? (
                previewEmployeeProfile ? (
                  <EmployeePreviewDocumentsPanel documents={previewEmployeeProfile.documents || []} />
                ) : (
                  <div className="text-muted small">{previewEmployeeProfileLoading ? 'Loading uploaded documents…' : 'No uploaded documents are available for this employee yet.'}</div>
                )
              ) : null}
              {previewEmployeeProfileLoading ? <div className="text-muted small mt-3">Refreshing employee details…</div> : null}
            </div>
          </div>
        ) : null}
      </ModalFrame>

      <MetadataEntryModal
        open={Boolean(metadataModal?.kind === 'metadata')}
        title={metadataModal?.mode === 'edit' ? 'Edit Metadata Entry' : 'Add Metadata Entry'}
        draft={metadataDraft}
        errors={metadataErrors}
        touched={metadataTouched}
        onChange={handleMetadataDraftChange}
        onBlur={handleMetadataFieldBlur}
        onClose={() => { setMetadataModal(null); setMetadataTouched({}) }}
        onSubmit={handleSaveMetadata}
        departmentOptions={metadataDepartmentOptions}
      />

      <RoleEntryModal
        open={Boolean(metadataModal?.kind === 'role')}
        title={metadataModal?.mode === 'edit' ? 'Edit Role Entry' : 'Add Role Entry'}
        draft={roleDraft}
        errors={roleErrors}
        touched={roleTouched}
        onChange={handleRoleDraftChange}
        onBlur={handleRoleFieldBlur}
        onClose={() => { setMetadataModal(null); setRoleTouched({}) }}
        onSubmit={handleSaveMetadata}
        moduleGroups={roleModuleGroups}
        modulesLoading={roleModulesFetching}
        allModules={rolePermissionModules}
        isSaving={isRoleSaving}
        isSystemAdminRole={isEditingSystemAdminRole}
        backendModulesUnavailable={backendRoleModulesUnavailable}
      />

      <MappingModal
        open={mappingModalOpen}
        employee={mappingEmployee}
        draft={mappingDraft}
        onChange={handleMappingDraftChange}
        onClose={closeMappingModal}
        onSubmit={handleSaveMapping}
        selectedEmployeeUid={mappingSelectedEmployeeUid}
        employeeOptions={mappingModalEmployeeOptions}
        onEmployeeChange={handleMappingEmployeeChange}
        managerOptions={mappingManagerOptions}
        hrOptions={mappingHrOptions}
        teamLeadOptions={mappingTeamLeadOptions}
        coordinatorOptions={mappingCoordinatorOptions}
        hiddenEmployeeOptions={hiddenMappingEmployeeOptions}
        warnings={mappingAssignmentWarnings}
      />
    </div>
  )
}
