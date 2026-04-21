import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { AttendanceMetricCard, AttendanceTabs } from '../../attendance/components/AttendanceShared.jsx'
import {
  CheckCircleIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrashIcon,
  XCircleIcon
} from '../../../components/common/AppIcons.jsx'
import { leaveService } from '../../../api/services/leave.service.js'
import { employeeService } from '../../../api/services/employee.service.js'
import { attendanceService } from '../../../api/services/attendance.service.js'
import {
  buildLeaveTypeOptions,
  formatLeaveDate,
  formatLeaveDays,
  getHolidayLegendItems,
  getHolidayScopeMeta,
  getHolidaySummary,
  getLeaveBalanceSummary,
  getLeaveRequestSummary,
  getLeaveStatusClass,
  getYearOptions
} from '../../../utils/leave.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../../utils/queryCache.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useToast } from '../../../app/providers/ToastProvider.jsx'
import { storage } from '../../../utils/storage.js'
import { downloadBlob, getTodayDateInput } from '../../../utils/attendance.js'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import {
  getDateRangeValidationMessage,
  getDateValidationMessage,
  getNumberValidationMessage,
  getRequiredFieldMessage,
  getTextValidationMessage,
  hasValidationErrors,
  markFieldsTouched
} from '../../../utils/validation.js'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  filterAccessibleTabs,
  hasAnyModulePermission,
  hasModulePermission,
  hasModuleVisibility,
  resolveAccessibleTab
} from '../../../utils/permissions.js'

const HOLIDAY_SCOPE_OPTIONS = [
  { value: 'international', label: 'International holiday' },
  { value: 'regional', label: 'Regional holiday' },
  { value: 'company', label: 'Company holiday' },
  { value: 'custom', label: 'Custom Event' }
]
const CALENDAR_VIEW_OPTIONS = [
  { value: 'month', label: 'Month view' },
  { value: 'week', label: 'Week view' },
  { value: 'day', label: 'Day view' }
]

const MANAGEMENT_CALENDAR_EVENT_OPTIONS = [
  { value: 'company', label: 'Company holiday' },
  { value: 'restricted', label: 'Restricted holiday' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'work_anniversary', label: 'Anniversary' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
  { value: 'custom', label: 'Custom Event' }
]

const MY_CALENDAR_EVENT_OPTIONS = [
  { value: 'birthday', label: 'Birthday' },
  { value: 'work_anniversary', label: 'Anniversary' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
  { value: 'custom', label: 'Custom Event' }
]

const PRESET_CALENDAR_COLORS = [
  '#2574dc',
  '#1d4ed8',
  '#7c3aed',
  '#db2777',
  '#d97706',
  '#059669',
  '#0284c7',
  '#dc2626'
]

const CALENDAR_AUDIENCE_OPTIONS = [
  { value: 'org', label: 'Organization calendar', description: 'Shared with the workforce and shown in the org calendar.' },
  { value: 'personal', label: 'My calendar', description: 'Saved only in this browser profile for the signed-in user.' }
]

const LOCAL_CALENDAR_STORAGE_KEY = 'one-gms-local-calendar-events'
const PUBLIC_IP_REGION_LOOKUP_URL = 'https://ipapi.co/json/'
const PUBLIC_HOLIDAY_API_BASE_URL = 'https://date.nager.at/api/v3'
const INTERNATIONAL_REFERENCE_COUNTRIES = ['US', 'GB', 'IN', 'DE', 'AU', 'CA']
const TIMEZONE_COUNTRY_MAP = {
  'asia/calcutta': 'IN',
  'asia/kolkata': 'IN',
  'asia/dubai': 'AE',
  'asia/singapore': 'SG',
  'asia/bangkok': 'TH',
  'america/new_york': 'US',
  'america/chicago': 'US',
  'america/denver': 'US',
  'america/los_angeles': 'US',
  'europe/london': 'GB'
}
const PHONE_DIALING_COUNTRY_MAP = [
  ['+91', 'IN'],
  ['+1', 'US'],
  ['+44', 'GB'],
  ['+61', 'AU'],
  ['+65', 'SG'],
  ['+971', 'AE']
]
const COUNTRY_TEXT_HINTS = [
  [/\bindia\b|\bin\b/i, 'IN'],
  [/\bunited states\b|\busa\b|\bus\b/i, 'US'],
  [/\bunited kingdom\b|\buk\b|\bgb\b/i, 'GB'],
  [/\baustralia\b|\bau\b/i, 'AU'],
  [/\bsingapore\b|\bsg\b/i, 'SG'],
  [/\buae\b|\bunited arab emirates\b|\bae\b/i, 'AE']
]
const DEFAULT_CALENDAR_FILTERS = {
  international: true,
  regional: true,
  company: true,
  restricted: true,
  birthday: true,
  work_anniversary: true,
  meeting: true,
  task: true,
  custom: true,
  org: true,
  personal: true,
  weekend: true,
  inactive: false
}

function sanitizeCountryCode(value = '') {
  const normalized = String(value || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : ''
}

function toCalendarSlug(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'event'
}

function resolveLocaleCountryCode() {
  if (typeof navigator === 'undefined') return ''

  const localeCandidates = [
    navigator.language,
    ...(Array.isArray(navigator.languages) ? navigator.languages : [])
  ]

  for (const locale of localeCandidates) {
    const match = String(locale || '').match(/-([A-Za-z]{2})(?:$|[^A-Za-z])/)
    if (match?.[1]) {
      return sanitizeCountryCode(match[1])
    }
  }

  return ''
}

async function fetchPublicJson(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  })

  if (!response.ok) {
    throw new Error(`Public calendar API request failed (${response.status}).`)
  }

  return response.json()
}

async function detectRegionByPublicIp() {
  const fallbackCountryCode = resolveLocaleCountryCode() || 'US'

  try {
    const payload = await fetchPublicJson(PUBLIC_IP_REGION_LOOKUP_URL)
    const countryCode = sanitizeCountryCode(payload?.country_code || payload?.country) || fallbackCountryCode

    return {
      countryCode,
      countryName: String(payload?.country_name || '').trim() || countryCode,
      regionName: String(payload?.region || '').trim(),
      cityName: String(payload?.city || '').trim(),
      timezone: String(payload?.timezone || '').trim(),
      source: 'ipapi'
    }
  } catch {
    return {
      countryCode: fallbackCountryCode,
      countryName: fallbackCountryCode,
      regionName: '',
      cityName: '',
      timezone: '',
      source: 'locale-fallback'
    }
  }
}

function resolveTimezoneCountryCode() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return ''

  try {
    const timezone = String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim().toLowerCase()
    return TIMEZONE_COUNTRY_MAP[timezone] || ''
  } catch {
    return ''
  }
}

function resolveSystemTimezoneLabel() {
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return ''

  try {
    return String(Intl.DateTimeFormat().resolvedOptions().timeZone || '').trim()
  } catch {
    return ''
  }
}

function inferCountryCodeFromText(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''

  const exactCode = sanitizeCountryCode(text)
  if (exactCode) return exactCode

  for (const [pattern, countryCode] of COUNTRY_TEXT_HINTS) {
    if (pattern.test(text)) return countryCode
  }

  return ''
}

function inferCountryCodeFromPhone(value = '') {
  const phone = String(value || '').trim()
  if (!phone) return ''

  const normalized = phone.startsWith('+') ? phone : `+${phone}`
  for (const [dialCode, countryCode] of PHONE_DIALING_COUNTRY_MAP) {
    if (normalized.startsWith(dialCode)) return countryCode
  }

  return ''
}

function resolveCountryFromUserDetails(user = null, employee = null) {
  const candidates = [
    employee?.countryCode,
    employee?.country,
    employee?.country_name,
    user?.countryCode,
    user?.country,
    user?.country_name,
    employee?.workLocation,
    employee?.address,
    user?.address,
    employee?.phone,
    user?.phone,
    user?.mobile,
    user?.mobileNo,
    user?.mobileNumber
  ]

  for (const value of candidates) {
    const codeFromText = inferCountryCodeFromText(value)
    if (codeFromText) return codeFromText
    const codeFromPhone = inferCountryCodeFromPhone(value)
    if (codeFromPhone) return codeFromPhone
  }

  return ''
}

function resolvePreferredCountryContext({ user = null, employee = null, ipCountryCode = '' } = {}) {
  const detailsCountryCode = resolveCountryFromUserDetails(user, employee)
  if (detailsCountryCode) return { countryCode: detailsCountryCode, source: 'user-details' }

  const timezoneCountryCode = resolveTimezoneCountryCode()
  if (timezoneCountryCode) return { countryCode: timezoneCountryCode, source: 'timezone' }

  const localeCountryCode = resolveLocaleCountryCode()
  if (localeCountryCode) return { countryCode: localeCountryCode, source: 'locale' }

  const ipCountry = sanitizeCountryCode(ipCountryCode)
  if (ipCountry) return { countryCode: ipCountry, source: 'ip' }

  return { countryCode: 'US', source: 'default' }
}

function getCountryDisplayName(countryCode = '') {
  const normalizedCountryCode = sanitizeCountryCode(countryCode)
  if (!normalizedCountryCode) return ''

  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      const locale = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || 'en'
      const displayNames = new Intl.DisplayNames([locale], { type: 'region' })
      return displayNames.of(normalizedCountryCode) || normalizedCountryCode
    }
  } catch {
    // Fallback to raw code when DisplayNames is unavailable.
  }

  return normalizedCountryCode
}

function mapToneToStatusType(tone = '') {
  const normalizedTone = String(tone || '').trim().toLowerCase()
  if (['success', 'ok'].includes(normalizedTone)) return 'success'
  if (['danger', 'error'].includes(normalizedTone)) return 'error'
  if (['warning', 'warn'].includes(normalizedTone)) return 'warning'
  return 'info'
}

