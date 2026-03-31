const HOLIDAY_META_MARKER = /\[(scope|color|audience|start|end|allday|source):([^\]]+)\]\s*/gi

const HOLIDAY_SCOPE_META = {
  international: { label: 'International holiday', tone: 'international', color: '#2563eb' },
  regional: { label: 'Regional holiday', tone: 'regional', color: '#7c3aed' },
  company: { label: 'Company holiday', tone: 'company', color: '#d97706' },
  restricted: { label: 'Restricted holiday', tone: 'restricted', color: '#ea580c' },
  birthday: { label: 'Birthday', tone: 'birthday', color: '#db2777' },
  work_anniversary: { label: 'Anniversary', tone: 'work-anniversary', color: '#059669' },
  meeting: { label: 'Meeting', tone: 'meeting', color: '#0891b2' },
  task: { label: 'Task', tone: 'task', color: '#475569' },
  custom: { label: 'Custom Event', tone: 'custom', color: '#0284c7' }
}

function parseHolidayMeta(rawDescription = '') {
  const meta = {}
  let match
  while ((match = HOLIDAY_META_MARKER.exec(rawDescription)) !== null) {
    const [, key, rawValue] = match
    const normalizedKey = String(key || '').toLowerCase()
    meta[normalizedKey] = String(rawValue || '').trim()
  }
  HOLIDAY_META_MARKER.lastIndex = 0
  return meta
}

function stripHolidayMeta(rawDescription = '') {
  return String(rawDescription || '').replace(HOLIDAY_META_MARKER, '').trim()
}

export function normalizeHoliday(record) {
  if (!record) return null

  const rawDescription = record.description || ''
  const meta = parseHolidayMeta(rawDescription)
  const scope = sanitizeHolidayScope(record.scope || meta.scope || 'custom')
  const description = stripHolidayMeta(rawDescription)

  return {
    uid: String(record.uid || ''),
    holidayDate: record.holiday_date || record.holidayDate || '',
    name: record.name || '',
    description,
    scope,
    color: sanitizeColor(meta.color || record.color || ''),
    audience: sanitizeAudience(meta.audience || record.audience || 'org'),
    isActive: Boolean(record.is_active ?? record.isActive ?? true),
    allDay: toBooleanMeta(meta.allday, true),
    startTime: normalizeTimeValue(meta.start || record.startTime || ''),
    endTime: normalizeTimeValue(meta.end || record.endTime || ''),
    source: String(meta.source || record.source || 'org').toLowerCase(),
    isLocal: false
  }
}

export function serializeHolidayDescription(description = '', metaOrScope = {}) {
  const inputMeta = typeof metaOrScope === 'string' ? { scope: metaOrScope } : (metaOrScope || {})
  const cleaned = stripHolidayMeta(description)
  const meta = {
    scope: sanitizeHolidayScope(inputMeta.scope || 'custom'),
    audience: sanitizeAudience(inputMeta.audience || 'org')
  }

  if (sanitizeColor(inputMeta.color)) meta.color = sanitizeColor(inputMeta.color)
  if (!toBooleanMeta(inputMeta.allDay, true)) meta.allday = 'false'
  if (normalizeTimeValue(inputMeta.startTime)) meta.start = normalizeTimeValue(inputMeta.startTime)
  if (normalizeTimeValue(inputMeta.endTime)) meta.end = normalizeTimeValue(inputMeta.endTime)
  if (inputMeta.source) meta.source = String(inputMeta.source).toLowerCase()

  const metaString = Object.entries(meta)
    .filter(([, value]) => value !== '' && value != null)
    .map(([key, value]) => `[${key}:${value}]`)
    .join('')

  return `${metaString}${cleaned ? ` ${cleaned}` : ''}`.trim()
}

export function sanitizeHolidayScope(scope = 'custom') {
  const normalized = String(scope || 'custom').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_')
  return Object.prototype.hasOwnProperty.call(HOLIDAY_SCOPE_META, normalized) ? normalized : 'custom'
}

export function sanitizeAudience(audience = 'org') {
  const normalized = String(audience || 'org').trim().toLowerCase()
  return normalized === 'personal' ? 'personal' : 'org'
}

function sanitizeColor(value = '') {
  const normalized = String(value || '').trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ? normalized : ''
}

function normalizeTimeValue(value = '') {
  const normalized = String(value || '').trim()
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized) ? normalized : ''
}

