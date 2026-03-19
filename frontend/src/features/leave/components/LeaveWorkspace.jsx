import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
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
import { useUi } from '../../../app/providers/UiProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { storage } from '../../../utils/storage.js'
import { getTodayDateInput } from '../../../utils/attendance.js'

const ADMIN_TABS = [
  { key: 'holiday', label: 'Holiday Calendar', helper: 'Org-wide holidays and closures' },
  { key: 'management', label: 'Leave Allocations', helper: 'Leave types and allocations' },
  { key: 'apply', label: 'Leave Requests', helper: 'Balances, requests, and approvals' }
]

const EMPLOYEE_TABS = [
  { key: 'holiday', label: 'Holiday Calendar', helper: 'Upcoming holidays and closures' },
  { key: 'apply', label: 'Leave Requests', helper: 'Balance visibility and request actions' }
]

const HOLIDAY_SCOPE_OPTIONS = [
  { value: 'international', label: 'International holiday' },
  { value: 'regional', label: 'Regional holiday' },
  { value: 'company', label: 'Company holiday' },
  { value: 'custom', label: 'Custom event' }
]
const CALENDAR_VIEW_OPTIONS = [
  { value: 'month', label: 'Month view' },
  { value: 'week', label: 'Week view' },
  { value: 'day', label: 'Day view' }
]

