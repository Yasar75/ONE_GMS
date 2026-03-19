export const EMPLOYEE_STORAGE_KEY = 'one_gms.admin.employees.directory'

export const EMPLOYEE_POSITION_OPTIONS = []
export const EMPLOYEE_DEPARTMENT_OPTIONS = []
export const EMPLOYEE_STATUS_OPTIONS = ['Active', 'Inactive', 'Resigned', 'Terminated']
export const EMPLOYEE_TYPE_OPTIONS = ['FullTime', 'PartTime', 'Contract', 'Intern']
export const EMPLOYEE_WORK_LOCATION_OPTIONS = ['Onsite', 'Remote', 'Hybrid']
export const EMPLOYEE_GENDER_OPTIONS = ['Male', 'Female', 'Others']
export const EMPLOYEE_BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const EMPLOYEE_ATTENDANCE_OPTIONS = ['Present', 'Remote', 'On Leave', 'Half-Day', 'Absent']

export const PHONE_COUNTRY_OPTIONS = [
  { countryCode: 'IN', label: 'India', dialCode: '+91' },
  { countryCode: 'AE', label: 'UAE', dialCode: '+971' },
  { countryCode: 'SA', label: 'Saudi Arabia', dialCode: '+966' },
  { countryCode: 'US', label: 'United States', dialCode: '+1' },
  { countryCode: 'CA', label: 'Canada', dialCode: '+1' },
  { countryCode: 'GB', label: 'United Kingdom', dialCode: '+44' },
  { countryCode: 'AU', label: 'Australia', dialCode: '+61' },
  { countryCode: 'SG', label: 'Singapore', dialCode: '+65' },
  { countryCode: 'MY', label: 'Malaysia', dialCode: '+60' },
  { countryCode: 'DE', label: 'Germany', dialCode: '+49' },
  { countryCode: 'FR', label: 'France', dialCode: '+33' },
  { countryCode: 'ZA', label: 'South Africa', dialCode: '+27' }
]

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
    phone: record.phone || '',
    joinDate: normalizeDateInput(record.joinDate || record.join_date || ''),
    status: record.status || 'Active',
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
    { label: 'Role', value: employee.roleName || employee.roleType || '—' },
    { label: 'Position', value: employee.position || '—' },
    { label: 'Department', value: employee.department || '—' },
    { label: 'Email', value: employee.email || '—' },
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
    { label: 'Manager', value: managerLabel || employee.managerEmployeeUid || '—' },
    { label: 'HR', value: employee.hrEmployeeName || employee.hrEmployeeUid || '—' },
    { label: 'Team Lead', value: employee.teamLeadName || employee.teamLeadEmployeeUid || '—' },
    { label: 'Coordinator', value: employee.coordinatorName || employee.coordinatorEmployeeUid || '—' },
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
    phone: toNullablePhone(employee.phone),
    join_date: toNullableString(normalizeDateInput(employee.joinDate)),
    status: toNullableString(employee.status) || 'Active',
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
  return Array.from(new Set([...EMPLOYEE_WORK_LOCATION_OPTIONS, ...dynamicValues]))
}


export function getStatusOptions(records = []) {
  const dynamicValues = records.map((employee) => employee.status).filter(Boolean)
  return Array.from(new Set([...EMPLOYEE_STATUS_OPTIONS, ...dynamicValues]))
}

export function getPhoneCountryOption(dialCode) {
  return PHONE_COUNTRY_OPTIONS.find((option) => option.dialCode === dialCode) || PHONE_COUNTRY_OPTIONS[0]
}

export function getDefaultPhoneCountryOption() {
  const fallback = PHONE_COUNTRY_OPTIONS[0]
  if (typeof navigator === 'undefined') return fallback

  const locale = String(navigator.language || '').toUpperCase()
  const countryCode = locale.includes('-') ? locale.split('-')[1] : ''
  return PHONE_COUNTRY_OPTIONS.find((option) => option.countryCode === countryCode) || fallback
}

export function parseStoredPhoneValue(phone) {
  const raw = String(phone || '').trim()
  if (!raw) {
    const fallback = getDefaultPhoneCountryOption()
    return { countryDialCode: fallback.dialCode, localNumber: '' }
  }

  const normalized = raw.replace(/[^\d+]/g, '')
  const matched = [...PHONE_COUNTRY_OPTIONS]
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
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value)

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function downloadEmployeesAsCsv(records) {
  const headers = ['Employee Code', 'First Name', 'Last Name', 'Role', 'Position', 'Department', 'Email', 'Phone', 'Join Date', 'Status', 'Date Of Birth', 'Gender', 'Caste', 'Employee Type', 'Work Location', 'Emergency Contact', 'Blood Group', 'Address']
  const rows = records.map((employee) => [
    employee.employeeCode || employee.id,
    employee.firstName,
    employee.lastName,
    employee.roleName || employee.roleType || '',
    employee.position,
    employee.department,
    employee.email,
    employee.phone,
    employee.joinDate,
    employee.status,
    employee.dateOfBirth,
    employee.gender,
    employee.caste,
    employee.employeeType,
    employee.workLocation,
    employee.emergencyContact,
    employee.bloodGroup,
    employee.address
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `employees-directory-${Date.now()}.csv`)
}

export function downloadEmployeesAsExcel(records) {
  const header = ['Employee Code', 'First Name', 'Last Name', 'Role', 'Position', 'Department', 'Email', 'Phone', 'Join Date', 'Status', 'Date Of Birth', 'Gender', 'Caste', 'Employee Type', 'Work Location', 'Emergency Contact', 'Blood Group', 'Address']
  const rows = records.map((employee) => `
    <tr>
      <td>${escapeHtml(employee.employeeCode || employee.id)}</td>
      <td>${escapeHtml(employee.firstName)}</td>
      <td>${escapeHtml(employee.lastName)}</td>
      <td>${escapeHtml(employee.roleName || employee.roleType)}</td>
      <td>${escapeHtml(employee.position)}</td>
      <td>${escapeHtml(employee.department)}</td>
      <td>${escapeHtml(employee.email)}</td>
      <td>${escapeHtml(employee.phone)}</td>
      <td>${escapeHtml(employee.joinDate)}</td>
      <td>${escapeHtml(employee.status)}</td>
      <td>${escapeHtml(employee.dateOfBirth)}</td>
      <td>${escapeHtml(employee.gender)}</td>
      <td>${escapeHtml(employee.caste)}</td>
      <td>${escapeHtml(employee.employeeType)}</td>
      <td>${escapeHtml(employee.workLocation)}</td>
      <td>${escapeHtml(employee.emergencyContact)}</td>
      <td>${escapeHtml(employee.bloodGroup)}</td>
      <td>${escapeHtml(employee.address)}</td>
    </tr>
  `).join('')

  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${header.map((value) => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  downloadBlob(blob, `employees-directory-${Date.now()}.xls`)
}


export function downloadEmployeeImportTemplateCsv() {
  const headers = [
    'Employee Code',
    'First Name',
    'Last Name',
    'Email',
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
    'Emergency Contact',
    'Blood Group',
    'Address'
  ]

  const csvContent = headers.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')
  const blob = new Blob([`${csvContent}
`], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, 'employees-import-template.csv')
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
