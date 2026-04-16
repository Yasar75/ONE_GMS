import * as XLSX from 'xlsx'

export const EMPLOYEE_STORAGE_KEY = 'one_gms.admin.employees.directory'

export const EMPLOYEE_ATTENDANCE_OPTIONS = ['Present', 'Remote', 'On Leave', 'Half-Day', 'Absent']
export const EMPLOYEE_IMPORT_HEADERS = [
  'Employee Code',
  'First Name',
  'Last Name',
  'Email',
  'Country Code',
  'Phone',
  'Role',
  'Position',
  'Department',
  'Status',
  'Work Location',
  'Join Date',
  'Date Of Birth',
  'Gender',
  'Caste',
  'Employee Type',
  'Emergency Contact Country Code',
  'Emergency Contact',
  'Blood Group',
  'Address'
]
export const EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROWS = [
  [
    'EMP-2001',
    'Aarav',
    'Sharma',
    'aarav.sharma@example.com',
    '+91',
    '9876543210',
    'Admin',
    'Software Engineer',
    'Engineering',
    'Active',
    'Onsite',
    '2024-02-15',
    '1995-04-24',
    'Male',
    '',
    'FullTime',
    '+91',
    '9123456780',
    'B+',
    'Bangalore'
  ],
  [
    'EMP-2002',
    'Diya',
    'Patel',
    'diya.patel@example.com',
    '+971',
    '551234567',
    'Admin',
    'HR Executive',
    'Human Resources',
    'Active',
    'Hybrid',
    '15/02/2024',
    '33865',
    'Female',
    '',
    'FullTime',
    '+971',
    '501234567',
    'O+',
    'Mumbai'
  ]
]

const DEFAULT_PHONE_LOCAL_LENGTH_RULE = Object.freeze({ minLength: 6, maxLength: 15 })
const PHONE_COUNTRY_STORAGE_KEY = 'one_gms.phone_country_options.v1'
const PHONE_COUNTRY_API_URL = 'https://restcountries.com/v3.1/all?fields=name,cca2,idd'
const DEFAULT_PHONE_COUNTRY_OPTION = Object.freeze({
  countryCode: 'IN',
  label: 'India',
  dialCode: '+91',
  localMinLength: 10,
  localMaxLength: 10
})
const GENERIC_PHONE_LENGTH_RULE = Object.freeze({
  localMinLength: DEFAULT_PHONE_LOCAL_LENGTH_RULE.minLength,
  localMaxLength: DEFAULT_PHONE_LOCAL_LENGTH_RULE.maxLength
})

let phoneCountryOptionsCache = [DEFAULT_PHONE_COUNTRY_OPTION]

function sortPhoneCountryOptions(options = []) {
  return [...(Array.isArray(options) ? options : [])].sort((left, right) => {
    const leftIsIndia = String(left?.countryCode || '').toUpperCase() === 'IN'
    const rightIsIndia = String(right?.countryCode || '').toUpperCase() === 'IN'
    if (leftIsIndia !== rightIsIndia) return leftIsIndia ? -1 : 1

    const leftLabel = String(left?.label || '')
    const rightLabel = String(right?.label || '')
    const labelCompare = leftLabel.localeCompare(rightLabel)
    if (labelCompare !== 0) return labelCompare

    return String(left?.dialCode || '').localeCompare(String(right?.dialCode || ''))
  })
}

function normalizePhoneCountryOption(option = {}) {
  const countryCode = String(option.countryCode || '').trim().toUpperCase()
  const label = String(option.label || '').trim()
  const rawDialCode = String(option.dialCode || '').trim()
  const dialCode = rawDialCode.startsWith('+') ? rawDialCode : (rawDialCode ? `+${rawDialCode}` : '')

  if (!countryCode || !label || !dialCode || !/^\+\d+$/.test(dialCode)) return null

  const localMinLength = Number.parseInt(String(option.localMinLength ?? option.minLength ?? GENERIC_PHONE_LENGTH_RULE.localMinLength), 10)
  const localMaxLength = Number.parseInt(String(option.localMaxLength ?? option.maxLength ?? GENERIC_PHONE_LENGTH_RULE.localMaxLength), 10)

  return {
    countryCode,
    label,
    dialCode,
    localMinLength: Number.isFinite(localMinLength) ? localMinLength : GENERIC_PHONE_LENGTH_RULE.localMinLength,
    localMaxLength: Number.isFinite(localMaxLength) ? Math.max(localMaxLength, localMinLength || 0) : GENERIC_PHONE_LENGTH_RULE.localMaxLength
  }
}