const ADMIN_CALENDAR_EVENT_OPTIONS = [
  { value: 'company', label: 'Company holiday' },
  { value: 'restricted', label: 'Restricted holiday' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'work_anniversary', label: 'Work anniversary' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
  { value: 'custom', label: 'Custom event' }
]

const EMPLOYEE_CALENDAR_EVENT_OPTIONS = [
  { value: 'meeting', label: 'Meeting' },
  { value: 'task', label: 'Task' },
  { value: 'custom', label: 'Custom event' }
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

function normalizeLeaveCodeInput(value = '') {
  return String(value || '').toUpperCase().replace(/\s+/g, '').trim()
}

function HolidayModal({ mode, draft, onChange, onClose, onSubmit, isPending, isAdmin = false }) {
  const isEdit = mode === 'edit'
  const entryLabel = draft.audience === 'personal' ? 'My calendar entry' : 'Organization calendar entry'
  const baseEventTypeOptions = isAdmin ? ADMIN_CALENDAR_EVENT_OPTIONS : EMPLOYEE_CALENDAR_EVENT_OPTIONS
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
        {isAdmin ? (
          <div className="col-12 col-md-6">
            <label className="form-label">Calendar lane</label>
            <AppSelect name="audience" value={draft.audience} onChange={onChange} options={CALENDAR_AUDIENCE_OPTIONS} disabled={isEdit} />
          </div>
        ) : null}
        <div className={`col-12 ${isAdmin ? 'col-md-6' : ''}`}>
          <label className="form-label">Event type</label>
          <AppSelect name="scope" value={draft.scope} onChange={onChange} options={eventTypeOptions} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Date</label>
          <input className="form-control" type="date" name="holidayDate" value={draft.holidayDate} onChange={onChange} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Title</label>
          <input className="form-control" type="text" name="name" value={draft.name} onChange={onChange} placeholder="Enter event title" />
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
              <input className="form-control" type="time" name="startTime" value={draft.startTime} onChange={onChange} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">End time</label>
              <input className="form-control" type="time" name="endTime" value={draft.endTime} onChange={onChange} />
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

function LeaveTypeModal({ mode, draft, onChange, onClose, onSubmit, isPending, errorMessage = '' }) {
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
            className="form-control text-uppercase"
            type="text"
            name="code"
            value={draft.code}
            onChange={onChange}
            disabled={isEdit}
            maxLength="10"
            placeholder="Enter leave code"
          />
          <div className="form-text">Manual entry. Once created, the leave code is locked.</div>
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label">Name</label>
          <input className="form-control" type="text" name="name" value={draft.name} onChange={onChange} placeholder="Enter leave type name" />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Annual Days</label>
          <input className="form-control" type="number" step="0.25" min="0" name="annualDays" value={draft.annualDays} onChange={onChange} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Carry Forward Cap</label>
          <input className="form-control" type="number" step="0.25" min="0" name="carryForwardCap" value={draft.carryForwardCap} onChange={onChange} disabled={!draft.carryForwardAllowed} placeholder="Optional" />
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
  const isApprove = mode === 'approve'
  return (
    <ModalFrame
      open={Boolean(mode && record)}
      title={isApprove ? 'Approve leave request' : 'Reject leave request'}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className={`btn px-4 ${isApprove ? 'btn-primary' : 'btn-outline-danger'}`} onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Submitting…' : (isApprove ? 'Approve request' : 'Reject request')}
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
          </div>
          <div>
            <label className="form-label">Reviewer Note</label>
            <textarea className="form-control" rows="4" value={note} onChange={(event) => onNoteChange(event.target.value)} placeholder={isApprove ? 'Capture the approval note for audit visibility.' : 'Capture the rejection rationale.'} />
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

export default function LeaveWorkspace({ isAdmin = false, initialTab = 'apply' }) {
  const queryClient = useQueryClient()
  const { openStatus, withLoader } = useUi()
  const { user } = useAuth()
  const calendarImportRef = useRef(null)

  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()))
  const [selectedHolidayMonth, setSelectedHolidayMonth] = useState(String(new Date().getMonth()))
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(toDateInputValue(new Date()))
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
  const [holidayModal, setHolidayModal] = useState({ mode: '', draft: emptyHolidayDraft(isAdmin ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })
  const [leaveTypeModal, setLeaveTypeModal] = useState({ mode: '', draft: emptyLeaveTypeDraft(), recordUid: '' })
  const [decisionState, setDecisionState] = useState({ mode: '', record: null, note: '' })
  const [manualGrant, setManualGrant] = useState({ leaveTypeUid: '', days: '' })
  const [leaveForm, setLeaveForm] = useState({ leaveTypeUid: '', startDate: '', endDate: '', reason: '' })

  const tabs = isAdmin ? ADMIN_TABS : EMPLOYEE_TABS
  const todayDate = useMemo(() => getTodayDateInput(), [])

  const holidaysQueryKey = ['leave', 'holidays', selectedYear]
  const leaveTypesQueryKey = ['leave', 'types']
  const employeesQueryKey = ['employees', 'lookup-directory', 'leave-admin']
  const myBalancesQueryKey = ['leave', 'balances', 'current-user', selectedYear]
  const employeeBalancesQueryKey = ['leave', 'balances', 'employee', selectedEmployeeUid, selectedYear]
  const myRequestsQueryKey = ['leave', 'requests', 'mine']
  const pendingRequestsQueryKey = ['leave', 'requests', 'pending']
  const leavePreviewQueryKey = ['leave', 'preview', leaveForm.startDate, leaveForm.endDate]

  const holidaysQuery = useQuery({
    queryKey: holidaysQueryKey,
    queryFn: () => withPersistentCache(holidaysQueryKey, () => leaveService.getHolidayCalendar(Number(selectedYear))),
    initialData: () => readCachedQuery(holidaysQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(holidaysQueryKey),
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const leaveTypesQuery = useQuery({
    queryKey: leaveTypesQueryKey,
    queryFn: () => withPersistentCache(leaveTypesQueryKey, leaveService.getLeaveTypes),
    initialData: () => readCachedQuery(leaveTypesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(leaveTypesQueryKey),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const employeesQuery = useQuery({
    queryKey: employeesQueryKey,
    queryFn: () => withPersistentCache(employeesQueryKey, employeeService.getLookupDirectory),
    initialData: () => readCachedQuery(employeesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(employeesQueryKey),
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const myPunchLogsLookupQuery = useQuery({
    queryKey: ['attendance', 'employee', 'my-logs', todayDate],
    queryFn: () => withPersistentCache(['attendance', 'employee', 'my-logs', todayDate], () => attendanceService.getMyPunchLogs(todayDate)),
    initialData: () => readCachedQuery(['attendance', 'employee', 'my-logs', todayDate]),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(['attendance', 'employee', 'my-logs', todayDate]),
    enabled: !isAdmin,
    retry: 1,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const myRegularizationsLookupQuery = useQuery({
    queryKey: ['attendance', 'employee', 'regularizations', 'mine'],
    queryFn: () => withPersistentCache(['attendance', 'employee', 'regularizations', 'mine'], attendanceService.getMyRegularizations),
    initialData: () => readCachedQuery(['attendance', 'employee', 'regularizations', 'mine']),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(['attendance', 'employee', 'regularizations', 'mine']),
    enabled: !isAdmin,
    retry: 1,
    staleTime: 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const employees = employeesQuery.data || []
  const currentEmployee = useMemo(() => {
    if (!isAdmin) return null
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
  }, [employees, isAdmin, user?.email, user?.uid])

  const myRequestsQuery = useQuery({
    queryKey: myRequestsQueryKey,
    queryFn: () => withPersistentCache(myRequestsQueryKey, leaveService.getMyLeaveRequests),
    initialData: () => readCachedQuery(myRequestsQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(myRequestsQueryKey),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
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

  const isResolvingCurrentEmployee = isAdmin
    ? employeesQuery.isLoading
    : (myRequestsQuery.isLoading || myPunchLogsLookupQuery.isLoading || myRegularizationsLookupQuery.isLoading)

  const myBalancesQuery = useQuery({
    queryKey: myBalancesQueryKey,
    queryFn: () => withPersistentCache(myBalancesQueryKey, () => leaveService.getMyLeaveBalances(currentEmployeeUid, Number(selectedYear))),
    initialData: () => readCachedQuery(myBalancesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(myBalancesQueryKey),
    enabled: Boolean(currentEmployeeUid),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const employeeBalancesQuery = useQuery({
    queryKey: employeeBalancesQueryKey,
    queryFn: () => withPersistentCache(employeeBalancesQueryKey, () => leaveService.getEmployeeLeaveBalances(selectedEmployeeUid, Number(selectedYear))),
    initialData: () => readCachedQuery(employeeBalancesQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(employeeBalancesQueryKey),
    enabled: Boolean(isAdmin && selectedEmployeeUid),
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const pendingRequestsQuery = useQuery({
    queryKey: pendingRequestsQueryKey,
    queryFn: () => withPersistentCache(pendingRequestsQueryKey, leaveService.getPendingLeaveRequests),
    initialData: () => readCachedQuery(pendingRequestsQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(pendingRequestsQueryKey),
    enabled: isAdmin,
    retry: 1,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  const previewEnabled = Boolean(leaveForm.startDate && leaveForm.endDate && leaveForm.startDate <= leaveForm.endDate)
  const leavePreviewQuery = useQuery({
    queryKey: leavePreviewQueryKey,
    queryFn: () => withPersistentCache(leavePreviewQueryKey, () => leaveService.previewLeaveDays(leaveForm.startDate, leaveForm.endDate)),
    initialData: () => readCachedQuery(leavePreviewQueryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(leavePreviewQueryKey),
    enabled: previewEnabled,
    retry: 0,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    if (!isAdmin) return
    const firstEmployeeUid = employeesQuery.data?.[0]?.uid || ''
    if (!selectedEmployeeUid && firstEmployeeUid) {
      setSelectedEmployeeUid(String(firstEmployeeUid))
    }
  }, [employeesQuery.data, isAdmin, selectedEmployeeUid])

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
          description: balance
            ? `Available ${formatLeaveDays(balance.availableBalance)} of ${formatLeaveDays(entitlementDays)} days`
            : 'Not allocated for the selected policy year yet'
        }
      })

    return mappedOptions.sort((left, right) => String(left.label || '').localeCompare(String(right.label || '')))
  }, [leaveTypes, requestBalanceByLeaveType])
  const selectedRequestBalance = useMemo(() => requestBalanceByLeaveType.get(String(leaveForm.leaveTypeUid)) || null, [leaveForm.leaveTypeUid, requestBalanceByLeaveType])
  const selectedRequestLeaveType = useMemo(() => leaveTypeMap.get(leaveForm.leaveTypeUid) || null, [leaveForm.leaveTypeUid, leaveTypeMap])
  const selectedRequestHasLedger = Boolean(selectedRequestBalance)
  const requestedAppliedDays = Number(leavePreviewQuery.data?.appliedDays || 0)
  const missingRequestBalanceMessage = leaveForm.leaveTypeUid && !selectedRequestHasLedger
    ? `${selectedRequestLeaveType ? `${selectedRequestLeaveType.name} (${selectedRequestLeaveType.code})` : 'Selected leave type'} is not allocated for policy year ${selectedYear} yet. Please contact admin or generate/grant the leave balance first.`
    : ''
  const insufficientLeaveBalance = Boolean(
    selectedRequestHasLedger
    && previewEnabled
    && leavePreviewQuery.data
    && requestedAppliedDays > Number(selectedRequestBalance.availableBalance || 0)
  )
  const insufficientLeaveBalanceMessage = insufficientLeaveBalance
    ? `${selectedRequestLeaveType ? `${selectedRequestLeaveType.name} (${selectedRequestLeaveType.code})` : 'Selected leave type'} has only ${formatLeaveDays(selectedRequestBalance?.availableBalance || 0)} day(s) available, but the selected date range requires ${formatLeaveDays(requestedAppliedDays)} day(s). Please reduce the range or choose another leave type.`
    : ''
  const holidayMonthOptions = useMemo(() => getMonthOptions(selectedYear), [selectedYear])

  useEffect(() => {
    if (!leaveForm.leaveTypeUid) return
    if (requestLeaveTypeOptions.some((item) => String(item.value) === String(leaveForm.leaveTypeUid))) return
    setLeaveForm((current) => ({ ...current, leaveTypeUid: '' }))
  }, [leaveForm.leaveTypeUid, requestLeaveTypeOptions])
  const holidayLegendItems = useMemo(() => getHolidayLegendItems(), [])
  const holidayCalendarDays = useMemo(() => getCalendarDays(calendarView, selectedYear, selectedHolidayMonth, selectedCalendarDate), [calendarView, selectedCalendarDate, selectedHolidayMonth, selectedYear])
  const remoteCalendarEntries = useMemo(() => holidays.map((item) => ({ ...item, source: 'org', isLocal: false, audience: item.audience || 'org' })), [holidays])
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
  const visibleRegisterHolidays = useMemo(() => (calendarView === 'month' ? visibleHolidays : filteredCalendarEntries.filter((holiday) => visibleCalendarDateKeys.includes(holiday.holidayDate))), [calendarView, filteredCalendarEntries, visibleCalendarDateKeys, visibleHolidays])
  const focusedDayHolidays = useMemo(() => holidaysByDate[selectedCalendarDate] || [], [holidaysByDate, selectedCalendarDate])

  const holidaySummary = useMemo(() => getHolidaySummary(calendarEntries), [calendarEntries])
  const myBalanceSummary = useMemo(() => getLeaveBalanceSummary(myBalances), [myBalances])
  const myRequestSummary = useMemo(() => getLeaveRequestSummary(myRequests), [myRequests])
  const pendingRequestSummary = useMemo(() => getLeaveRequestSummary(pendingRequests), [pendingRequests])
  const pendingEmployeeCount = useMemo(() => new Set(pendingRequests.map((item) => String(item.employeeUid || '')).filter(Boolean)).size, [pendingRequests])
  const employeeBalanceSummary = useMemo(() => getLeaveBalanceSummary(employeeBalances), [employeeBalances])

  const holidayMutation = useMutation({ mutationFn: async ({ mode, recordUid, payload }) => (mode === 'edit' ? leaveService.updateHoliday(recordUid, payload) : leaveService.createHoliday(payload)) })
  const deleteHolidayMutation = useMutation({ mutationFn: leaveService.deleteHoliday })
  const leaveTypeMutation = useMutation({ mutationFn: async ({ mode, recordUid, payload }) => (mode === 'edit' ? leaveService.updateLeaveType(recordUid, payload) : leaveService.createLeaveType(payload)) })
  const generateBalancesMutation = useMutation({ mutationFn: leaveService.generateLeaveBalances })
  const manualGrantMutation = useMutation({ mutationFn: leaveService.manualGrantLeaveBalance })
  const applyLeaveMutation = useMutation({ mutationFn: leaveService.applyLeave })
  const approveMutation = useMutation({ mutationFn: ({ leaveRequestUid, note }) => leaveService.approveLeaveRequest(leaveRequestUid, note) })
  const rejectMutation = useMutation({ mutationFn: ({ leaveRequestUid, note }) => leaveService.rejectLeaveRequest(leaveRequestUid, note) })

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
      if (name === 'audience' && value === 'personal' && !current.draft.color) {
        nextDraft.color = '#0f766e'
      }
      return { ...current, draft: nextDraft }
    })
  }

  const toggleCalendarFilter = (key) => {
    setCalendarFilters((current) => ({ ...current, [key]: !current[key] }))
  }

  const exportVisibleCalendar = () => {
    if (!visibleRegisterHolidays.length) {
      openStatus({ tone: 'warning', title: 'Nothing to export', message: 'There are no visible calendar entries in the current view.' })
      return
    }

    const icsContent = buildIcsContent(visibleRegisterHolidays)
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `one-gms-calendar-${selectedYear}-${String(Number(selectedHolidayMonth) + 1).padStart(2, '0')}.ics`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleCalendarImport = async (event) => {
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
    const { errorTitle = 'Action failed', onError } = options

    try {
      await withLoader({ title: successTitle, message: successMessage }, task)
      return true
    } catch (error) {
      const message = getErrorMessage(error)
      openStatus({ tone: 'danger', title: errorTitle, message })
      if (typeof onError === 'function') onError(message, error)
      return false
    }
  }

  async function submitHoliday() {
    const shouldPersistLocally = !isAdmin || holidayModal.recordSource === 'local' || holidayModal.draft.audience === 'personal'

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
      setHolidayModal({ mode: '', draft: emptyHolidayDraft(isAdmin ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })
      openStatus({ tone: 'success', title: 'Calendar entry saved', message: 'Your personal calendar lane has been updated.' })
      return
    }

    await runMutation(async () => {
      await holidayMutation.mutateAsync({ mode: holidayModal.mode, recordUid: holidayModal.recordUid, payload: holidayModal.draft })
      await invalidateLeaveData()
      setHolidayModal({ mode: '', draft: emptyHolidayDraft(isAdmin ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })
      openStatus({ tone: 'success', title: 'Calendar entry saved', message: 'The organization calendar has been refreshed with the latest update.' })
    }, 'Saving calendar entry', 'Updating the organization calendar and refreshing the latest view.')
  }

  async function removeHoliday(holiday) {
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
    setLeaveTypeActionError('')

    const saved = await runMutation(async () => {
      await leaveTypeMutation.mutateAsync({ mode: leaveTypeModal.mode, recordUid: leaveTypeModal.recordUid, payload: leaveTypeModal.draft })
      await invalidateLeaveData()
      setLeaveTypeModal({ mode: '', draft: emptyLeaveTypeDraft(), recordUid: '' })
      openStatus({ tone: 'success', title: 'Leave type saved', message: 'The leave type catalog has been synchronized.' })
    }, 'Saving leave type', 'Updating leave type settings and refreshing allocations.', {
      errorTitle: leaveTypeModal.mode === 'edit' ? 'Leave type update failed' : 'Leave type creation failed',
      onError: (message) => setLeaveTypeActionError(message)
    })

    return saved
  }

  async function generateBalances(employeeUid = '') {
    setDefaultAllocationError('')

    const generated = await runMutation(async () => {
      await generateBalancesMutation.mutateAsync({ year: Number(selectedYear), employeeUid: employeeUid || null })
      await invalidateLeaveData([employeeBalancesQueryKey, myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey])
      await refetchLeaveViews([
        employeeUid ? ['leave', 'balances', 'employee', employeeUid, selectedYear] : null,
        employeeUid && String(employeeUid) === String(currentEmployeeUid) ? myBalancesQueryKey : null,
        myRequestsQueryKey,
        pendingRequestsQueryKey
      ])
      openStatus({ tone: 'success', title: 'Balances generated', message: employeeUid ? 'Leave balances were generated for the selected employee.' : 'Leave balances were generated for the active workforce.' })
    }, 'Generating balances', 'Creating leave balance ledgers and syncing the latest totals.', {
      errorTitle: 'Default leave generation failed',
      onError: (message) => setDefaultAllocationError(message)
    })

    return generated
  }

  async function submitManualGrant() {
    if (!selectedEmployeeUid || !manualGrant.leaveTypeUid || !manualGrant.days) return

    await runMutation(async () => {
      await manualGrantMutation.mutateAsync({
        employeeUid: selectedEmployeeUid,
        leaveTypeUid: manualGrant.leaveTypeUid,
        year: Number(selectedYear),
        days: Number(manualGrant.days)
      })

      await invalidateLeaveData([employeeBalancesQueryKey, myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey])
      await refetchLeaveViews([
        ['leave', 'balances', 'employee', selectedEmployeeUid, selectedYear],
        String(selectedEmployeeUid) === String(currentEmployeeUid) ? myBalancesQueryKey : null,
        myRequestsQueryKey,
        pendingRequestsQueryKey
      ])
      setManualGrant((current) => ({ ...current, leaveTypeUid: '', days: '' }))
      openStatus({ tone: 'success', title: 'Special leave granted', message: 'The manual-grant leave has been posted to the employee ledger.' })
    }, 'Granting special leave', 'Posting the manual-grant leave allocation and refreshing the employee ledger.')
  }

  async function submitLeaveRequest() {
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
      await invalidateLeaveData([myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey])
      await refetchLeaveViews([myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey])
      setLeaveForm({ leaveTypeUid: '', startDate: '', endDate: '', reason: '' })
      openStatus({ tone: 'success', title: 'Leave request submitted', message: 'The leave request has been submitted into the approval workflow.' })
    }, 'Submitting leave request', 'Validating your request, reserving balance, and routing it for approval.')
  }

  async function submitDecision() {
    const payload = { leaveRequestUid: decisionState.record?.uid, note: decisionState.note }
    const mutation = decisionState.mode === 'approve' ? approveMutation : rejectMutation
    const title = decisionState.mode === 'approve' ? 'Approving leave request' : 'Rejecting leave request'
    const message = decisionState.mode === 'approve'
      ? 'Updating the leave request status and attendance ledgers.'
      : 'Updating the leave request status and releasing the pending balance.'

    await runMutation(async () => {
      await mutation.mutateAsync(payload)
      await invalidateLeaveData([employeeBalancesQueryKey, myBalancesQueryKey, myRequestsQueryKey, pendingRequestsQueryKey])
      await refetchLeaveViews([
        decisionState.record?.employeeUid ? ['leave', 'balances', 'employee', decisionState.record.employeeUid, selectedYear] : null,
        String(decisionState.record?.employeeUid || '') === String(currentEmployeeUid) ? myBalancesQueryKey : null,
        myRequestsQueryKey,
        pendingRequestsQueryKey
      ])
      setDecisionState({ mode: '', record: null, note: '' })
      openStatus({ tone: 'success', title: 'Decision saved', message: 'The leave workflow has been updated successfully.' })
    }, title, message)
  }

  function openHolidayEditor(mode, record = null) {
    if (record?.holidayDate) {
      const monthValue = String(Math.max(0, Number(String(record.holidayDate).slice(5, 7)) - 1))
      setSelectedHolidayMonth(monthValue)
    }

    const defaultAudience = isAdmin ? 'org' : 'personal'
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
  }

  function openLeaveTypeEditor(mode, record = null) {
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
  }

  function openDecision(mode, record) {
    setDecisionState({ mode, record, note: record?.reviewerNote || '' })
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

  return (
    <div className="leave-module-page">
      <AttendanceTabs activeTab={activeTab} onChange={setActiveTab} tabs={tabs} />

      {activeTab === 'holiday' ? (
        <>
          <input ref={calendarImportRef} type="file" accept=".ics,text/calendar" className="d-none" onChange={handleCalendarImport} />
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Calendar Entries" value={holidaySummary.total} helper="Organization and personal items in the selected year" tone="blue" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Organization Calendar" value={holidaySummary.org} helper="Shared holidays, company events, and closures" tone="emerald" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="My Calendar" value={holidaySummary.personal} helper="Personal meetings, tasks, and reminders" tone="violet" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Meetings + Tasks" value={holidaySummary.meeting + holidaySummary.task} helper="Operational entries in the calendar" tone="amber" /></div>
          </div>

          <CardShell
            title="Organization Calendar"
            right={(
              <div className="leave-toolbar leave-toolbar-calendar-upgraded">
                <AppSelect value={selectedYear} onChange={(value) => setSelectedYear(String(value))} options={yearOptions} placeholder="Year" hideSelectedDescription />
                <AppSelect value={selectedHolidayMonth} onChange={(value) => setSelectedHolidayMonth(String(value))} options={holidayMonthOptions} placeholder="Month" hideSelectedDescription />
                <AppSelect value={calendarView} onChange={(value) => setCalendarView(String(value))} options={CALENDAR_VIEW_OPTIONS} placeholder="View" hideSelectedDescription />
                <button type="button" className="btn btn-outline-primary employee-toolbar-btn" onClick={exportVisibleCalendar}><span>Export .ics</span></button>
                <button type="button" className="btn btn-outline-primary employee-toolbar-btn" onClick={() => calendarImportRef.current?.click()}><span>Import .ics</span></button>
                <button type="button" className="btn btn-primary employee-toolbar-btn" onClick={() => openHolidayEditor('add')}><PlusIcon /><span>Add Event</span></button>
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
              <div className="attendance-note-card mb-0 small text-muted">Admins can publish company, restricted, birthday, anniversary, meeting, task, and custom entries to the shared calendar. International and regional holidays stay view-only in the automatic holiday lanes. Every user can also keep their own meetings, tasks, and reminders in a personal calendar lane.</div>
              <div className="attendance-note-card mb-0 small text-muted">Calendar sync bridge is handled through .ics import/export in this frontend build. Direct Google, Microsoft, Zoho, Meet, Teams, and Slack connectors still need backend OAuth wiring.</div>
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
                      const isWeekend = isWeekendDate(date)
                      const maxVisibleItems = calendarView === 'month' ? 2 : 4
                      const visibleItems = holidayEntries.slice(0, maxVisibleItems)
                      const hiddenItemCount = holidayEntries.length - visibleItems.length
                      const showWeekendBadge = isWeekend && calendarFilters.weekend

                      return (
                        <button
                          key={cellDate}
                          type="button"
                          className={`leave-calendar-day${isCurrentMonth ? '' : ' is-muted'}${holidayEntries.length ? ' has-holiday' : ''}${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${isWeekend ? ' is-weekend' : ''}${primaryEntry ? ` tone-${getHolidayScopeMeta(primaryEntry.scope).tone}` : ''}`}
                          style={primaryEntry ? getCalendarAccentStyle(primaryEntry) : undefined}
                          onClick={() => {
                            setSelectedCalendarDate(cellDate)
                            setSelectedYear(String(date.getFullYear()))
                            setSelectedHolidayMonth(String(date.getMonth()))
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
              {isAdmin
                ? 'This calendar now behaves like an organization planner: shared holiday lanes, filtered categories, weekend off-days in red, personal task and meeting lanes, and color-coded event types. Use .ics export/import as the current sync bridge.'
                : 'Use the filters like Google Calendar to isolate holidays, meetings, tasks, birthdays, or your own reminders. Weekend off-days stay highlighted in red by default.'}
            </div>
          </CardShell>

          <CardShell
            title={`Calendar Register • ${selectedCalendarLabel}`}
            right={<button type="button" className="btn btn-outline-info btn-sm" onClick={() => openHolidayEditor('add')}>Quick Add</button>}
          >
            <div className="table-responsive employee-table-wrap">
              <table className="table employee-table workspace-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>When</th>
                    <th>Entry</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th className="table-header-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRegisterHolidays.length ? visibleRegisterHolidays.map((holiday) => {
                    const canManageEntry = isAdmin || holiday.isLocal || holiday.audience === 'personal'
                    return (
                      <tr key={holiday.uid}>
                        <td><TableCellStack title={formatLeaveDate(holiday.holidayDate)} subtitle={new Date(holiday.holidayDate).toLocaleDateString(undefined, { weekday: 'long' })} /></td>
                        <td><TableCellStack title={formatCalendarTimeLabel(holiday)} subtitle={isWeekendDate(new Date(holiday.holidayDate)) ? 'Weekend context' : 'Working day'} /></td>
                        <td><TableCellStack title={holiday.name} subtitle={holiday.isLocal ? (holiday.ownerLabel || 'Personal entry') : 'Organization calendar'} meta={holiday.scope ? getHolidayScopeMeta(holiday.scope).label : 'Calendar item'} /></td>
                        <td><HolidayScopeBadge scope={holiday.scope} color={holiday.color} /></td>
                        <td>{holiday.isLocal || holiday.audience === 'personal' ? <TableBadge value="My calendar" tone="success" /> : <TableBadge value="Organization" tone="blue" />}</td>
                        <td className="small text-muted">{holiday.description || '—'}</td>
                        <td>{holiday.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                        <td className="table-actions-cell">
                          {canManageEntry ? (
                            <TableActionCluster>
                              <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openHolidayEditor('edit', holiday)} />
                              <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => removeHoliday(holiday)} />
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
            </div>

            {calendarView === 'day' ? (
              <div className="attendance-note-card mt-3 mb-0 small text-muted">
                Focused day: <strong>{formatLeaveDate(selectedCalendarDate)}</strong>. {focusedDayHolidays.length ? `${focusedDayHolidays.length} filtered event(s) scheduled.` : 'No events scheduled yet.'}
              </div>
            ) : null}
          </CardShell>
        </>
      ) : null}

      {activeTab === 'management' && isAdmin ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Leave Types" value={leaveTypes.length} helper="Configured codes in policy catalog" tone="blue" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Active Types" value={leaveTypes.filter((item) => item.isActive).length} helper="Eligible for request and allocation" tone="emerald" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Selected Employee Balance" value={formatLeaveDays(employeeBalanceSummary.available)} helper="Available days across all types" tone="violet" /></div>
            <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Pending Days" value={formatLeaveDays(employeeBalanceSummary.pending)} helper="Reserved against future approvals" tone="amber" /></div>
          </div>

          <CardShell className="leave-section-card" title="Leave Policy Catalog" right={<button type="button" className="btn btn-primary employee-toolbar-btn" onClick={() => openLeaveTypeEditor('add')}><PlusIcon /><span>Add Leave Type</span></button>}>
            <div className="attendance-note-card mb-3 small text-muted">
              The catalog defines each leave type and its default reference days. Final balances are now assigned employee-wise, so this table is the policy baseline instead of a one-size-fits-all allocation engine.
            </div>
            <div className="table-responsive employee-table-wrap">
              <table className="table employee-table workspace-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Catalog Default</th>
                    <th>Assignment Model</th>
                    <th>Carry Forward</th>
                    <th>Status</th>
                    <th className="table-header-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveTypes.length ? leaveTypes.map((item) => (
                    <tr key={item.uid}>
                      <td><TableBadge value={item.code} tone="neutral" /></td>
                      <td><TableCellStack title={item.name} subtitle={item.autoAllocate ? 'Suggested default balance' : 'Flexible employee-wise balance'} /></td>
                      <td><TableBadge value={formatLeaveDays(item.annualDays)} tone="blue" /></td>
                      <td className="small text-muted">Employee-wise assignment{item.requiresManualGrant ? ' • Direct assignment enabled' : ' • Policy-driven only'}</td>
                      <td className="small text-muted">{item.carryForwardAllowed ? `Allowed${item.carryForwardCap != null ? ` • Cap ${formatLeaveDays(item.carryForwardCap)}` : ''}` : 'Not allowed'}</td>
                      <td>{item.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                      <td className="table-actions-cell"><TableActionCluster><TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openLeaveTypeEditor('edit', item)} /></TableActionCluster></td>
                    </tr>
                  )) : <tr><td colSpan="7"><div className="employee-empty-state text-center py-5 text-muted">No leave types are configured yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>

          <CardShell className="leave-section-card leave-section-card--allocation" title="Employee Leave Allocation">
            <div className="attendance-note-card leave-allocation-note mb-3 small text-muted">
              The allocation workflow has two paths. Use <strong>Default Leaves</strong> to let the backend generate all eligible auto-allocation leave balances for the selected employee and year. Use <strong>Special Leaves</strong> only for leave types flagged with manual grant, then enter the days manually and post them to the ledger.
            </div>

            <div className="row g-3 mb-3">
              <div className="col-12 col-lg-6">
                <label className="form-label">Employee</label>
                <AppSelect
                  value={selectedEmployeeUid}
                  onChange={(value) => { if (defaultAllocationError) setDefaultAllocationError(''); handleAllocationEmployeeChange(value) }}
                  options={employees.map((item) => ({ value: item.uid, label: item.fullName, description: `${item.employeeCode} • ${item.department || 'No department'}` }))}
                  placeholder="Select employee"
                  icon={<SearchIcon />}
                  hideSelectedDescription
                />
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
                      <div><span>Allocation Model</span><strong>Auto allocation</strong><small>Only leave types marked for backend auto allocation will be created.</small></div>
                      <div><span>Current Available</span><strong>{formatLeaveDays(employeeBalanceSummary.available)}</strong><small>{selectedEmployee ? `Current visible total for ${selectedYear}.` : 'No employee selected yet.'}</small></div>
                    </div>
                    <div className="d-flex justify-content-end mt-auto">
                      <button type="button" className="btn btn-primary leave-allocation-assign-btn" disabled={!selectedEmployeeUid} onClick={() => generateBalances(selectedEmployeeUid)}>Generate</button>
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
                        <AppSelect name="leaveTypeUid" value={manualGrant.leaveTypeUid} onChange={onManualGrantChange} options={manualGrantLeaveTypeOptions} placeholder="Select manual-grant leave type" hideSelectedDescription />
                      </div>
                      <div className="col-12">
                        <label className="form-label">Days</label>
                        <input className="form-control leave-allocation-control" type="number" min="0" step="0.25" name="days" value={manualGrant.days} onChange={onManualGrantChange} placeholder="Enter granted days" />
                      </div>
                    </div>
                    <div className="leave-preview-grid leave-preview-grid--allocation">
                      <div><span>Employee</span><strong>{selectedEmployeeLabel}</strong><small>{selectedEmployee ? 'The manual grant will be posted only to this employee.' : 'Choose an employee before posting a special leave grant.'}</small></div>
                      <div><span>Leave Type</span><strong>{selectedAllocationLeaveType ? `${selectedAllocationLeaveType.name} (${selectedAllocationLeaveType.code})` : 'Select leave type'}</strong><small>{selectedAllocationLeaveType ? 'Manual grant is enabled for this leave type.' : (manualGrantLeaveTypeOptions.length ? 'Only manual-grant leave types are listed.' : 'No leave types are currently enabled for manual grant.')}</small></div>
                      <div><span>Year</span><strong>{selectedYear}</strong><small>The special leave grant will be posted into this year ledger.</small></div>
                      <div><span>Grant Days</span><strong>{manualGrant.days || '0.00'} days</strong><small>Enter the exact number of days to grant manually.</small></div>
                    </div>
                    <div className="d-flex justify-content-end mt-auto">
                      <button type="button" className="btn btn-primary leave-allocation-assign-btn" disabled={!selectedEmployeeUid || !manualGrant.leaveTypeUid || !manualGrant.days} onClick={submitManualGrant}>Assign</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardShell>

          <CardShell className="leave-section-card leave-section-card--ledger" title={`Balance Ledger${selectedEmployee ? ` • ${selectedEmployee.fullName}` : ''}`}>
            <div className="table-responsive employee-table-wrap">
              <table className="table employee-table workspace-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Opening</th>
                    <th>Annual</th>
                    <th>Carry Forward</th>
                    <th>Manual</th>
                    <th>Used</th>
                    <th>Pending</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployeeUid ? (employeeBalances.length ? employeeBalances.map((balance) => {
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
            </div>
          </CardShell>
        </>
      ) : null}

      {activeTab === 'apply' ? (
        <>
          <div className="row g-3 mb-3">
            {isAdmin ? (
              <>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Pending Requests" value={pendingRequestSummary.pending} helper="Requests currently waiting for admin review" tone="blue" /></div>
                <div className="col-12 col-md-6 col-xl-3"><AttendanceMetricCard label="Employees in Queue" value={pendingEmployeeCount} helper="Unique employees with pending leave requests" tone="emerald" /></div>
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

          <CardShell title="Leave Request Planner">
            <div className="row g-3">
              <div className="col-12 col-md-3">
                <label className="form-label">Policy Year</label>
                <AppSelect value={selectedYear} onChange={(value) => setSelectedYear(String(value))} options={yearOptions} />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Leave Type</label>
                <AppSelect name="leaveTypeUid" value={leaveForm.leaveTypeUid} onChange={onLeaveFormChange} options={requestLeaveTypeOptions} placeholder="Select leave type" />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">Start Date</label>
                <input className="form-control" type="date" name="startDate" value={leaveForm.startDate} onChange={onLeaveFormChange} />
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label">End Date</label>
                <input className="form-control" type="date" name="endDate" value={leaveForm.endDate} onChange={onLeaveFormChange} min={leaveForm.startDate || undefined} />
              </div>
              <div className="col-12">
                <label className="form-label">Reason</label>
                <textarea className="form-control" rows="4" name="reason" value={leaveForm.reason} onChange={onLeaveFormChange} placeholder="Capture the business context for the leave request." />
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
                    <div className="small text-muted">The request uses the backend leave preview API, which excludes weekends and active holidays before submission.</div>
                    {selectedRequestBalance ? <div className="small text-muted mt-2">Available balance for the selected leave type: <strong>{formatLeaveDays(selectedRequestBalance.availableBalance)}</strong> day(s).</div> : null}
                    {missingRequestBalanceMessage ? <div className="text-warning small mt-2">{missingRequestBalanceMessage}</div> : null}
                    {insufficientLeaveBalanceMessage ? <div className="text-warning small mt-2">{insufficientLeaveBalanceMessage}</div> : null}
                  </div>
                  <button type="button" className="btn btn-primary w-100 mt-3" disabled={!currentEmployeeUid || !leaveForm.leaveTypeUid || !leaveForm.startDate || !leaveForm.endDate || !previewEnabled || !selectedRequestHasLedger || insufficientLeaveBalance || requestedAppliedDays <= 0} onClick={submitLeaveRequest}>Submit Request</button>
                </div>
              </div>
            </div>
          </CardShell>

          <CardShell title="My Leave Balance">
            {!currentEmployeeUid && !isResolvingCurrentEmployee ? <div className="alert alert-warning mb-0">Your leave balance could not be resolved from the current account yet. Once your account has at least one linked attendance, regularization, or leave request record, the balance ledger will load here automatically.</div> : myBalancesQuery.isError ? <div className="alert alert-warning mb-0">{getErrorMessage(myBalancesQuery.error, 'Your leave balance could not be loaded.')}</div> : (
              <div className="table-responsive employee-table-wrap">
                <table className="table employee-table workspace-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Leave</th>
                      <th>Allocated</th>
                      <th>Used</th>
                      <th>Pending</th>
                      <th>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myBalances.length ? myBalances.map((balance) => {
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
              </div>
            )}
          </CardShell>

          <CardShell title="My Leave Requests">
            {myRequestsQuery.isError ? <div className="alert alert-warning mb-0">{getErrorMessage(myRequestsQuery.error, 'Your leave requests could not be loaded.')}</div> : (
              <div className="table-responsive employee-table-wrap">
                <table className="table employee-table workspace-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Date Range</th>
                      <th>Applied Days</th>
                      <th>Status</th>
                      <th>Reason</th>
                      <th>Reviewer Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRequests.length ? myRequests.map((request) => {
                      const leaveType = leaveTypeMap.get(request.leaveTypeUid)
                      return (
                        <tr key={request.uid}>
                          <td><TableCellStack title={leaveType ? leaveType.name : request.leaveTypeUid} subtitle={leaveType ? leaveType.code : 'Leave type'} /></td>
                          <td><TableCellStack title={`${formatLeaveDate(request.startDate)} to ${formatLeaveDate(request.endDate)}`} subtitle={`${request.startDate} → ${request.endDate}`} /></td>
                          <td><TableBadge value={formatLeaveDays(request.appliedDays)} tone="blue" /></td>
                          <td><LeaveStatusBadge status={request.status} /></td>
                          <td className="small text-muted">{request.reason || '—'}</td>
                          <td className="small text-muted">{request.reviewerNote || '—'}</td>
                        </tr>
                      )
                    }) : <tr><td colSpan="6"><div className="employee-empty-state text-center py-5 text-muted">No leave requests have been raised yet.</div></td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </CardShell>

          {isAdmin ? (
            <CardShell title="Employee Leave Request">
              {pendingRequestsQuery.isError ? <div className="alert alert-warning mb-0">{getErrorMessage(pendingRequestsQuery.error, 'Employee leave requests could not be loaded.')}</div> : (
                <div className="table-responsive employee-table-wrap">
                  <table className="table employee-table workspace-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Date Range</th>
                        <th>Applied Days</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th className="table-header-center">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.length ? pendingRequests.map((request) => {
                        const employee = employeeMap.get(request.employeeUid)
                        const leaveType = leaveTypeMap.get(request.leaveTypeUid)
                        return (
                          <tr key={request.uid}>
                            <td><TableCellStack title={employee ? employee.fullName : request.employeeUid} subtitle={employee ? employee.employeeCode : 'Employee'} /></td>
                            <td><TableCellStack title={leaveType ? leaveType.name : request.leaveTypeUid} subtitle={leaveType ? leaveType.code : 'Leave type'} /></td>
                            <td><TableCellStack title={`${formatLeaveDate(request.startDate)} to ${formatLeaveDate(request.endDate)}`} subtitle={`${request.startDate} → ${request.endDate}`} /></td>
                            <td><TableBadge value={formatLeaveDays(request.appliedDays)} tone="blue" /></td>
                            <td className="small text-muted">{request.reason || '—'}</td>
                            <td><LeaveStatusBadge status={request.status} /></td>
                            <td className="table-actions-cell">
                              <TableActionCluster>
                                <TableActionButton icon={<CheckCircleIcon />} label="Approve" variant="view" onClick={() => openDecision('approve', request)} />
                                <TableActionButton icon={<XCircleIcon />} label="Reject" variant="delete" onClick={() => openDecision('reject', request)} />
                              </TableActionCluster>
                            </td>
                          </tr>
                        )
                      }) : <tr><td colSpan="7"><div className="employee-empty-state text-center py-5 text-muted">There are no pending leave requests waiting for review.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </CardShell>
          ) : null}
        </>
      ) : null}

      <HolidayModal mode={holidayModal.mode} draft={holidayModal.draft} onChange={onHolidayDraftChange} onClose={() => setHolidayModal({ mode: '', draft: emptyHolidayDraft(isAdmin ? 'org' : 'personal'), recordUid: '', recordSource: 'org' })} onSubmit={submitHoliday} isPending={holidayMutation.isPending} isAdmin={isAdmin} />
      <LeaveTypeModal mode={leaveTypeModal.mode} draft={leaveTypeModal.draft} onChange={handleLeaveTypeModalChange} onClose={() => { setLeaveTypeActionError(''); setLeaveTypeModal({ mode: '', draft: emptyLeaveTypeDraft(), recordUid: '' }) }} onSubmit={submitLeaveType} isPending={leaveTypeMutation.isPending} errorMessage={leaveTypeActionError} />
      <LeaveDecisionModal mode={decisionState.mode} record={decisionState.record} note={decisionState.note} onNoteChange={(value) => setDecisionState((current) => ({ ...current, note: value }))} onClose={() => setDecisionState({ mode: '', record: null, note: '' })} onSubmit={submitDecision} isPending={approveMutation.isPending || rejectMutation.isPending} employeeLabel={decisionState.record ? (employeeMap.get(decisionState.record.employeeUid)?.fullName || decisionState.record.employeeUid) : ''} leaveTypeLabel={decisionState.record ? (() => { const leaveType = leaveTypeMap.get(decisionState.record.leaveTypeUid); return leaveType ? `${leaveType.name} (${leaveType.code})` : decisionState.record.leaveTypeUid })() : ''} />
    </div>
  )
}