function toBooleanMeta(value, fallback = false) {
  if (value == null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return String(value).trim().toLowerCase() !== 'false'
}

export function getHolidayScopeMeta(scope = 'custom') {
  const normalized = sanitizeHolidayScope(scope)
  return HOLIDAY_SCOPE_META[normalized] || HOLIDAY_SCOPE_META.custom
}

export function getHolidayLegendItems() {
  return [
    'international',
    'regional',
    'company',
    'restricted',
    'birthday',
    'work_anniversary',
    'meeting',
    'task',
    'custom'
  ].map((key) => ({ key, ...getHolidayScopeMeta(key) })).concat([
    { key: 'org', label: 'Organization calendar', tone: 'org', color: '#2563eb' },
    { key: 'personal', label: 'My calendar', tone: 'personal', color: '#0f766e' },
    { key: 'weekend', label: 'Weekend off', tone: 'weekend', color: '#dc2626' },
    { key: 'inactive', label: 'Inactive / archived', tone: 'inactive', color: '#64748b' }
  ])
}

export function normalizeLeaveType(record) {
  if (!record) return null
  return {
    uid: String(record.uid || ''),
    code: String(record.code || ''),
    name: record.name || '',
    annualDays: toNumber(record.annual_days ?? record.annualDays),
    autoAllocate: Boolean(record.auto_allocate ?? record.autoAllocate ?? false),
    requiresManualGrant: Boolean(record.requires_manual_grant ?? record.requiresManualGrant ?? false),
    carryForwardAllowed: Boolean(record.carry_forward_allowed ?? record.carryForwardAllowed ?? false),
    carryForwardCap: record.carry_forward_cap == null && record.carryForwardCap == null
      ? null
      : toNumber(record.carry_forward_cap ?? record.carryForwardCap),
    isActive: Boolean(record.is_active ?? record.isActive ?? true)
  }
}

export function normalizeLeaveBalance(record) {
  if (!record) return null
  return {
    uid: String(record.uid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    leaveTypeUid: String(record.leave_type_uid || record.leaveTypeUid || ''),
    year: Number(record.year || new Date().getFullYear()),
    openingBalance: toNumber(record.opening_balance ?? record.openingBalance),
    annualAllocation: toNumber(record.annual_allocation ?? record.annualAllocation),
    carryForwardIn: toNumber(record.carry_forward_in ?? record.carryForwardIn),
    manualGranted: toNumber(record.manual_granted ?? record.manualGranted),
    usedDays: toNumber(record.used_days ?? record.usedDays),
    pendingDays: toNumber(record.pending_days ?? record.pendingDays),
    lapsedDays: toNumber(record.lapsed_days ?? record.lapsedDays),
    availableBalance: toNumber(record.available_balance ?? record.availableBalance)
  }
}

export function normalizeLeaveRequest(record) {
  if (!record) return null
  return {
    uid: String(record.uid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    leaveTypeUid: String(record.leave_type_uid || record.leaveTypeUid || ''),
    startDate: record.start_date || record.startDate || '',
    endDate: record.end_date || record.endDate || '',
    appliedDays: toNumber(record.applied_days ?? record.appliedDays),
    reason: record.reason || '',
    status: record.status || 'Pending',
    approverEmployeeUid: record.approver_employee_uid ? String(record.approver_employee_uid) : (record.approverEmployeeUid ? String(record.approverEmployeeUid) : ''),
    reviewerNote: record.reviewer_note || record.reviewerNote || '',
    reviewedAt: record.reviewed_at || record.reviewedAt || null
  }
}

export function normalizeLeavePreview(record) {
  if (!record) return null
  return {
    startDate: record.start_date || record.startDate || '',
    endDate: record.end_date || record.endDate || '',
    totalCalendarDays: Number(record.total_calendar_days ?? record.totalCalendarDays ?? 0),
    excludedWeekends: Array.isArray(record.excluded_weekends || record.excludedWeekends) ? (record.excluded_weekends || record.excludedWeekends) : [],
    excludedHolidays: Array.isArray(record.excluded_holidays || record.excludedHolidays) ? (record.excluded_holidays || record.excludedHolidays) : [],
    appliedDays: toNumber(record.applied_days ?? record.appliedDays)
  }
}

export function toNumber(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

export function formatLeaveDays(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0.00'
  return num.toFixed(2)
}

export function formatLeaveDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export function getLeaveStatusClass(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '-')
  return `attendance-badge leave-status ${normalized || 'pending'}`
}

export function getHolidaySummary(holidays = []) {
  const active = holidays.filter((item) => item.isActive)
  const months = new Set(active.map((item) => String(item.holidayDate || '').slice(0, 7)).filter(Boolean))
  const byScope = holidays.reduce((accumulator, item) => {
    const key = sanitizeHolidayScope(item.scope || 'custom')
    accumulator[key] = (accumulator[key] || 0) + 1
    return accumulator
  }, {})
  const bySource = holidays.reduce((accumulator, item) => {
    const key = sanitizeAudience(item.audience || (item.isLocal ? 'personal' : 'org'))
    accumulator[key] = (accumulator[key] || 0) + 1
    return accumulator
  }, {})

  return {
    total: holidays.length,
    active: active.length,
    inactive: holidays.length - active.length,
    coveredMonths: months.size,
    international: byScope.international || 0,
    regional: byScope.regional || 0,
    company: byScope.company || 0,
    custom: byScope.custom || 0,
    restricted: byScope.restricted || 0,
    birthday: byScope.birthday || 0,
    workAnniversary: byScope.work_anniversary || 0,
    meeting: byScope.meeting || 0,
    task: byScope.task || 0,
    org: bySource.org || 0,
    personal: bySource.personal || 0
  }
}

export function getLeaveRequestSummary(requests = []) {
  return requests.reduce((summary, request) => {
    const status = String(request.status || '').trim().toLowerCase()
    summary.total += 1
    if (status === 'approved') summary.approved += 1
    else if (status === 'rejected') summary.rejected += 1
    else summary.pending += 1
    return summary
  }, { total: 0, approved: 0, rejected: 0, pending: 0 })
}

export function getLeaveBalanceSummary(balances = []) {
  return balances.reduce((summary, balance) => {
    summary.available += toNumber(balance.availableBalance)
    summary.used += toNumber(balance.usedDays)
    summary.pending += toNumber(balance.pendingDays)
    summary.allocated += toNumber(balance.annualAllocation) + toNumber(balance.manualGranted) + toNumber(balance.openingBalance) + toNumber(balance.carryForwardIn)
    return summary
  }, { available: 0, used: 0, pending: 0, allocated: 0 })
}

export function getYearOptions() {
  const currentYear = new Date().getFullYear()
  return [currentYear - 1, currentYear, currentYear + 1].map((year) => ({ value: String(year), label: String(year) }))
}

export function buildLeaveTypeOptions(leaveTypes = []) {
  return leaveTypes
    .filter((item) => item.isActive)
    .map((item) => ({
      value: item.uid,
      label: `${item.name} (${item.code})`,
      description: `${formatLeaveDays(item.annualDays)} annual days`
    }))
}