function dedupePhoneCountryOptions(options = []) {
  const seen = new Set()

  return sortPhoneCountryOptions((Array.isArray(options) ? options : [])
    .map((option) => normalizePhoneCountryOption(option))
    .filter(Boolean)
    .filter((option) => {
      const key = `${option.countryCode}:${option.dialCode}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }))
}

function readStoredPhoneCountryOptions() {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(PHONE_COUNTRY_STORAGE_KEY)
    if (!storedValue) return []
    const parsedValue = JSON.parse(storedValue)
    return dedupePhoneCountryOptions(parsedValue)
  } catch {
    return []
  }
}

function writeStoredPhoneCountryOptions(options = []) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(PHONE_COUNTRY_STORAGE_KEY, JSON.stringify(options))
  } catch {
    // Ignore storage write failures and continue with in-memory cache.
  }
}

function updatePhoneCountryOptionsCache(options = []) {
  const normalizedOptions = dedupePhoneCountryOptions(options)
  phoneCountryOptionsCache = normalizedOptions.length ? normalizedOptions : [DEFAULT_PHONE_COUNTRY_OPTION]
  writeStoredPhoneCountryOptions(phoneCountryOptionsCache)
  return phoneCountryOptionsCache
}

function createPhoneCountryOptionsFromApi(records = []) {
  const mappedOptions = (Array.isArray(records) ? records : []).flatMap((record) => {
    const countryCode = String(record?.cca2 || '').trim().toUpperCase()
    const label = String(record?.name?.common || record?.name?.official || '').trim()
    const root = String(record?.idd?.root || '').trim()
    const suffixes = Array.isArray(record?.idd?.suffixes) ? record.idd.suffixes : []
    if (!countryCode || !label || !root || !suffixes.length) return []

    return suffixes
      .map((suffix) => String(suffix || '').trim())
      .filter(Boolean)
      .map((suffix) => ({
        countryCode,
        label,
        dialCode: `${root}${suffix}`,
        ...(countryCode === 'IN' ? DEFAULT_PHONE_COUNTRY_OPTION : GENERIC_PHONE_LENGTH_RULE)
      }))
  })

  return dedupePhoneCountryOptions(mappedOptions)
}

export function getPhoneCountryOptions() {
  if (!phoneCountryOptionsCache.length) {
    const storedOptions = readStoredPhoneCountryOptions()
    if (storedOptions.length) {
      phoneCountryOptionsCache = storedOptions
    } else {
      phoneCountryOptionsCache = [DEFAULT_PHONE_COUNTRY_OPTION]
    }
  }

  return phoneCountryOptionsCache
}

export async function fetchPhoneCountryOptions() {
  const cachedOptions = readStoredPhoneCountryOptions()
  if (cachedOptions.length) {
    phoneCountryOptionsCache = cachedOptions
  }

  try {
    const response = await fetch(PHONE_COUNTRY_API_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`Country code request failed with status ${response.status}`)

    const data = await response.json()
    const nextOptions = createPhoneCountryOptionsFromApi(data)
    if (nextOptions.length) {
      return updatePhoneCountryOptionsCache(nextOptions)
    }
  } catch {
    // Keep the app functional with cached values or the India-first fallback.
  }

  if (cachedOptions.length) return cachedOptions
  return updatePhoneCountryOptionsCache([DEFAULT_PHONE_COUNTRY_OPTION])
}

function sortMetadataEntries(entries = []) {
  return [...(Array.isArray(entries) ? entries : [])].sort((left, right) => {
    const leftOrder = Number(left?.sortOrder ?? left?.sort_order ?? 0)
    const rightOrder = Number(right?.sortOrder ?? right?.sort_order ?? 0)
    if (leftOrder !== rightOrder) return leftOrder - rightOrder

    const leftLabel = String(left?.label || left?.value || '')
    const rightLabel = String(right?.label || right?.value || '')
    return leftLabel.localeCompare(rightLabel)
  })
}

function normalizeMetadataLookupValue(value = '') {
  return String(value || '').trim().toLowerCase()
}

export function buildEmployeeMetadataCatalog(metadataEntries = []) {
  const activeEntries = (Array.isArray(metadataEntries) ? metadataEntries : [])
    .filter((entry) => entry?.category && entry?.isActive !== false)

  const byCategory = activeEntries.reduce((accumulator, entry) => {
    const categoryKey = String(entry.category || '')
    accumulator[categoryKey] = accumulator[categoryKey] || []
    accumulator[categoryKey].push(entry)
    return accumulator
  }, {})

  Object.keys(byCategory).forEach((categoryKey) => {
    byCategory[categoryKey] = sortMetadataEntries(byCategory[categoryKey])
  })

  const departmentEntries = byCategory.department || []
  const positionEntries = byCategory.position || []
  const departmentEntryByValue = new Map(departmentEntries.map((entry) => [String(entry.value || ''), entry]))
  const departmentEntryByUid = new Map(departmentEntries.map((entry) => [String(entry.uid || ''), entry]))
  const departmentLabelByUid = new Map(departmentEntries.map((entry) => [String(entry.uid || ''), entry.label || entry.value || '']))
  const positionEntryByValue = new Map(positionEntries.map((entry) => [String(entry.value || ''), entry]))
  const positionEntriesByDepartmentUid = positionEntries.reduce((accumulator, entry) => {
    const departmentUid = String(entry.departmentUid || '')
    const bucket = accumulator.get(departmentUid) || []
    bucket.push(entry)
    accumulator.set(departmentUid, bucket)
    return accumulator
  }, new Map())

  positionEntriesByDepartmentUid.forEach((entries, departmentUid) => {
    positionEntriesByDepartmentUid.set(departmentUid, sortMetadataEntries(entries))
  })

  const lookupByCategory = Object.entries(byCategory).reduce((accumulator, [categoryKey, entries]) => {
    accumulator[categoryKey] = new Map()
    entries.forEach((entry) => {
      const displayLabel = String(entry.label || entry.value || '')
      const normalizedValueKey = normalizeMetadataLookupValue(entry.value)
      const normalizedLabelKey = normalizeMetadataLookupValue(displayLabel)
      if (normalizedValueKey) accumulator[categoryKey].set(normalizedValueKey, entry)
      if (normalizedLabelKey) accumulator[categoryKey].set(normalizedLabelKey, entry)
    })
    return accumulator
  }, {})

  const labelMaps = Object.entries(byCategory).reduce((accumulator, [categoryKey, entries]) => {
    accumulator[categoryKey] = new Map(entries.map((entry) => [String(entry.value || ''), entry.label || entry.value || '']))
    return accumulator
  }, {})

  return {
    byCategory,
    departmentEntries,
    positionEntries,
    departmentEntryByValue,
    departmentEntryByUid,
    departmentLabelByUid,
    positionEntryByValue,
    positionEntriesByDepartmentUid,
    lookupByCategory,
    labelMaps
  }
}

export function buildMetadataOptions(entries = [], currentValue = '') {
  const options = sortMetadataEntries(entries).map((entry) => ({
    value: entry.value,
    label: entry.label || entry.value || '',
    description: entry.description || ''
  }))

  const normalizedCurrentValue = String(currentValue || '').trim()
  if (normalizedCurrentValue && !options.some((option) => String(option.value) === normalizedCurrentValue)) {
    options.push({
      value: normalizedCurrentValue,
      label: normalizedCurrentValue,
      description: 'Current saved value'
    })
  }

  return options
}

export function buildDepartmentScopedPositionOptions(catalog = {}, departmentValue = '', currentValue = '') {
  const normalizedDepartmentValue = String(departmentValue || '').trim()
  const departmentEntry = catalog.departmentEntryByValue?.get(normalizedDepartmentValue)
  const scopedEntries = departmentEntry
    ? (catalog.positionEntriesByDepartmentUid?.get(String(departmentEntry.uid || '')) || [])
    : []

  return buildMetadataOptions(scopedEntries, currentValue)
}

export function isPositionMappedToDepartment(catalog = {}, positionValue = '', departmentValue = '') {
  const normalizedPositionValue = String(positionValue || '').trim()
  if (!normalizedPositionValue) return true

  const positionEntry = catalog.positionEntryByValue?.get(normalizedPositionValue)
  const departmentEntry = catalog.departmentEntryByValue?.get(String(departmentValue || '').trim())
  if (!positionEntry || !departmentEntry || !positionEntry.departmentUid) return false

  return String(positionEntry.departmentUid) === String(departmentEntry.uid)
}

export function getMetadataDisplayLabel(catalog = {}, category = '', value = '') {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return ''
  return catalog.labelMaps?.[category]?.get(normalizedValue) || normalizedValue
}

export function findMetadataEntryByInput(catalog = {}, category = '', input = '') {
  const normalizedInput = normalizeMetadataLookupValue(input)
  if (!normalizedInput) return null
  return catalog.lookupByCategory?.[category]?.get(normalizedInput) || null
}

export function findPhoneCountryOptionByInput(value = '') {
  const rawValue = String(value || '').trim()
  if (!rawValue) return null

  const normalizedLabel = rawValue.toLowerCase()
  const normalizedDigits = rawValue.replace(/[^\d+]/g, '')
  const normalizedDigitsWithoutPlus = normalizedDigits.replace(/^\+/, '')
  const normalizedCountryCode = rawValue.toUpperCase()

  return getPhoneCountryOptions().find((option) => (
    option.dialCode === normalizedDigits
    || option.dialCode.replace(/^\+/, '') === normalizedDigitsWithoutPlus
    || option.countryCode === normalizedCountryCode
    || String(option.label || '').toLowerCase() === normalizedLabel
  )) || null
}

export function normalizeEmployee(record) {
  if (!record) return null

  const firstName = record.first_name || record.firstName || ''
  const lastName = record.last_name || record.lastName || ''
  const fullName = record.fullName || [firstName, lastName].filter(Boolean).join(' ').trim()
  const employeeCode = record.employee_code || record.employeeCode || record.id || record.uid || `EMP-${Math.floor(Math.random() * 10000)}`

  return {
    uid: record.uid || record.employee_uid || null,
    userUid: record.user_uid || record.userUid || null,
    id: employeeCode,
    employeeCode,
    fullName,
    firstName: firstName || splitFullName(fullName).firstName,
    lastName: lastName || splitFullName(fullName).lastName,
    position: record.position || '',
    department: record.department || '',
    email: record.email || '',
    clientEmail: record.client_email || record.clientEmail || '',
    phone: record.phone || '',
    joinDate: normalizeDateInput(record.joinDate || record.join_date || ''),
    status: record.status || '',
    attendanceStatus: normalizeAttendanceLabel(record.attendanceStatus || record.attendance_status || record.attendance || record.latest_attendance_status || inferAttendanceFromWorkLocation(record.work_location)),
    dateOfBirth: normalizeDateInput(record.dateOfBirth || record.birth_date || ''),
    address: record.address || '',
    gender: record.gender || '',
    caste: record.caste || '',
    createdAt: record.createdAt || record.created_at || new Date().toISOString(),
    updatedAt: record.updatedAt || record.updated_at || new Date().toISOString(),
    workLocation: record.work_location || record.workLocation || '',
    emergencyContact: record.emergency_contact || record.emergencyContact || '',
    bloodGroup: record.blood_group || record.bloodGroup || '',
    employeeType: record.employee_type || record.employeeType || '',
    managerEmployeeUid: record.manager_employee_uid ? String(record.manager_employee_uid) : (record.managerEmployeeUid ? String(record.managerEmployeeUid) : ''),
    hrEmployeeUid: record.hr_employee_uid ? String(record.hr_employee_uid) : (record.hrEmployeeUid ? String(record.hrEmployeeUid) : ''),
    teamLeadEmployeeUid: record.team_lead_employee_uid ? String(record.team_lead_employee_uid) : (record.teamLeadEmployeeUid ? String(record.teamLeadEmployeeUid) : ''),
    coordinatorEmployeeUid: record.coordinator_employee_uid ? String(record.coordinator_employee_uid) : (record.coordinatorEmployeeUid ? String(record.coordinatorEmployeeUid) : ''),
    roleType: record.role_type || record.roleType || null,
    roleName: record.role_name || record.roleName || ''
  }
}

export function sortEmployees(records = []) {
  return [...records].sort((left, right) => String(left.fullName || left.employeeCode).localeCompare(String(right.fullName || right.employeeCode)))
}

export function buildEmployeePayload(values, existingRecord = {}) {
  const now = new Date().toISOString()
  const derivedNames = splitFullName(values.fullName || [values.firstName, values.lastName].filter(Boolean).join(' '))
  const firstName = values.firstName || derivedNames.firstName
  const lastName = values.lastName || derivedNames.lastName
  const employeeCode = values.employeeCode || existingRecord.employeeCode || values.id || existingRecord.id || generateEmployeeId()
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  return normalizeEmployee({
    ...existingRecord,
    ...values,
    uid: existingRecord.uid || values.uid || null,
    employee_code: employeeCode,
    employeeCode,
    id: employeeCode,
    fullName,
    first_name: firstName,
    firstName,
    last_name: lastName,
    lastName,
    createdAt: existingRecord.createdAt || values.createdAt || now,
    updatedAt: now
  })
}

export function generateEmployeeId() {
  const value = Math.floor(1000 + Math.random() * 9000)
  return `EMP-${value}`
}

export function getEmployeeOverviewItems(employee, managerLabel = '—') {
  return [
    { label: 'Employee Code', value: employee.employeeCode || employee.id },
    { label: 'First Name', value: employee.firstName || '—' },
    { label: 'Last Name', value: employee.lastName || '—' },
    { label: 'Personal Email', value: employee.email || '—' },
    { label: 'Client Email', value: employee.clientEmail || '—' },
    { label: 'Role', value: employee.roleName || '—' },
    { label: 'Position', value: employee.position || '—' },
    { label: 'Department', value: employee.department || '—' },
    { label: 'Phone', value: employee.phone || '—' },
    { label: 'Join Date', value: formatDate(employee.joinDate) },
    { label: 'Status', value: employee.status || '—' },
    { label: 'Attendance', value: employee.attendanceStatus || '—' },
    { label: 'Age', value: formatEmployeeAge(employee.dateOfBirth) },
    { label: 'Date of Birth', value: formatDate(employee.dateOfBirth) },
    { label: 'Gender', value: employee.gender || '—' },
    { label: 'Caste', value: employee.caste || '—' },
    { label: 'Blood Group', value: employee.bloodGroup || '—' },
    { label: 'Employee Type', value: employee.employeeType || '—' },
    { label: 'Work Location', value: employee.workLocation || '—' },
    { label: 'Manager', value: managerLabel || '—' },
    { label: 'HR', value: employee.hrEmployeeName || '—' },
    { label: 'Team Lead', value: employee.teamLeadName || '—' },
    { label: 'Coordinator', value: employee.coordinatorName || '—' },
    { label: 'Emergency Contact', value: employee.emergencyContact || '—' },
    { label: 'Address', value: employee.address || '—' }
  ]
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function getEmployeeAge(dateOfBirth) {
  if (!dateOfBirth) return null

  const birthDate = new Date(dateOfBirth)
  if (Number.isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age >= 0 ? age : null
}

export function formatEmployeeAge(dateOfBirth) {
  const age = getEmployeeAge(dateOfBirth)
  return Number.isFinite(age) ? `${age} yrs` : '—'
}

export function normalizeAttendanceLabel(value) {
  const raw = String(value || '').trim().toLowerCase()

  if (!raw) return 'Present'
  if (['leave', 'on leave', 'on_leave'].includes(raw)) return 'On Leave'
  if (['halfday', 'half-day', 'half day'].includes(raw)) return 'Half-Day'
  if (['remote', 'wfh', 'work from home'].includes(raw)) return 'Remote'
  if (['absent'].includes(raw)) return 'Absent'
  return raw === 'present' ? 'Present' : toTitleCase(raw)
}

export function inferAttendanceFromWorkLocation(workLocation) {
  const raw = String(workLocation || '').trim().toLowerCase()
  return raw === 'remote' ? 'Remote' : 'Present'
}

export function mergeEmployeesWithAttendance(employeeRecords = [], attendanceRecords = []) {
  const latestAttendanceByEmployee = new Map()

  attendanceRecords.forEach((attendance) => {
    const employeeUid = String(attendance.employee_uid || attendance.employeeUid || '')
    if (!employeeUid) return

    const nextTimestamp = Date.parse(attendance.attendanceDate || attendance.attendance_date || attendance.att_date || attendance.attDate || '') || 0
    const current = latestAttendanceByEmployee.get(employeeUid)
    const currentTimestamp = current ? (Date.parse(current.attendanceDate || current.attendance_date || current.att_date || current.attDate || '') || 0) : -1

    if (!current || nextTimestamp >= currentTimestamp) {
      latestAttendanceByEmployee.set(employeeUid, attendance)
    }
  })

  return employeeRecords.map((record) => {
    const uid = String(record.uid || '')
    const latestAttendance = latestAttendanceByEmployee.get(uid)

    return normalizeEmployee({
      ...record,
      latest_attendance_status: latestAttendance ? mapAttendanceApiStatus(latestAttendance.status) : undefined
    })
  })
}

export function mapAttendanceApiStatus(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'leave') return 'On Leave'
  if (raw === 'halfday') return 'Half-Day'
  if (raw === 'pendingregularization') return 'Pending Regularization'
  if (raw === 'present') return 'Present'
  if (raw === 'absent') return 'Absent'
  return normalizeAttendanceLabel(raw)
}

export function toEmployeeApiPayload(employee) {
  const { firstName, lastName } = splitFullName(employee.fullName)

  return {
    employee_code: toNullableString(employee.employeeCode || employee.id) || generateEmployeeId(),
    first_name: toNullableString(employee.firstName || firstName) || 'Employee',
    last_name: toNullableString(employee.lastName || lastName) || '',
    position: toNullableString(employee.position),
    department: toNullableString(employee.department),
    email: toNullableString(employee.email),
    client_email: toNullableString(employee.clientEmail),
    phone: toNullablePhone(employee.phone),
    join_date: toNullableString(normalizeDateInput(employee.joinDate)),
    status: toNullableString(employee.status),
    birth_date: toNullableString(normalizeDateInput(employee.dateOfBirth)),
    address: toNullableString(employee.address),
    gender: toNullableString(employee.gender),
    caste: toNullableString(employee.caste),
    emergency_contact: toNullableString(employee.emergencyContact),
    blood_group: toNullableString(employee.bloodGroup),
    employee_type: toNullableString(employee.employeeType),
    work_location: toNullableString(employee.workLocation) || (employee.attendanceStatus === 'Remote' ? 'Remote' : 'Onsite'),
    manager_employee_uid: toNullableString(employee.managerEmployeeUid),
    hr_employee_uid: toNullableString(employee.hrEmployeeUid),
    team_lead_employee_uid: toNullableString(employee.teamLeadEmployeeUid),
    coordinator_employee_uid: toNullableString(employee.coordinatorEmployeeUid),
    role_type: toNullableString(employee.roleType)
  }
}

export function splitFullName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  }
}

export function getAttendanceOptions(records = []) {
  const dynamicValues = records.map((employee) => employee.attendanceStatus).filter(Boolean)
  return Array.from(new Set([...EMPLOYEE_ATTENDANCE_OPTIONS, ...dynamicValues]))
}

export function getWorkLocationOptions(records = []) {
  const dynamicValues = records.map((employee) => employee.workLocation).filter(Boolean)
  return Array.from(new Set(dynamicValues))
}


export function getStatusOptions(records = []) {
  const dynamicValues = records.map((employee) => employee.status).filter(Boolean)
  return Array.from(new Set(dynamicValues))
}

export function getPhoneCountryOption(dialCode) {
  const options = getPhoneCountryOptions()
  return options.find((option) => option.dialCode === dialCode) || options[0] || DEFAULT_PHONE_COUNTRY_OPTION
}

export function getPhoneCountryLengthRule(dialCode) {
  const option = getPhoneCountryOption(dialCode)
  const minLength = Number.isInteger(option.localMinLength) ? option.localMinLength : DEFAULT_PHONE_LOCAL_LENGTH_RULE.minLength
  const maxLength = Number.isInteger(option.localMaxLength) ? option.localMaxLength : DEFAULT_PHONE_LOCAL_LENGTH_RULE.maxLength

  return {
    ...option,
    minLength,
    maxLength,
    isExactLength: minLength === maxLength
  }
}

export function formatPhoneLengthRule(ruleOrDialCode) {
  const rule = typeof ruleOrDialCode === 'string' ? getPhoneCountryLengthRule(ruleOrDialCode) : ruleOrDialCode
  if (!rule) return `${DEFAULT_PHONE_LOCAL_LENGTH_RULE.minLength} to ${DEFAULT_PHONE_LOCAL_LENGTH_RULE.maxLength} digits`
  return rule.isExactLength ? `${rule.minLength} digits` : `${rule.minLength} to ${rule.maxLength} digits`
}


export function buildPhoneCountrySelectOptions(options = []) {
  const groupedOptions = new Map()

  ;(Array.isArray(options) ? options : []).forEach((option, index) => {
    const normalizedOption = normalizePhoneCountryOption(option)
    if (!normalizedOption) return

    const current = groupedOptions.get(normalizedOption.dialCode) || {
      value: normalizedOption.dialCode,
      label: normalizedOption.dialCode,
      dialCode: normalizedOption.dialCode,
      minLength: normalizedOption.localMinLength,
      maxLength: normalizedOption.localMaxLength,
      countries: [],
      countryCodes: [],
      firstIndex: index
    }

    current.minLength = Math.min(current.minLength, normalizedOption.localMinLength)
    current.maxLength = Math.max(current.maxLength, normalizedOption.localMaxLength)

    if (!current.countries.includes(normalizedOption.label)) current.countries.push(normalizedOption.label)
    if (!current.countryCodes.includes(normalizedOption.countryCode)) current.countryCodes.push(normalizedOption.countryCode)

    groupedOptions.set(normalizedOption.dialCode, current)
  })

  return [...groupedOptions.values()]
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map((option) => {
      const countrySummary = option.countries.length <= 2
        ? option.countries.join(' / ')
        : `${option.countries[0]} +${option.countries.length - 1} more`
      const lengthRule = formatPhoneLengthRule({
        minLength: option.minLength,
        maxLength: option.maxLength,
        isExactLength: option.minLength === option.maxLength
      })

      return {
        value: option.value,
        label: option.label,
        description: `${countrySummary} - ${lengthRule}`,
        searchText: `${option.dialCode} ${option.countries.join(' ')} ${option.countryCodes.join(' ')} ${lengthRule}`,
        key: `dial-code-${option.dialCode}`
      }
    })
}

export function getDefaultPhoneCountryOption() {
  const options = getPhoneCountryOptions()
  const fallback = options[0] || DEFAULT_PHONE_COUNTRY_OPTION
  return options.find((option) => option.countryCode === DEFAULT_PHONE_COUNTRY_OPTION.countryCode) || fallback
}

export function parseStoredPhoneValue(phone) {
  const raw = String(phone || '').trim()
  if (!raw) {
    const fallback = getDefaultPhoneCountryOption()
    return { countryDialCode: fallback.dialCode, localNumber: '' }
  }

  const normalized = raw.replace(/[^\d+]/g, '')
  const matched = [...getPhoneCountryOptions()]
    .sort((left, right) => right.dialCode.length - left.dialCode.length)
    .find((option) => normalized.startsWith(option.dialCode))

  if (!matched) {
    const fallback = getDefaultPhoneCountryOption()
    return { countryDialCode: fallback.dialCode, localNumber: normalized.replace(/\D/g, '') }
  }

  return {
    countryDialCode: matched.dialCode,
    localNumber: normalized.slice(matched.dialCode.length).replace(/\D/g, '')
  }
}

export function buildPhoneValue(countryDialCode, localNumber) {
  const digits = String(localNumber || '').replace(/\D/g, '')
  if (!digits) return ''
  return `${countryDialCode}${digits}`
}

export function normalizeDateInput(value) {
  if (value === null || value === undefined || value === '') return ''

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : toIsoDateString(value)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const numericDate = excelSerialToIsoDate(value)
    if (numericDate) return numericDate
  }

  const raw = String(value).trim()
  if (!raw) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw
  }

  if (/^\d+(\.\d+)?$/.test(raw)) {
    const serialDate = excelSerialToIsoDate(raw)
    if (serialDate) return serialDate
  }

  const ymdMatch = raw.match(/^(\d{4})[\/.\- ](\d{1,2})[\/.\- ](\d{1,2})$/)
  if (ymdMatch) {
    const ymdValue = buildIsoDateFromParts(
      Number(ymdMatch[1]),
      Number(ymdMatch[2]),
      Number(ymdMatch[3])
    )
    if (ymdValue) return ymdValue
  }

  const dmyOrMdyMatch = raw.match(/^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/)
  if (dmyOrMdyMatch) {
    const first = Number(dmyOrMdyMatch[1])
    const second = Number(dmyOrMdyMatch[2])
    const normalizedYear = normalizeTwoDigitYear(Number(dmyOrMdyMatch[3]))

    const dayFirstValue = buildIsoDateFromParts(normalizedYear, second, first)
    const monthFirstValue = buildIsoDateFromParts(normalizedYear, first, second)

    if (first > 12 && dayFirstValue) return dayFirstValue
    if (second > 12 && monthFirstValue) return monthFirstValue
    if (dayFirstValue) return dayFirstValue
    if (monthFirstValue) return monthFirstValue
  }

  const date = new Date(raw)
  if (!Number.isNaN(date.getTime())) {
    return toIsoDateString(date)
  }

  return raw
}

export function isIsoDateInput(value) {
  const raw = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false

  const [year, month, day] = raw.split('-').map((part) => Number(part))
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day
}

function getEmployeeExportDisplay(employee = {}) {
  return {
    role: employee.roleName || employee.roleLabel || '',
    position: employee.positionLabel || employee.position || '',
    department: employee.departmentLabel || employee.department || '',
    status: employee.statusLabel || employee.status || '',
    gender: employee.genderLabel || employee.gender || '',
    employeeType: employee.employeeTypeLabel || employee.employeeType || '',
    workLocation: employee.workLocationLabel || employee.workLocation || '',
    bloodGroup: employee.bloodGroupLabel || employee.bloodGroup || ''
  }
}

export function downloadEmployeesAsCsv(records) {
  const headers = ['Employee Code', 'First Name', 'Last Name', 'Role', 'Position', 'Department', 'Personal Email', 'Client Email', 'Phone', 'Join Date', 'Status', 'Date Of Birth', 'Gender', 'Caste', 'Employee Type', 'Work Location', 'Emergency Contact', 'Blood Group', 'Address']
  const rows = records.map((employee) => {
    const display = getEmployeeExportDisplay(employee)
    return [
      employee.employeeCode || employee.id,
      employee.firstName,
      employee.lastName,
      display.role,
      display.position,
      display.department,
      employee.email,
      employee.clientEmail,
      employee.phone,
      employee.joinDate,
      display.status,
      employee.dateOfBirth,
      display.gender,
      employee.caste,
      display.employeeType,
      display.workLocation,
      employee.emergencyContact,
      display.bloodGroup,
      employee.address
    ]
  })

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `employees-directory-${Date.now()}.csv`)
}

export function downloadEmployeesAsExcel(records) {
  const header = ['Employee Code', 'First Name', 'Last Name', 'Role', 'Position', 'Department', 'Personal Email', 'Client Email', 'Phone', 'Join Date', 'Status', 'Date Of Birth', 'Gender', 'Caste', 'Employee Type', 'Work Location', 'Emergency Contact', 'Blood Group', 'Address']
  const rows = records.map((employee) => {
    const display = getEmployeeExportDisplay(employee)
    return ([
      employee.employeeCode || employee.id || '',
      employee.firstName || '',
      employee.lastName || '',
      display.role,
      display.position,
      display.department,
      employee.email || '',
      employee.clientEmail || '',
      employee.phone || '',
      employee.joinDate || '',
      display.status,
      employee.dateOfBirth || '',
      display.gender,
      employee.caste || '',
      display.employeeType,
      display.workLocation,
      employee.emergencyContact || '',
      display.bloodGroup,
      employee.address || ''
    ])
  })

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees Directory')

  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `employees-directory-${Date.now()}.xlsx`)
}


export function downloadEmployeeImportTemplateCsv() {
  const csvRows = [EMPLOYEE_IMPORT_HEADERS, ...EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROWS]
  const csvContent = csvRows
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([`${csvContent}\n`], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, 'employees-import-template.csv')
}

export function downloadEmployeeImportTemplateExcel() {
  const worksheetRows = [EMPLOYEE_IMPORT_HEADERS, ...EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROWS]
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows)
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees Import')

  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, 'employees-import-template.xlsx')
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function toTitleCase(value) {
  return String(value)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toNullableString(value) {
  const normalized = String(value ?? '').trim()
  return normalized ? normalized : null
}

function toNullablePhone(value) {
  const normalized = String(value ?? '').replace(/[^\d+]/g, '')
  return normalized ? normalized : null
}

function toIsoDateString(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildIsoDateFromParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return ''
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''

  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return ''
  return toIsoDateString(date)
}

function normalizeTwoDigitYear(year) {
  if (!Number.isInteger(year)) return year
  if (year >= 100) return year
  return year >= 70 ? 1900 + year : 2000 + year
}

function excelSerialToIsoDate(value) {
  const serial = Number(value)
  if (!Number.isFinite(serial)) return ''
  if (serial < 20000 || serial > 80000) return ''

  const days = Math.floor(serial)
  const excelEpochUtc = Date.UTC(1899, 11, 30)
  const date = new Date(excelEpochUtc + (days * 24 * 60 * 60 * 1000))
  return Number.isNaN(date.getTime()) ? '' : toIsoDateString(date)
}