function dedupeCalendarEntries(entries = []) {
  const seen = new Set()

  return (Array.isArray(entries) ? entries : []).filter((entry) => {
    const key = [
      String(entry?.holidayDate || '').trim(),
      String(entry?.scope || '').trim().toLowerCase(),
      String(entry?.name || '').trim().toLowerCase(),
      String(entry?.audience || '').trim().toLowerCase()
    ].join('|')

    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function toExternalHolidayEntry(record = {}, scope = 'international') {
  const holidayDate = String(record?.date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) return null

  const countryCode = sanitizeCountryCode(record?.countryCode)
  const baseName = String(record?.name || record?.localName || 'Holiday').trim() || 'Holiday'
  const displayName = scope === 'international'
    ? `${baseName}${countryCode ? ` (${countryCode})` : ''}`
    : baseName
  const localName = String(record?.localName || '').trim()
  const typeLabel = Array.isArray(record?.types) ? record.types.filter(Boolean).join(', ') : ''
  const descriptionSegments = []

  if (localName && localName.toLowerCase() !== baseName.toLowerCase()) {
    descriptionSegments.push(`Local name: ${localName}.`)
  }
  if (typeLabel) {
    descriptionSegments.push(`Type: ${typeLabel}.`)
  }
  descriptionSegments.push(scope === 'regional'
    ? 'Regional public holiday lane synced from Nager.Date.'
    : 'International public holiday lane synced from Nager.Date.')

  return {
    uid: `external-${scope}-${countryCode || 'xx'}-${holidayDate}-${toCalendarSlug(displayName)}`,
    holidayDate,
    name: displayName,
    description: descriptionSegments.join(' ').trim(),
    scope,
    color: getHolidayScopeMeta(scope).color,
    audience: 'org',
    isActive: true,
    allDay: true,
    startTime: '',
    endTime: '',
    source: 'external',
    isLocal: false,
    ownerKey: '',
    ownerLabel: ''
  }
}

async function fetchRegionalHolidayFeed(year, countryCode) {
  const normalizedCountryCode = sanitizeCountryCode(countryCode) || 'US'
  const payload = await fetchPublicJson(`${PUBLIC_HOLIDAY_API_BASE_URL}/publicholidays/${year}/${normalizedCountryCode}`)
  return Array.isArray(payload) ? payload : []
}

async function fetchInternationalHolidayFeed(year) {
  const worldwidePayload = await fetchPublicJson(`${PUBLIC_HOLIDAY_API_BASE_URL}/nextpublicholidaysworldwide`)
  const worldwideRows = Array.isArray(worldwidePayload) ? worldwidePayload : []
  const scopedWorldwideRows = worldwideRows.filter((row) => String(row?.date || '').startsWith(`${year}-`))

  if (scopedWorldwideRows.length) return scopedWorldwideRows

  const fallbackResponses = await Promise.all(INTERNATIONAL_REFERENCE_COUNTRIES.map(async (countryCode) => {
    try {
      const items = await fetchRegionalHolidayFeed(year, countryCode)
      return { countryCode, items }
    } catch {
      return { countryCode, items: [] }
    }
  }))

  const groupedRows = new Map()
  fallbackResponses.forEach(({ countryCode, items }) => {
    ;(Array.isArray(items) ? items : []).forEach((item) => {
      const name = String(item?.name || item?.localName || '').trim().toLowerCase()
      const date = String(item?.date || '').trim()
      if (!name || !date) return

      const key = `${date}|${name}`
      const existing = groupedRows.get(key) || {
        sample: { ...item, countryCode },
        countries: new Set()
      }
      existing.countries.add(countryCode)
      groupedRows.set(key, existing)
    })
  })

  return Array.from(groupedRows.values())
    .filter((entry) => entry.countries.size >= 2)
    .map((entry) => entry.sample)
}

async function loadExternalHolidayCalendar(year, countryCode) {
  const normalizedYear = Number(year) || new Date().getFullYear()
  const normalizedCountryCode = sanitizeCountryCode(countryCode) || 'US'

  const [regionalRows, internationalRows] = await Promise.all([
    fetchRegionalHolidayFeed(normalizedYear, normalizedCountryCode).catch(() => []),
    fetchInternationalHolidayFeed(normalizedYear).catch(() => [])
  ])

  const regionalEntries = regionalRows
    .map((entry) => toExternalHolidayEntry({ ...entry, countryCode: normalizedCountryCode }, 'regional'))
    .filter(Boolean)
  const internationalEntries = internationalRows
    .map((entry) => toExternalHolidayEntry(entry, 'international'))
    .filter(Boolean)

  return {
    entries: dedupeCalendarEntries([...internationalEntries, ...regionalEntries]),
    meta: {
      countryCode: normalizedCountryCode,
      internationalCount: internationalEntries.length,
      regionalCount: regionalEntries.length
    }
  }
}

function createCalendarUid(prefix = 'event') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeHexColor(color = '') {
  const normalized = String(color || '').trim()
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized) ? normalized : ''
}

function hexToRgba(color, alpha = 1) {
  const normalized = normalizeHexColor(color)
  if (!normalized) return `rgba(37, 116, 220, ${alpha})`

  const value = normalized.slice(1)
  const expanded = value.length === 3 ? value.split('').map((char) => `${char}${char}`).join('') : value
  const red = parseInt(expanded.slice(0, 2), 16)
  const green = parseInt(expanded.slice(2, 4), 16)
  const blue = parseInt(expanded.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function isWeekendDate(date) {
  const day = date.getDay()
  return day === 0 || day === 6
}

function formatCalendarTimeLabel(entry) {
  if (!entry) return 'All day'
  if (entry.allDay || (!entry.startTime && !entry.endTime)) return 'All day'
  if (entry.startTime && entry.endTime) return `${entry.startTime} - ${entry.endTime}`
  return entry.startTime || entry.endTime || 'All day'
}


function getBalanceEntitlementDays(balance = {}) {
  return [
    balance.openingBalance,
    balance.annualAllocation,
    balance.carryForwardIn,
    balance.manualGranted
  ].reduce((total, value) => total + Number(value || 0), 0)
}

function prioritizeRowsByEmployee(rows = [], employeeUid = '') {
  const normalizedEmployeeUid = String(employeeUid || '').trim()
  if (!normalizedEmployeeUid) return Array.isArray(rows) ? rows : []

  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    const leftOwnsRecord = String(left?.employeeUid || '') === normalizedEmployeeUid
    const rightOwnsRecord = String(right?.employeeUid || '') === normalizedEmployeeUid
    if (leftOwnsRecord === rightOwnsRecord) return 0
    return leftOwnsRecord ? -1 : 1
  })
}

function getCalendarEntryColor(entry) {
  return normalizeHexColor(entry?.color || '') || getHolidayScopeMeta(entry?.scope).color || '#2574dc'
}

function getCalendarAccentStyle(entry, emphasis = 'soft') {
  const color = getCalendarEntryColor(entry)
  if (emphasis === 'badge') {
    return {
      background: hexToRgba(color, 0.16),
      borderColor: hexToRgba(color, 0.28),
      color
    }
  }

  return {
    '--calendar-accent': color,
    '--calendar-accent-soft': hexToRgba(color, 0.16),
    '--calendar-accent-border': hexToRgba(color, 0.28)
  }
}

function normalizeLocalCalendarEntry(record) {
  if (!record) return null
  return {
    uid: String(record.uid || createCalendarUid('local')),
    holidayDate: record.holidayDate || '',
    name: record.name || '',
    description: record.description || '',
    scope: String(record.scope || 'custom'),
    color: normalizeHexColor(record.color || ''),
    audience: String(record.audience || 'personal'),
    isActive: Boolean(record.isActive ?? true),
    allDay: Boolean(record.allDay ?? true),
    startTime: record.startTime || '',
    endTime: record.endTime || '',
    source: 'local',
    isLocal: true,
    ownerKey: String(record.ownerKey || ''),
    ownerLabel: record.ownerLabel || ''
  }
}

function sortCalendarEntries(entries = []) {
  return [...entries].sort((left, right) => {
    const leftDateTime = `${left.holidayDate || ''} ${left.startTime || '00:00'}`
    const rightDateTime = `${right.holidayDate || ''} ${right.startTime || '00:00'}`
    return leftDateTime.localeCompare(rightDateTime) || String(left.name || '').localeCompare(String(right.name || ''))
  })
}

function formatIcsDate(dateValue, timeValue = '', allDay = true) {
  const normalizedDate = typeof dateValue === 'string' ? dateValue.trim() : toDateInputValue(new Date(dateValue))
  if (!normalizedDate) return ''
  if (allDay || !timeValue) return normalizedDate.replace(/-/g, '')
  return `${normalizedDate.replace(/-/g, '')}T${String(timeValue).replace(':', '')}00`
}

function buildIcsContent(entries = []) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ONE GMS//Organization Calendar//EN']

  entries.forEach((entry) => {
    const startValue = formatIcsDate(entry.holidayDate, entry.startTime, entry.allDay)
    if (!startValue) return

    const endValue = entry.allDay
      ? formatIcsDate(toDateInputValue(addDays(new Date(entry.holidayDate), 1)), '', true)
      : formatIcsDate(entry.holidayDate, entry.endTime || entry.startTime, false)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${entry.uid}@onegms.local`)
    lines.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`)
    if (entry.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${startValue}`)
      lines.push(`DTEND;VALUE=DATE:${endValue}`)
    } else {
      lines.push(`DTSTART:${startValue}`)
      if (endValue) lines.push(`DTEND:${endValue}`)
    }
    lines.push(`SUMMARY:${String(entry.name || 'Calendar entry').replace(/\n/g, ' ')}`)
    if (entry.description) lines.push(`DESCRIPTION:${String(entry.description).replace(/\n/g, ' ')}`)
    lines.push(`CATEGORIES:${getHolidayScopeMeta(entry.scope).label}`)
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

function parseIcsEvents(content = '') {
  return String(content || '')
    .split('BEGIN:VEVENT')
    .slice(1)
    .map((segment) => segment.split('END:VEVENT')[0])
    .map((segment) => {
      const lineMap = segment
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .reduce((accumulator, line) => {
          const separatorIndex = line.indexOf(':')
          if (separatorIndex <= 0) return accumulator
          const key = line.slice(0, separatorIndex)
          const value = line.slice(separatorIndex + 1)
          accumulator[key] = value
          return accumulator
        }, {})

      const rawDate = lineMap['DTSTART;VALUE=DATE'] || lineMap.DTSTART || ''
      if (!rawDate) return null
      const isAllDay = Boolean(lineMap['DTSTART;VALUE=DATE'])
      const holidayDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      const startTime = !isAllDay && rawDate.includes('T') ? `${rawDate.slice(9, 11)}:${rawDate.slice(11, 13)}` : ''
      const rawEnd = lineMap.DTEND || ''
      const endTime = !isAllDay && rawEnd.includes('T') ? `${rawEnd.slice(9, 11)}:${rawEnd.slice(11, 13)}` : ''

      return normalizeLocalCalendarEntry({
        uid: createCalendarUid('import'),
        holidayDate,
        name: lineMap.SUMMARY || 'Imported event',
        description: lineMap.DESCRIPTION || 'Imported from calendar file.',
        scope: 'custom',
        allDay: isAllDay,
        startTime,
        endTime,
        audience: 'personal',
        color: '#0284c7',
        isActive: true,
        source: 'local'
      })
    })
    .filter(Boolean)
}

function LeaveStatusBadge({ status }) {
  return <span className={getLeaveStatusClass(status)}>{status}</span>
}

function getCancellationStatusTone(status = '') {
  const normalizedStatus = String(status || 'NoneRequested').trim().toLowerCase()
  if (normalizedStatus === 'pending') return 'orange'
  if (normalizedStatus === 'approved') return 'success'
  if (normalizedStatus === 'rejected') return 'danger'
  return 'neutral'
}

function getCancellationStatusLabel(status = '') {
  const normalizedStatus = String(status || 'NoneRequested').trim()
  if (!normalizedStatus || normalizedStatus === 'NoneRequested') return 'No request'
  if (normalizedStatus === 'Pending') return 'Pending review'
  if (normalizedStatus === 'Approved') return 'Approved'
  if (normalizedStatus === 'Rejected') return 'Rejected'
  return normalizedStatus
}

function HolidayScopeBadge({ scope, color = '' }) {
  const meta = getHolidayScopeMeta(scope)
  const style = normalizeHexColor(color) ? getCalendarAccentStyle({ scope, color }, 'badge') : undefined
  return <span className={`leave-scope-badge ${meta.tone}`} style={style}>{meta.label}</span>
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getMonthOptions(year) {
  return Array.from({ length: 12 }, (_, monthIndex) => ({
    value: String(monthIndex),
    label: new Date(Number(year), monthIndex, 1).toLocaleDateString(undefined, { month: 'long' })
  }))
}

function getStartOfWeek(date) {
  const start = new Date(date)
  const offset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - offset)
  start.setHours(0, 0, 0, 0)
  return start
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getCalendarDays(view, year, monthIndex, selectedDate) {
  const focusDate = selectedDate ? new Date(selectedDate) : new Date(Number(year), Number(monthIndex), 1)

  if (view === 'day') {
    return [focusDate]
  }

  if (view === 'week') {
    const start = getStartOfWeek(focusDate)
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }

  const firstDay = new Date(Number(year), Number(monthIndex), 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - startOffset)

  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
}

function chunkDays(days, chunkSize) {
  const rows = []
  for (let index = 0; index < days.length; index += chunkSize) {
    rows.push(days.slice(index, index + chunkSize))
  }
  return rows
}

function getIsoWeekNumber(date) {
  const normalized = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1))
  return Math.ceil((((normalized - yearStart) / 86400000) + 1) / 7)
}

function emptyHolidayDraft(audience = 'org') {
  return {
    holidayDate: '',
    name: '',
    description: '',
    scope: 'custom',
    audience,
    color: '',
    allDay: true,
    startTime: '',
    endTime: '',
    isActive: true
  }
}

function emptyLeaveTypeDraft() {
  return {
    code: '',
    name: '',
    annualDays: '0',
    autoAllocate: true,
    requiresManualGrant: false,
    carryForwardAllowed: false,
    carryForwardCap: '',
    isActive: true
  }
}

function emptyLeaveRequestDraft() {
  return {
    leaveTypeUid: '',
    startDate: '',
    endDate: '',
    reason: ''
  }
}

function buildLeaveRequestDraft(record = null) {
  if (!record) return emptyLeaveRequestDraft()

  return {
    leaveTypeUid: record.leaveTypeUid || '',
    startDate: record.startDate || '',
    endDate: record.endDate || '',
    reason: record.reason || ''
  }
}

function normalizeLeaveCodeInput(value = '') {
  return String(value || '').toUpperCase().replace(/\s+/g, '').trim()
}

function buildHolidayErrors(draft, isManagementWorkspace) {
  return {
    audience: isManagementWorkspace ? getRequiredFieldMessage(draft.audience, 'Calendar lane') : '',
    scope: getRequiredFieldMessage(draft.scope, 'Event type'),
    holidayDate: getDateValidationMessage(draft.holidayDate, { required: true, label: 'Date' }),
    name: getRequiredFieldMessage(draft.name, 'Title'),
    startTime: !draft.allDay && !draft.startTime ? 'Start time is required.' : '',
    endTime: !draft.allDay
      ? (!draft.endTime
        ? 'End time is required.'
        : (draft.startTime && draft.endTime && draft.endTime <= draft.startTime ? 'End time must be after start time.' : ''))
      : ''
  }
}

function buildLeaveTypeErrors(draft) {
  return {
    code: getTextValidationMessage(draft.code, {
      required: true,
      label: 'Code',
      pattern: /^[A-Z0-9-]{1,10}$/,
      patternMessage: 'Code can contain only uppercase letters, numbers, and hyphens.'
    }),
    name: getRequiredFieldMessage(draft.name, 'Name'),
    annualDays: getNumberValidationMessage(draft.annualDays, { required: true, label: 'Annual days', min: 0 }),
    carryForwardCap: draft.carryForwardAllowed && draft.carryForwardCap
      ? getNumberValidationMessage(draft.carryForwardCap, { label: 'Carry forward cap', min: 0 })
      : ''
  }
}

function buildManualGrantErrors(selectedEmployeeUid, draft) {
  return {
    employeeUid: getRequiredFieldMessage(selectedEmployeeUid, 'Employee'),
    leaveTypeUid: getRequiredFieldMessage(draft.leaveTypeUid, 'Leave type'),
    days: getNumberValidationMessage(draft.days, { required: true, label: 'Days', min: 0.25, allowZero: false })
  }
}

function buildLeaveRequestErrors(draft) {
  return {
    leaveTypeUid: getRequiredFieldMessage(draft.leaveTypeUid, 'Leave type'),
    startDate: getDateValidationMessage(draft.startDate, { required: true, label: 'Start date' }),
    endDate: getDateValidationMessage(draft.endDate, { required: true, label: 'End date' }) || getDateRangeValidationMessage(draft.startDate, draft.endDate),
    reason: getTextValidationMessage(draft.reason, { label: 'Reason', maxLength: 1000 })
  }
}

function HolidayModal({ mode, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending, isManagementWorkspace = false }) {
  const isEdit = mode === 'edit'
  const entryLabel = draft.audience === 'personal' ? 'My calendar entry' : 'Organization calendar entry'
  const baseEventTypeOptions = isManagementWorkspace && draft.audience !== 'personal'
    ? MANAGEMENT_CALENDAR_EVENT_OPTIONS
    : MY_CALENDAR_EVENT_OPTIONS
  const eventTypeOptions = useMemo(() => {
    if (!['international', 'regional'].includes(String(draft.scope || ''))) return baseEventTypeOptions
    const lockedOption = {
      value: draft.scope,
      label: `${getHolidayScopeMeta(draft.scope).label} (auto-synced)`,
      description: 'This event type is populated automatically and cannot be created manually.',
      disabled: true
    }
    return [lockedOption, ...baseEventTypeOptions]
  }, [baseEventTypeOptions, draft.scope])

  return (
    <ModalFrame
      open={Boolean(mode)}
      title={isEdit ? 'Modify calendar entry' : 'Add calendar entry'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending || !draft.name || !draft.holidayDate}>
            {isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Create entry')}
          </button>
        </>
      )}    
    >
      <div className="row g-3">
        {isManagementWorkspace ? (
          <div className="col-12 col-md-6">
            <label className="form-label">Calendar lane</label>
            <AppSelect name="audience" value={draft.audience} onChange={onChange} onBlur={onBlur} options={CALENDAR_AUDIENCE_OPTIONS} disabled={isEdit} invalid={Boolean(touched.audience && errors.audience)} />
            {touched.audience && errors.audience ? <div className="invalid-feedback d-block">{errors.audience}</div> : null}
          </div>
        ) : null}
        <div className={`col-12 ${isManagementWorkspace ? 'col-md-6' : ''}`}>
          <label className="form-label">Event type</label>
          <AppSelect name="scope" value={draft.scope} onChange={onChange} onBlur={onBlur} options={eventTypeOptions} invalid={Boolean(touched.scope && errors.scope)} />
          {touched.scope && errors.scope ? <div className="invalid-feedback d-block">{errors.scope}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Date</label>
          <input className={`form-control${touched.holidayDate && errors.holidayDate ? ' is-invalid' : ''}`} type="date" name="holidayDate" value={draft.holidayDate} onChange={onChange} onBlur={onBlur} />
          {touched.holidayDate && errors.holidayDate ? <div className="invalid-feedback d-block">{errors.holidayDate}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Title</label>
          <input className={`form-control${touched.name && errors.name ? ' is-invalid' : ''}`} type="text" name="name" value={draft.name} onChange={onChange} onBlur={onBlur} placeholder="Enter event title" />
          {touched.name && errors.name ? <div className="invalid-feedback d-block">{errors.name}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Accent color</label>
          <div className="leave-color-presets" role="group" aria-label="Preset event colors">
            {PRESET_CALENDAR_COLORS.map((color) => {
              const activeColor = draft.color || getHolidayScopeMeta(draft.scope).color || '#0284c7'
              const isSelected = String(activeColor).toLowerCase() === color.toLowerCase()
              return (
                <button
                  key={color}
                  type="button"
                  className={`leave-color-swatch ${isSelected ? 'is-selected' : ''}`.trim()}
                  style={{ '--swatch-color': color }}
                  onClick={() => onChange({ target: { name: 'color', value: color } })}
                  aria-label={`Use color ${color}`}
                  aria-pressed={isSelected}
                />
              )
            })}
          </div>
          <div className="leave-color-input-wrap">
            <label className="leave-color-custom-picker">
              <input className="form-control form-control-color" type="color" name="color" value={draft.color || getHolidayScopeMeta(draft.scope).color || '#0284c7'} onChange={onChange} />
              <span>Custom</span>
            </label>
            {/* <input className="form-control" type="text" name="color" value={draft.color || getHolidayScopeMeta(draft.scope).color || '#0284c7'} onChange={onChange} placeholder="#0284c7" /> */}
          </div>
        </div>
        <div className="col-12 col-md-6 d-flex align-items-end">
          <div className="form-check form-switch mt-2">
            <input className="form-check-input" id="holidayAllDay" type="checkbox" checked={draft.allDay} onChange={(event) => onChange({ target: { name: 'allDay', value: event.target.checked } })} />
            <label className="form-check-label" htmlFor="holidayAllDay">All day entry</label>
          </div>
        </div>
        {!draft.allDay ? (
          <>
            <div className="col-12 col-md-6">
              <label className="form-label">Start time</label>
              <input className={`form-control${touched.startTime && errors.startTime ? ' is-invalid' : ''}`} type="time" name="startTime" value={draft.startTime} onChange={onChange} onBlur={onBlur} />
              {touched.startTime && errors.startTime ? <div className="invalid-feedback d-block">{errors.startTime}</div> : null}
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">End time</label>
              <input className={`form-control${touched.endTime && errors.endTime ? ' is-invalid' : ''}`} type="time" name="endTime" value={draft.endTime} onChange={onChange} onBlur={onBlur} />
              {touched.endTime && errors.endTime ? <div className="invalid-feedback d-block">{errors.endTime}</div> : null}
            </div>
          </>
        ) : null}
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea className="form-control" rows="4" name="description" value={draft.description} onChange={onChange} placeholder="Add meeting notes, event details, or instructions." />
        </div>
        <div className="col-12 d-flex flex-column gap-2">
          <div className="attendance-note-card mb-0 small text-muted">
            {draft.audience === 'personal'
              ? 'Personal entries are stored in this browser profile so every signed-in user can manage their own task, meeting, or reminder lane without changing the organization calendar.'
              : 'Organization entries stay in the shared holiday calendar and remain visible to the workforce based on active filters.'}
          </div>
          <div className="form-check form-switch mt-1">
            <input className="form-check-input" id="holidayIsActive" type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ target: { name: 'isActive', value: event.target.checked } })} />
            <label className="form-check-label" htmlFor="holidayIsActive">Active entry in {entryLabel}</label>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function LeaveTypeModal({ mode, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending, errorMessage = '' }) {
  const isEdit = mode === 'edit'

  return (
    <ModalFrame
      open={Boolean(mode)}
      title={isEdit ? 'Modify leave type' : 'Add leave type'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending || !draft.name || !draft.code}>
            {isPending ? 'Saving…' : (isEdit ? 'Save changes' : 'Create leave type')}
          </button>
        </>
      )}
    >
      <div className="row g-3">
        {errorMessage ? <div className="col-12"><div className="alert alert-warning mb-0">{errorMessage}</div></div> : null}
        <div className="col-12 col-md-4">
          <label className="form-label">Code</label>
          <input
            className={`form-control text-uppercase${touched.code && errors.code ? ' is-invalid' : ''}`}
            type="text"
            name="code"
            value={draft.code}
            onChange={onChange}
            onBlur={onBlur}
            disabled={isEdit}
            maxLength="10"
            placeholder="Enter leave code"
          />
          <div className="form-text">Manual entry. Once created, the leave code is locked.</div>
          {touched.code && errors.code ? <div className="invalid-feedback d-block">{errors.code}</div> : null}
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label">Name</label>
          <input className={`form-control${touched.name && errors.name ? ' is-invalid' : ''}`} type="text" name="name" value={draft.name} onChange={onChange} onBlur={onBlur} placeholder="Enter leave type name" />
          {touched.name && errors.name ? <div className="invalid-feedback d-block">{errors.name}</div> : null}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Annual Days</label>
          <input className={`form-control${touched.annualDays && errors.annualDays ? ' is-invalid' : ''}`} type="number" step="0.25" min="0" name="annualDays" value={draft.annualDays} onChange={onChange} onBlur={onBlur} />
          {touched.annualDays && errors.annualDays ? <div className="invalid-feedback d-block">{errors.annualDays}</div> : null}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Carry Forward Cap</label>
          <input className={`form-control${touched.carryForwardCap && errors.carryForwardCap ? ' is-invalid' : ''}`} type="number" step="0.25" min="0" name="carryForwardCap" value={draft.carryForwardCap} onChange={onChange} onBlur={onBlur} disabled={!draft.carryForwardAllowed} placeholder="Optional" />
          {touched.carryForwardCap && errors.carryForwardCap ? <div className="invalid-feedback d-block">{errors.carryForwardCap}</div> : null}
        </div>
        <div className="col-12 col-md-4 d-flex align-items-end">
          <div className="leave-toggle-stack w-100">
            <label className="form-label d-block">Flags</label>
            <div className="form-check form-switch"><input className="form-check-input" id="leaveTypeAutoAllocate" type="checkbox" checked={draft.autoAllocate} onChange={(event) => onChange({ target: { name: 'autoAllocate', value: event.target.checked } })} /><label className="form-check-label" htmlFor="leaveTypeAutoAllocate">Auto allocate</label></div>
            <div className="form-check form-switch"><input className="form-check-input" id="leaveTypeManualGrant" type="checkbox" checked={draft.requiresManualGrant} onChange={(event) => onChange({ target: { name: 'requiresManualGrant', value: event.target.checked } })} /><label className="form-check-label" htmlFor="leaveTypeManualGrant">Manual grant</label></div>
            <div className="form-check form-switch"><input className="form-check-input" id="leaveTypeCarryForward" type="checkbox" checked={draft.carryForwardAllowed} onChange={(event) => onChange({ target: { name: 'carryForwardAllowed', value: event.target.checked } })} /><label className="form-check-label" htmlFor="leaveTypeCarryForward">Carry forward allowed</label></div>
            {isEdit ? <div className="form-check form-switch"><input className="form-check-input" id="leaveTypeActive" type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ target: { name: 'isActive', value: event.target.checked } })} /><label className="form-check-label" htmlFor="leaveTypeActive">Active</label></div> : null}
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function LeaveDecisionModal({ mode, record, note, onNoteChange, onClose, onSubmit, isPending, employeeLabel, leaveTypeLabel }) {
  const isCancellationMode = ['approve-cancellation', 'reject-cancellation'].includes(mode)
  const isApprove = mode === 'approve' || mode === 'approve-cancellation'

  const title = isCancellationMode
    ? (isApprove ? 'Approve leave cancellation' : 'Reject leave cancellation')
    : (isApprove ? 'Approve leave request' : 'Reject leave request')
  const actionLabel = isCancellationMode
    ? (isApprove ? 'Approve cancellation' : 'Reject cancellation')
    : (isApprove ? 'Approve request' : 'Reject request')
  const notePlaceholder = isCancellationMode
    ? (isApprove ? 'Capture the approval note for the cancellation request.' : 'Capture why the cancellation request is being rejected.')
    : (isApprove ? 'Capture the approval note for audit visibility.' : 'Capture the rejection rationale.')

  return (
    <ModalFrame
      open={Boolean(mode && record)}
      title={title}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className={`btn px-4 ${isApprove ? 'btn-primary' : 'btn-outline-danger'}`} onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Submitting…' : actionLabel}
          </button>
        </>
      )}
    >
      {record ? (
        <div className="d-flex flex-column gap-3">
          <div className="attendance-note-card">
            <div className="fw-semibold">{employeeLabel}</div>
            <div className="small text-muted">{leaveTypeLabel} • {formatLeaveDate(record.startDate)} to {formatLeaveDate(record.endDate)}</div>
            <div className="small text-muted mt-1">Applied Days: {formatLeaveDays(record.appliedDays)}</div>
            <div className="small mt-2">{record.reason || 'No reason provided.'}</div>
            {isCancellationMode ? (
              <div className="small mt-2">
                Cancellation reason: {record.cancellationReason || 'No cancellation reason provided.'}
              </div>
            ) : null}
          </div>
          <div>
            <label className="form-label">Reviewer Note</label>
            <textarea className="form-control" rows="4" value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder={notePlaceholder} />
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

function LeaveRequestModal({ mode, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending, leaveTypeOptions = [] }) {
  return (
    <ModalFrame
      open={Boolean(mode)}
      title="Modify pending leave request"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending || !draft.leaveTypeUid || !draft.startDate || !draft.endDate}>
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label">Leave Type</label>
          <AppSelect
            name="leaveTypeUid"
            value={draft.leaveTypeUid}
            onChange={onChange}
            onBlur={onBlur}
            options={leaveTypeOptions}
            placeholder="Select leave type"
            invalid={Boolean(touched.leaveTypeUid && errors.leaveTypeUid)}
          />
          {touched.leaveTypeUid && errors.leaveTypeUid ? <div className="invalid-feedback d-block">{errors.leaveTypeUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Start Date</label>
          <input className={`form-control${touched.startDate && errors.startDate ? ' is-invalid' : ''}`} type="date" name="startDate" value={draft.startDate} onChange={onChange} onBlur={onBlur} />
          {touched.startDate && errors.startDate ? <div className="invalid-feedback d-block">{errors.startDate}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">End Date</label>
          <input className={`form-control${touched.endDate && errors.endDate ? ' is-invalid' : ''}`} type="date" name="endDate" value={draft.endDate} onChange={onChange} onBlur={onBlur} min={draft.startDate || undefined} />
          {touched.endDate && errors.endDate ? <div className="invalid-feedback d-block">{errors.endDate}</div> : null}
        </div>
        <div className="col-12">
          <label className="form-label">Reason</label>
          <textarea className={`form-control${touched.reason && errors.reason ? ' is-invalid' : ''}`} rows="4" name="reason" value={draft.reason} onChange={onChange} onBlur={onBlur} placeholder="Update the reason if the leave context changed." />
          {touched.reason && errors.reason ? <div className="invalid-feedback d-block">{errors.reason}</div> : null}
        </div>
      </div>
    </ModalFrame>
  )
}

function LeaveCancellationRequestModal({ record, reason, onReasonChange, onClose, onSubmit, isPending, leaveTypeLabel }) {
  return (
    <ModalFrame
      open={Boolean(record)}
      title="Request leave cancellation"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-outline-danger px-4" onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Submitting…' : 'Request cancellation'}
          </button>
        </>
      )}
    >
      {record ? (
        <div className="d-flex flex-column gap-3">
          <div className="attendance-note-card">
            <div className="fw-semibold">{leaveTypeLabel}</div>
            <div className="small text-muted">{formatLeaveDate(record.startDate)} to {formatLeaveDate(record.endDate)}</div>
            <div className="small text-muted mt-1">Applied Days: {formatLeaveDays(record.appliedDays)}</div>
          </div>
          <div>
            <label className="form-label">Cancellation Reason</label>
            <textarea className="form-control" rows="4" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Capture why this approved leave is no longer needed." />
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

export default function LeaveShared({ workspaceType = 'request', tabs = [], initialTab = 'apply' }) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showConfirm, showStatus, runWithLoader } = useModal()
  const withLoader = useCallback((loaderConfig, task) => runWithLoader(task, loaderConfig), [runWithLoader])
  const openConfirm = useCallback((config = {}) => showConfirm({
    ...config,
    confirmLabel: config.confirmLabel || config.confirmText,
    cancelLabel: config.cancelLabel || config.cancelText
  }), [showConfirm])
  const openStatus = useCallback((config = {}) => showStatus({
    ...config,
    type: config.type || mapToneToStatusType(config.tone)
  }), [showStatus])
  const { user } = useAuth()
  const { showToast } = useToast()
  const calendarImportRef = useRef(null)
  const isManagementWorkspace = workspaceType === 'management'
  const canCreateHolidayEntries = hasModulePermission(user, PERMISSION_MODULES.holidayCalendar, PERMISSION_ACTIONS.create)
  const canUpdateHolidayEntries = hasModulePermission(user, PERMISSION_MODULES.holidayCalendar, PERMISSION_ACTIONS.update)
  const canDeleteHolidayEntries = hasModulePermission(user, PERMISSION_MODULES.holidayCalendar, PERMISSION_ACTIONS.delete)
  const canReadHolidayCalendar = hasModulePermission(user, PERMISSION_MODULES.holidayCalendar, PERMISSION_ACTIONS.read)
  const canViewHolidayTab = canReadHolidayCalendar || canCreateHolidayEntries || canUpdateHolidayEntries || canDeleteHolidayEntries
  const canViewManagementTab = isManagementWorkspace && hasModuleVisibility(user, [...PERMISSION_MODULES.leaveType, ...PERMISSION_MODULES.assignLeave])
  const canViewMyLeaveBalance = hasModulePermission(user, PERMISSION_MODULES.myLeaveBalance, PERMISSION_ACTIONS.read)
  const canViewManageLeaveQueue = isManagementWorkspace && hasModulePermission(user, PERMISSION_MODULES.manageLeave, PERMISSION_ACTIONS.read)
  const canCreateLeaveType = hasModulePermission(user, PERMISSION_MODULES.leaveType, PERMISSION_ACTIONS.create)
  const canUpdateLeaveType = hasModulePermission(user, PERMISSION_MODULES.leaveType, PERMISSION_ACTIONS.update)
  const canManageAllocations = hasAnyModulePermission(user, PERMISSION_MODULES.assignLeave, [PERMISSION_ACTIONS.create, PERMISSION_ACTIONS.update])
  const canReadLeaveRequests = hasModulePermission(user, PERMISSION_MODULES.leaveRequest, PERMISSION_ACTIONS.read)
  // Self apply-leave is enabled by default for all users, independent of role-matrix create mapping.
  const canCreateOwnLeaveRequest = true
  const canReviewLeaveRequests = hasModulePermission(user, PERMISSION_MODULES.manageLeave, PERMISSION_ACTIONS.update)
  const canAccessManageLeaveQueue = canViewManageLeaveQueue
  const canViewLeaveRequests = isManagementWorkspace ? canAccessManageLeaveQueue : canReadLeaveRequests
  const canViewApplyTab = isManagementWorkspace
    ? (canAccessManageLeaveQueue || canCreateOwnLeaveRequest || canReadLeaveRequests || canViewMyLeaveBalance)
    : (canReadLeaveRequests || canCreateOwnLeaveRequest || canViewMyLeaveBalance)
  const resolvedTabs = Array.isArray(tabs) && tabs.length
    ? tabs
    : (isManagementWorkspace
      ? [
        { key: 'holiday', label: 'Holiday Calendar', helper: 'Org-wide holidays and closures' },
        { key: 'management', label: 'Leave Allocations', helper: 'Leave types and allocations' },
        { key: 'apply', label: 'Manage Leaves', helper: 'Balances, requests, and approvals' }
      ]
      : [
        { key: 'holiday', label: 'Holiday Calendar', helper: 'Upcoming holidays and closures' },
        { key: 'apply', label: 'Apply Leave', helper: 'Balance visibility and request actions' }
      ])

  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => requestedTab || initialTab)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [selectedHolidayMonth, setSelectedHolidayMonth] = useState(String(new Date().getMonth()))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(toDateInputValue(new Date()))
  const [expandedCalendarDate, setExpandedCalendarDate] = useState('')
  const [calendarView, setCalendarView] = useState('month')
  const [showWeekNumbers, setShowWeekNumbers] = useState(true)
  const [calendarFilters, setCalendarFilters] = useState(DEFAULT_CALENDAR_FILTERS)
  const [localCalendarEntries, setLocalCalendarEntries] = useState(() => {
    const stored = storage.get(LOCAL_CALENDAR_STORAGE_KEY, [])
    return Array.isArray(stored) ? stored.map(normalizeLocalCalendarEntry).filter(Boolean) : []
  })
  const [selectedEmployeeUid, setSelectedEmployeeUid] = useState('')
  const [leaveTypeActionError, setLeaveTypeActionError] = useState('')
  const [defaultAllocationError, setDefaultAllocationError] = useState('')
  const [holidayModal, setHolidayModal] = useState({ mode: '', draft: emptyHolidayDraft(isManagementWorkspace ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })
  const [holidayTouched, setHolidayTouched] = useState({})
  const [leaveTypeModal, setLeaveTypeModal] = useState({ mode: '', draft: emptyLeaveTypeDraft(), recordUid: '' })
  const [leaveTypeTouched, setLeaveTypeTouched] = useState({})
  const [decisionState, setDecisionState] = useState({ mode: '', record: null, note: '' })
  const [leaveRequestModal, setLeaveRequestModal] = useState({ mode: '', record: null, draft: emptyLeaveRequestDraft() })
  const [leaveRequestTouched, setLeaveRequestTouched] = useState({})
  const [cancellationRequestState, setCancellationRequestState] = useState({ record: null, reason: '' })
  const [manualGrant, setManualGrant] = useState({ leaveTypeUid: '', days: '' })
  const [manualGrantTouched, setManualGrantTouched] = useState({})
  const [leaveForm, setLeaveForm] = useState({ leaveTypeUid: '', startDate: '', endDate: '', reason: '' })
  const [leaveFormTouched, setLeaveFormTouched] = useState({})

  const todayDate = useMemo(() => getTodayDateInput(), [])

  const holidaysQueryKey = ['leave', 'holidays', selectedYear]
  const publicRegionQueryKey = ['leave', 'holidays', 'public-region']
  const profileRegionQueryKey = ['leave', 'holidays', 'profile-region', String(user?.uid || user?.email || 'anonymous')]
  const leaveTypesQueryKey = ['leave', 'types']
  const employeesQueryKey = ['employees', 'lookup-directory', 'leave-management']
  const myBalancesQueryKey = ['leave', 'balances', 'current-user', selectedYear]
  const employeeBalancesQueryKey = ['leave', 'balances', 'employee', selectedEmployeeUid, selectedYear]
  const myRequestsQueryKey = ['leave', 'requests', 'mine']
  const pendingRequestsQueryKey = ['leave', 'requests', 'pending']
  const pendingCancellationRequestsQueryKey = ['leave', 'requests', 'pending-cancellations']
  const leavePreviewQueryKey = ['leave', 'preview', leaveForm.startDate, leaveForm.endDate]

  const profileRegionQuery = useQuery({
    queryKey: profileRegionQueryKey,
    queryFn: () => withPersistentCache(profileRegionQueryKey, async () => {
      const profile = await employeeService.getMyProfile()
      return profile?.employee || null
    }),
    initialData: () => readCachedQuery(profileRegionQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(profileRegionQueryKey),
    enabled: canViewHolidayTab && Boolean(user?.uid || user?.email),
    retry: 1,
    staleTime: 30 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false
  })
  const regionEmployee = profileRegionQuery.data || null
  const detailsHolidayCountryCode = resolveCountryFromUserDetails(user, regionEmployee)
  const shouldUsePublicIpRegion = canViewHolidayTab
    && !detailsHolidayCountryCode
    && (!Boolean(user?.uid || user?.email) || profileRegionQuery.isFetched || profileRegionQuery.isError)
  const publicRegionQuery = useQuery({
    queryKey: publicRegionQueryKey,
    queryFn: () => withPersistentCache(publicRegionQueryKey, detectRegionByPublicIp),
    initialData: () => readCachedQuery(publicRegionQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(publicRegionQueryKey),
    enabled: shouldUsePublicIpRegion,
    retry: 1,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false
  })
  const detectedHolidayRegion = publicRegionQuery.data || null
  const ipHolidayCountryCode = sanitizeCountryCode(detectedHolidayRegion?.countryCode)
  const detectedHolidayCountryCode = sanitizeCountryCode(detailsHolidayCountryCode || ipHolidayCountryCode || 'US') || 'US'
  const holidayRegionSource = detailsHolidayCountryCode
    ? 'user-details'
    : (ipHolidayCountryCode ? 'ip' : 'default')

  const holidaysQuery = useQuery({
    queryKey: holidaysQueryKey,
    queryFn: () => withPersistentCache(holidaysQueryKey, () => leaveService.getHolidayCalendar(Number(selectedYear))),
    initialData: () => readCachedQuery(holidaysQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(holidaysQueryKey),
    enabled: canReadHolidayCalendar,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const leaveTypesQuery = useQuery({
    queryKey: leaveTypesQueryKey,
    queryFn: () => withPersistentCache(leaveTypesQueryKey, leaveService.getLeaveTypes),
    initialData: () => readCachedQuery(leaveTypesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(leaveTypesQueryKey),
    enabled: canViewManagementTab || canCreateOwnLeaveRequest || canViewLeaveRequests || canViewMyLeaveBalance || canAccessManageLeaveQueue,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const employeesQuery = useQuery({
    queryKey: employeesQueryKey,
    queryFn: () => withPersistentCache(employeesQueryKey, employeeService.getLookupDirectory),
    initialData: () => readCachedQuery(employeesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(employeesQueryKey),
    enabled: isManagementWorkspace && (canViewManagementTab || canAccessManageLeaveQueue),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const myPunchLogsLookupQuery = useQuery({
    queryKey: ['attendance', 'employee', 'my-logs', todayDate],
    queryFn: () => withPersistentCache(['attendance', 'employee', 'my-logs', todayDate], () => attendanceService.getMyPunchLogs(todayDate)),
    initialData: () => readCachedQuery(['attendance', 'employee', 'my-logs', todayDate]),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(['attendance', 'employee', 'my-logs', todayDate]),
    enabled: !isManagementWorkspace && canViewApplyTab,
    retry: 1,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const myRegularizationsLookupQuery = useQuery({
    queryKey: ['attendance', 'employee', 'regularizations', 'mine'],
    queryFn: () => withPersistentCache(['attendance', 'employee', 'regularizations', 'mine'], attendanceService.getMyRegularizations),
    initialData: () => readCachedQuery(['attendance', 'employee', 'regularizations', 'mine']),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(['attendance', 'employee', 'regularizations', 'mine']),
    enabled: !isManagementWorkspace && canViewApplyTab,
    retry: 1,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const employees = employeesQuery.data || []
  const currentEmployee = useMemo(() => {
    if (!isManagementWorkspace) return null
    const userUid = String(user?.uid || '')
    const userEmail = String(user?.email || '').trim().toLowerCase()
    if (userUid) {
      const byUserUid = employees.find((item) => String(item.userUid || '') === userUid)
      if (byUserUid) return byUserUid
    }
    if (userEmail) {
      const byEmail = employees.find((item) => String(item.email || '').trim().toLowerCase() === userEmail)
      if (byEmail) return byEmail
    }
    return null
  }, [employees, isManagementWorkspace, user?.email, user?.uid])

  const myRequestsQuery = useQuery({
    queryKey: myRequestsQueryKey,
    queryFn: () => withPersistentCache(myRequestsQueryKey, leaveService.getMyLeaveRequests),
    initialData: () => readCachedQuery(myRequestsQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(myRequestsQueryKey),
    enabled: canViewApplyTab,
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const currentEmployeeUid = useMemo(() => {
    const explicitEmployeeUid = String(user?.employeeUid || '')
    if (explicitEmployeeUid) return explicitEmployeeUid
    if (currentEmployee?.uid) return String(currentEmployee.uid)

    const fallbackEmployeeUid = [
      myRequestsQuery.data?.[0]?.employeeUid,
      myPunchLogsLookupQuery.data?.[0]?.employeeUid,
      myRegularizationsLookupQuery.data?.[0]?.employeeUid
    ].find(Boolean)

    return String(fallbackEmployeeUid || '')
  }, [currentEmployee?.uid, myPunchLogsLookupQuery.data, myRegularizationsLookupQuery.data, myRequestsQuery.data, user?.employeeUid])

  const isResolvingCurrentEmployee = isManagementWorkspace
    ? employeesQuery.isLoading
    : (myRequestsQuery.isLoading || myPunchLogsLookupQuery.isLoading || myRegularizationsLookupQuery.isLoading)

  const myBalancesQuery = useQuery({
    queryKey: myBalancesQueryKey,
    queryFn: () => withPersistentCache(myBalancesQueryKey, () => leaveService.getMyLeaveBalances(currentEmployeeUid, Number(selectedYear))),
    initialData: () => readCachedQuery(myBalancesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(myBalancesQueryKey),
    enabled: canViewMyLeaveBalance && Boolean(currentEmployeeUid),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const employeeBalancesQuery = useQuery({
    queryKey: employeeBalancesQueryKey,
    queryFn: () => withPersistentCache(employeeBalancesQueryKey, () => leaveService.getEmployeeLeaveBalances(selectedEmployeeUid, Number(selectedYear))),
    initialData: () => readCachedQuery(employeeBalancesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(employeeBalancesQueryKey),
    enabled: Boolean(isManagementWorkspace && canViewMyLeaveBalance && selectedEmployeeUid),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const pendingRequestsQuery = useQuery({
    queryKey: pendingRequestsQueryKey,
    queryFn: () => withPersistentCache(pendingRequestsQueryKey, leaveService.getPendingLeaveRequests),
    initialData: () => readCachedQuery(pendingRequestsQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(pendingRequestsQueryKey),
    enabled: canViewManageLeaveQueue,
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const pendingCancellationRequestsQuery = useQuery({
    queryKey: pendingCancellationRequestsQueryKey,
    queryFn: () => withPersistentCache(pendingCancellationRequestsQueryKey, leaveService.getPendingLeaveCancellationRequests),
    initialData: () => readCachedQuery(pendingCancellationRequestsQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(pendingCancellationRequestsQueryKey),
    enabled: canViewManageLeaveQueue,
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })

  const previewEnabled = Boolean(leaveForm.startDate && leaveForm.endDate && leaveForm.startDate <= leaveForm.endDate)
  const leavePreviewQuery = useQuery({
    queryKey: leavePreviewQueryKey,
    queryFn: () => withPersistentCache(leavePreviewQueryKey, () => leaveService.previewLeaveDays(leaveForm.startDate, leaveForm.endDate)),
    initialData: () => readCachedQuery(leavePreviewQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(leavePreviewQueryKey),
    enabled: previewEnabled && canViewApplyTab,
    retry: 0,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: 'always',
    meta: { suppressGlobalLoader: true }
  })

  useEffect(() => {
    if (!isManagementWorkspace) return
    const firstEmployeeUid = employeesQuery.data?.[0]?.uid || ''
    if (!selectedEmployeeUid && firstEmployeeUid) {
      setSelectedEmployeeUid(String(firstEmployeeUid))
    }
  }, [employeesQuery.data, isManagementWorkspace, selectedEmployeeUid])

  useEffect(() => {
    const candidate = new Date(selectedCalendarDate)
    if (!Number.isNaN(candidate.getTime()) && String(candidate.getFullYear()) === String(selectedYear) && String(candidate.getMonth()) === String(selectedHolidayMonth)) {
      return
    }
    setSelectedCalendarDate(toDateInputValue(new Date(Number(selectedYear), Number(selectedHolidayMonth), 1)))
  }, [selectedHolidayMonth, selectedYear])

  useEffect(() => {
    storage.set(LOCAL_CALENDAR_STORAGE_KEY, localCalendarEntries)
  }, [localCalendarEntries])

  const leaveTypes = leaveTypesQuery.data || []
  const holidays = holidaysQuery.data || []
  const myBalances = myBalancesQuery.data || []
  const myRequests = myRequestsQuery.data || []
  const pendingRequests = pendingRequestsQuery.data || []
  const pendingCancellationRequests = pendingCancellationRequestsQuery.data || []
  const employeeBalances = employeeBalancesQuery.data || []
  const calendarOwnerKey = String(user?.employeeUid || currentEmployeeUid || user?.uid || user?.email || '')
  const calendarOwnerLabel = user?.fullName || user?.name || user?.email || 'Current user'

  const leaveTypeMap = useMemo(() => new Map(leaveTypes.map((item) => [item.uid, item])), [leaveTypes])
  const employeeMap = useMemo(() => new Map(employees.map((item) => [item.uid, item])), [employees])
  const yearOptions = useMemo(() => getYearOptions(), [])
  const leaveTypeOptions = useMemo(() => buildLeaveTypeOptions(leaveTypes), [leaveTypes])
  const manualGrantLeaveTypeOptions = useMemo(() => buildLeaveTypeOptions(leaveTypes.filter((item) => item.requiresManualGrant)), [leaveTypes])
  const requestBalanceByLeaveType = useMemo(() => new Map(myBalances.map((balance) => [String(balance.leaveTypeUid), balance])), [myBalances])
  const requestLeaveTypeOptions = useMemo(() => {
    const mappedOptions = leaveTypes
      .filter((leaveType) => leaveType.isActive)
      .map((leaveType) => {
        const balance = requestBalanceByLeaveType.get(String(leaveType.uid)) || null
        const entitlementDays = balance ? getBalanceEntitlementDays(balance) : 0
        return {
          value: leaveType.uid,
          label: `${leaveType.name} (${leaveType.code})`,
          description: !canViewMyLeaveBalance
            ? 'Balance visibility depends on your role access.'
            : (balance
            ? `Available ${formatLeaveDays(balance.availableBalance)} of ${formatLeaveDays(entitlementDays)} days`
            : 'Not allocated for the selected policy year yet')
        }
      })

    return mappedOptions.sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')))
  }, [canViewMyLeaveBalance, leaveTypes, requestBalanceByLeaveType])
  const leaveRequestModalLeaveTypeOptions = useMemo(() => {
    const optionMap = new Map(requestLeaveTypeOptions.map((option) => [String(option.value), option]))
    const selectedModalLeaveTypeUid = String(leaveRequestModal.draft.leaveTypeUid || '')

    if (selectedModalLeaveTypeUid && !optionMap.has(selectedModalLeaveTypeUid)) {
      const leaveType = leaveTypeMap.get(selectedModalLeaveTypeUid)
      optionMap.set(selectedModalLeaveTypeUid, {
        value: selectedModalLeaveTypeUid,
        label: leaveType ? `${leaveType.name} (${leaveType.code})` : selectedModalLeaveTypeUid,
        description: 'Currently linked to this leave request.'
      })
    }

    return Array.from(optionMap.values())
  }, [leaveRequestModal.draft.leaveTypeUid, leaveTypeMap, requestLeaveTypeOptions])
  const selectedRequestBalance = useMemo(() => requestBalanceByLeaveType.get(String(leaveForm.leaveTypeUid)) || null, [leaveForm.leaveTypeUid, requestBalanceByLeaveType])
  const selectedRequestLeaveType = useMemo(() => leaveTypeMap.get(leaveForm.leaveTypeUid) || null, [leaveForm.leaveTypeUid, leaveTypeMap])
  const canValidateRequestBalance = canViewMyLeaveBalance
  const selectedRequestHasLedger = canValidateRequestBalance ? Boolean(selectedRequestBalance) : true
  const requestedAppliedDays = Number(leavePreviewQuery.data?.appliedDays || 0)
  const missingRequestBalanceMessage = canValidateRequestBalance && leaveForm.leaveTypeUid && !selectedRequestHasLedger
    ? `${selectedRequestLeaveType ? `${selectedRequestLeaveType.name} (${selectedRequestLeaveType.code})` : 'Selected leave type'} is not allocated for policy year ${selectedYear} yet. Please contact the leave management team or generate/grant the leave balance first.`
    : ''
  const insufficientLeaveBalance = Boolean(
    canValidateRequestBalance
    && selectedRequestHasLedger
    && previewEnabled
    && leavePreviewQuery.data
    && requestedAppliedDays > Number(selectedRequestBalance.availableBalance || 0)
  )
  const insufficientLeaveBalanceMessage = insufficientLeaveBalance
    ? `${selectedRequestLeaveType ? `${selectedRequestLeaveType.name} (${selectedRequestLeaveType.code})` : 'Selected leave type'} has only ${formatLeaveDays(selectedRequestBalance?.availableBalance || 0)} day(s) available, but the selected date range requires ${formatLeaveDays(requestedAppliedDays)} day(s). Please reduce the range or choose another leave type.`
    : ''
  const holidayErrors = useMemo(() => buildHolidayErrors(holidayModal.draft, isManagementWorkspace), [holidayModal.draft, isManagementWorkspace])
  const leaveTypeErrors = useMemo(() => buildLeaveTypeErrors(leaveTypeModal.draft), [leaveTypeModal.draft])
  const manualGrantErrors = useMemo(() => buildManualGrantErrors(selectedEmployeeUid, manualGrant), [manualGrant, selectedEmployeeUid])
  const leaveFormErrors = useMemo(() => buildLeaveRequestErrors(leaveForm), [leaveForm])
  const leaveRequestErrors = useMemo(() => buildLeaveRequestErrors(leaveRequestModal.draft), [leaveRequestModal.draft])
  const holidayMonthOptions = useMemo(() => getMonthOptions(selectedYear), [selectedYear])
  const availableTabs = useMemo(() => filterAccessibleTabs(resolvedTabs, (tabKey) => {
    if (tabKey === 'holiday') return canViewHolidayTab
    if (tabKey === 'management') return canViewManagementTab
    if (tabKey === 'apply') return canViewApplyTab
    return false
  }), [canViewApplyTab, canViewHolidayTab, canViewManagementTab, resolvedTabs])
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

  useEffect(() => {
    if (!leaveForm.leaveTypeUid) return
    if (requestLeaveTypeOptions.some((item) => String(item.value) === String(leaveForm.leaveTypeUid))) return
    setLeaveForm((current) => ({ ...current, leaveTypeUid: '' }))
  }, [leaveForm.leaveTypeUid, requestLeaveTypeOptions])

  useEffect(() => {
    if (!requestedTab) return
    setActiveTab((current) => (requestedTab !== current ? requestedTab : current))
  }, [requestedTab])

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'holiday') return canViewHolidayTab
      if (tabKey === 'management') return canViewManagementTab
      if (tabKey === 'apply') return canViewApplyTab
      return false
    }, availableTabs[0]?.key || initialTab)

    if (!nextTab) return
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    if (requestedTab !== nextTab) {
      updateTabSearchParam(nextTab)
    }
  }, [activeTab, availableTabs, canViewApplyTab, canViewHolidayTab, canViewManagementTab, initialTab, requestedTab, updateTabSearchParam])

  const holidayLegendItems = useMemo(() => getHolidayLegendItems(), [])
  const holidayCalendarDays = useMemo(() => getCalendarDays(calendarView, selectedYear, selectedHolidayMonth, selectedCalendarDate), [calendarView, selectedCalendarDate, selectedHolidayMonth, selectedYear])
  useEffect(() => {
    if (!expandedCalendarDate) return
    if (holidayCalendarDays.some((date) => toDateInputValue(date) === expandedCalendarDate)) return
    setExpandedCalendarDate('')
  }, [expandedCalendarDate, holidayCalendarDays])
  const remoteCalendarEntries = useMemo(() => {
    const orgCalendarEntries = holidays.map((item) => ({ ...item, source: 'org', isLocal: false, audience: item.audience || 'org' }))
    return dedupeCalendarEntries(orgCalendarEntries)
  }, [holidays])
  const adminCalendarEntries = useMemo(() => remoteCalendarEntries.filter((entry) => {
    if (entry.isLocal) return false
    if (String(entry.audience || '').trim().toLowerCase() !== 'org') return false
    return String(entry.source || '').trim().toLowerCase() !== 'external'
  }), [remoteCalendarEntries])
  const visibleLocalCalendarEntries = useMemo(() => localCalendarEntries.filter((item) => item.audience === 'org' || !calendarOwnerKey || String(item.ownerKey || '') === calendarOwnerKey), [calendarOwnerKey, localCalendarEntries])
  const calendarEntries = useMemo(() => sortCalendarEntries([...remoteCalendarEntries, ...visibleLocalCalendarEntries]), [remoteCalendarEntries, visibleLocalCalendarEntries])
  const filteredCalendarEntries = useMemo(() => calendarEntries.filter((entry) => {
    const sourceKey = entry.audience === 'personal' || entry.isLocal ? 'personal' : 'org'
    if (!entry.isActive && !calendarFilters.inactive) return false
    if (!calendarFilters[entry.scope]) return false
    if (!calendarFilters[sourceKey]) return false
    return true
  }), [calendarEntries, calendarFilters])
  const holidaysByDate = useMemo(() => filteredCalendarEntries.reduce((accumulator, holiday) => {
    const key = holiday.holidayDate
    accumulator[key] = accumulator[key] || []
    accumulator[key].push(holiday)
    return accumulator
  }, {}), [filteredCalendarEntries])
  const visibleHolidayMonthKey = `${selectedYear}-${String(Number(selectedHolidayMonth) + 1).padStart(2, '0')}`
  const visibleHolidays = useMemo(() => filteredCalendarEntries.filter((holiday) => String(holiday.holidayDate || '').startsWith(visibleHolidayMonthKey)), [filteredCalendarEntries, visibleHolidayMonthKey])
  const selectedHolidayMonthLabel = useMemo(() => new Date(Number(selectedYear), Number(selectedHolidayMonth), 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), [selectedHolidayMonth, selectedYear])
  const selectedCalendarLabel = useMemo(() => {
    const focusDate = new Date(selectedCalendarDate)
    if (Number.isNaN(focusDate.getTime())) return selectedHolidayMonthLabel
    if (calendarView === 'day') {
      return focusDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (calendarView === 'week') {
      const weekStart = getStartOfWeek(focusDate)
      const weekEnd = addDays(weekStart, 6)
      return `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return selectedHolidayMonthLabel
  }, [calendarView, selectedCalendarDate, selectedHolidayMonthLabel])
  const selectedCalendarRows = useMemo(() => chunkDays(holidayCalendarDays, calendarView === 'month' ? 7 : holidayCalendarDays.length || 1), [calendarView, holidayCalendarDays])
  const visibleCalendarDateKeys = useMemo(() => holidayCalendarDays.map((date) => toDateInputValue(date)), [holidayCalendarDays])
  const visibleRegisterHolidays = useMemo(() => {
    const calendarScopeRows = calendarView === 'month'
      ? adminCalendarEntries.filter((holiday) => String(holiday.holidayDate || '').startsWith(visibleHolidayMonthKey))
      : adminCalendarEntries.filter((holiday) => visibleCalendarDateKeys.includes(holiday.holidayDate))

    return calendarScopeRows.filter((entry) => {
      if (!entry.isActive && !calendarFilters.inactive) return false
      if (!calendarFilters[entry.scope]) return false
      return true
    })
  }, [adminCalendarEntries, calendarFilters, calendarView, visibleCalendarDateKeys, visibleHolidayMonthKey])
  const { items: sortedVisibleRegisterHolidays, sortConfig: holidayRegisterSortConfig, requestSort: requestHolidayRegisterSort } = useSortableData(visibleRegisterHolidays, {
    initialKey: 'date',
    initialDirection: 'asc',
    accessors: {
      date: (holiday) => holiday.holidayDate || '',
      when: (holiday) => `${holiday.holidayDate || ''} ${holiday.startTime || (holiday.allDay ? '00:00' : '')}`.trim(),
      entry: (holiday) => `${holiday.name || ''} ${holiday.ownerLabel || ''}`.trim(),
      type: (holiday) => getHolidayScopeMeta(holiday.scope).label,
      source: (holiday) => holiday.isLocal ? (holiday.ownerLabel || 'Personal entry') : 'Organization calendar',
      description: (holiday) => holiday.description || '',
      status: (holiday) => (holiday.isActive ? 'Active' : 'Inactive')
    }
  })
  const { items: sortedLeaveTypes, sortConfig: leaveTypeSortConfig, requestSort: requestLeaveTypeSort } = useSortableData(leaveTypes, {
    initialKey: 'code',
    initialDirection: 'asc',
    accessors: {
      code: (item) => item.code || '',
      name: (item) => item.name || '',
      catalogDefault: (item) => Number(item.annualDays || 0),
      assignmentModel: (item) => `${item.autoAllocate ? 'Suggested default balance' : 'Flexible employee-wise balance'} ${item.requiresManualGrant ? 'Direct assignment enabled' : 'Policy-driven only'}`.trim(),
      carryForward: (item) => `${item.carryForwardAllowed ? 'Allowed' : 'Not allowed'} ${item.carryForwardCap ?? ''}`.trim(),
      status: (item) => (item.isActive ? 'Active' : 'Inactive')
    }
  })
  const { items: sortedEmployeeBalances, sortConfig: employeeBalanceSortConfig, requestSort: requestEmployeeBalanceSort } = useSortableData(selectedEmployeeUid ? employeeBalances : [], {
    initialKey: 'leaveType',
    initialDirection: 'asc',
    accessors: {
      leaveType: (balance) => {
        const leaveType = leaveTypeMap.get(balance.leaveTypeUid)
        return leaveType ? `${leaveType.name} ${leaveType.code}`.trim() : String(balance.leaveTypeUid || '')
      },
      opening: (balance) => Number(balance.openingBalance || 0),
      annual: (balance) => Number(balance.annualAllocation || 0),
      carryForward: (balance) => Number(balance.carryForwardIn || 0),
      manual: (balance) => Number(balance.manualGranted || 0),
      used: (balance) => Number(balance.usedDays || 0),
      pending: (balance) => Number(balance.pendingDays || 0),
      available: (balance) => Number(balance.availableBalance || 0)
    }
  })
  const { items: sortedMyBalances, sortConfig: myBalanceSortConfig, requestSort: requestMyBalanceSort } = useSortableData(myBalances, {
    initialKey: 'leave',
    initialDirection: 'asc',
    accessors: {
      leave: (balance) => {
        const leaveType = leaveTypeMap.get(balance.leaveTypeUid)
        return leaveType ? `${leaveType.name} ${leaveType.code}`.trim() : String(balance.leaveTypeUid || '')
      },
      allocated: (balance) => Number(getBalanceEntitlementDays(balance) || 0),
      used: (balance) => Number(balance.usedDays || 0),
      pending: (balance) => Number(balance.pendingDays || 0),
      available: (balance) => Number(balance.availableBalance || 0)
    }
  })
  const { items: sortedMyRequests, sortConfig: myRequestSortConfig, requestSort: requestMyRequestSort } = useSortableData(myRequests, {
    initialKey: 'dateRange',
    initialDirection: 'desc',
    accessors: {
      leaveType: (request) => {
        const leaveType = leaveTypeMap.get(request.leaveTypeUid)
        return leaveType ? `${leaveType.name} ${leaveType.code}`.trim() : String(request.leaveTypeUid || '')
      },
      dateRange: (request) => `${request.startDate || ''} ${request.endDate || ''}`.trim(),
      appliedDays: (request) => Number(request.appliedDays || 0),
      status: (request) => request.status || '',
      reason: (request) => request.reason || '',
      reviewerNote: (request) => request.reviewerNote || ''
    }
  })
  const { items: sortedPendingRequests, sortConfig: pendingRequestSortConfig, requestSort: requestPendingRequestSort } = useSortableData(pendingRequests, {
    initialKey: 'employee',
    initialDirection: 'asc',
    accessors: {
      employee: (request) => {
        const employee = employeeMap.get(request.employeeUid)
        return employee ? `${employee.fullName} ${employee.employeeCode}`.trim() : String(request.employeeUid || '')
      },
      leaveType: (request) => {
        const leaveType = leaveTypeMap.get(request.leaveTypeUid)
        return leaveType ? `${leaveType.name} ${leaveType.code}`.trim() : String(request.leaveTypeUid || '')
      },
      dateRange: (request) => `${request.startDate || ''} ${request.endDate || ''}`.trim(),
      appliedDays: (request) => Number(request.appliedDays || 0),
      reason: (request) => request.reason || '',
      status: (request) => request.status || ''
    }
  })
  const { items: sortedPendingCancellationRequests } = useSortableData(pendingCancellationRequests, {
    initialKey: 'employee',
    initialDirection: 'asc',
    accessors: {
      employee: (request) => {
        const employee = employeeMap.get(request.employeeUid)
        return employee ? `${employee.fullName} ${employee.employeeCode}`.trim() : String(request.employeeUid || '')
      },
      leaveType: (request) => {
        const leaveType = leaveTypeMap.get(request.leaveTypeUid)
        return leaveType ? `${leaveType.name} ${leaveType.code}`.trim() : String(request.leaveTypeUid || '')
      },
      dateRange: (request) => `${request.startDate || ''} ${request.endDate || ''}`.trim(),
      appliedDays: (request) => Number(request.appliedDays || 0),
      cancellationReason: (request) => request.cancellationReason || '',
      cancellationStatus: (request) => request.cancellationStatus || ''
    }
  })
  const leaveRequestRows = useMemo(() => {
    const rowsByUid = new Map()

    sortedMyRequests.forEach((request) => {
      rowsByUid.set(String(request.uid), request)
    })

    sortedPendingRequests.forEach((request) => {
      const rowKey = String(request.uid)
      if (rowsByUid.has(rowKey)) {
        rowsByUid.set(rowKey, {
          ...rowsByUid.get(rowKey),
          ...request
        })
        return
      }

      rowsByUid.set(rowKey, request)
    })

    sortedPendingCancellationRequests.forEach((request) => {
      const rowKey = String(request.uid)
      if (rowsByUid.has(rowKey)) {
        rowsByUid.set(rowKey, {
          ...rowsByUid.get(rowKey),
          ...request
        })
        return
      }

      rowsByUid.set(rowKey, request)
    })

    return Array.from(rowsByUid.values())
  }, [sortedMyRequests, sortedPendingCancellationRequests, sortedPendingRequests])
  const { items: sortedLeaveRequestRows, sortConfig: leaveRequestSortConfig, requestSort: requestLeaveRequestSort } = useSortableData(leaveRequestRows, {
    initialKey: 'dateRange',
    initialDirection: 'desc',
    accessors: {
      employee: (request) => {
        const employee = employeeMap.get(request.employeeUid)
        return employee ? `${employee.fullName} ${employee.employeeCode}`.trim() : String(request.employeeUid || '')
      },
      leaveType: (request) => {
        const leaveType = leaveTypeMap.get(request.leaveTypeUid)
        return leaveType ? `${leaveType.name} ${leaveType.code}`.trim() : String(request.leaveTypeUid || '')
      },
      dateRange: (request) => `${request.startDate || ''} ${request.endDate || ''}`.trim(),
      appliedDays: (request) => Number(request.appliedDays || 0),
      status: (request) => `${request.status || ''} ${request.cancellationStatus || ''}`.trim(),
      cancellationStatus: (request) => request.cancellationStatus || '',
      reason: (request) => request.reason || '',
      cancellationReason: (request) => request.cancellationReason || '',
      reviewerNote: (request) => request.cancellationReviewerNote || request.reviewerNote || ''
    }
  })
  const pinnedLeaveRequestRows = useMemo(() => prioritizeRowsByEmployee(sortedLeaveRequestRows, currentEmployeeUid), [currentEmployeeUid, sortedLeaveRequestRows])
  const hasExportableCalendarEntries = sortedVisibleRegisterHolidays.length > 0
  const focusedDayHolidays = useMemo(() => holidaysByDate[selectedCalendarDate] || [], [holidaysByDate, selectedCalendarDate])

  const holidaySummary = useMemo(() => getHolidaySummary(calendarEntries), [calendarEntries])
  const detectedHolidayRegionLabel = useMemo(() => {
    const countryCode = detectedHolidayCountryCode
    const countryName = getCountryDisplayName(countryCode)
    if (holidayRegionSource === 'ip') {
      const ipCountryName = String(detectedHolidayRegion?.countryName || '').trim() || countryName
      const regionName = String(detectedHolidayRegion?.regionName || '').trim()
      const cityName = String(detectedHolidayRegion?.cityName || '').trim()
      if (cityName && regionName && ipCountryName) return `${cityName}, ${regionName}, ${ipCountryName} (${countryCode})`
      if (regionName && ipCountryName) return `${regionName}, ${ipCountryName} (${countryCode})`
      if (ipCountryName) return `${ipCountryName} (${countryCode})`
    }
    return countryName ? `${countryName} (${countryCode})` : countryCode
  }, [detectedHolidayCountryCode, detectedHolidayRegion?.cityName, detectedHolidayRegion?.countryName, detectedHolidayRegion?.regionName, holidayRegionSource])
  const holidayRegionCardMessage = useMemo(() => {
    if (holidayRegionSource === 'user-details') {
      return `Regional holiday view follows your profile country: ${detectedHolidayRegionLabel}.`
    }

    if (holidayRegionSource === 'ip') {
      return `Profile country was not available, so regional holiday view is set from your current location: ${detectedHolidayRegionLabel}.`
    }

    return `Regional holiday view currently defaults to ${detectedHolidayRegionLabel}. Add your country in profile details for a personalized regional view.`
  }, [detectedHolidayRegionLabel, holidayRegionSource])
  const myBalanceSummary = useMemo(() => getLeaveBalanceSummary(myBalances), [myBalances])
  const myRequestSummary = useMemo(() => getLeaveRequestSummary(myRequests), [myRequests])
  const pendingQueueCount = useMemo(() => pendingRequests.length + pendingCancellationRequests.length, [pendingCancellationRequests.length, pendingRequests.length])
  const pendingEmployeeCount = useMemo(() => new Set([...pendingRequests, ...pendingCancellationRequests].map((item) => String(item.employeeUid || '')).filter(Boolean)).size, [pendingCancellationRequests, pendingRequests])
  const employeeBalanceSummary = useMemo(() => getLeaveBalanceSummary(employeeBalances), [employeeBalances])

  const holidayMutation = useMutation({ mutationFn: async ({ mode, recordUid, payload }) => (mode === 'edit' ? leaveService.updateHoliday(recordUid, payload) : leaveService.createHoliday(payload)) })
  const deleteHolidayMutation = useMutation({ mutationFn: leaveService.deleteHoliday })
  const leaveTypeMutation = useMutation({ mutationFn: async ({ mode, recordUid, payload }) => (mode === 'edit' ? leaveService.updateLeaveType(recordUid, payload) : leaveService.createLeaveType(payload)) })
  const generateBalancesMutation = useMutation({ mutationFn: leaveService.generateLeaveBalances })
  const manualGrantMutation = useMutation({ mutationFn: leaveService.manualGrantLeaveBalance })
  const applyLeaveMutation = useMutation({ mutationFn: leaveService.applyLeave })
  const editLeaveMutation = useMutation({ mutationFn: ({ leaveRequestUid, payload }) => leaveService.editPendingLeaveRequest(leaveRequestUid, payload) })
  const deleteLeaveMutation = useMutation({ mutationFn: leaveService.deletePendingLeaveRequest })
  const requestLeaveCancellationMutation = useMutation({ mutationFn: ({ leaveRequestUid, reason }) => leaveService.requestLeaveCancellation(leaveRequestUid, reason) })
  const approveMutation = useMutation({ mutationFn: ({ leaveRequestUid, note }) => leaveService.approveLeaveRequest(leaveRequestUid, note) })
  const rejectMutation = useMutation({ mutationFn: ({ leaveRequestUid, note }) => leaveService.rejectLeaveRequest(leaveRequestUid, note) })
  const approveCancellationMutation = useMutation({ mutationFn: ({ leaveRequestUid, note }) => leaveService.approveLeaveCancellation(leaveRequestUid, note) })
  const rejectCancellationMutation = useMutation({ mutationFn: ({ leaveRequestUid, note }) => leaveService.rejectLeaveCancellation(leaveRequestUid, note) })

  function handleFieldChange(setter) {
    return (event) => {
      const { name, value } = event.target
      setter((current) => {
        if (name === 'color') {
          return { ...current, [name]: normalizeHexColor(value) || value }
        }
        return { ...current, [name]: value }
      })
    }
  }

  const handleHolidayFieldBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setHolidayTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleLeaveTypeFieldBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setLeaveTypeTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleManualGrantFieldBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setManualGrantTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleLeaveFormFieldBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setLeaveFormTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleLeaveRequestFieldBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setLeaveRequestTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const onHolidayDraftChange = (event) => {
    const { name, value } = event.target
    setHolidayModal((current) => {
      const nextDraft = { ...current.draft, [name]: value }
      if (name === 'scope' && !current.draft.color) {
        nextDraft.color = getHolidayScopeMeta(value).color || ''
      }
      if (name === 'allDay' && value) {
        nextDraft.startTime = ''
        nextDraft.endTime = ''
      }
      if (name === 'audience' && value === 'personal') {
        const allowedPersonalScopes = new Set(MY_CALENDAR_EVENT_OPTIONS.map((option) => option.value))
        if (!allowedPersonalScopes.has(String(nextDraft.scope || ''))) {
          nextDraft.scope = 'custom'
        }
        if (!current.draft.color) {
          nextDraft.color = '#0f766e'
        }
      }
      return { ...current, draft: nextDraft }
    })
  }

  const toggleCalendarFilter = (key) => {
    setCalendarFilters((current) => ({ ...current, [key]: !current[key] }))
  }

  const exportVisibleCalendar = () => {
    if (!hasExportableCalendarEntries) {
      showToast({
        tone: 'warning',
        title: 'Export unavailable',
        message: 'Add at least one calendar entry to the current view before exporting the .ics file.'
      })
      return
    }

    try {
      const icsContent = buildIcsContent(sortedVisibleRegisterHolidays)
      const fileName = `one-gms-calendar-${selectedYear}-${String(Number(selectedHolidayMonth) + 1).padStart(2, '0')}.ics`

      if (typeof navigator !== 'undefined' && typeof navigator.msSaveOrOpenBlob === 'function') {
        navigator.msSaveOrOpenBlob(new Blob([icsContent], { type: 'application/octet-stream' }), fileName)
        return
      }

      downloadBlob(new Blob([icsContent], { type: 'application/octet-stream' }), fileName)
    } catch (error) {
      showToast({
        tone: 'danger',
        title: 'Export failed',
        message: error?.message || 'The calendar file could not be generated for download.'
      })
    }
  }

  const handleCalendarImport = async (event) => {
    if (!canCreateHolidayEntries) {
      openStatus({ tone: 'danger', title: 'Calendar access blocked', message: 'Your role does not have permission to import calendar entries.' })
      event.target.value = ''
      return
    }

    const file = event.target.files?.[0]
    if (!file) return

    const content = await file.text()
    const importedEvents = parseIcsEvents(content).map((item) => ({
      ...item,
      ownerKey: calendarOwnerKey,
      ownerLabel: calendarOwnerLabel,
      audience: 'personal'
    }))

    if (!importedEvents.length) {
      openStatus({ tone: 'warning', title: 'Import skipped', message: 'No compatible calendar entries were found in the selected file.' })
      return
    }

    setLocalCalendarEntries((current) => sortCalendarEntries([...current, ...importedEvents]))
    openStatus({ tone: 'success', title: 'Calendar imported', message: `${importedEvents.length} entry${importedEvents.length > 1 ? 'ies were' : ' was'} added to your personal calendar lane.` })
    event.target.value = ''
  }

  const onManualGrantChange = (event) => {
    const { name, value } = event.target
    setManualGrant((current) => ({ ...current, [name]: value }))
  }
  const onLeaveFormChange = handleFieldChange(setLeaveForm)
  const onLeaveRequestModalChange = handleFieldChange((updater) => {
    setLeaveRequestModal((current) => ({
      ...current,
      draft: typeof updater === 'function' ? updater(current.draft) : updater
    }))
  })

  const handleAllocationEmployeeChange = (value) => {
    const nextValue = String(value || '')
    setSelectedEmployeeUid(nextValue)
  }

  const handleLeaveTypeModalChange = (event) => {
    const { name, value, type, checked } = event.target
    const nextValue = type === 'checkbox' ? checked : value
    if (leaveTypeActionError) setLeaveTypeActionError('')

    setLeaveTypeModal((current) => ({
      ...current,
      draft: {
        ...current.draft,
        [name]: name === 'code' ? normalizeLeaveCodeInput(nextValue) : nextValue
      }
    }))
  }

  async function invalidateLeaveData(extraKeys = []) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leave'] }),
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      ...extraKeys.map((key) => queryClient.invalidateQueries({ queryKey: key }))
    ])
  }

  async function refetchLeaveViews(extraKeys = []) {
    const queryKeys = extraKeys.filter((key) => Array.isArray(key) && key.length)
    if (!queryKeys.length) return

    await Promise.all(queryKeys.map((key) => queryClient.refetchQueries({ queryKey: key, exact: true, type: 'active' })))
  }

  async function runMutation(task, successTitle, successMessage, options = {}) {
    const { errorTitle = 'Action failed', onError, loaderConfig = {} } = options

    try {
      await withLoader({ title: successTitle, message: successMessage, ...loaderConfig }, task)
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      openStatus({ tone: 'danger', title: errorTitle, message })
      if (typeof onError === 'function') onError(message, error)
      return false
    }
  }

  async function submitHoliday() {
    const requiredAction = holidayModal.mode === 'edit' ? PERMISSION_ACTIONS.update : PERMISSION_ACTIONS.create
    const canSaveHoliday = hasModulePermission(user, PERMISSION_MODULES.holidayCalendar, requiredAction)
    if (!canSaveHoliday) {
      openStatus({ tone: 'danger', title: 'Calendar access blocked', message: 'Your role does not have permission to save holiday calendar entries from this workspace.' })
      return
    }

    const validationFields = [ ...(isManagementWorkspace ? ['audience'] : []), 'scope', 'holidayDate', 'name', ...(holidayModal.draft.allDay ? [] : ['startTime', 'endTime']) ]
    setHolidayTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(holidayErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => holidayErrors[fieldName]).find(Boolean)
      openStatus({ tone: 'warning', title: 'Calendar entry has validation errors', message: firstError || 'Resolve the highlighted fields before saving this entry.' })
      return
    }

    const shouldPersistLocally = !isManagementWorkspace || holidayModal.recordSource === 'local' || holidayModal.draft.audience === 'personal'

    if (shouldPersistLocally) {
      const nextEntry = normalizeLocalCalendarEntry({
        ...holidayModal.draft,
        uid: holidayModal.recordUid || createCalendarUid('local'),
        ownerKey: calendarOwnerKey,
        ownerLabel: calendarOwnerLabel,
        audience: 'personal'
      })

      setLocalCalendarEntries((current) => {
        const remaining = current.filter((item) => String(item.uid) !== String(holidayModal.recordUid))
        return sortCalendarEntries([...remaining, nextEntry])
      })
      setHolidayModal({ mode: '', draft: emptyHolidayDraft(isManagementWorkspace ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })
      setHolidayTouched({})
      openStatus({ tone: 'success', title: 'Calendar entry saved', message: 'Your personal calendar lane has been updated.' })
      return
    }

    await runMutation(async () => {
      await holidayMutation.mutateAsync({ mode: holidayModal.mode, recordUid: holidayModal.recordUid, payload: holidayModal.draft })
      await invalidateLeaveData()
      setHolidayModal({ mode: '', draft: emptyHolidayDraft(isManagementWorkspace ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })
      setHolidayTouched({})
      openStatus({ tone: 'success', title: 'Calendar entry saved', message: 'The organization calendar has been refreshed with the latest update.' })
    }, 'Saving calendar entry', 'Updating the organization calendar and refreshing the latest view.')
  }

  async function removeHoliday(holiday) {
    if (String(holiday?.source || '').trim().toLowerCase() === 'external') {
      openStatus({ tone: 'warning', title: 'Read-only entry', message: 'This entry is read-only and cannot be deleted from this screen.' })
      return
    }

    if (!canDeleteHolidayEntries) {
      openStatus({ tone: 'danger', title: 'Calendar access blocked', message: 'Your role does not have permission to delete holiday calendar entries.' })
      return
    }

    if (holiday?.isLocal || holiday?.audience === 'personal') {
      setLocalCalendarEntries((current) => current.filter((item) => String(item.uid) !== String(holiday.uid)))
      openStatus({ tone: 'success', title: 'Calendar entry removed', message: 'The personal calendar entry was removed.' })
      return
    }

    await runMutation(async () => {
      await deleteHolidayMutation.mutateAsync(holiday.uid)
      await invalidateLeaveData()
      openStatus({ tone: 'success', title: 'Holiday removed', message: 'The holiday has been deleted from the selected year calendar.' })
    }, 'Deleting holiday', 'Removing the holiday entry and refreshing the calendar.')
  }

  async function submitLeaveType() {
    const requiredAction = leaveTypeModal.mode === 'edit' ? PERMISSION_ACTIONS.update : PERMISSION_ACTIONS.create
    const canSaveLeaveType = hasModulePermission(user, PERMISSION_MODULES.leaveType, requiredAction)
    if (!canSaveLeaveType) {
      setLeaveTypeActionError('Your role does not have permission to save leave type catalog entries.')
      return false
    }

    setLeaveTypeActionError('')
    const validationFields = ['code', 'name', 'annualDays', 'carryForwardCap']
    setLeaveTypeTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(leaveTypeErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => leaveTypeErrors[fieldName]).find(Boolean)
      setLeaveTypeActionError(firstError || 'Resolve the highlighted leave type fields before saving.')
      return false
    }

    const saved = await runMutation(async () => {
      await leaveTypeMutation.mutateAsync({ mode: leaveTypeModal.mode, recordUid: leaveTypeModal.recordUid, payload: leaveTypeModal.draft })
      await invalidateLeaveData()
      setLeaveTypeModal({ mode: '', draft: emptyLeaveTypeDraft(), recordUid: '' })
      setLeaveTypeTouched({})
      openStatus({ tone: 'success', title: 'Leave type saved', message: 'The leave type catalog has been synchronized.' })
    }, 'Saving leave type', 'Updating leave type settings and refreshing allocations.', {
      errorTitle: leaveTypeModal.mode === 'edit' ? 'Leave type update failed' : 'Leave type creation failed',
      onError: (message) => setLeaveTypeActionError(message),
      loaderConfig: {
        delayMs: 0,
        minVisibleMs: 520
      }
    })

    return saved
  }

  async function generateBalances(employeeUid = '') {
    if (!canManageAllocations) {
      setDefaultAllocationError('Your role does not have permission to generate employee leave allocations.')
      return false
    }

    setDefaultAllocationError('')

    const generated = await runMutation(async () => {
      await generateBalancesMutation.mutateAsync({ year: Number(selectedYear), employeeUid: employeeUid || null })
      await invalidateLeaveData([employeeBalancesQueryKey, myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey, pendingCancellationRequestsQueryKey])
      await refetchLeaveViews([
        employeeUid ? ['leave', 'balances', 'employee', employeeUid, selectedYear] : null,
        employeeUid && String(employeeUid) === String(currentEmployeeUid) ? myBalancesQueryKey : null,
        myRequestsQueryKey,
        pendingRequestsQueryKey,
        pendingCancellationRequestsQueryKey
      ])
      openStatus({ tone: 'success', title: 'Balances generated', message: employeeUid ? 'Leave balances were generated for the selected employee.' : 'Leave balances were generated for the active workforce.' })
    }, 'Generating balances', 'Creating leave balance ledgers and syncing the latest totals.', {
      errorTitle: 'Default leave generation failed',
      onError: (message) => setDefaultAllocationError(message),
      loaderConfig: {
        delayMs: 0,
        minVisibleMs: 520
      }
    })

    return generated
  }

  async function submitManualGrant() {
    if (!canManageAllocations) {
      openStatus({ tone: 'danger', title: 'Allocation access blocked', message: 'Your role does not have permission to assign manual leave balances.' })
      return
    }

    const validationFields = ['employeeUid', 'leaveTypeUid', 'days']
    setManualGrantTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(manualGrantErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => manualGrantErrors[fieldName]).find(Boolean)
      openStatus({ tone: 'warning', title: 'Special leave has validation errors', message: firstError || 'Resolve the highlighted fields before assigning leave.' })
      return
    }

    await runMutation(async () => {
      await manualGrantMutation.mutateAsync({
        employeeUid: selectedEmployeeUid,
        leaveTypeUid: manualGrant.leaveTypeUid,
        year: Number(selectedYear),
        days: Number(manualGrant.days)
      })

      await invalidateLeaveData([employeeBalancesQueryKey, myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey, pendingCancellationRequestsQueryKey])
      await refetchLeaveViews([
        ['leave', 'balances', 'employee', selectedEmployeeUid, selectedYear],
        String(selectedEmployeeUid) === String(currentEmployeeUid) ? myBalancesQueryKey : null,
        myRequestsQueryKey,
        pendingRequestsQueryKey,
        pendingCancellationRequestsQueryKey
      ])
      setManualGrant((current) => ({ ...current, leaveTypeUid: '', days: '' }))
      setManualGrantTouched({})
      openStatus({ tone: 'success', title: 'Special leave granted', message: 'The manual-grant leave has been posted to the employee ledger.' })
    }, 'Granting special leave', 'Posting the manual-grant leave allocation and refreshing the employee ledger.', {
      loaderConfig: {
        delayMs: 0,
        minVisibleMs: 520
      }
    })
  }

  async function submitLeaveRequest() {
    if (!canCreateOwnLeaveRequest) {
      openStatus({ tone: 'danger', title: 'Leave access blocked', message: 'Your role does not have permission to submit leave requests.' })
      return
    }

    const validationFields = ['leaveTypeUid', 'startDate', 'endDate', 'reason']
    setLeaveFormTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(leaveFormErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => leaveFormErrors[fieldName]).find(Boolean)
      openStatus({ tone: 'warning', title: 'Leave request has validation errors', message: firstError || 'Resolve the highlighted fields before submitting the request.' })
      return
    }

    if (!selectedRequestHasLedger) {
      openStatus({ tone: 'warning', title: 'Leave balance not allocated', message: missingRequestBalanceMessage || 'The selected leave type is not allocated for the selected policy year yet.' })
      return
    }

    if (insufficientLeaveBalance) {
      openStatus({ tone: 'warning', title: 'Insufficient leave balance', message: insufficientLeaveBalanceMessage || 'The selected date range exceeds the available leave balance.' })
      return
    }

    await runMutation(async () => {
      await applyLeaveMutation.mutateAsync(leaveForm)
      await invalidateLeaveData([myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey, pendingCancellationRequestsQueryKey])
      await refetchLeaveViews([myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey, pendingCancellationRequestsQueryKey])
      setLeaveForm({ leaveTypeUid: '', startDate: '', endDate: '', reason: '' })
      setLeaveFormTouched({})
      openStatus({ tone: 'success', title: 'Leave request submitted', message: 'The leave request has been submitted into the approval workflow.' })
    }, 'Submitting leave request', 'Validating your request, reserving balance, and routing it for approval.')
  }

  function closeLeaveRequestModal() {
    setLeaveRequestTouched({})
    setLeaveRequestModal({ mode: '', record: null, draft: emptyLeaveRequestDraft() })
  }

  function closeCancellationRequestModal() {
    setCancellationRequestState({ record: null, reason: '' })
  }

  function getLeaveWorkflowRefetchKeys(record = null) {
    const employeeUid = String(record?.employeeUid || '')

    return [
      employeeUid && String(selectedEmployeeUid || '') === employeeUid ? employeeBalancesQueryKey : null,
      employeeUid && String(currentEmployeeUid || '') === employeeUid ? myBalancesQueryKey : null,
      myRequestsQueryKey,
      pendingRequestsQueryKey,
      pendingCancellationRequestsQueryKey
    ]
  }

  function isOwnLeaveRequest(record) {
    return Boolean(
      record
      && currentEmployeeUid
      && String(record.employeeUid || '') === String(currentEmployeeUid)
    )
  }

  function canEditOwnLeaveRequest(record) {
    const normalizedStatus = String(record?.status || '').trim().toLowerCase()
    const normalizedCancellationStatus = String(record?.cancellationStatus || 'NoneRequested').trim().toLowerCase()
    return isOwnLeaveRequest(record) && normalizedStatus === 'pending' && normalizedCancellationStatus !== 'pending'
  }

  function canRequestOwnLeaveCancellation(record) {
    const normalizedStatus = String(record?.status || '').trim().toLowerCase()
    const normalizedCancellationStatus = String(record?.cancellationStatus || 'NoneRequested').trim().toLowerCase()
    return isOwnLeaveRequest(record) && normalizedStatus === 'approved' && !['pending', 'approved'].includes(normalizedCancellationStatus)
  }

  function getLeaveTypeLabel(record) {
    if (!record) return ''
    const leaveType = leaveTypeMap.get(record.leaveTypeUid)
    return leaveType ? `${leaveType.name} (${leaveType.code})` : record.leaveTypeUid
  }

  function openLeaveRequestEditor(record) {
    if (!canEditOwnLeaveRequest(record)) {
      openStatus({ tone: 'warning', title: 'Leave request locked', message: 'Only your pending leave requests can be edited from this workspace.' })
      return
    }

    setLeaveRequestTouched({})
    setLeaveRequestModal({
      mode: 'edit',
      record,
      draft: buildLeaveRequestDraft(record)
    })
  }

  async function submitLeaveRequestEdit() {
    if (!leaveRequestModal.record) return

    const validationFields = ['leaveTypeUid', 'startDate', 'endDate', 'reason']
    setLeaveRequestTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(leaveRequestErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => leaveRequestErrors[fieldName]).find(Boolean)
      openStatus({ tone: 'warning', title: 'Leave request has validation errors', message: firstError || 'Resolve the highlighted fields before saving the request changes.' })
      return
    }

    await runMutation(async () => {
      await editLeaveMutation.mutateAsync({
        leaveRequestUid: leaveRequestModal.record.uid,
        payload: leaveRequestModal.draft
      })
      const refreshKeys = getLeaveWorkflowRefetchKeys(leaveRequestModal.record)
      await invalidateLeaveData(refreshKeys)
      await refetchLeaveViews(refreshKeys)
      closeLeaveRequestModal()
      openStatus({ tone: 'success', title: 'Leave request updated', message: 'Your pending leave request has been updated successfully.' })
    }, 'Updating leave request', 'Revalidating the edited request and syncing the pending leave balance.')
  }

  async function handleDeleteLeaveRequest(record) {
    if (!canEditOwnLeaveRequest(record)) {
      openStatus({ tone: 'warning', title: 'Leave request locked', message: 'Only your pending leave requests can be deleted from this workspace.' })
      return
    }

    const accepted = await openConfirm({
      tone: 'warning',
      title: 'Delete pending leave request?',
      message: 'This will remove the request from the approval queue and release the reserved balance.',
      confirmText: 'Delete request',
      cancelText: 'Keep request',
      confirmVariant: 'btn-outline-danger'
    })
    if (!accepted) return

    await runMutation(async () => {
      await deleteLeaveMutation.mutateAsync(record.uid)
      const refreshKeys = getLeaveWorkflowRefetchKeys(record)
      await invalidateLeaveData(refreshKeys)
      await refetchLeaveViews(refreshKeys)
      openStatus({ tone: 'success', title: 'Leave request deleted', message: 'The pending leave request was removed successfully.' })
    }, 'Deleting leave request', 'Removing the pending leave request and restoring the reserved balance.')
  }

  function openLeaveCancellationRequest(record) {
    if (!canRequestOwnLeaveCancellation(record)) {
      openStatus({ tone: 'warning', title: 'Cancellation unavailable', message: 'Only your approved leave requests can be sent for cancellation.' })
      return
    }

    setCancellationRequestState({
      record,
      reason: record?.cancellationReason || ''
    })
  }

  async function submitLeaveCancellationRequest() {
    if (!cancellationRequestState.record) return

    await runMutation(async () => {
      await requestLeaveCancellationMutation.mutateAsync({
        leaveRequestUid: cancellationRequestState.record.uid,
        reason: cancellationRequestState.reason
      })
      const refreshKeys = getLeaveWorkflowRefetchKeys(cancellationRequestState.record)
      await invalidateLeaveData(refreshKeys)
      await refetchLeaveViews(refreshKeys)
      closeCancellationRequestModal()
      openStatus({ tone: 'success', title: 'Cancellation requested', message: 'The leave cancellation request has been sent for review.' })
    }, 'Submitting cancellation request', 'Routing the leave cancellation request for management review.')
  }

  async function submitDecision() {
    if (!canReviewLeaveRequests) {
      openStatus({ tone: 'danger', title: 'Leave access blocked', message: 'Your role does not have permission to approve or reject leave requests.' })
      return
    }

    const isCancellationMode = ['approve-cancellation', 'reject-cancellation'].includes(decisionState.mode)
    const payload = { leaveRequestUid: decisionState.record?.uid, note: decisionState.note }
    const mutation = decisionState.mode === 'approve'
      ? approveMutation
      : decisionState.mode === 'reject'
        ? rejectMutation
        : decisionState.mode === 'approve-cancellation'
          ? approveCancellationMutation
          : rejectCancellationMutation
    const title = decisionState.mode === 'approve'
      ? 'Approving leave request'
      : decisionState.mode === 'reject'
        ? 'Rejecting leave request'
        : decisionState.mode === 'approve-cancellation'
          ? 'Approving leave cancellation'
          : 'Rejecting leave cancellation'
    const message = decisionState.mode === 'approve'
      ? 'Updating the leave request status and attendance ledgers.'
      : decisionState.mode === 'reject'
        ? 'Updating the leave request status and releasing the pending balance.'
        : decisionState.mode === 'approve-cancellation'
          ? 'Closing the leave request and reversing any applied attendance impact.'
          : 'Keeping the approved leave active and saving the cancellation review note.'

    await runMutation(async () => {
      await mutation.mutateAsync(payload)
      const refreshKeys = getLeaveWorkflowRefetchKeys(decisionState.record)
      await invalidateLeaveData(refreshKeys)
      await refetchLeaveViews(refreshKeys)
      setDecisionState({ mode: '', record: null, note: '' })
      openStatus({
        tone: 'success',
        title: isCancellationMode ? 'Cancellation decision saved' : 'Decision saved',
        message: isCancellationMode ? 'The leave cancellation workflow has been updated successfully.' : 'The leave workflow has been updated successfully.'
      })
    }, title, message)
  }

  function openHolidayEditor(mode, record = null) {
    if (String(record?.source || '').trim().toLowerCase() === 'external') {
      openStatus({ tone: 'warning', title: 'Read-only entry', message: 'This entry is read-only and cannot be edited from this screen.' })
      return
    }

    const requiredAction = mode === 'edit' ? PERMISSION_ACTIONS.update : PERMISSION_ACTIONS.create
    if (!hasModulePermission(user, PERMISSION_MODULES.holidayCalendar, requiredAction)) {
      openStatus({ tone: 'danger', title: 'Calendar access blocked', message: 'Your role does not have permission to edit holiday calendar entries.' })
      return
    }

    if (record?.holidayDate) {
      const monthValue = String(Math.max(0, Number(String(record.holidayDate).slice(5, 7)) - 1))
      setSelectedHolidayMonth(monthValue)
    }

    const defaultAudience = isManagementWorkspace ? 'org' : 'personal'
    setHolidayModal({
      mode,
      recordUid: record?.uid || '',
      recordSource: record?.isLocal ? 'local' : 'org',
      draft: record
        ? {
          holidayDate: record.holidayDate || '',
          name: record.name || '',
          description: record.description || '',
          scope: record.scope || 'custom',
          audience: record.audience || defaultAudience,
          color: record.color || getHolidayScopeMeta(record.scope || 'custom').color || '',
          allDay: record.allDay ?? true,
          startTime: record.startTime || '',
          endTime: record.endTime || '',
          isActive: record.isActive ?? true
        }
        : {
          ...emptyHolidayDraft(defaultAudience),
          holidayDate: selectedCalendarDate,
          color: getHolidayScopeMeta('custom').color || ''
        }
    })
    setHolidayTouched({})
  }

  function openLeaveTypeEditor(mode, record = null) {
    const requiredAction = mode === 'edit' ? PERMISSION_ACTIONS.update : PERMISSION_ACTIONS.create
    if (!hasModulePermission(user, PERMISSION_MODULES.leaveType, requiredAction)) {
      setLeaveTypeActionError('Your role does not have permission to edit leave type catalog entries.')
      return
    }

    setLeaveTypeActionError('')
    setLeaveTypeModal({
      mode,
      recordUid: record?.uid || '',
      draft: record
        ? {
          code: record.code,
          name: record.name,
          annualDays: String(record.annualDays),
          autoAllocate: record.autoAllocate,
          requiresManualGrant: record.requiresManualGrant,
          carryForwardAllowed: record.carryForwardAllowed,
          carryForwardCap: record.carryForwardCap == null ? '' : String(record.carryForwardCap),
          isActive: record.isActive
        }
        : emptyLeaveTypeDraft()
    })
    setLeaveTypeTouched({})
  }

  function openDecision(mode, record) {
    if (!canReviewLeaveRequests) {
      openStatus({ tone: 'danger', title: 'Leave access blocked', message: 'Your role does not have permission to review leave requests.' })
      return
    }
    setDecisionState({
      mode,
      record,
      note: ['approve-cancellation', 'reject-cancellation'].includes(mode)
        ? (record?.cancellationReviewerNote || '')
        : (record?.reviewerNote || '')
    })
  }

  function renderLeaveRequestActions(request) {
    const normalizedStatus = String(request?.status || '').trim().toLowerCase()
    const normalizedCancellationStatus = String(request?.cancellationStatus || 'NoneRequested').trim().toLowerCase()
    const ownRequest = isOwnLeaveRequest(request)
    const canEditRequest = canEditOwnLeaveRequest(request)
    const canRequestCancellation = canRequestOwnLeaveCancellation(request)

    if (ownRequest) {
      if (canEditRequest || canRequestCancellation) {
        return (
          <TableActionCluster>
            {canEditRequest ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openLeaveRequestEditor(request)} /> : null}
            {canEditRequest ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteLeaveRequest(request)} /> : null}
            {canRequestCancellation ? <TableActionButton icon={<XCircleIcon />} label="Request Cancellation" variant="delete" onClick={() => openLeaveCancellationRequest(request)} /> : null}
          </TableActionCluster>
        )
      }

      if (normalizedCancellationStatus === 'pending') {
        return <TableBadge value="Cancellation pending" tone="orange" />
      }

      return <TableBadge value="Read only" tone="neutral" />
    }

    if (canReviewLeaveRequests && normalizedCancellationStatus === 'pending') {
      return (
        <TableActionCluster>
          <TableActionButton icon={<CheckCircleIcon />} label="Approve Cancellation" variant="view" onClick={() => openDecision('approve-cancellation', request)} />
          <TableActionButton icon={<XCircleIcon />} label="Reject Cancellation" variant="delete" onClick={() => openDecision('reject-cancellation', request)} />
        </TableActionCluster>
      )
    }

    if (canReviewLeaveRequests && normalizedStatus === 'pending') {
      return (
        <TableActionCluster>
          <TableActionButton icon={<CheckCircleIcon />} label="Approve" variant="view" onClick={() => openDecision('approve', request)} />
          <TableActionButton icon={<XCircleIcon />} label="Reject" variant="delete" onClick={() => openDecision('reject', request)} />
        </TableActionCluster>
      )
    }

    return <TableBadge value="Read only" tone="neutral" />
  }

  function moveCalendar(direction) {
    const focusDate = new Date(selectedCalendarDate)
    if (Number.isNaN(focusDate.getTime())) return
    const next = new Date(focusDate)

    if (calendarView === 'day') next.setDate(next.getDate() + direction)
    else if (calendarView === 'week') next.setDate(next.getDate() + (direction * 7))
    else next.setMonth(next.getMonth() + direction, 1)

    setSelectedCalendarDate(toDateInputValue(next))
    setSelectedYear(String(next.getFullYear()))
    setSelectedHolidayMonth(String(next.getMonth()))
  }

  const selectedEmployee = selectedEmployeeUid ? employeeMap.get(selectedEmployeeUid) : null
  const selectedEmployeeLabel = selectedEmployee ? `${selectedEmployee.fullName} (${selectedEmployee.employeeCode})` : 'Select employee'
  const selectedAllocationLeaveType = manualGrant.leaveTypeUid ? leaveTypeMap.get(manualGrant.leaveTypeUid) : null
  const leaveRequestsLoadError = !isManagementWorkspace
    ? (myRequestsQuery.isError ? myRequestsQuery.error : null)
    : (
        (pendingRequestsQuery.isError && !pendingRequests.length && !pendingCancellationRequests.length)
          ? pendingRequestsQuery.error
          : (pendingCancellationRequestsQuery.isError && !pendingRequests.length && !pendingCancellationRequests.length)
              ? pendingCancellationRequestsQuery.error
              : null
      )

  return (
    <div className="leave-module-page">
      <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />

      {activeTab === 'holiday' ? (
        <>
          <input ref={calendarImportRef} type="file" accept=".ics,text/calendar" className="d-none" onChange={handleCalendarImport} />
          <div className="row g-3 mt-1">
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Calendar Entries" value={holidaySummary.total} helper="Organization and personal items in the selected year" tone="blue" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Organization Calendar" value={holidaySummary.org} helper="Shared holidays, company events, and closures" tone="emerald" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="My Calendar" value={holidaySummary.personal} helper="Personal meetings, tasks, and reminders" tone="violet" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Meetings + Tasks" value={holidaySummary.meeting + holidaySummary.task} helper="Operational entries in the calendar" tone="amber" /></div>
          </div>

          <CardShell
            title="Holiday Calendar"
            right={(
              <div className="leave-toolbar leave-toolbar-calendar-upgraded">
                <AppSelect value={selectedYear} onChange={(value) => setSelectedYear(String(value))} options={yearOptions} placeholder="Year" hideSelectedDescription />
                <AppSelect value={selectedHolidayMonth} onChange={(value) => setSelectedHolidayMonth(String(value))} options={holidayMonthOptions} placeholder="Month" hideSelectedDescription />
                <AppSelect value={calendarView} onChange={(value) => setCalendarView(String(value))} options={CALENDAR_VIEW_OPTIONS} placeholder="View" hideSelectedDescription />
                <button
                  type="button"
                  className={`btn btn-outline-primary employee-toolbar-btn${!hasExportableCalendarEntries ? ' btn-soft-disabled' : ''}`}
                  onClick={exportVisibleCalendar}
                  aria-disabled={!hasExportableCalendarEntries}
                  title={!hasExportableCalendarEntries ? 'Add calendar entries to enable export.' : 'Export the visible calendar as an .ics file.'}
                >
                  <span>Export .ics</span>
                </button>
                {canCreateHolidayEntries ? <button type="button" className="btn btn-outline-primary employee-toolbar-btn" onClick={() => calendarImportRef.current?.click()}><span>Import .ics</span></button> : null}
                {canCreateHolidayEntries ? <button type="button" className="btn btn-primary employee-toolbar-btn" onClick={() => openHolidayEditor('add')}><PlusIcon /><span>Add Event</span></button> : null}
              </div>
            )}
          >
            <div className="leave-calendar-toolbar-panel">
              <div className="leave-calendar-nav">
                <button type="button" className="leave-calendar-nav-button" onClick={() => moveCalendar(-1)} aria-label="Previous period">
                  <ChevronLeftIcon />
                </button>
                <button type="button" className="leave-calendar-today-button" onClick={() => {
                  const today = new Date()
                  setSelectedCalendarDate(toDateInputValue(today))
                  setSelectedYear(String(today.getFullYear()))
                  setSelectedHolidayMonth(String(today.getMonth()))
                }}>Today</button>
                <button type="button" className="leave-calendar-nav-button" onClick={() => moveCalendar(1)} aria-label="Next period">
                  <ChevronRightIcon />
                </button>
                <div className="leave-calendar-title">{selectedCalendarLabel}</div>
              </div>
              <label className="leave-week-toggle">
                <input type="checkbox" checked={showWeekNumbers} onChange={(event) => setShowWeekNumbers(event.target.checked)} disabled={calendarView === 'day'} />
                <span>Week numbers</span>
              </label>
            </div>

            <div className="leave-calendar-source-strip mb-3">
              <div className="attendance-note-card mb-0 small text-muted">Leave-management users can publish company, restricted, birthday, anniversary, meeting, task, and custom entries to the shared calendar. International and regional lanes remain read-only. Every user can also keep meetings, tasks, and reminders in a personal lane.</div>
              <div className="attendance-note-card mb-0 small text-muted">Use <strong>Export .ics</strong> to download the current view and <strong>Import .ics</strong> to add calendar entries from a file.</div>
              <div className="attendance-note-card attendance-note-card--full mb-0 small text-muted">{holidayRegionCardMessage}</div>
            </div>

            <div className="leave-calendar-legend leave-calendar-legend--filters">
              {holidayLegendItems.map((item) => {
                const isChecked = Boolean(calendarFilters[item.key])
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`leave-calendar-filter-pill ${isChecked ? 'is-active' : ''}`}
                    onClick={() => toggleCalendarFilter(item.key)}
                  >
                    <span className={`leave-scope-badge ${item.tone}`} style={{ background: isChecked ? undefined : 'transparent' }}>
                      <span className="leave-scope-badge__dot" />
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className={`leave-calendar-shell view-${calendarView}`}>
              {calendarView !== 'day' ? (
                <div className={`leave-calendar-grid leave-calendar-grid--headings${showWeekNumbers ? ' has-week-numbers' : ''}`}>
                  {showWeekNumbers ? <div className="leave-calendar-week-heading">Wk</div> : null}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => <div key={label} className={`leave-calendar-heading${label === 'Sat' || label === 'Sun' ? ' is-weekend' : ''}`}>{label}</div>)}
                </div>
              ) : null}

              <div className="leave-calendar-rows">
                {selectedCalendarRows.map((row, rowIndex) => (
                  <div key={`calendar-row-${rowIndex}`} className={`leave-calendar-grid leave-calendar-grid--days${showWeekNumbers && calendarView !== 'day' ? ' has-week-numbers' : ''}${calendarView === 'day' ? ' is-day-view' : ''}`}>
                    {showWeekNumbers && calendarView !== 'day' ? <div className="leave-calendar-week-badge">W{getIsoWeekNumber(row[0])}</div> : null}
                    {row.map((date) => {
                      const cellDate = toDateInputValue(date)
                      const isCurrentMonth = date.getMonth() === Number(selectedHolidayMonth)
                      const holidayEntries = holidaysByDate[cellDate] || []
                      const primaryEntry = holidayEntries[0] || null
                      const isToday = cellDate === toDateInputValue(new Date())
                      const isSelected = cellDate === selectedCalendarDate
                      const isExpanded = expandedCalendarDate === cellDate
                      const isWeekend = isWeekendDate(date)
                      const maxVisibleItems = calendarView === 'month' ? 2 : 4
                      const visibleItems = isExpanded ? holidayEntries : holidayEntries.slice(0, maxVisibleItems)
                      const hiddenItemCount = isExpanded ? 0 : (holidayEntries.length - visibleItems.length)
                      const showWeekendBadge = isWeekend && calendarFilters.weekend

                      return (
                        <button
                          key={cellDate}
                          type="button"
                          className={`leave-calendar-day${isCurrentMonth ? '' : ' is-muted'}${holidayEntries.length ? ' has-holiday' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${isExpanded ? ' is-expanded' : ''}${isWeekend ? ' is-weekend' : ''}${primaryEntry ? ` tone-${getHolidayScopeMeta(primaryEntry.scope).tone}` : ''}`}
                          style={primaryEntry ? getCalendarAccentStyle(primaryEntry) : undefined}
                          onClick={() => {
                            setSelectedCalendarDate(cellDate)
                            setSelectedYear(String(date.getFullYear()))
                            setSelectedHolidayMonth(String(date.getMonth()))
                            if (holidayEntries.length > maxVisibleItems) {
                              setExpandedCalendarDate((current) => (current === cellDate ? '' : cellDate))
                            } else {
                              setExpandedCalendarDate('')
                            }
                          }}
                          onMouseLeave={() => {
                            setExpandedCalendarDate((current) => (current === cellDate ? '' : current))
                          }}
                        >
                          <div className="leave-calendar-day__topline">
                            <div className="leave-calendar-day__date">{date.getDate()}</div>
                            <div className="leave-calendar-day__meta">
                              <span>{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                              {(holidayEntries.length || showWeekendBadge) ? <span>{holidayEntries.length + (showWeekendBadge ? 1 : 0)} item{holidayEntries.length + (showWeekendBadge ? 1 : 0) > 1 ? 's' : ''}</span> : null}
                            </div>
                          </div>
                          <div className="leave-calendar-day__items">
                            {showWeekendBadge ? <span className="leave-calendar-chip weekend-off">Weekend off</span> : null}
                            {visibleItems.length ? visibleItems.map((holiday) => {
                              const scopeMeta = getHolidayScopeMeta(holiday.scope)
                              return (
                                <span key={holiday.uid} className={`leave-calendar-chip ${scopeMeta.tone}${holiday.isActive ? '' : ' inactive'}`} style={getCalendarAccentStyle(holiday, 'badge')} title={holiday.description || holiday.name}>
                                  {holiday.name}
                                </span>
                              )
                            }) : (!showWeekendBadge ? <span className="leave-calendar-chip empty">No events</span> : null)}
                            {hiddenItemCount > 0 ? <span className="leave-calendar-chip more">+{hiddenItemCount} more</span> : null}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="attendance-note-card mt-3 mb-0 small text-muted">
              {isManagementWorkspace
                ? 'Use filters to focus on the entries you need. Weekend off-days are highlighted in red, and color coding helps you scan event types quickly.'
                : 'Use the filters like Google Calendar to isolate holidays, meetings, tasks, birthdays, or your own reminders. Weekend off-days stay highlighted in red by default.'}
            </div>
          </CardShell>

          <CardShell
            title={`Calendar Register • ${selectedCalendarLabel}`}
            right={canCreateHolidayEntries ? <button type="button" className="btn btn-outline-info btn-sm" onClick={() => openHolidayEditor('add')}>Quick Add</button> : null}
          >
            <PaginatedTable rows={sortedVisibleRegisterHolidays}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Date" sortKey="date" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th><SortableHeader label="When" sortKey="when" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th><SortableHeader label="Entry" sortKey="entry" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th><SortableHeader label="Type" sortKey="type" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th><SortableHeader label="Source" sortKey="source" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th><SortableHeader label="Description" sortKey="description" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={holidayRegisterSortConfig} onSort={requestHolidayRegisterSort} /></th>
                      <th className="table-header-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((holiday) => {
                      const isExternalEntry = String(holiday?.source || '').trim().toLowerCase() === 'external'
                      const canEditEntry = !isExternalEntry && canUpdateHolidayEntries
                      const canDeleteEntry = !isExternalEntry && canDeleteHolidayEntries
                      const canManageEntry = canEditEntry || canDeleteEntry
                      return (
                        <tr key={holiday.uid}>
                          <td><TableCellStack title={formatLeaveDate(holiday.holidayDate)} subtitle={new Date(holiday.holidayDate).toLocaleDateString(undefined, { weekday: 'long' })} /></td>
                          <td><TableCellStack title={formatCalendarTimeLabel(holiday)} subtitle={isWeekendDate(new Date(holiday.holidayDate)) ? 'Weekend context' : 'Working day'} /></td>
                          <td><TableCellStack title={holiday.name} subtitle={holiday.isLocal ? (holiday.ownerLabel || 'Personal entry') : (isExternalEntry ? 'Public holiday feed' : 'Organization calendar')} meta={holiday.scope ? getHolidayScopeMeta(holiday.scope).label : 'Calendar item'} /></td>
                          <td><HolidayScopeBadge scope={holiday.scope} color={holiday.color} /></td>
                          <td>{holiday.isLocal || holiday.audience === 'personal' ? <TableBadge value="My calendar" tone="success" /> : (isExternalEntry ? <TableBadge value="Global feed" tone="neutral" /> : <TableBadge value="Organization" tone="blue" />)}</td>
                          <td className="small text-muted">{holiday.description || '—'}</td>
                          <td>{holiday.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                          <td className="table-actions-cell">
                            {canManageEntry ? (
                              <TableActionCluster>
                                {canEditEntry ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openHolidayEditor('edit', holiday)} /> : null}
                                {canDeleteEntry ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => removeHoliday(holiday)} /> : null}
                              </TableActionCluster>
                            ) : <TableBadge value="Read only" tone="neutral" />}
                          </td>
                        </tr>
                      )
                    }) : (
                      <tr><td colSpan="8"><div className="employee-empty-state text-center py-5 text-muted">No calendar entries are visible for {selectedCalendarLabel}. Adjust the filters or add a new event.</div></td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </PaginatedTable>

            {calendarView === 'day' ? (
              <div className="attendance-note-card mt-3 mb-0 small text-muted">
                Focused day: <strong>{formatLeaveDate(selectedCalendarDate)}</strong>. {focusedDayHolidays.length ? `${focusedDayHolidays.length} filtered event(s) scheduled.` : 'No events scheduled yet.'}
              </div>
            ) : null}
          </CardShell>
        </>
      ) : null}

      {activeTab === 'management' && isManagementWorkspace ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Leave Types" value={leaveTypes.length} helper="Configured codes in policy catalog" tone="blue" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Active Types" value={leaveTypes.filter((item) => item.isActive).length} helper="Eligible for request and allocation" tone="emerald" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Selected Employee Balance" value={formatLeaveDays(employeeBalanceSummary.available)} helper="Available days across all types" tone="violet" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Pending Days" value={formatLeaveDays(employeeBalanceSummary.pending)} helper="Reserved against future approvals" tone="amber" /></div>
          </div>

          <CardShell className="leave-section-card" title="Leave Policy Catalog" right={canCreateLeaveType ? <button type="button" className="btn btn-primary employee-toolbar-btn" onClick={() => openLeaveTypeEditor('add')}><PlusIcon /><span>Add Leave Type</span></button> : null}>
            <div className="attendance-note-card mb-3 small text-muted">
              The catalog defines each leave type and its default reference days. Final balances are now assigned employee-wise, so this table is the policy baseline instead of a one-size-fits-all allocation engine.
            </div>
            <PaginatedTable rows={sortedLeaveTypes}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Code" sortKey="code" sortConfig={leaveTypeSortConfig} onSort={requestLeaveTypeSort} /></th>
                      <th><SortableHeader label="Name" sortKey="name" sortConfig={leaveTypeSortConfig} onSort={requestLeaveTypeSort} /></th>
                      <th><SortableHeader label="Catalog Default" sortKey="catalogDefault" sortConfig={leaveTypeSortConfig} onSort={requestLeaveTypeSort} /></th>
                      <th><SortableHeader label="Assignment Model" sortKey="assignmentModel" sortConfig={leaveTypeSortConfig} onSort={requestLeaveTypeSort} /></th>
                      <th><SortableHeader label="Carry Forward" sortKey="carryForward" sortConfig={leaveTypeSortConfig} onSort={requestLeaveTypeSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={leaveTypeSortConfig} onSort={requestLeaveTypeSort} /></th>
                      <th className="table-header-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((item) => (
                      <tr key={item.uid}>
                        <td><TableBadge value={item.code} tone="neutral" /></td>
                        <td><TableCellStack title={item.name} subtitle={item.autoAllocate ? 'Suggested default balance' : 'Flexible employee-wise balance'} /></td>
                        <td><TableBadge value={formatLeaveDays(item.annualDays)} tone="blue" /></td>
                        <td className="small text-muted">Employee-wise assignment{item.requiresManualGrant ? ' • Direct assignment enabled' : ' • Policy-driven only'}</td>
                        <td className="small text-muted">{item.carryForwardAllowed ? `Allowed${item.carryForwardCap != null ? ` • Cap ${formatLeaveDays(item.carryForwardCap)}` : ''}` : 'Not allowed'}</td>
                        <td>{item.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                        <td className="table-actions-cell">{canUpdateLeaveType ? <TableActionCluster><TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openLeaveTypeEditor('edit', item)} /></TableActionCluster> : <TableBadge value="Read only" tone="neutral" />}</td>
                      </tr>
                    )) : <tr><td colSpan="7"><div className="employee-empty-state text-center py-5 text-muted">No leave types are configured yet.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
          </CardShell>

          <CardShell className="leave-section-card leave-section-card--allocation" title="Employee Leave Allocation">
            <div className="attendance-note-card leave-allocation-note mb-3 small text-muted">
              The allocation workflow has two paths. Use <strong>Default Leaves</strong> to generate all eligible auto-allocation balances for the selected employee and year. Use <strong>Special Leaves</strong> only for leave types flagged with manual grant, then enter and assign the exact days.
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-lg-6">
                <label className="form-label">Employee</label>
                <AppSelect
                  value={selectedEmployeeUid}
                  onChange={(value) => { if (defaultAllocationError) setDefaultAllocationError(''); handleAllocationEmployeeChange(value) }}
                  onBlur={() => setManualGrantTouched((current) => ({ ...current, employeeUid: true }))}
                  options={employees.map((item) => ({ value: item.uid, label: item.fullName, description: `${item.employeeCode} • ${item.department || 'No department'}` }))}
                  placeholder="Select employee"
                  icon={<SearchIcon />}
                  hideSelectedDescription
                  invalid={Boolean(manualGrantTouched.employeeUid && manualGrantErrors.employeeUid)}
                />
                {manualGrantTouched.employeeUid && manualGrantErrors.employeeUid ? <div className="invalid-feedback d-block">{manualGrantErrors.employeeUid}</div> : null}
              </div>
              <div className="col-12 col-lg-6">
                <label className="form-label">Year</label>
                <AppSelect value={selectedYear} onChange={(value) => { if (defaultAllocationError) setDefaultAllocationError(''); setSelectedYear(String(value)) }} options={yearOptions} hideSelectedDescription />
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-xl-6">
                <div className="attendance-note-card h-100">
                  <div className="d-flex flex-column gap-3 h-100">
                    <div>
                      <div className="fw-semibold">Default Leaves</div>
                      <div className="small text-muted mt-1">Backend-driven generation for all active leave types that support auto allocation. Only employee and year are required.</div>
                    </div>
                    {defaultAllocationError ? <div className="alert alert-warning mb-0">{defaultAllocationError}</div> : null}
                    <div className="leave-preview-grid leave-preview-grid--allocation">
                      <div><span>Employee</span><strong>{selectedEmployeeLabel}</strong><small>{selectedEmployee ? (selectedEmployee.department || 'No department mapped') : 'Choose an employee to generate the yearly default leave ledger.'}</small></div>
                      <div><span>Year</span><strong>{selectedYear}</strong><small>Generation will target the selected annual cycle.</small></div>
                      <div><span>Allocation Model</span><strong>Auto allocation</strong><small>Only leave types marked for auto allocation will be created.</small></div>
                      <div><span>Current Available</span><strong>{formatLeaveDays(employeeBalanceSummary.available)}</strong><small>{selectedEmployee ? `Current visible total for ${selectedYear}.` : 'No employee selected yet.'}</small></div>
                    </div>
                    <div className="d-flex justify-content-end mt-auto">
                      <button type="button" className="btn btn-primary leave-allocation-assign-btn" disabled={!canManageAllocations || !selectedEmployeeUid} onClick={() => generateBalances(selectedEmployeeUid)}>Generate</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-xl-6">
                <div className="attendance-note-card h-100">
                  <div className="d-flex flex-column gap-3 h-100">
                    <div>
                      <div className="fw-semibold">Special Leaves</div>
                      <div className="small text-muted mt-1">Manual-grant workflow for special leave codes such as ML and PL. Only leave types enabled for manual grant are listed here.</div>
                    </div>
                    <div className="row g-3 align-items-end">
                      <div className="col-12">
                        <label className="form-label">Leave Type</label>
                        <AppSelect name="leaveTypeUid" value={manualGrant.leaveTypeUid} onChange={onManualGrantChange} onBlur={handleManualGrantFieldBlur} options={manualGrantLeaveTypeOptions} placeholder="Select manual-grant leave type" hideSelectedDescription invalid={Boolean(manualGrantTouched.leaveTypeUid && manualGrantErrors.leaveTypeUid)} />
                        {manualGrantTouched.leaveTypeUid && manualGrantErrors.leaveTypeUid ? <div className="invalid-feedback d-block">{manualGrantErrors.leaveTypeUid}</div> : null}
                      </div>
                      <div className="col-12">
                        <label className="form-label">Days</label>
                        <input className={`form-control leave-allocation-control${manualGrantTouched.days && manualGrantErrors.days ? ' is-invalid' : ''}`} type="number" min="0" step="0.25" name="days" value={manualGrant.days} onChange={onManualGrantChange} onBlur={handleManualGrantFieldBlur} placeholder="Enter granted days" />
                        {manualGrantTouched.days && manualGrantErrors.days ? <div className="invalid-feedback d-block">{manualGrantErrors.days}</div> : null}
                      </div>
                    </div>
                    <div className="leave-preview-grid leave-preview-grid--allocation">
                      <div><span>Employee</span><strong>{selectedEmployeeLabel}</strong><small>{selectedEmployee ? 'The manual grant will be posted only to this employee.' : 'Choose an employee before posting a special leave grant.'}</small></div>
                      <div><span>Leave Type</span><strong>{selectedAllocationLeaveType ? `${selectedAllocationLeaveType.name} (${selectedAllocationLeaveType.code})` : 'Select leave type'}</strong><small>{selectedAllocationLeaveType ? 'Manual grant is enabled for this leave type.' : (manualGrantLeaveTypeOptions.length ? 'Only manual-grant leave types are listed.' : 'No leave types are currently enabled for manual grant.')}</small></div>
                      <div><span>Year</span><strong>{selectedYear}</strong><small>The special leave grant will be posted into this year ledger.</small></div>
                      <div><span>Grant Days</span><strong>{manualGrant.days || '0.00'} days</strong><small>Enter the exact number of days to grant manually.</small></div>
                    </div>
                    <div className="d-flex justify-content-end mt-auto">
                      <button type="button" className="btn btn-primary leave-allocation-assign-btn" disabled={!canManageAllocations || !selectedEmployeeUid || !manualGrant.leaveTypeUid || !manualGrant.days} onClick={submitManualGrant}>Assign</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardShell>

            {isManagementWorkspace && canViewMyLeaveBalance ? (
            <CardShell className="leave-section-card leave-section-card--ledger" title={`Balance Ledger${selectedEmployee ? ` • ${selectedEmployee.fullName}` : ''}`}>
              <PaginatedTable rows={sortedEmployeeBalances}>
                {({ rows: paginatedRows }) => (
                  <table className="table employee-table workspace-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th><SortableHeader label="Leave Type" sortKey="leaveType" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Opening" sortKey="opening" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Annual" sortKey="annual" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Carry Forward" sortKey="carryForward" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Manual" sortKey="manual" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Used" sortKey="used" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Pending" sortKey="pending" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                        <th><SortableHeader label="Available" sortKey="available" sortConfig={employeeBalanceSortConfig} onSort={requestEmployeeBalanceSort} /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEmployeeUid ? (paginatedRows.length ? paginatedRows.map((balance) => {
                        const leaveType = leaveTypeMap.get(balance.leaveTypeUid)
                        return (
                          <tr key={balance.uid}>
                            <td>{leaveType ? `${leaveType.name} (${leaveType.code})` : balance.leaveTypeUid}</td>
                            <td>{formatLeaveDays(balance.openingBalance)}</td>
                            <td>{formatLeaveDays(balance.annualAllocation)}</td>
                            <td>{formatLeaveDays(balance.carryForwardIn)}</td>
                            <td>{formatLeaveDays(balance.manualGranted)}</td>
                            <td>{formatLeaveDays(balance.usedDays)}</td>
                            <td>{formatLeaveDays(balance.pendingDays)}</td>
                            <td className="fw-semibold">{formatLeaveDays(balance.availableBalance)}</td>
                          </tr>
                        )
                      }) : <tr><td colSpan="8"><div className="employee-empty-state text-center py-5 text-muted">No balance ledger exists for this employee and year yet. Assign a leave type to start building the ledger.</div></td></tr>) : <tr><td colSpan="8"><div className="employee-empty-state text-center py-5 text-muted">Choose an employee first to inspect the assigned leave balances.</div></td></tr>}
                    </tbody>
                  </table>
                )}
              </PaginatedTable>
            </CardShell>
          ) : null}
        </>
      ) : null}

      {activeTab === 'apply' ? (
        <>
          <div className="row g-3 mb-3">
            {isManagementWorkspace ? (
              <>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Pending Requests" value={pendingQueueCount} helper="Leave requests and cancellation requests waiting for review" tone="blue" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Employees in Queue" value={pendingEmployeeCount} helper="Unique employees with leave or cancellation items in review" tone="emerald" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="My Available Balance" value={formatLeaveDays(myBalanceSummary.available)} helper={`Year ${selectedYear} balance for your own employee profile`} tone="amber" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="My Requests Raised" value={myRequestSummary.total} helper={`${myRequestSummary.pending} pending • ${myRequestSummary.approved} approved`} tone="violet" /></div>
              </>
            ) : (
              <>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Available Balance" value={formatLeaveDays(myBalanceSummary.available)} helper={`Year ${selectedYear} total across active leave types`} tone="blue" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Used Days" value={formatLeaveDays(myBalanceSummary.used)} helper="Approved leave already consumed" tone="emerald" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Pending Days" value={formatLeaveDays(myBalanceSummary.pending)} helper="Reserved against open requests" tone="amber" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Requests Raised" value={myRequestSummary.total} helper={`${myRequestSummary.pending} pending • ${myRequestSummary.approved} approved`} tone="violet" /></div>
              </>
            )}
          </div>

          {(canViewLeaveRequests || canCreateOwnLeaveRequest) ? (
            <CardShell title="Leave Request Planner">
              <div className="row g-3">
                <div className="col-12 col-md-3">
                  <label className="form-label">Policy Year</label>
                  <AppSelect value={selectedYear} onChange={(value) => setSelectedYear(String(value))} options={yearOptions} />
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Leave Type</label>
                  <AppSelect name="leaveTypeUid" value={leaveForm.leaveTypeUid} onChange={onLeaveFormChange} onBlur={handleLeaveFormFieldBlur} options={requestLeaveTypeOptions} placeholder="Select leave type" invalid={Boolean(leaveFormTouched.leaveTypeUid && leaveFormErrors.leaveTypeUid)} />
                  {leaveFormTouched.leaveTypeUid && leaveFormErrors.leaveTypeUid ? <div className="invalid-feedback d-block">{leaveFormErrors.leaveTypeUid}</div> : null}
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">Start Date</label>
                  <input className={`form-control${leaveFormTouched.startDate && leaveFormErrors.startDate ? ' is-invalid' : ''}`} type="date" name="startDate" value={leaveForm.startDate} onChange={onLeaveFormChange} onBlur={handleLeaveFormFieldBlur} />
                  {leaveFormTouched.startDate && leaveFormErrors.startDate ? <div className="invalid-feedback d-block">{leaveFormErrors.startDate}</div> : null}
                </div>
                <div className="col-12 col-md-3">
                  <label className="form-label">End Date</label>
                  <input className={`form-control${leaveFormTouched.endDate && leaveFormErrors.endDate ? ' is-invalid' : ''}`} type="date" name="endDate" value={leaveForm.endDate} onChange={onLeaveFormChange} onBlur={handleLeaveFormFieldBlur} min={leaveForm.startDate || undefined} />
                  {leaveFormTouched.endDate && leaveFormErrors.endDate ? <div className="invalid-feedback d-block">{leaveFormErrors.endDate}</div> : null}
                </div>
                <div className="col-12">
                  <label className="form-label">Reason</label>
                  <textarea className={`form-control${leaveFormTouched.reason && leaveFormErrors.reason ? ' is-invalid' : ''}`} rows="4" name="reason" value={leaveForm.reason} onChange={onLeaveFormChange} onBlur={handleLeaveFormFieldBlur} placeholder="Capture the business context for the leave request." />
                  {leaveFormTouched.reason && leaveFormErrors.reason ? <div className="invalid-feedback d-block">{leaveFormErrors.reason}</div> : null}
                </div>
                <div className="col-12 col-lg-8">
                  <div className="leave-preview-card h-100">
                    <div className="leave-preview-card__title">Leave Day Preview</div>
                    {previewEnabled && leavePreviewQuery.data ? (
                      <div className="leave-preview-grid">
                        <div><span>Applied Days</span><strong>{formatLeaveDays(leavePreviewQuery.data.appliedDays)}</strong></div>
                        <div><span>Calendar Days</span><strong>{leavePreviewQuery.data.totalCalendarDays}</strong></div>
                        <div><span>Weekends Excluded</span><strong>{leavePreviewQuery.data.excludedWeekends.length}</strong></div>
                        <div><span>Holidays Excluded</span><strong>{leavePreviewQuery.data.excludedHolidays.length}</strong></div>
                      </div>
                    ) : (
                      <div className="small text-muted">Choose a valid start and end date to preview applied leave days.</div>
                    )}
                    {leavePreviewQuery.isError ? <div className="text-danger small mt-2">{getErrorMessage(leavePreviewQuery.error)}</div> : null}
                    {missingRequestBalanceMessage ? <div className="alert alert-warning mt-3 mb-0">{missingRequestBalanceMessage}</div> : null}
                    {insufficientLeaveBalanceMessage ? <div className="alert alert-warning mt-3 mb-0">{insufficientLeaveBalanceMessage}</div> : null}
                  </div>
                </div>
                <div className="col-12 col-lg-4 d-flex align-items-end">
                  <div className="leave-preview-card w-100 h-100 d-flex flex-column justify-content-between">
                    <div>
                      <div className="leave-preview-card__title">Submission Guidance</div>
                      <div className="small text-muted">The leave preview excludes weekends and active holidays before submission.</div>
                      {selectedRequestBalance ? <div className="small text-muted mt-2">Available balance for the selected leave type: <strong>{formatLeaveDays(selectedRequestBalance.availableBalance)}</strong> day(s).</div> : null}
                      {!canViewMyLeaveBalance ? <div className="small text-muted mt-2">Your role does not include leave-balance visibility. The request will still be validated during submission.</div> : null}
                      {missingRequestBalanceMessage ? <div className="text-warning small mt-2">{missingRequestBalanceMessage}</div> : null}
                      {insufficientLeaveBalanceMessage ? <div className="text-warning small mt-2">{insufficientLeaveBalanceMessage}</div> : null}
                    </div>
                    <button type="button" className="btn btn-primary w-100 mt-3" disabled={!canCreateOwnLeaveRequest || !currentEmployeeUid || !leaveForm.leaveTypeUid || !leaveForm.startDate || !leaveForm.endDate || !previewEnabled || !selectedRequestHasLedger || insufficientLeaveBalance || requestedAppliedDays <= 0} onClick={submitLeaveRequest}>Submit Request</button>
                  </div>
                </div>
              </div>
            </CardShell>
          ) : null}

          {canViewMyLeaveBalance ? (
            <CardShell title="My Leave Balance">
              {!currentEmployeeUid && !isResolvingCurrentEmployee ? <div className="alert alert-warning mb-0">Your leave balance could not be resolved from the current account yet. Once your account has at least one linked attendance, regularization, or leave request record, the balance ledger will load here automatically.</div> : myBalancesQuery.isError ? <div className="alert alert-warning mb-0">{getErrorMessage(myBalancesQuery.error, 'Your leave balance could not be loaded.')}</div> : (
                <PaginatedTable rows={sortedMyBalances}>
                  {({ rows: paginatedRows }) => (
                    <table className="table employee-table workspace-table align-middle mb-0">
                      <thead>
                        <tr>
                          <th><SortableHeader label="Leave" sortKey="leave" sortConfig={myBalanceSortConfig} onSort={requestMyBalanceSort} /></th>
                          <th><SortableHeader label="Allocated" sortKey="allocated" sortConfig={myBalanceSortConfig} onSort={requestMyBalanceSort} /></th>
                          <th><SortableHeader label="Used" sortKey="used" sortConfig={myBalanceSortConfig} onSort={requestMyBalanceSort} /></th>
                          <th><SortableHeader label="Pending" sortKey="pending" sortConfig={myBalanceSortConfig} onSort={requestMyBalanceSort} /></th>
                          <th><SortableHeader label="Available" sortKey="available" sortConfig={myBalanceSortConfig} onSort={requestMyBalanceSort} /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((balance) => {
                          const leaveType = leaveTypeMap.get(balance.leaveTypeUid)
                          return (
                            <tr key={balance.uid}>
                              <td><TableCellStack title={leaveType ? leaveType.name : balance.leaveTypeUid} subtitle={leaveType ? leaveType.code : 'Leave type'} /></td>
                              <td><TableBadge value={formatLeaveDays(getBalanceEntitlementDays(balance))} tone="blue" /></td>
                              <td><TableBadge value={formatLeaveDays(balance.usedDays)} tone="danger" /></td>
                              <td><TableBadge value={formatLeaveDays(balance.pendingDays)} tone="orange" /></td>
                              <td><TableBadge value={formatLeaveDays(balance.availableBalance)} tone="success" /></td>
                            </tr>
                          )
                        }) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No leave balance is available for the selected year yet.</div></td></tr>}
                      </tbody>
                    </table>
                  )}
                </PaginatedTable>
              )}
            </CardShell>
          ) : null}

          {(canViewLeaveRequests || canCreateOwnLeaveRequest || canAccessManageLeaveQueue) ? (
            <CardShell title="Leave Requests">
              {leaveRequestsLoadError ? (
                <div className="alert alert-warning mb-0">{getErrorMessage(leaveRequestsLoadError, 'Leave requests could not be loaded.')}</div>
              ) : (
                <PaginatedTable rows={pinnedLeaveRequestRows}>
                  {({ rows: paginatedRows }) => (
                    <table className="table employee-table workspace-table align-middle mb-0">
                      <thead>
                        <tr>
                          {isManagementWorkspace ? <th><SortableHeader label="Employee" sortKey="employee" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th> : null}
                          <th><SortableHeader label="Leave Type" sortKey="leaveType" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th><SortableHeader label="Date Range" sortKey="dateRange" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th><SortableHeader label="Applied Days" sortKey="appliedDays" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th><SortableHeader label="Status" sortKey="status" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th><SortableHeader label="Cancellation" sortKey="cancellationStatus" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th><SortableHeader label="Reason" sortKey="reason" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th><SortableHeader label="Reviewer Note" sortKey="reviewerNote" sortConfig={leaveRequestSortConfig} onSort={requestLeaveRequestSort} /></th>
                          <th className="table-header-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((request) => {
                          const employee = employeeMap.get(request.employeeUid)
                          const leaveType = leaveTypeMap.get(request.leaveTypeUid)
                          const hasCancellationRequest = String(request.cancellationStatus || 'NoneRequested').trim() !== 'NoneRequested'

                          return (
                            <tr key={request.uid}>
                              {isManagementWorkspace ? <td><TableCellStack title={employee ? employee.fullName : request.employeeUid} subtitle={employee ? employee.employeeCode : 'Employee'} /></td> : null}
                              <td><TableCellStack title={leaveType ? leaveType.name : request.leaveTypeUid} subtitle={leaveType ? leaveType.code : 'Leave type'} /></td>
                              <td><TableCellStack title={`${formatLeaveDate(request.startDate)} to ${formatLeaveDate(request.endDate)}`} subtitle={`${request.startDate} → ${request.endDate}`} /></td>
                              <td><TableBadge value={formatLeaveDays(request.appliedDays)} tone="blue" /></td>
                              <td>
                                <div className="d-flex flex-column gap-2 align-items-start">
                                  <LeaveStatusBadge status={request.status} />
                                  {hasCancellationRequest ? <TableBadge value={`Cancellation ${getCancellationStatusLabel(request.cancellationStatus)}`} tone={getCancellationStatusTone(request.cancellationStatus)} /> : null}
                                </div>
                              </td>
                              <td>
                                <div className="d-flex flex-column gap-2 align-items-start">
                                  <TableBadge value={getCancellationStatusLabel(request.cancellationStatus)} tone={getCancellationStatusTone(request.cancellationStatus)} />
                                  {hasCancellationRequest ? <div className="small text-muted">{request.cancellationReason || 'No cancellation reason provided.'}</div> : null}
                                </div>
                              </td>
                              <td><TableCellStack title={request.reason || '—'} subtitle={hasCancellationRequest ? 'Cancellation details are listed in the cancellation column.' : ''} /></td>
                              <td><TableCellStack title={request.reviewerNote || '—'} subtitle={hasCancellationRequest ? `Cancellation: ${request.cancellationReviewerNote || '—'}` : ''} /></td>
                              <td className="table-actions-cell">{renderLeaveRequestActions(request)}</td>
                            </tr>
                          )
                        }) : <tr><td colSpan={isManagementWorkspace ? 9 : 8}><div className="employee-empty-state text-center py-5 text-muted">No leave requests are available right now.</div></td></tr>}
                      </tbody>
                    </table>
                  )}
                </PaginatedTable>
              )}
            </CardShell>
          ) : null}
        </>
      ) : null}

      <HolidayModal mode={holidayModal.mode} draft={holidayModal.draft} errors={holidayErrors} touched={holidayTouched} onChange={onHolidayDraftChange} onBlur={handleHolidayFieldBlur} onClose={() => { setHolidayTouched({}); setHolidayModal({ mode: '', draft: emptyHolidayDraft(isManagementWorkspace ? 'org' : 'personal'), recordUid: '', recordSource: 'org' }) }} onSubmit={submitHoliday} isPending={holidayMutation.isPending} isManagementWorkspace={isManagementWorkspace} />
      <LeaveTypeModal mode={leaveTypeModal.mode} draft={leaveTypeModal.draft} errors={leaveTypeErrors} touched={leaveTypeTouched} onChange={handleLeaveTypeModalChange} onBlur={handleLeaveTypeFieldBlur} onClose={() => { setLeaveTypeActionError(''); setLeaveTypeTouched({}); setLeaveTypeModal({ mode: '', draft: emptyLeaveTypeDraft(), recordUid: '' }) }} onSubmit={submitLeaveType} isPending={leaveTypeMutation.isPending} errorMessage={leaveTypeActionError} />
      <LeaveRequestModal mode={leaveRequestModal.mode} draft={leaveRequestModal.draft} errors={leaveRequestErrors} touched={leaveRequestTouched} onChange={onLeaveRequestModalChange} onBlur={handleLeaveRequestFieldBlur} onClose={closeLeaveRequestModal} onSubmit={submitLeaveRequestEdit} isPending={editLeaveMutation.isPending} leaveTypeOptions={leaveRequestModalLeaveTypeOptions} />
      <LeaveCancellationRequestModal record={cancellationRequestState.record} reason={cancellationRequestState.reason} onReasonChange={(value) => setCancellationRequestState((current) => ({ ...current, reason: value }))} onClose={closeCancellationRequestModal} onSubmit={submitLeaveCancellationRequest} isPending={requestLeaveCancellationMutation.isPending} leaveTypeLabel={getLeaveTypeLabel(cancellationRequestState.record)} />
      <LeaveDecisionModal mode={decisionState.mode} record={decisionState.record} note={decisionState.note} onNoteChange={(value) => setDecisionState((current) => ({ ...current, note: value }))} onClose={() => setDecisionState({ mode: '', record: null, note: '' })} onSubmit={submitDecision} isPending={approveMutation.isPending || rejectMutation.isPending || approveCancellationMutation.isPending || rejectCancellationMutation.isPending} employeeLabel={decisionState.record ? (employeeMap.get(decisionState.record.employeeUid)?.fullName || decisionState.record.employeeUid) : ''} leaveTypeLabel={getLeaveTypeLabel(decisionState.record)} />
    </div>
  )
}
