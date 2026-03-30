import React, { useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import AppDateRangeField from '../../../components/common/AppDateRangeField.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import EmployeeAdditionalDetailsEditor from '../components/EmployeeAdditionalDetailsEditor.jsx'
import { AttendanceTabs } from '../../attendance/components/AttendanceShared.jsx'
import { useEmployeesQuery } from '../../../hooks/employees/useEmployeesQuery.js'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'
import { useEmployeeDirectoryActions } from '../../../hooks/employees/useEmployeeDirectoryActions.js'
import { useEmployeeMetadataQuery, useRoleDirectoryQuery, useRoleModulesQuery } from '../../../hooks/employees/useEmployeeMetadataQuery.js'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import {
  EMPLOYEE_BLOOD_GROUP_OPTIONS,
  EMPLOYEE_GENDER_OPTIONS,
  EMPLOYEE_DEPARTMENT_OPTIONS,
  EMPLOYEE_POSITION_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYEE_TYPE_OPTIONS,
  EMPLOYEE_WORK_LOCATION_OPTIONS,
  PHONE_COUNTRY_OPTIONS,
  buildEmployeePayload,
  buildPhoneValue,
  downloadEmployeeImportTemplateCsv,
  downloadEmployeeImportTemplateExcel,
  downloadEmployeesAsCsv,
  downloadEmployeesAsExcel,
  formatPhoneLengthRule,
  formatDate,
  formatEmployeeAge,
  getDefaultPhoneCountryOption,
  getEmployeeAge,
  getPhoneCountryLengthRule,
  isIsoDateInput,
  normalizeDateInput,
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
  TrashIcon,
  UserPlusIcon,
  ViewIcon,
  XIcon
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
  hasModuleVisibility,
  isAdminBypassUser,
  resolveAccessibleTab,
  toCanonicalPermissionModuleName
} from '../../../utils/permissions.js'
import { filterCollectionByQuery } from '../../../utils/search.js'

const TAB_ITEMS = [
  { key: 'metadata', label: 'Metadata Entries', helper: 'Backend-driven master data' },
  { key: 'entries', label: 'Employee Entries', helper: 'Directory, create, update, export' },
  // Reserved for future backend module support.
  // { key: 'mapping', label: 'Employee Mapping', helper: 'Reserved for future use' },
  { key: 'requests', label: 'Employee Status', helper: 'Backend lock state and first-login status' }
]

const EMPLOYEE_VIEW_TABS = [
  { key: 'basic', label: 'Basic Details', helper: 'Admin-managed identity and organization details' },
  { key: 'additional', label: 'Additional Details', helper: 'Employee-managed profile details' }
]

const METADATA_SECTIONS = [
  { key: 'roles', title: 'Roles', description: 'Auth roles used for login signup and employee assignment.' },
  { key: 'department', title: 'Department', description: 'Business units used in employee records.' },
  { key: 'position', title: 'Position', description: 'Job positions available for employee records.' },
  { key: 'status', title: 'Status', description: 'Employment lifecycle statuses.' },
  { key: 'work_location', title: 'Work Location', description: 'Onsite, remote, hybrid, and future location modes.' },
  { key: 'employee_type', title: 'Employee Type', description: 'Engagement model such as full time or contract.' },
  // { key: 'gender', title: 'Gender', description: 'Gender values available in employee records.' },
  { key: 'blood_group', title: 'Blood Group', description: 'Blood group values available for employee records.' }
]

const ACCESS_LEVEL_OPTIONS = [
  { key: 'c', label: 'Create', shortLabel: 'C' },
  { key: 'r', label: 'Read', shortLabel: 'R' },
  { key: 'u', label: 'Update', shortLabel: 'U' },
  { key: 'd', label: 'Delete', shortLabel: 'D' }
]

const ROLE_ACCESS_EXPANDED_GROUPS_CACHE_KEY = 'one-gms:role-access-expanded-groups:v1'
const SYSTEM_ADMIN_ROLE_NAME = 'Admin'
const ROLE_MODULE_VISUAL_GROUP_ORDER = ['Administration', 'Employee Management', 'Attendance Management', 'Leave Management', 'Other']
const ROLE_MODULE_VISUAL_CONFIG = [
  {
    title: 'Administration',
    modules: [
      { key: 'Roles', label: 'Roles' }
    ]
  },
  {
    title: 'Employee Management',
    modules: [
      { key: 'Employees Management', label: 'Employees Management' },
      { key: 'Profile Update', label: 'Profile Update' },
      { key: 'Employee Documents', label: 'Employee Documents' },
      { key: 'Employee Metadata', label: 'Employee Metadata' },
      { key: 'Employee Skills', label: 'Employee Skills' },
      { key: 'Employee Work Experience', label: 'Employee Work Experience' },
      { key: 'My Work Experience', label: 'My Work Experience' },
      { key: 'My Family Details', label: 'My Family Details' },
      { key: "Employee's Family Details", label: "Employee's Family Details" }
    ]
  },
  {
    title: 'Attendance Management',
    modules: [
      { key: 'Attendance Overview', label: 'Attendance Overview' },
      { key: 'My Attendance Preview', label: 'My Attendance Preview' },
      { key: 'Manage Regularization', label: 'Manage Regularization' },
      { key: 'Assign Shift', label: 'Assign Shift' },
      { key: 'My Shift', label: 'My Shift' },
      { key: 'Shift Roster', label: 'Shift Roster' }
    ]
  },
  {
    title: 'Leave Management',
    modules: [
      { key: 'Assign Leave', label: 'Assign Leave' },
      { key: 'My Leave Balance', label: 'My Leave Balance' },
      { key: 'Holiday Calendar', label: 'Holiday Calendar' },
      { key: 'Leave Request', label: 'Leave Request' },
      { key: 'Manage Leave', label: 'Manage Leave' },
      { key: 'Leave Type', label: 'Leave Type' }
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

function toCanonicalRoleModuleName(moduleName) {
  return toCanonicalPermissionModuleName(moduleName)
}

function getRoleModuleDisplayName(moduleName) {
  const canonicalModuleName = toCanonicalRoleModuleName(moduleName)
  if (!canonicalModuleName) return ''
  return ROLE_MODULE_VISUAL_META.displayNameByKey[canonicalModuleName] || canonicalModuleName
}

function getRoleModuleSortOrder(moduleName) {
  const canonicalModuleName = toCanonicalRoleModuleName(moduleName)
  if (!canonicalModuleName) return Number.MAX_SAFE_INTEGER
  return ROLE_MODULE_VISUAL_META.sortOrderByKey[canonicalModuleName] ?? Number.MAX_SAFE_INTEGER
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

function dedupeRoleModules(modules = []) {
  return dedupePermissionModules(modules)
}

function getRoleModuleGroupName(moduleName) {
  const canonicalModuleName = toCanonicalRoleModuleName(moduleName)
  if (!canonicalModuleName) return 'Other'

  const configuredGroup = ROLE_MODULE_VISUAL_META.groupNameByKey[canonicalModuleName]
  if (configuredGroup) return configuredGroup

  if (canonicalModuleName === 'Roles') return 'Administration'
  if (['Employee Metadata', 'Employees Management', 'Profile Update', 'Employee Documents', 'Employee Skills', "Employee's Family Details", 'My Family Details', 'Employee Work Experience', 'My Work Experience'].includes(canonicalModuleName)) return 'Employee Management'
  if (['Attendance Overview', 'My Attendance Preview', 'Manage Regularization', 'Shift Roster', 'Assign Shift', 'My Shift'].includes(canonicalModuleName)) return 'Attendance Management'
  if (['Holiday Calendar', 'Assign Leave', 'My Leave Balance', 'Leave Request', 'Manage Leave', 'Leave Type'].includes(canonicalModuleName)) return 'Leave Management'
  return 'Other'
}

function buildRoleModuleGroups(modules = []) {
  const groupedModules = dedupeRoleModules(modules).reduce((accumulator, moduleName) => {
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
    value: getRequiredFieldMessage(draft.value, 'Value')
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

function createEmptyEmployeeDraft() {
  const defaultPhoneCountry = getDefaultPhoneCountryOption()
  return {
    employeeCode: '',
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    roleType: '',
    email: '',
    phoneCountryCode: defaultPhoneCountry.dialCode,
    phoneLocal: '',
    joinDate: '',
    status: '',
    dateOfBirth: '',
    gender: '',
    caste: '',
    address: '',
    emergencyContactCountryCode: defaultPhoneCountry.dialCode,
    emergencyContactLocal: '',
    bloodGroup: '',
    employeeType: '',
    workLocation: ''
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
    position: employee.position || '',
    department: employee.department || '',
    roleType: employee.roleType || '',
    email: employee.email || '',
    phoneCountryCode: phone.countryDialCode || fallback.phoneCountryCode,
    phoneLocal: phone.localNumber || '',
    joinDate: employee.joinDate || '',
    status: employee.status || '',
    dateOfBirth: employee.dateOfBirth || '',
    gender: employee.gender || '',
    caste: employee.caste || '',
    address: employee.address || '',
    emergencyContactCountryCode: emergencyContact.countryDialCode || fallback.emergencyContactCountryCode,
    emergencyContactLocal: emergencyContact.localNumber || '',
    bloodGroup: employee.bloodGroup || '',
    employeeType: employee.employeeType || '',
    workLocation: employee.workLocation || ''
  }
}

function createMappingDraft(employee) {
  return {
    managerEmployeeUid: employee?.managerEmployeeUid || '',
    hrEmployeeUid: employee?.hrEmployeeUid || '',
    teamLeadEmployeeUid: employee?.teamLeadEmployeeUid || '',
    coordinatorEmployeeUid: employee?.coordinatorEmployeeUid || ''
  }
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

function buildImportPayloads(rows = [], employees = [], roleDirectory = new Map()) {
  const existingCodes = new Set(employees.map((employee) => String(employee.employeeCode || employee.id || '').trim().toUpperCase()).filter(Boolean))
  const pendingCodes = new Set()
  const payloads = []
  const errors = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const employeeCode = pickCsvValue(row, ['Employee Code']).trim().toUpperCase()
    const firstName = pickCsvValue(row, ['First Name']).trim()
    const lastName = pickCsvValue(row, ['Last Name']).trim()
    const email = pickCsvValue(row, ['Email']).trim()
    const phone = pickCsvValue(row, ['Phone']).trim()
    const roleInput = pickCsvValue(row, ['Role']).trim()
    const position = pickCsvValue(row, ['Position']).trim()
    const department = pickCsvValue(row, ['Department']).trim()
    const status = pickCsvValue(row, ['Status']).trim() || 'Active'
    const workLocation = pickCsvValue(row, ['Work Location']).trim()
    const joinDateInput = pickCsvValue(row, ['Join Date']).trim()
    const dateOfBirthInput = pickCsvValue(row, ['Date Of Birth']).trim()
    const joinDate = normalizeDateInput(joinDateInput)
    const dateOfBirth = normalizeDateInput(dateOfBirthInput)
    const employeeType = pickCsvValue(row, ['Employee Type']).trim()
    const gender = pickCsvValue(row, ['Gender']).trim()
    const caste = pickCsvValue(row, ['Caste']).trim()
    const emergencyContact = pickCsvValue(row, ['Emergency Contact']).trim()
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

    if (existingCodes.has(employeeCode) || pendingCodes.has(employeeCode)) {
      errors.push(`Row ${rowNumber}: employee code ${employeeCode} already exists.`)
      return
    }

    if (dateOfBirth && !isDateOfBirthWithinAllowedRange(dateOfBirth)) {
      errors.push(`Row ${rowNumber}: date of birth keeps age outside the 21-65 range.`)
      return
    }

    const roleMatch = [...roleDirectory.entries()].find(([, roleName]) => String(roleName).toLowerCase() === roleInput.toLowerCase())
    if (!roleMatch) {
      errors.push(`Row ${rowNumber}: role ${roleInput} was not found in metadata entries.`)
      return
    }

    const phoneParts = parseStoredPhoneValue(phone)
    const emergencyParts = parseStoredPhoneValue(emergencyContact)
    const preparedPhone = buildPhoneValue(phoneParts.countryDialCode, phoneParts.localNumber)
    const preparedEmergency = buildPhoneValue(emergencyParts.countryDialCode, emergencyParts.localNumber)

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
      roleType: roleMatch[0],
      roleName: roleMatch[1],
      position,
      department,
      status,
      workLocation,
      joinDate,
      dateOfBirth,
      employeeType,
      gender,
      caste,
      bloodGroup,
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

function EmployeeBadge({ value, type = 'status' }) {
  const safeValue = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return <span className={`employee-badge ${type} ${safeValue}`}>{value || '—'}</span>
}

function CellStack({ title, subtitle, meta = null, className = '' }) {
  return (
    <div className={`employee-cell-stack ${className}`.trim()}>
      <div className="employee-cell-primary">{title || '—'}</div>
      {subtitle ? <div className="employee-cell-secondary">{subtitle}</div> : null}
      {meta ? <div className="employee-cell-meta">{meta}</div> : null}
    </div>
  )
}

function ActionButton({ icon, label, variant = 'view', onClick, disabled = false }) {
  return (
    <button
      type="button"
      className={`employee-action-btn employee-action-btn-${variant}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {icon}
      <span>{label}</span>
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
  bloodGroupOptions,
  genderOptions,
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
        <label className="form-label">Email*</label>
        <input className={`form-control${showError('email') ? ' is-invalid' : ''}`} type="email" name="email" value={draft.email} onChange={onChange} onBlur={onBlur} required />
        {showError('email') ? <div className="invalid-feedback d-block">{errors.email}</div> : null}
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
        <label className="form-label">Role*</label>
        <AppSelect name="roleType" value={draft.roleType} onChange={onChange} onBlur={onBlur} options={roleOptions} placeholder="Select role" invalid={Boolean(showError('roleType'))} />
        {showError('roleType') ? <div className="invalid-feedback d-block">{errors.roleType}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Position*</label>
        <AppSelect name="position" value={draft.position} onChange={onChange} onBlur={onBlur} options={positionOptions} placeholder="Select position" invalid={Boolean(showError('position'))} />
        {showError('position') ? <div className="invalid-feedback d-block">{errors.position}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Department*</label>
        <AppSelect name="department" value={draft.department} onChange={onChange} onBlur={onBlur} options={departmentOptions} placeholder="Select department" invalid={Boolean(showError('department'))} />
        {showError('department') ? <div className="invalid-feedback d-block">{errors.department}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Mobile Number*</label>
        <div className="phone-input-shell">
          <AppSelect name="phoneCountryCode" value={draft.phoneCountryCode} onChange={onChange} onBlur={onBlur} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" />
          <input className={`form-control${showError('phoneLocal') ? ' is-invalid' : ''}`} name="phoneLocal" value={draft.phoneLocal} onChange={onChange} onBlur={onBlur} inputMode="numeric" placeholder="Enter mobile number" minLength={mobileRule.minLength} maxLength={mobileRule.maxLength} pattern={`[0-9]{${mobileRule.minLength},${mobileRule.maxLength}}`} required />
        </div>
        <div className="form-text">Expected local length for {mobileRule.label} ({mobileRule.dialCode}): {formatPhoneLengthRule(mobileRule)}.</div>
        {showError('phoneLocal') ? <div className="invalid-feedback d-block">{errors.phoneLocal}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Join Date*</label>
        <input className={`form-control${showError('joinDate') ? ' is-invalid' : ''}`} type="date" name="joinDate" value={draft.joinDate} onChange={onChange} onBlur={onBlur} required />
        {showError('joinDate') ? <div className="invalid-feedback d-block">{errors.joinDate}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Status*</label>
        <AppSelect name="status" value={draft.status} onChange={onChange} onBlur={onBlur} options={statusOptions} placeholder="Select status" invalid={Boolean(showError('status'))} />
        {showError('status') ? <div className="invalid-feedback d-block">{errors.status}</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Date of Birth</label>
        <input className={`form-control${showError('dateOfBirth') ? ' is-invalid' : ''}`} type="date" name="dateOfBirth" value={draft.dateOfBirth} onChange={onChange} onBlur={onBlur} min={dobBounds.min} max={dobBounds.max} />
        <div className="form-text">Allowed age band: 21 to 65 years.</div>
        {showError('dateOfBirth') ? <div className="invalid-feedback d-block">{errors.dateOfBirth}</div> : null}
      </div>

      <div className="col-12 col-md-3">
        <label className="form-label">Age</label>
        <input className="form-control" value={ageLabel} disabled placeholder="Calculated from date of birth" />
      </div>

      <div className="col-12 col-md-3">
        <label className="form-label">Tenure in Organization</label>
        <input className="form-control" value={tenureLabel} disabled placeholder="Calculated from join date" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Gender</label>
        <AppSelect name="gender" value={draft.gender} onChange={onChange} onBlur={onBlur} options={genderOptions} placeholder="Select gender" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Caste</label>
        <input className="form-control" name="caste" value={draft.caste} onChange={onChange} onBlur={onBlur} maxLength="120" placeholder="Enter caste manually" />
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
        <label className="form-label">Blood Group</label>
        <AppSelect name="bloodGroup" value={draft.bloodGroup} onChange={onChange} onBlur={onBlur} options={bloodGroupOptions} placeholder="Select blood group" />
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
  const documents = profile?.documents || []

  return (
    <div className="d-flex flex-column gap-3">
      <div className="row g-2">
        <div className="col-12 col-md-6"><strong>Nickname:</strong> {profile?.nickname || '—'}</div>
        <div className="col-12 col-md-6"><strong>Gender:</strong> {employee?.gender || '—'}</div>
        <div className="col-12 col-md-6"><strong>Caste:</strong> {employee?.caste || '—'}</div>
        <div className="col-12 col-md-6"><strong>Date of Birth:</strong> {formatDate(employee?.dateOfBirth)}</div>
        <div className="col-12 col-md-6"><strong>Age:</strong> {formatEmployeeAge(employee?.dateOfBirth)}</div>
        <div className="col-12 col-md-6"><strong>Blood Group:</strong> {employee?.bloodGroup || '—'}</div>
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

      <div className="profile-form-divider" />

      <div className="d-flex flex-column gap-2">
        <div className="fw-semibold">Documents</div>
        {documents.length ? documents.map((document) => (
          <a key={document.uid} href={document.fileUrl || '#'} target="_blank" rel="noreferrer" download={document.name || 'employee-document'} className="profile-doc-item">
            <span className="profile-doc-item-title">{document.name || 'Document'}</span>
            <span className="text-muted small">
              {document.documentType || 'OTHER'} • {document.uploadDateLabel || '—'}
            </span>
          </a>
        )) : <div className="text-muted small">No documents uploaded for this employee.</div>}
      </div>
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
        : (entry.value || ''),
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
                  <th><SortableHeader label={roleCard ? 'Access Summary' : 'Value'} sortKey="value" sortConfig={metadataSortConfig} onSort={requestMetadataSort} /></th>
                  <th><SortableHeader label="Description" sortKey="description" sortConfig={metadataSortConfig} onSort={requestMetadataSort} /></th>
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
                          subtitle={roleCard ? `${accessMeta.moduleCount} module${accessMeta.moduleCount === 1 ? '' : 's'} configured • ${accessMeta.permissionCount} permission${accessMeta.permissionCount === 1 ? '' : 's'}` : null}
                        />
                      </td>
                      <td className="employee-cell-wrap">
                        {roleCard ? (
                          <div className="metadata-role-summary">
                            <div className="fw-semibold small">{getRoleAccessSummary(effectiveAccess)}</div>
                            {isSystemAdminRoleName(entry.roleName) ? <div className="metadata-role-flag">Backend-managed full access</div> : null}
                          </div>
                        ) : (entry.value || '—')}
                      </td>
                      <td className="employee-cell-wrap">{entry.description || '—'}</td>
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
                    <td colSpan="5">
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

function MetadataEntryModal({ open, title, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit }) {
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
        <div className="col-12 col-md-6">
          <label className="form-label">Label*</label>
          <input className={`form-control${touched.label && errors.label ? ' is-invalid' : ''}`} name="label" value={draft.label} onChange={onChange} onBlur={onBlur} maxLength="120" />
          {touched.label && errors.label ? <div className="invalid-feedback d-block">{errors.label}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Value*</label>
          <input className={`form-control${touched.value && errors.value ? ' is-invalid' : ''}`} name="value" value={draft.value} onChange={onChange} onBlur={onBlur} maxLength="120" />
          <div className="form-text">Use backend-safe values like FullTime, Remote, Active, or Engineering.</div>
          {touched.value && errors.value ? <div className="invalid-feedback d-block">{errors.value}</div> : null}
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows="3" name="description" value={draft.description} onChange={onChange} onBlur={onBlur} />
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
    const currentLevels = currentAccess[moduleName] || []
    const nextLevels = currentLevels.includes(accessLevel)
      ? currentLevels.filter((level) => level !== accessLevel)
      : ACCESS_LEVEL_OPTIONS.map((option) => option.key).filter((level) => currentLevels.includes(level) || level === accessLevel)

    const nextAccess = { ...currentAccess }
    if (nextLevels.length) nextAccess[moduleName] = nextLevels
    else delete nextAccess[moduleName]

    updateRoleField('access', nextAccess)
  }

  function handleGroupPermissionToggle(groupModules, accessLevel) {
    if (isSystemAdminRole) return
    shouldNormalizeScrollRef.current = true
    const currentAccess = normalizeRoleAccess(draft.access)
    const shouldClear = groupModules.every((moduleName) => (currentAccess[moduleName] || []).includes(accessLevel))
    const nextAccess = { ...currentAccess }

    groupModules.forEach((moduleName) => {
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
      size="lg"
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
            <div className="text-muted small">Expand a main module, select the required access on its sub-modules or tabs, and the frontend will save only the short codes <strong>C</strong>, <strong>R</strong>, <strong>U</strong>, and <strong>D</strong> to the backend.</div>
            {isSystemAdminRole ? (
              <div className="role-access-state-banner">This system role is backend-managed. Full access is shown for reference, and editing is locked here.</div>
            ) : null}
            {backendModulesUnavailable ? (
              <div className="role-access-state-banner">
                Backend role modules are currently unavailable. Role access cannot be saved until the running backend returns a valid module list.
              </div>
            ) : null}
          </div>
        </div>
        <div className="col-12">
          {modulesLoading ? (
            <div className="role-access-loading text-muted small">Loading module permissions from the backend…</div>
          ) : moduleGroups.length ? (
            <div className="role-access-accordion d-flex flex-column gap-3">
              {moduleGroups.map((group) => {
                const isExpanded = expandedGroups.includes(group.key)
                const configuredCount = group.modules.filter((moduleName) => (selectedAccessMap[moduleName] || []).length).length
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
                            const selectedCount = group.modules.filter((moduleName) => (selectedAccessMap[moduleName] || []).includes(option.key)).length
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
                          const selectedAccess = selectedAccessMap[moduleName] || []
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
            <div className="text-muted small">No backend modules are available for permission mapping yet.</div>
          )}
        </div>
      </div>
    </ModalFrame>
  )
}

function MappingModal({ open, employee, draft, onChange, onClose, onSubmit, options }) {
  return (
    <ModalFrame
      open={open}
      title={employee ? `Map Reporting Structure • ${employee.fullName}` : 'Map Reporting Structure'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>Save Mapping</button>
        </>
      )}
    >
      {employee ? (
        <div className="row g-3">
          <div className="col-12">
            <div className="attendance-note-card">
              <div className="fw-semibold">{employee.fullName}</div>
              <div className="small text-muted">{employee.employeeCode} • {employee.roleName || 'No role assigned'}</div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Manager</label>
            <AppSelect name="managerEmployeeUid" value={draft.managerEmployeeUid} onChange={onChange} options={options.manager} placeholder="Select manager" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">HR</label>
            <AppSelect name="hrEmployeeUid" value={draft.hrEmployeeUid} onChange={onChange} options={options.hr} placeholder="Select HR" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Team Lead</label>
            <AppSelect name="teamLeadEmployeeUid" value={draft.teamLeadEmployeeUid} onChange={onChange} options={options.teamLead} placeholder="Select team lead" />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Coordinator</label>
            <AppSelect name="coordinatorEmployeeUid" value={draft.coordinatorEmployeeUid} onChange={onChange} options={options.coordinator} placeholder="Select coordinator" />
          </div>
        </div>
      ) : null}
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
  const isAdminUser = isAdminBypassUser(user)
  const canViewMetadata = hasModuleVisibility(user, [...PERMISSION_MODULES.roles, ...PERMISSION_MODULES.employeeMetadata])
  const canViewEntries = hasModuleVisibility(user, PERMISSION_MODULES.employeeDirectory)
  const canViewRequests = isAdminUser
  const canCreateEmployees = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.create)
  const canUpdateEmployees = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.update)
  const canDeleteEmployees = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.delete)
  const canManageEmployeeRequests = isAdminUser
  const canReadRoles = hasModulePermission(user, PERMISSION_MODULES.roles, PERMISSION_ACTIONS.read)
  const canReadEmployeeMetadata = hasModulePermission(user, PERMISSION_MODULES.employeeMetadata, PERMISSION_ACTIONS.read)
  const defaultTab = canViewEntries ? 'entries' : (canViewMetadata ? 'metadata' : 'requests')
  const { data: employeesData = [], isLoading, isError, error, refetch, isFetching } = useEmployeesQuery(canViewEntries)
  const { data: employeeLookup = [] } = useEmployeeLookupQuery(canViewEntries || canViewRequests)
  const { data: metadataEntries = [] } = useEmployeeMetadataQuery(canViewMetadata || canViewEntries)
  const { data: roles = [] } = useRoleDirectoryQuery(canViewMetadata || canViewEntries)
  const { data: roleModules = [], isFetching: roleModulesFetching } = useRoleModulesQuery(canViewMetadata)
  const { addEmployee, bulkAddEmployees, updateEmployee, deleteEmployee } = useEmployeeDirectoryActions()
  const {
    data: profileRequests = [],
    isFetching: profileRequestsFetching,
    isError: profileRequestsErrorState,
    error: profileRequestsError
  } = useQuery({
    queryKey: ['employees', 'profile-requests'],
    queryFn: employeeService.getProfileRequests,
    enabled: canViewRequests,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
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
  const [joinDateRange, setJoinDateRange] = useState({ start: '', end: '' })
  const [mappingSearch, setMappingSearch] = useState('')

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
  const [previewEmployeeTab, setPreviewEmployeeTab] = useState('basic')

  const [metadataModal, setMetadataModal] = useState(null)
  const [metadataDraft, setMetadataDraft] = useState({ category: '', value: '', label: '', description: '', isActive: true, sortOrder: 0 })
  const [metadataTouched, setMetadataTouched] = useState({})
  const [roleDraft, setRoleDraft] = useState(() => createEmptyRoleDraft())
  const [roleTouched, setRoleTouched] = useState({})
  const [isRoleSaving, setIsRoleSaving] = useState(false)

  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [mappingEmployee, setMappingEmployee] = useState(null)
  const [mappingDraft, setMappingDraft] = useState(createMappingDraft(null))

  const canManageMetadataSection = (category, action) => {
    if (category === 'roles') {
      if (action === PERMISSION_ACTIONS.read) return canReadRoles
      return isAdminUser && hasModulePermission(user, PERMISSION_MODULES.roles, action)
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

  const backendRoleModulesUnavailable = canViewMetadata && !roleModulesFetching && Array.isArray(roleModules) && roleModules.length === 0
  const rolePermissionModules = useMemo(() => dedupeRoleModules([
    ...roleModules,
    ...roles.flatMap((role) => Object.keys(normalizeRoleAccess(role.access)))
  ]), [roleModules, roles])
  const roleModuleGroups = useMemo(() => buildRoleModuleGroups(rolePermissionModules), [rolePermissionModules])
  const availableTabs = useMemo(() => filterAccessibleTabs(TAB_ITEMS, (tabKey) => {
    if (tabKey === 'metadata') return canViewMetadata
    if (tabKey === 'entries') return canViewEntries
    if (tabKey === 'requests') return canViewRequests
    return false
  }), [canViewEntries, canViewMetadata, canViewRequests])
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

  const roleDirectory = useMemo(() => new Map(roles.map((role) => [String(role.uid), role.roleName])), [roles])
  const employeeNameDirectory = useMemo(() => new Map(employeeLookup.map((employee) => [String(employee.uid), employee.fullName])), [employeeLookup])

  const employees = useMemo(() => employeesData.map((employee) => ({
    ...employee,
    roleName: roleDirectory.get(String(employee.roleType || '')) || employee.roleName || '',
    managerName: employeeNameDirectory.get(String(employee.managerEmployeeUid || '')) || '',
    hrEmployeeName: employeeNameDirectory.get(String(employee.hrEmployeeUid || '')) || '',
    teamLeadName: employeeNameDirectory.get(String(employee.teamLeadEmployeeUid || '')) || '',
    coordinatorName: employeeNameDirectory.get(String(employee.coordinatorEmployeeUid || '')) || ''
  })), [employeesData, roleDirectory, employeeNameDirectory])
  const employeeDirectoryByUid = useMemo(() => new Map(employees.map((employee) => [String(employee.uid), employee])), [employees])

  const positionValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_POSITION_OPTIONS,
    [...(metadataByCategory.position || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.position)]
  ), [employees, metadataByCategory.position])

  const departmentValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_DEPARTMENT_OPTIONS,
    [...(metadataByCategory.department || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.department)]
  ), [employees, metadataByCategory.department])

  const statusValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_STATUS_OPTIONS,
    [...(metadataByCategory.status || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.status)]
  ), [employees, metadataByCategory.status])

  const workLocationValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_WORK_LOCATION_OPTIONS,
    [...(metadataByCategory.work_location || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.workLocation)]
  ), [employees, metadataByCategory.work_location])

  const employeeTypeValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_TYPE_OPTIONS,
    [...(metadataByCategory.employee_type || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.employeeType)]
  ), [employees, metadataByCategory.employee_type])

  const bloodGroupValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_BLOOD_GROUP_OPTIONS,
    [...(metadataByCategory.blood_group || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.bloodGroup)]
  ), [employees, metadataByCategory.blood_group])

  const genderValues = useMemo(() => mergeOptionValues(
    EMPLOYEE_GENDER_OPTIONS,
    [...(metadataByCategory.gender || []).filter((entry) => entry.isActive).map((entry) => entry.value), ...employees.map((employee) => employee.gender)]
  ), [employees, metadataByCategory.gender])

  const roleOptions = useMemo(() => roles.map((role) => ({ value: role.uid, label: role.roleName, description: role.description || 'Auth role' })), [roles])
  const roleFilterOptions = useMemo(() => buildSelectOptions(roles.map((role) => ({ value: role.uid, label: role.roleName, description: role.description || 'Role filter' })), 'All roles'), [roles])
  const positionFilterOptions = useMemo(() => buildSelectOptions(positionValues), [positionValues])
  const departmentFilterOptions = useMemo(() => buildSelectOptions(departmentValues), [departmentValues])
  const statusFilterOptions = useMemo(() => buildSelectOptions(statusValues), [statusValues])
  const workLocationFilterOptions = useMemo(() => buildSelectOptions(workLocationValues), [workLocationValues])
  const employeeTypeFilterOptions = useMemo(() => buildSelectOptions(employeeTypeValues), [employeeTypeValues])

  const positionFormOptions = useMemo(() => positionValues.map((value) => ({ value, label: value })), [positionValues])
  const departmentFormOptions = useMemo(() => departmentValues.map((value) => ({ value, label: value })), [departmentValues])
  const statusFormOptions = useMemo(() => statusValues.map((value) => ({ value, label: value })), [statusValues])
  const workLocationFormOptions = useMemo(() => workLocationValues.map((value) => ({ value, label: value })), [workLocationValues])
  const employeeTypeFormOptions = useMemo(() => employeeTypeValues.map((value) => ({ value, label: value })), [employeeTypeValues])
  const bloodGroupFormOptions = useMemo(() => bloodGroupValues.map((value) => ({ value, label: value })), [bloodGroupValues])
  const genderFormOptions = useMemo(() => genderValues.map((value) => ({ value, label: value })), [genderValues])
  const phoneCountryFormOptions = useMemo(() => PHONE_COUNTRY_OPTIONS.map((option) => ({
    value: option.dialCode,
    label: option.dialCode,
    description: `${option.label} - ${formatPhoneLengthRule(option.dialCode)}`
  })), [])
  const employeeFormTabs = useMemo(
    () => employeeFormMode === 'edit'
      ? EMPLOYEE_VIEW_TABS
      : EMPLOYEE_VIEW_TABS.filter((tab) => tab.key === 'basic'),
    [employeeFormMode]
  )
  const deferredSearch = useDeferredValue(search)
  const deferredMappingSearch = useDeferredValue(mappingSearch)

  const filteredEmployees = useMemo(() => filterCollectionByQuery(employees, deferredSearch, [
    'employeeCode',
    'fullName',
    'roleName',
    'position',
    'department',
    'email',
    'phone',
    'emergencyContact'
  ]).filter((employee) => {
    const matchesSearch = true

    const matchesStatus = statusFilter === 'All' || employee.status === statusFilter
    const matchesWorkLocation = workLocationFilter === 'All' || employee.workLocation === workLocationFilter
    const matchesDepartment = departmentFilter === 'All' || employee.department === departmentFilter
    const matchesPosition = positionFilter === 'All' || employee.position === positionFilter
    const matchesRole = roleFilter === 'All' || String(employee.roleType || '') === String(roleFilter)
    const matchesEmployeeType = employeeTypeFilter === 'All' || employee.employeeType === employeeTypeFilter
    const matchesJoinDate = isJoinDateInRange(employee.joinDate, joinDateRange)

    return matchesSearch && matchesStatus && matchesWorkLocation && matchesDepartment && matchesPosition && matchesRole && matchesEmployeeType && matchesJoinDate
  }), [deferredSearch, departmentFilter, employeeTypeFilter, employees, joinDateRange, positionFilter, roleFilter, statusFilter, workLocationFilter])

  const { items: sortedEmployees, sortConfig: employeeSortConfig, requestSort: requestEmployeeSort } = useSortableData(filteredEmployees, {
    initialKey: 'employee',
    initialDirection: 'asc',
    accessors: {
      employee: (employee) => `${employee.fullName || ''} ${employee.employeeCode || ''}`.trim(),
      role: (employee) => employee.roleName || '',
      contact: (employee) => `${employee.email || ''} ${employee.phone || ''}`.trim(),
      positionDepartment: (employee) => `${employee.position || ''} ${employee.department || ''}`.trim(),
      statusJoinDate: (employee) => `${employee.status || ''} ${employee.joinDate || ''}`.trim(),
      locationType: (employee) => `${employee.workLocation || ''} ${employee.employeeType || ''}`.trim()
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

  const mappingRows = useMemo(() => filterCollectionByQuery(employees, deferredMappingSearch, [
    'employeeCode',
    'fullName',
    'roleName',
    'managerName',
    'hrEmployeeName',
    'teamLeadName',
    'coordinatorName'
  ]), [deferredMappingSearch, employees])

  const metrics = useMemo(() => {
    const active = employees.filter((employee) => employee.status === 'Active').length
    const inactive = employees.filter((employee) => employee.status === 'Inactive').length
    const onsite = employees.filter((employee) => employee.workLocation === 'Onsite').length
    const remote = employees.filter((employee) => employee.workLocation === 'Remote').length
    const hybrid = employees.filter((employee) => employee.workLocation === 'Hybrid').length
    const mapped = employees.filter((employee) => employee.managerEmployeeUid || employee.hrEmployeeUid || employee.teamLeadEmployeeUid || employee.coordinatorEmployeeUid).length
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

  const employeeMappingOptions = useMemo(() => {
    const base = [
      { value: '', label: 'Unassigned', description: 'Remove current mapping' },
      ...employees.map((employee) => ({ value: employee.uid, label: employee.fullName, description: `${employee.employeeCode} • ${employee.roleName || 'No role'}` }))
    ]
    return {
      manager: base,
      hr: base,
      teamLead: base,
      coordinator: base
    }
  }, [employees])

  useEffect(() => {
    let isMounted = true

    async function loadPreviewProfile() {
      if (!previewEmployee?.uid) {
        setPreviewEmployeeProfile(null)
        setPreviewEmployeeProfileLoading(false)
        setPreviewEmployeeTab('basic')
        return
      }

      setPreviewEmployeeTab('basic')
      setPreviewEmployeeProfileLoading(true)
      try {
        const profile = await employeeService.getEmployeeProfile(previewEmployee.uid)
        if (!isMounted) return
        setPreviewEmployeeProfile(profile)
      } catch (error) {
        if (!isMounted) return
        setPreviewEmployeeProfile(null)
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
  }, [previewEmployee, showStatus])

  useEffect(() => {
    let isMounted = true

    async function loadEmployeeFormProfile() {
      if (!isEmployeeFormOpen || employeeFormMode !== 'edit' || !selectedEmployee?.uid) {
        setEmployeeFormProfile(null)
        setEmployeeFormProfileLoading(false)
        setEmployeeFormTab('basic')
        return
      }

      setEmployeeFormTab('basic')
      setEmployeeFormProfileLoading(true)
      try {
        const profile = await employeeService.getEmployeeProfile(selectedEmployee.uid)
        if (!isMounted) return
        setEmployeeFormProfile(profile)
      } catch (error) {
        if (!isMounted) return
        setEmployeeFormProfile(null)
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
  }, [employeeFormMode, isEmployeeFormOpen, selectedEmployee, showStatus])

  function resetDirectoryFilters() {
    setSearch('')
    setStatusFilter('All')
    setWorkLocationFilter('All')
    setDepartmentFilter('All')
    setPositionFilter('All')
    setRoleFilter('All')
    setEmployeeTypeFilter('All')
    setJoinDateRange({ start: '', end: '' })
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
    setEmployeeFormMode('edit')
    setSelectedEmployee(employee)
    setEmployeeDraft(buildEmployeeDraft(employee))
    setEmployeeFormTouched({})
    setEmployeeFormTab('basic')
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

      return { ...current, [name]: value }
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
      await runWithLoader(async () => {
        if (employeeFormMode === 'create') {
          await addEmployee(payload)
        } else {
          await updateEmployee(selectedEmployee.uid, payload)
        }
      }, {
        title: employeeFormMode === 'create' ? 'Creating employee' : 'Updating employee',
        message: employeeFormMode === 'create' ? 'Saving employee record and provisioning linked auth signup.' : 'Applying employee updates and syncing linked auth details.',
        minVisibleMs: 700
      })

      showStatus({
        type: 'success',
        title: employeeFormMode === 'create' ? 'Employee created' : 'Employee updated',
        message: employeeFormMode === 'create'
          ? `${payload.fullName} was added successfully. Linked auth signup was provisioned with the default password Welcome@123.`
          : `${payload.fullName} was updated successfully.`
      })

      setIsEmployeeFormOpen(false)
      setEmployeeDraft(createEmptyEmployeeDraft())
      setEmployeeFormTouched({})
      setEmployeeFormTab('basic')
      setEmployeeFormProfile(null)
      setSelectedEmployee(null)
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Employee save failed', message: actionError?.response?.data?.detail || actionError?.message || 'The employee request could not be completed.' })
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
      await runWithLoader(() => deleteEmployee(employee.uid), { title: 'Deleting employee', message: 'Removing the selected employee record from the directory.', minVisibleMs: 650 })
      showStatus({ type: 'success', title: 'Employee removed', message: `${employee.fullName} has been removed from the directory.` })
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Delete failed', message: actionError?.response?.data?.detail || actionError?.message || 'The employee could not be removed.' })
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

    const { payloads, errors } = buildImportPayloads(rows, employees, roleDirectory)

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
    setMetadataDraft({ category, value: '', label: '', description: '', isActive: true, sortOrder: 0 })
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
      value: entry.value || '',
      label: entry.label || '',
      description: entry.description || '',
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
          message: 'The running backend returned no valid role modules, so the role matrix cannot be saved right now.'
        })
        return
      }

      setRoleTouched((current) => ({ ...current, ...markFieldsTouched(['roleName']) }))

      if (hasValidationErrors(roleErrors, ['roleName'])) {
        showStatus({ type: 'error', title: 'Missing role name', message: roleErrors.roleName || 'Role name is required.' })
        return
      }

      if (isEditingSystemAdminRole) {
        showStatus({ type: 'error', title: 'Role locked', message: 'The Admin role is backend-managed. Its permissions are shown for reference and cannot be changed here.' })
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
        if (metadataModal.mode === 'create') {
          await metadataService.createRole(sanitizedRolePayload)
        } else {
          await metadataService.updateRole(targetRoleUid, sanitizedRolePayload)
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['employees', 'roles'] }),
          queryClient.invalidateQueries({ queryKey: ['employees', 'role-modules', 'v2'] })
        ])

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

    setMetadataTouched((current) => ({ ...current, ...markFieldsTouched(['label', 'value']) }))

    if (hasValidationErrors(metadataErrors, ['label', 'value'])) {
      const firstError = ['label', 'value'].map((fieldName) => metadataErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Missing metadata value', message: firstError || 'Label and value are both required.' })
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
      showStatus({ type: 'error', title: 'Metadata save failed', message: actionError?.response?.data?.detail || actionError?.message || 'The metadata entry could not be saved.' })
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

  function openMappingModal(employee) {
    setMappingEmployee(employee)
    setMappingDraft(createMappingDraft(employee))
    setMappingModalOpen(true)
  }

  function handleMappingDraftChange(event) {
    const { name, value } = event.target
    setMappingDraft((current) => ({ ...current, [name]: value }))
  }

  async function handleSaveMapping() {
    if (!mappingEmployee) return

    const values = Object.entries(mappingDraft)
      .filter(([, value]) => value)
      .map(([, value]) => String(value))
    if (values.some((value) => value === String(mappingEmployee.uid))) {
      showStatus({ type: 'error', title: 'Invalid mapping', message: 'An employee cannot be mapped to themselves.' })
      return
    }

    try {
      await runWithLoader(() => updateEmployee(mappingEmployee.uid, {
        ...mappingEmployee,
        managerEmployeeUid: mappingDraft.managerEmployeeUid,
        hrEmployeeUid: mappingDraft.hrEmployeeUid,
        teamLeadEmployeeUid: mappingDraft.teamLeadEmployeeUid,
        coordinatorEmployeeUid: mappingDraft.coordinatorEmployeeUid
      }), { title: 'Saving employee mapping', message: `Updating reporting assignments for ${mappingEmployee.fullName}.` })

      showStatus({ type: 'success', title: 'Mapping updated', message: `${mappingEmployee.fullName} mapping has been updated successfully.` })
      setMappingModalOpen(false)
      setMappingEmployee(null)
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Mapping update failed', message: actionError?.response?.data?.detail || actionError?.message || 'The employee mapping could not be saved.' })
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
      showStatus({ type: 'error', title: 'User already unlocked', message: `${requestEntry.fullName || requestEntry.email} is already unlocked in the backend.` })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Unlock User Account',
      title: `Unlock ${requestEntry.fullName || requestEntry.email}?`,
      message: 'This will call the backend unlock-user API by email.',
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
          message: `Restoring backend account access for ${requestEntry.fullName || requestEntry.email}.`,
          minVisibleMs: 550
        }
      )

      showStatus({
        type: 'success',
        title: 'Account unlocked',
        message: `${requestEntry.fullName || requestEntry.email} has been unlocked through the backend.`
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
    return { ...section, entries: metadataByCategory[section.key] || [] }
  }).filter((section) => (section.key === 'roles' ? canReadRoles : canReadEmployeeMetadata)), [canReadEmployeeMetadata, canReadRoles, metadataByCategory, roles])

  useEffect(() => {
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab)
    }
  }, [activeTab, requestedTab])

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'metadata') return canViewMetadata
      if (tabKey === 'entries') return canViewEntries
      if (tabKey === 'requests') return canViewRequests
      return false
    }, defaultTab)

    if (!nextTab) return
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    if (requestedTab !== nextTab) {
      updateTabSearchParam(nextTab)
    }
  }, [activeTab, availableTabs, canViewEntries, canViewMetadata, canViewRequests, defaultTab, requestedTab, updateTabSearchParam])


  if (isLoading) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Employees Management" tagline="Administer metadata, employee records, and linked auth signup from a single workspace." />
        <div className="card border-0 shadow-sm glass employee-directory-shell"><div className="card-body py-5 text-center"><div className="global-loader-spinner mb-3"><span /><span /></div><div className="fw-semibold mb-1">Loading employee management</div>
      {/* Mapping tab is under development and will be available in a future release. */}
      {/* <div className="text-muted small">Pulling directory, metadata, and mapping catalogs from the backend.</div></div></div> */}
        <div className="text-muted small">Pulling directory and metadata catalogs from the backend.</div></div></div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Employees Management" tagline="Administer metadata, employee records, and linked auth signup from a single workspace." />
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="fw-semibold mb-2">Employee management could not be loaded.</div>
            <div className="text-muted small mb-3">{error?.response?.data?.detail || error?.message || 'The backend request failed.'}</div>
            <button type="button" className="btn btn-primary" onClick={() => refetch()}>Retry</button>
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
      <PageHeader title="Employees Management" tagline="Administer metadata, employee records, and linked auth signup from one operational console." />

      <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />

      {activeTab === 'metadata' ? (
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

      {activeTab === 'entries' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Total Employees" value={employees.length} helper="Registered employee records in directory." tone="blue" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Active / Inactive" value={`${metrics.active} / ${metrics.inactive}`} helper="Current employment status split." tone="orange" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Roles / Departments" value={`${roles.length} / ${departmentValues.length}`} helper="Dynamic backend-driven master data." tone="teal" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <DirectoryMetricCard title="Onsite / Remote / Hybrid" value={`${metrics.onsite} / ${metrics.remote} / ${metrics.hybrid}`} helper="Work location split." tone="purple" />
            </div>
          </div>

          <div className="card border-0 shadow-sm glass employee-directory-shell">
            <div className="card-body d-flex flex-column gap-3">
              <div className="employee-toolbar employee-toolbar-top">
                <AppSearchField className="employee-toolbar-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by code, employee, role, department, email, or phone" />

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
                <div className="employee-filter-field employee-filter-field-range">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Join Date</label>
                  <AppDateRangeField value={joinDateRange} onChange={setJoinDateRange} className="employee-range-field" placeholder="[Select range]" />
                </div>
                <div className="employee-filter-actions">
                  <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetDirectoryFilters}>
                    <XIcon />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <PaginatedTable rows={sortedEmployees}>
                {({ rows: paginatedRows }) => (
                  <table className="table align-middle mb-0 employee-table employee-table-dense">
                    <colgroup>
                      <col className="employee-col-name" />
                      <col className="employee-col-role" />
                      <col className="employee-col-contact" />
                      <col className="employee-col-role" />
                      <col className="employee-col-status" />
                      <col className="employee-col-join" />
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
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? paginatedRows.map((employee) => (
                        <tr key={employee.uid || employee.id}>
                          <td className="employee-cell-wrap">
                            <CellStack title={employee.fullName} subtitle={employee.employeeCode} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap employee-role-cell">
                            <CellStack title={<EmployeeBadge value={employee.roleName || 'Unassigned'} type="role" />} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={employee.email || '—'} subtitle={employee.phone || '—'} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={employee.position || '—'} subtitle={employee.department || '—'} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={<EmployeeBadge value={employee.status || '—'} type="status" />} subtitle={formatDate(employee.joinDate)} className="employee-cell-wrap" />
                          </td>
                          <td className="employee-cell-wrap">
                            <CellStack title={<EmployeeBadge value={employee.workLocation || '—'} type="workLocation" />} subtitle={<EmployeeBadge value={employee.employeeType || '—'} type="employeeType" />} className="employee-cell-wrap" />
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
                          <td colSpan="7">
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

      {activeTab === 'mapping' ? (
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="fw-semibold mb-2">Employee Mapping</div>
            <div className="text-muted small">This section is kept as-is for future use.</div>
          </div>
        </div>
      ) : null}

      {activeTab === 'requests' ? (
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body d-flex flex-column gap-3">
            <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
              <div>
                <div className="fw-semibold">Employee Status Controls</div>
                <div className="text-muted small">Live backend account status for all users. Accounts are auto-locked after 48 hours only if first login was not completed, and admin can unlock by email.</div>
              </div>
              <div className="small text-muted">Records: <strong>{profileRequests.length}</strong></div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-sm-6 col-xl-3">
                <DirectoryMetricCard title="Locked Accounts" value={profileRequestMetrics.locked} helper="Users currently locked by backend account state." tone="orange" />
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
                {profileRequestsError?.response?.data?.detail || profileRequestsError?.message || 'Employee status records could not be loaded from the backend.'}
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
                              subtitle={entry.lockedReason ? 'Backend locked_reason' : 'No backend lock reason provided.'}
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
          <AttendanceTabs activeTab={employeeFormTab} onChange={setEmployeeFormTab} tabs={employeeFormTabs} />

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
                bloodGroupOptions={bloodGroupFormOptions}
                genderOptions={genderFormOptions}
                phoneCountryOptions={phoneCountryFormOptions}
              />
            </form>
          ) : null}

          {employeeFormMode === 'edit' && employeeFormTab === 'additional' ? (
            employeeFormProfileLoading ? (
              <div className="text-muted small">Loading employee additional details…</div>
            ) : (
              <div className="employee-overview-box">
                <EmployeeAdditionalDetailsEditor employee={selectedEmployee} profile={employeeFormProfile} />
              </div>
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
            <div className="text-muted small">Download the CSV or Excel template, fill one employee per row, use an existing role name from metadata, and upload the completed file here. Linked signup creation still uses the default password Welcome@123.</div>
            <div className="text-muted small mt-2">Validation checks: required fields, unique employee code, role name must exist in metadata, date formats are auto-converted (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, and Excel serial dates), and date of birth must keep age between 21 and 65.</div>
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
          setPreviewEmployeeTab('basic')
        }}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => { setPreviewEmployee(null); setPreviewEmployeeProfile(null); setPreviewEmployeeTab('basic') }}>Close</button>
            {previewEmployee && canUpdateEmployees ? <button type="button" className="btn btn-primary btn-icon-inline" onClick={() => { const current = previewEmployee; setPreviewEmployee(null); openEditEmployee(current) }}><PencilIcon /><span>Edit</span></button> : null}
          </>
        )}
      >
        {previewEmployee ? (
          <div className="d-flex flex-column gap-3">
            <AttendanceTabs
              activeTab={previewEmployeeTab}
              onChange={setPreviewEmployeeTab}
              tabs={EMPLOYEE_VIEW_TABS.filter((tab) => tab.key === 'basic')}
            />

            {previewEmployeeProfileLoading ? (
              <div className="text-muted small">Loading employee details…</div>
            ) : (
              <div className="employee-overview-box">
                {previewEmployeeTab === 'basic' ? (
                  <div className="row g-3 align-items-start">
                    <div className="col-12 col-md-4">
                      <div className="profile-photo-preview">
                        {previewEmployeeProfile?.profileImageUrl
                          ? <img src={previewEmployeeProfile.profileImageUrl} alt={previewEmployee.fullName || 'Employee'} />
                          : <span>{String(previewEmployee.fullName || 'E').charAt(0).toUpperCase()}</span>}
                      </div>
                    </div>
                    <div className="col-12 col-md-8">
                      <div className="row g-2">
                        <div className="col-12 col-md-6"><strong>Employee Code:</strong> {previewEmployee.employeeCode || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Name:</strong> {previewEmployee.fullName || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Email:</strong> {previewEmployee.email || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Mobile:</strong> {previewEmployee.phone || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Role:</strong> {previewEmployee.roleName || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Status:</strong> <EmployeeBadge value={previewEmployee.status || '—'} type="status" /></div>
                        <div className="col-12 col-md-6"><strong>Department:</strong> {previewEmployee.department || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Position:</strong> {previewEmployee.position || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Date of Joining:</strong> {formatDate(previewEmployee.joinDate)}</div>
                        <div className="col-12 col-md-6"><strong>Work Location:</strong> {previewEmployee.workLocation || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Employee Type:</strong> {previewEmployee.employeeType || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Manager:</strong> {previewEmployee.managerName || '—'}</div>
                        <div className="col-12 col-md-6"><strong>HR:</strong> {previewEmployee.hrEmployeeName || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Lead:</strong> {previewEmployee.teamLeadName || '—'}</div>
                        <div className="col-12 col-md-6"><strong>Coordinator:</strong> {previewEmployee.coordinatorName || '—'}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

              </div>
            )}
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
        onClose={() => setMappingModalOpen(false)}
        onSubmit={handleSaveMapping}
        options={employeeMappingOptions}
      />
    </div>
  )
}
