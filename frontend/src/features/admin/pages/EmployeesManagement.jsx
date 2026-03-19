import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import OverviewList from '../../../components/common/OverviewList.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import AppDateRangeField from '../../../components/common/AppDateRangeField.jsx'
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
  downloadEmployeesAsCsv,
  downloadEmployeesAsExcel,
  formatDate,
  formatEmployeeAge,
  getDefaultPhoneCountryOption,
  getEmployeeAge,
  getEmployeeOverviewItems,
  normalizeDateInput,
  parseStoredPhoneValue
} from '../../../utils/employee.js'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DownloadIcon,
  ExportIcon,
  FilterIcon,
  ImportIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UserPlusIcon,
  ViewIcon,
  XIcon
} from '../../../components/common/AppIcons.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { metadataService } from '../../../api/services/metadata.service.js'

const TAB_ITEMS = [
  { key: 'metadata', label: 'Metadata Entries', helper: 'Backend-driven master data' },
  { key: 'entries', label: 'Employee Entries', helper: 'Directory, create, update, export' }
  // Mapping tab is under development and will be available in a future release.
  // { key: 'mapping', label: 'Employees Mapping', helper: 'Manager, HR, lead, coordinator' }
]

const METADATA_SECTIONS = [
  { key: 'roles', title: 'Roles', description: 'Auth roles used for login signup and employee assignment.' },
  { key: 'department', title: 'Department', description: 'Business units used in employee records.' },
  { key: 'position', title: 'Position', description: 'Job positions available for employee records.' },
  { key: 'status', title: 'Status', description: 'Employment lifecycle statuses.' },
  { key: 'work_location', title: 'Work Location', description: 'Onsite, remote, hybrid, and future location modes.' },
  { key: 'employee_type', title: 'Employee Type', description: 'Engagement model such as full time or contract.' },
  { key: 'gender', title: 'Gender', description: 'Gender values available in employee records.' },
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

function createEmptyRoleDraft() {
  return { uid: null, roleName: '', description: '', access: {} }
}

function isSystemAdminRoleName(roleName) {
  return String(roleName || '').trim().toLowerCase() === SYSTEM_ADMIN_ROLE_NAME.toLowerCase()
}

function sanitizeRoleModuleName(moduleName) {
  const normalizedValue = String(moduleName || '')
    .replace(/^\s*[\[({<]+/, '')
    .replace(/[\])}>]+\s*$/, '')
    .replace(/^['"`]+|['"`,;:]+$/g, '')
    .trim()

  return /[A-Za-z0-9]/.test(normalizedValue) ? normalizedValue : ''
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

    const sanitizedModuleName = sanitizeRoleModuleName(moduleName)
    if (sanitizedModuleName && normalizedLevels.length) {
      accumulator[sanitizedModuleName] = normalizedLevels
    }
    return accumulator
  }, {})
}

function getRoleAccessSummary(access = {}) {
  const configuredModules = Object.entries(normalizeRoleAccess(access))
  if (!configuredModules.length) return 'No access assigned'

  const preview = configuredModules
    .slice(0, 2)
    .map(([moduleName, accessLevels]) => `${moduleName} (${accessLevels.map((level) => level.toUpperCase()).join('/')})`)
    .join(', ')

  return `${configuredModules.length} module${configuredModules.length === 1 ? '' : 's'} • ${preview}${configuredModules.length > 2 ? ` +${configuredModules.length - 2} more` : ''}`
}

function buildRoleAccessMeta(access = {}) {
  const configuredModules = Object.values(normalizeRoleAccess(access))
  const permissionCount = configuredModules.reduce((total, accessLevels) => total + accessLevels.length, 0)
  return { moduleCount: configuredModules.length, permissionCount }
}

function dedupeRoleModules(modules = []) {
  return Array.from(new Set((Array.isArray(modules) ? modules : [])
    .map(sanitizeRoleModuleName)
    .filter(Boolean)))
}

function getRoleModuleGroupName(moduleName) {
  if (!moduleName) return 'Other'
  if (moduleName === 'Roles') return 'Administration'
  if (moduleName.startsWith('Employee')) return 'Employees'
  if (moduleName.startsWith('Attendance') || moduleName === 'Shift Roster' || moduleName === 'Assign Shift') return 'Attendance'
  if (moduleName === 'Holiday Calendar' || moduleName === 'Leave Request' || moduleName === 'Leave Type') return 'Leave'
  return 'Other'
}

function buildRoleModuleGroups(modules = []) {
  const orderedGroupNames = ['Employees', 'Attendance', 'Leave', 'Administration', 'Other']
  const groupedModules = dedupeRoleModules(modules).reduce((accumulator, moduleName) => {
    const groupName = getRoleModuleGroupName(moduleName)
    accumulator[groupName] = accumulator[groupName] || []
    accumulator[groupName].push(moduleName)
    return accumulator
  }, {})

  return orderedGroupNames
    .filter((groupName) => Array.isArray(groupedModules[groupName]) && groupedModules[groupName].length)
    .map((groupName) => ({
      key: groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: groupName,
      modules: groupedModules[groupName]
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

function parseBulkEmployeeCsv(content = '') {
  const lines = String(content || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  if (lines.length <= 1) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] || ''
      return accumulator
    }, {})
  })

  return { headers, rows }
}

function pickCsvValue(row, aliases) {
  return aliases.reduce((selected, alias) => {
    if (selected) return selected
    return row[alias.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()] || ''
  }, '')
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
    const joinDate = normalizeDateInput(pickCsvValue(row, ['Join Date']).trim())
    const dateOfBirth = normalizeDateInput(pickCsvValue(row, ['Date Of Birth']).trim())
    const employeeType = pickCsvValue(row, ['Employee Type']).trim()
    const gender = pickCsvValue(row, ['Gender']).trim()
    const caste = pickCsvValue(row, ['Caste']).trim()
    const emergencyContact = pickCsvValue(row, ['Emergency Contact']).trim()
    const bloodGroup = pickCsvValue(row, ['Blood Group']).trim()
    const address = pickCsvValue(row, ['Address']).trim()

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

function ActionButton({ icon, label, variant = 'view', onClick }) {
  return (
    <button type="button" className={`employee-action-btn employee-action-btn-${variant}`} onClick={onClick} aria-label={label} title={label}>
      {icon}
      <span>{label}</span>
    </button>
  )
}

function EmployeeFormFields({
  draft,
  onChange,
  formMode,
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

  return (
    <div className="row g-3">
      <div className="col-12 col-md-6">
        <label className="form-label">Employee Code*</label>
        <input className="form-control" name="employeeCode" value={draft.employeeCode} onChange={onChange} maxLength="20" required disabled={formMode === 'edit'} />
        {formMode === 'edit' ? <div className="form-text">Employee code is locked after creation and cannot be modified.</div> : null}
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Email*</label>
        <input className="form-control" type="email" name="email" value={draft.email} onChange={onChange} required />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">First Name*</label>
        <input className="form-control" name="firstName" value={draft.firstName} onChange={onChange} maxLength="120" required />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Last Name*</label>
        <input className="form-control" name="lastName" value={draft.lastName} onChange={onChange} maxLength="120" required />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Role*</label>
        <AppSelect name="roleType" value={draft.roleType} onChange={onChange} options={roleOptions} placeholder="Select role" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Position*</label>
        <AppSelect name="position" value={draft.position} onChange={onChange} options={positionOptions} placeholder="Select position" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Department*</label>
        <AppSelect name="department" value={draft.department} onChange={onChange} options={departmentOptions} placeholder="Select department" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Mobile Number*</label>
        <div className="phone-input-shell">
          <AppSelect name="phoneCountryCode" value={draft.phoneCountryCode} onChange={onChange} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" />
          <input className="form-control" name="phoneLocal" value={draft.phoneLocal} onChange={onChange} inputMode="numeric" placeholder="Enter mobile number" minLength="6" maxLength="15" pattern="[0-9]{6,15}" required />
        </div>
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Join Date*</label>
        <input className="form-control" type="date" name="joinDate" value={draft.joinDate} onChange={onChange} required />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Status*</label>
        <AppSelect name="status" value={draft.status} onChange={onChange} options={statusOptions} placeholder="Select status" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Date of Birth</label>
        <input className="form-control" type="date" name="dateOfBirth" value={draft.dateOfBirth} onChange={onChange} min={dobBounds.min} max={dobBounds.max} />
        <div className="form-text">Allowed age band: 21 to 65 years.</div>
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
        <AppSelect name="gender" value={draft.gender} onChange={onChange} options={genderOptions} placeholder="Select gender" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Caste</label>
        <input className="form-control" name="caste" value={draft.caste} onChange={onChange} maxLength="120" placeholder="Enter caste manually" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Employee Type</label>
        <AppSelect name="employeeType" value={draft.employeeType} onChange={onChange} options={employeeTypeOptions} placeholder="Select type" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Work Location</label>
        <AppSelect name="workLocation" value={draft.workLocation} onChange={onChange} options={workLocationOptions} placeholder="Select work location" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Blood Group</label>
        <AppSelect name="bloodGroup" value={draft.bloodGroup} onChange={onChange} options={bloodGroupOptions} placeholder="Select blood group" />
      </div>

      <div className="col-12 col-md-6">
        <label className="form-label">Emergency Contact</label>
        <div className="phone-input-shell">
          <AppSelect name="emergencyContactCountryCode" value={draft.emergencyContactCountryCode} onChange={onChange} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" />
          <input className="form-control" name="emergencyContactLocal" value={draft.emergencyContactLocal} onChange={onChange} inputMode="numeric" placeholder="Enter emergency contact number" minLength="0" maxLength="15" pattern="[0-9]{0,15}" />
        </div>
        <div className="form-text">Emergency contact must differ from the employee mobile number.</div>
      </div>

      <div className="col-12">
        <label className="form-label">Address</label>
        <textarea className="form-control" rows="3" name="address" value={draft.address} onChange={onChange} />
      </div>
    </div>
  )
}

function MetadataCard({ title, description, entries, onAdd, onEdit, onDelete, roleCard = false, roleModules = [] }) {
  return (
    <div className="card border-0 shadow-sm glass employee-directory-shell metadata-card-shell">
      <div className="card-body d-flex flex-column gap-3">
        <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
          <div>
            <div className="fw-semibold">{title}</div>
            <div className="text-muted small">{description}</div>
          </div>
          <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={onAdd}>
            <PlusIcon />
            <span>Add Entry</span>
          </button>
        </div>

        <div className="table-responsive employee-table-wrap metadata-table-wrap">
          <table className="table align-middle mb-0 employee-table employee-table-dense metadata-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Value</th>
                <th>Description</th>
                <th>Status</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.length ? entries.map((entry) => {
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
                      <div className="employee-action-cluster metadata-action-cluster">
                        <ActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => onEdit(entry)} />
                        <ActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => onDelete(entry)} />
                      </div>
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
        </div>
      </div>
    </div>
  )
}

function MetadataEntryModal({ open, title, draft, onChange, onClose, onSubmit }) {
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
          <input className="form-control" name="label" value={draft.label} onChange={onChange} maxLength="120" />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Value*</label>
          <input className="form-control" name="value" value={draft.value} onChange={onChange} maxLength="120" />
          <div className="form-text">Use backend-safe values like FullTime, Remote, Active, or Engineering.</div>
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows="3" name="description" value={draft.description} onChange={onChange} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Sort Order</label>
          <input className="form-control" type="number" name="sortOrder" value={draft.sortOrder} onChange={onChange} />
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

function RoleEntryModal({ open, title, draft, onChange, onClose, onSubmit, moduleGroups, modulesLoading = false, allModules = [], isSaving = false, isSystemAdminRole = false }) {
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
          {!isSystemAdminRole ? <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button> : null}
        </>
      )}
    >
      <div ref={contentRef} className="row g-3 role-entry-modal">
        <div className="col-12 col-md-6">
          <label className="form-label">Role Name*</label>
          <input className="form-control" name="roleName" value={draft.roleName} onChange={onChange} maxLength="100" readOnly={isSystemAdminRole || isSaving} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Description</label>
          <input className="form-control" name="description" value={draft.description} onChange={onChange} maxLength="500" readOnly={isSystemAdminRole || isSaving} />
        </div>
        <div className="col-12">
          <div className="attendance-note-card role-access-note-card">
            <div className="fw-semibold mb-1">Role access matrix</div>
            <div className="text-muted small">Expand a main module, select the required access on its sub-modules or tabs, and the frontend will save only the short codes <strong>C</strong>, <strong>R</strong>, <strong>U</strong>, and <strong>D</strong> to the backend.</div>
            {isSystemAdminRole ? (
              <div className="role-access-state-banner">This system role is backend-managed. Full access is shown for reference, and editing is locked here.</div>
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
                                <div className="fw-semibold">{moduleName}</div>
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

export default function AdminEmployees() {
  const formRef = useRef(null)
  const queryClient = useQueryClient()
  const exportMenuId = 'employeesExportMenu'
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const { data: employeesData = [], isLoading, isError, error, refetch, isFetching } = useEmployeesQuery()
  const { data: employeeLookup = [] } = useEmployeeLookupQuery()
  const { data: metadataEntries = [] } = useEmployeeMetadataQuery()
  const { data: roles = [] } = useRoleDirectoryQuery()
  const { data: roleModules = [], isFetching: roleModulesFetching } = useRoleModulesQuery()
  const { addEmployee, bulkAddEmployees, updateEmployee, deleteEmployee } = useEmployeeDirectoryActions()

  const [activeTab, setActiveTab] = useState('entries')
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
  const [previewEmployee, setPreviewEmployee] = useState(null)

  const [metadataModal, setMetadataModal] = useState(null)
  const [metadataDraft, setMetadataDraft] = useState({ category: '', value: '', label: '', description: '', isActive: true, sortOrder: 0 })
  const [roleDraft, setRoleDraft] = useState(() => createEmptyRoleDraft())
  const [isRoleSaving, setIsRoleSaving] = useState(false)

  const [mappingModalOpen, setMappingModalOpen] = useState(false)
  const [mappingEmployee, setMappingEmployee] = useState(null)
  const [mappingDraft, setMappingDraft] = useState(createMappingDraft(null))

  const metadataByCategory = useMemo(() => {
    return metadataEntries.reduce((accumulator, entry) => {
      const key = entry.category
      accumulator[key] = accumulator[key] || []
      accumulator[key].push(entry)
      return accumulator
    }, {})
  }, [metadataEntries])

  const rolePermissionModules = useMemo(() => dedupeRoleModules([
    ...roleModules,
    ...roles.flatMap((role) => Object.keys(normalizeRoleAccess(role.access)))
  ]), [roleModules, roles])
  const roleModuleGroups = useMemo(() => buildRoleModuleGroups(rolePermissionModules), [rolePermissionModules])
  const isEditingSystemAdminRole = metadataModal?.kind === 'role' && metadataModal?.mode === 'edit' && isSystemAdminRoleName(metadataModal?.entry?.roleName || roleDraft.roleName)

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
  const phoneCountryFormOptions = useMemo(() => PHONE_COUNTRY_OPTIONS.map((option) => ({ value: option.dialCode, label: option.dialCode, description: option.label })), [])

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    const matchesSearch = !search || [
      employee.employeeCode,
      employee.fullName,
      employee.roleName,
      employee.position,
      employee.department,
      employee.email,
      employee.phone,
      employee.emergencyContact
    ].join(' ').toLowerCase().includes(search.toLowerCase())

    const matchesStatus = statusFilter === 'All' || employee.status === statusFilter
    const matchesWorkLocation = workLocationFilter === 'All' || employee.workLocation === workLocationFilter
    const matchesDepartment = departmentFilter === 'All' || employee.department === departmentFilter
    const matchesPosition = positionFilter === 'All' || employee.position === positionFilter
    const matchesRole = roleFilter === 'All' || String(employee.roleType || '') === String(roleFilter)
    const matchesEmployeeType = employeeTypeFilter === 'All' || employee.employeeType === employeeTypeFilter
    const matchesJoinDate = isJoinDateInRange(employee.joinDate, joinDateRange)

    return matchesSearch && matchesStatus && matchesWorkLocation && matchesDepartment && matchesPosition && matchesRole && matchesEmployeeType && matchesJoinDate
  }), [employees, search, statusFilter, workLocationFilter, departmentFilter, positionFilter, roleFilter, employeeTypeFilter, joinDateRange])

  const { items: sortedEmployees, sortConfig, requestSort } = useSortableData(filteredEmployees, {
    initialKey: 'nameRole',
    initialDirection: 'asc',
    accessors: {
      nameRole: (employee) => `${employee.fullName || ''} ${employee.roleName || ''}`.trim(),
      contact: (employee) => `${employee.email || ''} ${employee.phone || ''}`.trim(),
      positionDepartment: (employee) => `${employee.position || ''} ${employee.department || ''}`.trim(),
      statusJoinDate: (employee) => `${employee.status || ''} ${employee.joinDate || ''}`.trim(),
      locationType: (employee) => `${employee.workLocation || ''} ${employee.employeeType || ''}`.trim()
    }
  })

  const mappingRows = useMemo(() => employees.filter((employee) => {
    const haystack = [
      employee.employeeCode,
      employee.fullName,
      employee.roleName,
      employee.managerName,
      employee.hrEmployeeName,
      employee.teamLeadName,
      employee.coordinatorName
    ].join(' ').toLowerCase()
    return !mappingSearch || haystack.includes(mappingSearch.toLowerCase())
  }), [employees, mappingSearch])

  const metrics = useMemo(() => {
    const active = employees.filter((employee) => employee.status === 'Active').length
    const inactive = employees.filter((employee) => employee.status === 'Inactive').length
    const onsite = employees.filter((employee) => employee.workLocation === 'Onsite').length
    const remote = employees.filter((employee) => employee.workLocation === 'Remote').length
    const hybrid = employees.filter((employee) => employee.workLocation === 'Hybrid').length
    const mapped = employees.filter((employee) => employee.managerEmployeeUid || employee.hrEmployeeUid || employee.teamLeadEmployeeUid || employee.coordinatorEmployeeUid).length
    return { active, inactive, onsite, remote, hybrid, mapped }
  }, [employees])

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
    setEmployeeFormMode('create')
    setSelectedEmployee(null)
    setEmployeeDraft(createEmptyEmployeeDraft())
    setIsEmployeeFormOpen(true)
  }

  function openEditEmployee(employee) {
    setEmployeeFormMode('edit')
    setSelectedEmployee(employee)
    setEmployeeDraft(buildEmployeeDraft(employee))
    setIsEmployeeFormOpen(true)
  }

  function handleEmployeeDraftChange(event) {
    const { name } = event.target
    let { value } = event.target
    if (name === 'employeeCode') value = value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
    if (name === 'phoneLocal' || name === 'emergencyContactLocal') value = String(value).replace(/\D/g, '').slice(0, 15)
    setEmployeeDraft((current) => ({ ...current, [name]: value }))
  }

  async function handleSaveEmployee() {
    const requiredFields = [
      ['employeeCode', 'Employee code'],
      ['firstName', 'First name'],
      ['lastName', 'Last name'],
      ['roleType', 'Role'],
      ['position', 'Position'],
      ['department', 'Department'],
      ['email', 'Email'],
      ['phoneLocal', 'Mobile number'],
      ['joinDate', 'Join date'],
      ['status', 'Status']
    ]

    if (employeeFormMode === 'edit') {
      requiredFields.shift()
    }

    if (!formRef.current?.reportValidity()) return

    const firstMissing = requiredFields.find(([key]) => !String(employeeDraft[key] || '').trim())
    if (firstMissing) {
      showStatus({ type: 'error', title: 'Missing required value', message: `${firstMissing[1]} is required before you can continue.` })
      return
    }

    if (!isDateOfBirthWithinAllowedRange(employeeDraft.dateOfBirth)) {
      showStatus({ type: 'error', title: 'Invalid date of birth', message: 'The selected date of birth must keep the employee age between 21 and 65 years.' })
      return
    }

    const phone = buildPhoneValue(employeeDraft.phoneCountryCode, employeeDraft.phoneLocal)
    const emergencyContact = buildPhoneValue(employeeDraft.emergencyContactCountryCode, employeeDraft.emergencyContactLocal)

    if (phone && emergencyContact && phone === emergencyContact) {
      showStatus({ type: 'error', title: 'Invalid emergency contact', message: 'Mobile number and emergency contact cannot be the same.' })
      return
    }

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
      setSelectedEmployee(null)
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Employee save failed', message: actionError?.response?.data?.detail || actionError?.message || 'The employee request could not be completed.' })
    }
  }

  async function handleDeleteEmployee(employee) {
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
    if (!importFile) {
      showStatus({ type: 'error', title: 'No file selected', message: 'Upload the populated CSV template before starting the bulk import.' })
      return
    }

    const content = await importFile.text()
    const { rows } = parseBulkEmployeeCsv(content)
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
      showStatus({ type: 'error', title: 'Bulk import failed', message: importError?.response?.data?.detail || importError?.message || 'The CSV file could not be imported.' })
    }
  }

  function openMetadataModal(category) {
    if (category === 'roles') {
      setMetadataModal({ kind: 'role', mode: 'create' })
      setRoleDraft(createEmptyRoleDraft())
      return
    }
    setMetadataModal({ kind: 'metadata', category, mode: 'create' })
    setMetadataDraft({ category, value: '', label: '', description: '', isActive: true, sortOrder: 0 })
  }

  function openEditMetadata(category, entry) {
    if (category === 'roles') {
      setMetadataModal({ kind: 'role', mode: 'edit', entry })
      setRoleDraft({ uid: entry.uid || null, roleName: entry.roleName || '', description: entry.description || '', access: getEffectiveRoleAccess(entry.access, entry.roleName, rolePermissionModules) })
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
  }

  function handleMetadataDraftChange(event) {
    const { name, value } = event.target
    setMetadataDraft((current) => ({ ...current, [name]: name === 'sortOrder' ? Number(value || 0) : value }))
  }

  function handleRoleDraftChange(event) {
    const { name, value } = event.target
    setRoleDraft((current) => ({
      ...current,
      [name]: name === 'access' ? normalizeRoleAccess(value) : value
    }))
  }

  async function handleSaveMetadata() {
    if (metadataModal?.kind === 'role') {
      if (!roleDraft.roleName.trim()) {
        showStatus({ type: 'error', title: 'Missing role name', message: 'Role name is required.' })
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
          queryClient.invalidateQueries({ queryKey: ['employees', 'role-modules'] })
        ])

        showStatus({ type: 'success', title: metadataModal.mode === 'create' ? 'Role created' : 'Role updated', message: `${sanitizedRolePayload.roleName} is now available for employee mapping.` })
        setMetadataModal(null)
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

    if (!metadataDraft.label.trim() || !metadataDraft.value.trim()) {
      showStatus({ type: 'error', title: 'Missing metadata value', message: 'Label and value are both required.' })
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
    } catch (actionError) {
      showStatus({ type: 'error', title: 'Metadata save failed', message: actionError?.response?.data?.detail || actionError?.message || 'The metadata entry could not be saved.' })
    }
  }

  async function handleDeleteMetadata(category, entry) {
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

  const metadataPanels = useMemo(() => METADATA_SECTIONS.map((section) => {
    if (section.key === 'roles') {
      return { ...section, entries: roles.map((role) => ({ ...role, isActive: true })) }
    }
    return { ...section, entries: metadataByCategory[section.key] || [] }
  }), [metadataByCategory, roles])


  if (isLoading) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from a single workspace." />
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
        <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from a single workspace." />
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
      <PageHeader title="Employee Management" tagline="Administer metadata, employee records, and linked auth signup from one operational console." />

      <AttendanceTabs activeTab={activeTab} onChange={setActiveTab} tabs={TAB_ITEMS} />

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
                  onAdd={() => openMetadataModal(section.key)}
                  onEdit={(entry) => openEditMetadata(section.key, entry)}
                  onDelete={(entry) => handleDeleteMetadata(section.key, entry)}
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
                  onAdd={() => openMetadataModal(section.key)}
                  onEdit={(entry) => openEditMetadata(section.key, entry)}
                  onDelete={(entry) => handleDeleteMetadata(section.key, entry)}
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
                <div className="employee-toolbar-search employee-search-field">
                  <label className="form-label small text-muted">Search</label>
                  <div className="input-group employee-search-group">
                    <span className="input-group-text"><SearchIcon /></span>
                    <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by code, employee, role, department, email, or phone" />
                  </div>
                </div>

                <div className="employee-toolbar-actions">
                  <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-toolbar-btn" onClick={() => { setImportFile(null); setIsImportOpen(true) }}>
                    <ImportIcon />
                    <span>Import</span>
                  </button>

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

                  <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateEmployee}>
                    <UserPlusIcon />
                    <span>Add Employee</span>
                  </button>
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

              <div className="table-responsive employee-table-wrap">
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
                      <th><SortableHeader label="Employee Name (Code)" columnKey="nameRole" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th> 
                      <th className="employee-role-column table-header-center"><SortableHeader label="Role" columnKey="nameRole" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap employee-header-wrap-center" /></th>
                      <th><SortableHeader label="Contact" columnKey="contact" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Position (Dept)" columnKey="positionDepartment" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Status (DOJ)" columnKey="statusJoinDate" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Work Location (Type)" columnKey="locationType" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th className="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEmployees.length ? sortedEmployees.map((employee) => (
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
                            <ActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditEmployee(employee)} />
                            <ActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteEmployee(employee)} />
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
              </div>
              {isFetching ? <div className="text-muted small">Refreshing employee management records…</div> : null}
            </div>
          </div>
        </>
      ) : null}

      {/* Mapping tab is under development and will be available in a future release. */}
      {/* {activeTab === 'mapping' ? (
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body d-flex flex-column gap-3">
            <div className="employee-toolbar employee-toolbar-top">
              <div className="employee-toolbar-search employee-search-field">
                <label className="form-label small text-muted">Search Mapping</label>
                <div className="input-group employee-search-group">
                  <span className="input-group-text"><SearchIcon /></span>
                  <input className="form-control" value={mappingSearch} onChange={(event) => setMappingSearch(event.target.value)} placeholder="Search by employee, role, manager, HR, team lead, or coordinator" />
                </div>
              </div>
              <div className="small text-muted">Mapped employees: <strong>{metrics.mapped}</strong> / {employees.length}</div>
            </div>

            <div className="table-responsive employee-table-wrap">
              <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Manager</th>
                    <th>HR</th>
                    <th>Team Lead</th>
                    <th>Coordinator</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappingRows.length ? mappingRows.map((employee) => (
                    <tr key={employee.uid}>
                      <td className="employee-cell-wrap"><CellStack title={employee.fullName} subtitle={`${employee.employeeCode} • ${employee.roleName || 'No role'}`} className="employee-cell-wrap" /></td>
                      <td className="employee-cell-wrap">{employee.managerName || 'Unassigned'}</td>
                      <td className="employee-cell-wrap">{employee.hrEmployeeName || 'Unassigned'}</td>
                      <td className="employee-cell-wrap">{employee.teamLeadName || 'Unassigned'}</td>
                      <td className="employee-cell-wrap">{employee.coordinatorName || 'Unassigned'}</td>
                      <td className="employee-actions-cell">
                        <div className="employee-action-cluster metadata-action-cluster">
                          <ActionButton icon={<PencilIcon />} label="Assign" variant="edit" onClick={() => openMappingModal(employee)} />
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="7">
                        <div className="employee-empty-state text-center py-4">
                          <div className="fw-semibold mb-1">No employee mapping rows matched the search.</div>
                          <div className="text-muted small">Try another employee name or reporting assignee.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null} */}

      <ModalFrame
        open={isEmployeeFormOpen}
        title={employeeFormMode === 'create' ? 'Add Employee' : 'Edit Employee'}
        onClose={() => setIsEmployeeFormOpen(false)}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-light" onClick={() => setEmployeeDraft(employeeFormMode === 'edit' && selectedEmployee ? buildEmployeeDraft(selectedEmployee) : createEmptyEmployeeDraft())}>Reset</button>
            <button type="button" className="btn btn-primary" onClick={handleSaveEmployee}>{employeeFormMode === 'create' ? 'Add' : 'Save'}</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsEmployeeFormOpen(false)}>Cancel</button>
          </>
        )}
      >
        <form ref={formRef}>
          <EmployeeFormFields
            draft={employeeDraft}
            onChange={handleEmployeeDraftChange}
            formMode={employeeFormMode}
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
      </ModalFrame>

      <ModalFrame
        open={isImportOpen}
        title="Import Employees"
        onClose={() => setIsImportOpen(false)}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadEmployeeImportTemplateCsv}><DownloadIcon /><span>Download Template</span></button>
            <button type="button" className="btn btn-primary" onClick={handleImportSubmit}>Start Import</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setIsImportOpen(false)}>Cancel</button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-3">
          <div className="employee-import-note">
            <div className="fw-semibold mb-1">Bulk entry template</div>
            <div className="text-muted small">Download the CSV template, fill one employee per row, use an existing role name from metadata, and upload the completed file here. Linked signup creation still uses the default password Welcome@123.</div>
          </div>
          <div className="employee-import-upload">
            <label className="form-label">Upload populated CSV</label>
            <input type="file" className="form-control" accept=".csv,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] || null)} />
            <div className="form-text">Accepted format: CSV. The file is validated before records are created.</div>
          </div>
          {importFile ? <div className="employee-import-file-chip"><span className="fw-semibold">Selected file:</span> {importFile.name}</div> : null}
        </div>
      </ModalFrame>

      <ModalFrame
        open={Boolean(previewEmployee)}
        title="Employee Overview"
        onClose={() => setPreviewEmployee(null)}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setPreviewEmployee(null)}>Close</button>
            {previewEmployee ? <button type="button" className="btn btn-primary btn-icon-inline" onClick={() => { const current = previewEmployee; setPreviewEmployee(null); openEditEmployee(current) }}><PencilIcon /><span>Edit</span></button> : null}
          </>
        )}
      >
        {previewEmployee ? (
          <div className="d-flex flex-column gap-3">
            <div className="employee-overview-box">
              <div className="d-flex align-items-start justify-content-between gap-3 mb-3 flex-wrap">
                <div>
                  <div className="small text-muted">Overview</div>
                  <div className="h5 fw-bold mb-1">{previewEmployee.fullName}</div>
                  <div className="text-muted small">{previewEmployee.roleName || 'No role'} • {previewEmployee.employeeCode}</div>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  <EmployeeBadge value={previewEmployee.status} type="status" />
                  <EmployeeBadge value={previewEmployee.workLocation} type="workLocation" />
                </div>
              </div>
              <OverviewList items={getEmployeeOverviewItems(previewEmployee, previewEmployee.managerName || '—')} />
            </div>
          </div>
        ) : null}
      </ModalFrame>

      <MetadataEntryModal
        open={Boolean(metadataModal?.kind === 'metadata')}
        title={metadataModal?.mode === 'edit' ? 'Edit Metadata Entry' : 'Add Metadata Entry'}
        draft={metadataDraft}
        onChange={handleMetadataDraftChange}
        onClose={() => setMetadataModal(null)}
        onSubmit={handleSaveMetadata}
      />

      <RoleEntryModal
        open={Boolean(metadataModal?.kind === 'role')}
        title={metadataModal?.mode === 'edit' ? 'Edit Role Entry' : 'Add Role Entry'}
        draft={roleDraft}
        onChange={handleRoleDraftChange}
        onClose={() => setMetadataModal(null)}
        onSubmit={handleSaveMetadata}
        moduleGroups={roleModuleGroups}
        modulesLoading={roleModulesFetching}
        allModules={rolePermissionModules}
        isSaving={isRoleSaving}
        isSystemAdminRole={isEditingSystemAdminRole}
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
