import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/common/PageHeader.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import AppDateRangeField from '../../../components/common/AppDateRangeField.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import {
  BriefcaseIcon,
  CalendarIcon,
  CheckCircleIcon,
  FilterIcon,
  PencilIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  UserPlusIcon,
  ViewIcon,
  XCircleIcon
} from '../../../components/common/AppIcons.jsx'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'
import { useAdminAttendanceQuery } from '../../../hooks/attendance/useAdminAttendanceQuery.js'
import { useEmployeeShiftAssignmentsQuery } from '../../../hooks/attendance/useEmployeeShiftAssignmentsQuery.js'
import { useMyPunchLogsQuery } from '../../../hooks/attendance/useMyPunchLogsQuery.js'
import { useMyRegularizationsQuery } from '../../../hooks/attendance/useMyRegularizationsQuery.js'
import { usePendingRegularizationsQuery } from '../../../hooks/attendance/usePendingRegularizationsQuery.js'
import { useRegularizationLogsQuery } from '../../../hooks/attendance/useRegularizationLogsQuery.js'
import { useShiftRosterQuery } from '../../../hooks/attendance/useShiftRosterQuery.js'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { attendanceService } from '../../../api/services/attendance.service.js'
import {
  PUNCH_CONTROL_CHANGED_EVENT,
  applyLocalPunchControl,
  downloadAttendanceRowsCsv,
  downloadAttendanceRowsExcel,
  downloadPunchLogsCsv,
  downloadPunchLogsExcel,
  formatDate,
  formatDateTime,
  formatHours,
  formatTime,
  getAttendanceSummary,
  getLatestRegularizationStatus,
  getPunchSessionState,
  getShiftDurationHours,
  getShiftOverview,
  getTodayDateInput,
  rememberPunchOutMode,
  rememberSoftPunchResume,
  toDateTimeLocalValue,
  toTimeInputValue
} from '../../../utils/attendance.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useToast } from '../../../app/providers/ToastProvider.jsx'
import {
  AttendanceBadge,
  AttendanceMetricCard,
  AttendanceTabs,
  DownloadActionGroup,
  OverviewList,
  PunchTypeBadge,
  PunchSessionCard,
  RegularizationBadge
} from '../../attendance/components/AttendanceShared.jsx'
import {
  getDateTimeRangeValidationMessage,
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
  hasModulePermission,
  hasModuleVisibility,
  resolveAccessibleTab
} from '../../../utils/permissions.js'
import { filterCollectionByQuery } from '../../../utils/search.js'

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview', helper: 'Unified workforce summary' },
  { key: 'attendance', label: 'Manage Attendance', helper: 'Punches, edits, and exports' },
  { key: 'shifts', label: 'Shift Roster', helper: 'Shift roster and assignment control' },
  { key: 'regularization', label: 'Manage Regularization', helper: 'Review, verify, and action requests' }
]

// The backend attendance PATCH route is currently not exposed.
const ATTENDANCE_EDIT_API_AVAILABLE = false

function buildRegularizationDraft(dateValue, logs) {
  const firstIn = logs.find((log) => log.punchType === 'IN')?.punchTime || null
  const lastOut = [...logs].reverse().find((log) => log.punchType === 'OUT')?.punchTime || null

  return {
    regularizationDate: dateValue,
    requestedPunchIn: toDateTimeLocalValue(firstIn),
    requestedPunchOut: toDateTimeLocalValue(lastOut),
    requestedWorkedHours: '',
    reason: ''
  }
}

function buildAttendanceEditErrors(draft) {
  if (!draft) return {}

  return {
    totalWorkedHours: draft.totalWorkedHours !== '' && draft.totalWorkedHours != null
      ? getNumberValidationMessage(draft.totalWorkedHours, { label: 'Worked hours', min: 0, max: 24 })
      : '',
    lastPunchOut: getDateTimeRangeValidationMessage(draft.firstPunchIn, draft.lastPunchOut, { startLabel: 'First punch in', endLabel: 'Last punch out' }),
    status: getRequiredFieldMessage(draft.status, 'Status')
  }
}

function buildRegularizationErrors(draft) {
  return {
    regularizationDate: getDateValidationMessage(draft.regularizationDate, { required: true, label: 'Regularization date' }),
    requestedWorkedHours: draft.requestedWorkedHours
      ? getNumberValidationMessage(draft.requestedWorkedHours, { label: 'Requested worked hours', min: 0, max: 24 })
      : '',
    requestedPunchOut: getDateTimeRangeValidationMessage(draft.requestedPunchIn, draft.requestedPunchOut, { startLabel: 'Requested punch in', endLabel: 'Requested punch out' }),
    reason: getRequiredFieldMessage(draft.reason, 'Reason')
  }
}

function buildShiftErrors(draft, editing) {
  return {
    code: editing ? '' : getTextValidationMessage(draft.code, { required: true, label: 'Shift code' }),
    name: getRequiredFieldMessage(draft.name, 'Shift name'),
    startTime: getRequiredFieldMessage(draft.startTime, 'Start time'),
    endTime: getRequiredFieldMessage(draft.endTime, 'End time')
  }
}

function buildAssignmentErrors(draft) {
  return {
    employeeUid: getRequiredFieldMessage(draft.employeeUid, 'Employee'),
    shiftUid: getRequiredFieldMessage(draft.shiftUid, 'Shift')
  }
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

function AttendanceDetailModal({ record, onClose }) {
  return (
    <ModalFrame
      open={Boolean(record)}
      title="Attendance record"
      onClose={onClose}
      size="lg"
      footer={<button type="button" className="btn btn-primary px-4" onClick={onClose}>Close</button>}
    >
      {record ? (
        <div className="row g-3">
          {[
            ['Employee', record.employeeName],
            ['Employee Code', record.employeeCode],
            ['Department', record.department],
            ['Date', formatDate(record.attendanceDate)],
            ['Status', record.status],
            ['First Punch In', formatDateTime(record.firstPunchIn)],
            ['Last Punch Out', formatDateTime(record.lastPunchOut)],
            ['Worked Hours', formatHours(record.totalWorkedHours)],
            ['Assigned Shift Hours', formatHours(record.totalAssignedShiftHours)],
            ['Regularized', record.isRegularized ? 'Yes' : 'No'],
            ['Remarks', record.remarks || '—'],
            ['Updated At', formatDateTime(record.updatedAt)]
          ].map(([label, value]) => (
            <div className="col-12 col-md-6" key={label}>
              <div className="attendance-detail-label">{label}</div>
              <div className="attendance-detail-value">{value || '—'}</div>
            </div>
          ))}
        </div>
      ) : null}
    </ModalFrame>
  )
}

function AttendanceEditModal({ draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending }) {
  return (
    <ModalFrame
      open={Boolean(draft)}
      title="Modify attendance entry"
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      )}
    >
      {draft ? (
        <div className="row g-3">
          <div className="col-12">
            <div className="attendance-note-card">
              <div className="fw-semibold">{draft.employeeName}</div>
              <div className="small text-muted">{draft.employeeCode} • {formatDate(draft.attendanceDate)}</div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">First Punch In</label>
            <input className="form-control" type="datetime-local" name="firstPunchIn" value={draft.firstPunchIn} onChange={onChange} onBlur={onBlur} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Last Punch Out</label>
            <input className={`form-control${touched.lastPunchOut && errors.lastPunchOut ? ' is-invalid' : ''}`} type="datetime-local" name="lastPunchOut" value={draft.lastPunchOut} onChange={onChange} onBlur={onBlur} />
            {touched.lastPunchOut && errors.lastPunchOut ? <div className="invalid-feedback d-block">{errors.lastPunchOut}</div> : null}
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Worked Hours</label>
            <input className={`form-control${touched.totalWorkedHours && errors.totalWorkedHours ? ' is-invalid' : ''}`} type="number" step="0.25" min="0" max="24" name="totalWorkedHours" value={draft.totalWorkedHours} onChange={onChange} onBlur={onBlur} />
            {touched.totalWorkedHours && errors.totalWorkedHours ? <div className="invalid-feedback d-block">{errors.totalWorkedHours}</div> : null}
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Status</label>
            <AppSelect
              name="status"
              value={draft.status}
              onChange={onChange}
              onBlur={onBlur}
              options={['Present', 'Absent', 'Leave', 'Half-Day', 'Pending Regularization'].map((value) => ({ value, label: value }))}
              invalid={Boolean(touched.status && errors.status)}
            />
            {touched.status && errors.status ? <div className="invalid-feedback d-block">{errors.status}</div> : null}
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label d-block">Record Type</label>
            <div className="form-check form-switch mt-2">
              <input className="form-check-input" id="attendanceIsRegularized" type="checkbox" checked={draft.isRegularized} onChange={(event) => onChange({ target: { name: 'isRegularized', value: event.target.checked } })} />
              <label className="form-check-label" htmlFor="attendanceIsRegularized">Mark as regularized</label>
            </div>
          </div>
          <div className="col-12">
            <label className="form-label">Remarks</label>
            <textarea className="form-control" rows="4" name="remarks" value={draft.remarks} onChange={onChange} placeholder="Add admin remarks for this correction." />
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

function DecisionModal({ mode, record, note, onNoteChange, onClose, onSubmit, isPending }) {
  const isApprove = mode === 'approve'

  return (
    <ModalFrame
      open={Boolean(record && mode)}
      title={isApprove ? 'Verify and approve request' : 'Reject regularization'}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button
            type="button"
            className={`btn px-4 ${isApprove ? 'btn-primary' : 'btn-outline-danger'}`}
            onClick={onSubmit}
            disabled={isPending}
          >
            {isPending ? 'Submitting…' : (isApprove ? 'Approve request' : 'Reject request')}
          </button>
        </>
      )}
    >
      {record ? (
        <div className="d-flex flex-column gap-3">
          <div className="attendance-note-card">
            <div className="fw-semibold">{record.employeeName}</div>
            <div className="small text-muted">{formatDate(record.regularizationDate)} • {record.employeeCode || 'Employee record'}</div>
            <div className="small mt-2">{record.reason || 'No reason provided.'}</div>
          </div>

          <div>
            <label className="form-label">Reviewer note</label>
            <textarea
              className="form-control"
              rows="4"
              placeholder={isApprove ? 'Capture your verification note before approval.' : 'Capture the rejection rationale.'}
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
            />
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

function RegularizationRequestModal({ open, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending }) {
  return (
    <ModalFrame
      open={open}
      title="Request time regularization"
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending || !draft.reason.trim()}>
            {isPending ? 'Submitting…' : 'Submit request'}
          </button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Regularization Date*</label>
          <input className={`form-control${touched.regularizationDate && errors.regularizationDate ? ' is-invalid' : ''}`} type="date" name="regularizationDate" value={draft.regularizationDate} onChange={onChange} onBlur={onBlur} required />
          {touched.regularizationDate && errors.regularizationDate ? <div className="invalid-feedback d-block">{errors.regularizationDate}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Worked Hours</label>
          <input className={`form-control${touched.requestedWorkedHours && errors.requestedWorkedHours ? ' is-invalid' : ''}`} type="number" step="0.25" min="0" max="24" name="requestedWorkedHours" value={draft.requestedWorkedHours} onChange={onChange} onBlur={onBlur} />
          {touched.requestedWorkedHours && errors.requestedWorkedHours ? <div className="invalid-feedback d-block">{errors.requestedWorkedHours}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Punch In</label>
          <input className="form-control" type="datetime-local" name="requestedPunchIn" value={draft.requestedPunchIn} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Punch Out</label>
          <input className={`form-control${touched.requestedPunchOut && errors.requestedPunchOut ? ' is-invalid' : ''}`} type="datetime-local" name="requestedPunchOut" value={draft.requestedPunchOut} onChange={onChange} onBlur={onBlur} />
          {touched.requestedPunchOut && errors.requestedPunchOut ? <div className="invalid-feedback d-block">{errors.requestedPunchOut}</div> : null}
        </div>
        <div className="col-12">
          <label className="form-label">Reason*</label>
          <textarea className={`form-control${touched.reason && errors.reason ? ' is-invalid' : ''}`} rows="4" name="reason" value={draft.reason} onChange={onChange} onBlur={onBlur} placeholder="Explain why this attendance entry needs to be corrected." required />
          {touched.reason && errors.reason ? <div className="invalid-feedback d-block">{errors.reason}</div> : null}
        </div>
      </div>
    </ModalFrame>
  )
}

function ShiftModal({ open, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending, editing }) {
  return (
    <ModalFrame
      open={open}
      title={editing ? 'Edit shift roster' : 'Create shift roster'}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending || !draft.name.trim() || !draft.startTime || !draft.endTime || (!editing && !draft.code.trim())}>
            {isPending ? 'Saving…' : (editing ? 'Update shift' : 'Create shift')}
          </button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Shift Code*</label>
          <input className={`form-control${touched.code && errors.code ? ' is-invalid' : ''}`} name="code" value={draft.code} onChange={onChange} onBlur={onBlur} placeholder="MORN-1" disabled={editing} />
          {touched.code && errors.code ? <div className="invalid-feedback d-block">{errors.code}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Shift Name*</label>
          <input className={`form-control${touched.name && errors.name ? ' is-invalid' : ''}`} name="name" value={draft.name} onChange={onChange} onBlur={onBlur} placeholder="Morning Shift" />
          {touched.name && errors.name ? <div className="invalid-feedback d-block">{errors.name}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Start Time*</label>
          <input className={`form-control${touched.startTime && errors.startTime ? ' is-invalid' : ''}`} type="time" name="startTime" value={draft.startTime} onChange={onChange} onBlur={onBlur} />
          {touched.startTime && errors.startTime ? <div className="invalid-feedback d-block">{errors.startTime}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">End Time*</label>
          <input className={`form-control${touched.endTime && errors.endTime ? ' is-invalid' : ''}`} type="time" name="endTime" value={draft.endTime} onChange={onChange} onBlur={onBlur} />
          {touched.endTime && errors.endTime ? <div className="invalid-feedback d-block">{errors.endTime}</div> : null}
        </div>
        <div className="col-12">
          <div className="form-check form-switch">
            <input className="form-check-input" id="shiftActive" type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ target: { name: 'isActive', value: event.target.checked } })} />
            <label className="form-check-label" htmlFor="shiftActive">Keep this shift active</label>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function AssignmentModal({ open, draft, errors = {}, touched = {}, employees, shifts, onChange, onBlur, onClose, onSubmit, isPending, editing }) {
  return (
    <ModalFrame
      open={open}
      title={editing ? 'Update shift assignment' : 'Assign shift to employee'}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={isPending || !draft.employeeUid || !draft.shiftUid}>
            {isPending ? 'Saving…' : (editing ? 'Update assignment' : 'Assign shift')}
          </button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label">Employee*</label>
          <AppSelect
            name="employeeUid"
            value={draft.employeeUid}
            onChange={onChange}
            onBlur={onBlur}
            options={employees.map((employee) => ({ value: employee.uid, label: employee.fullName, description: employee.employeeCode }))}
            placeholder="Select employee"
            disabled={editing}
            invalid={Boolean(touched.employeeUid && errors.employeeUid)}
          />
          {touched.employeeUid && errors.employeeUid ? <div className="invalid-feedback d-block">{errors.employeeUid}</div> : null}
        </div>
        <div className="col-12">
          <label className="form-label">Shift*</label>
          <AppSelect
            name="shiftUid"
            value={draft.shiftUid}
            onChange={onChange}
            onBlur={onBlur}
            options={shifts.map((shift) => ({ value: shift.uid, label: shift.name, description: `${shift.code} • ${formatTime(shift.startTime)}-${formatTime(shift.endTime)}` }))}
            placeholder="Select shift"
            invalid={Boolean(touched.shiftUid && errors.shiftUid)}
          />
          {touched.shiftUid && errors.shiftUid ? <div className="invalid-feedback d-block">{errors.shiftUid}</div> : null}
        </div>
        <div className="col-12">
          <div className="form-check form-switch">
            <input className="form-check-input" id="assignmentActive" type="checkbox" checked={draft.isActive} onChange={(event) => onChange({ target: { name: 'isActive', value: event.target.checked } })} />
            <label className="form-check-label" htmlFor="assignmentActive">Assignment active</label>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function RegularizationLogsModal({ record, logs, employeesByUid, isLoading, onClose }) {
  return (
    <ModalFrame
      open={Boolean(record)}
      title="Regularization timeline"
      onClose={onClose}
      size="md"
      footer={<button type="button" className="btn btn-primary px-4" onClick={onClose}>Close</button>}
    >
      {record ? (
        <div className="d-flex flex-column gap-3">
          <div className="attendance-note-card">
            <div className="fw-semibold">{record.employeeName}</div>
            <div className="small text-muted">{formatDate(record.regularizationDate)} • {record.status}</div>
          </div>
          {isLoading ? (
            <div className="text-muted">Loading request history…</div>
          ) : logs.length ? logs.map((log) => {
            const actor = employeesByUid.get(String(log.actorEmployeeUid || ''))
            return (
              <div className="attendance-log-event" key={log.uid}>
                <div className="attendance-log-event__title">{log.action}</div>
                <div className="small text-muted">{actor?.fullName || 'System'} • {formatDateTime(log.createdAt)}</div>
                <div className="small mt-2">{log.note || 'No note captured.'}</div>
              </div>
            )
          }) : (
            <div className="text-muted">No review timeline is available for this request yet.</div>
          )}
        </div>
      ) : null}
    </ModalFrame>
  )
}

export default function AttendanceManagement() {
  const todayDate = getTodayDateInput()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showStatus, runWithLoader, showConfirm } = useModal()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canViewAttendanceRegister = hasModulePermission(user, PERMISSION_MODULES.attendanceOverview, PERMISSION_ACTIONS.read)
  const canViewSelfAttendance = hasModulePermission(user, PERMISSION_MODULES.myAttendancePreview, PERMISSION_ACTIONS.read)
  const canViewShiftsTab = hasModuleVisibility(user, [...PERMISSION_MODULES.shiftRoster, ...PERMISSION_MODULES.assignShift])
  const canViewOwnRegularizations = hasModulePermission(user, PERMISSION_MODULES.manageRegularization, PERMISSION_ACTIONS.read)
  const canViewRegularizationQueue = hasModulePermission(user, PERMISSION_MODULES.manageRegularization, PERMISSION_ACTIONS.read)
  const canSelfPunch = hasModulePermission(user, PERMISSION_MODULES.myAttendancePreview, PERMISSION_ACTIONS.create)
  const canModifyAttendance = ATTENDANCE_EDIT_API_AVAILABLE && hasModulePermission(user, PERMISSION_MODULES.attendanceOverview, PERMISSION_ACTIONS.update)
  const canCreateRegularization = hasModulePermission(user, PERMISSION_MODULES.manageRegularization, PERMISSION_ACTIONS.create)
  const canReviewRegularization = hasModulePermission(user, PERMISSION_MODULES.manageRegularization, PERMISSION_ACTIONS.create)
  const canViewRegularizationLogs = hasModulePermission(user, PERMISSION_MODULES.selfRegularizationLogs, PERMISSION_ACTIONS.read)
  const canCreateShift = hasModulePermission(user, PERMISSION_MODULES.shiftRoster, PERMISSION_ACTIONS.create)
  const canUpdateShift = hasModulePermission(user, PERMISSION_MODULES.shiftRoster, PERMISSION_ACTIONS.update)
  const canDeleteShift = hasModulePermission(user, PERMISSION_MODULES.shiftRoster, PERMISSION_ACTIONS.delete)
  const canCreateAssignment = hasModulePermission(user, PERMISSION_MODULES.assignShift, PERMISSION_ACTIONS.create)
  const canUpdateAssignment = hasModulePermission(user, PERMISSION_MODULES.assignShift, PERMISSION_ACTIONS.update)
  const canDeleteAssignment = hasModulePermission(user, PERMISSION_MODULES.assignShift, PERMISSION_ACTIONS.delete)
  const canUseSelfAttendance = canViewSelfAttendance || canSelfPunch || canViewOwnRegularizations || canCreateRegularization
  const canViewAttendanceTab = canViewAttendanceRegister || canUseSelfAttendance
  const canViewRegularizationTab = canViewRegularizationQueue || canReviewRegularization || canViewRegularizationLogs || canViewOwnRegularizations || canCreateRegularization
  const canViewOverview = canViewAttendanceRegister || canViewShiftsTab || canViewRegularizationQueue

  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => requestedTab || 'overview')
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const [statusFilter, setStatusFilter] = useState('All')
  const [regularizedFilter, setRegularizedFilter] = useState('All')
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' })
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [attendanceEditDraft, setAttendanceEditDraft] = useState(null)
  const [attendanceEditTouched, setAttendanceEditTouched] = useState({})
  const [decisionState, setDecisionState] = useState({ mode: '', record: null })
  const [reviewerNote, setReviewerNote] = useState('')
  const [regularizationOpen, setRegularizationOpen] = useState(false)
  const [regularizationDraft, setRegularizationDraft] = useState(() => buildRegularizationDraft(todayDate, []))
  const [regularizationTouched, setRegularizationTouched] = useState({})
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftDraft, setShiftDraft] = useState({ uid: '', code: '', name: '', startTime: '', endTime: '', isActive: true })
  const [shiftTouched, setShiftTouched] = useState({})
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [assignmentDraft, setAssignmentDraft] = useState({ uid: '', employeeUid: '', shiftUid: '', isActive: true })
  const [assignmentTouched, setAssignmentTouched] = useState({})
  const [selectedRegularizationLogRecord, setSelectedRegularizationLogRecord] = useState(null)
  const [punchControlVersion, setPunchControlVersion] = useState(0)

  const employeesQuery = useEmployeeLookupQuery(canViewAttendanceRegister || canViewShiftsTab || canViewRegularizationQueue || canReviewRegularization || canViewRegularizationLogs)
  const attendanceQuery = useAdminAttendanceQuery(canViewAttendanceRegister || canModifyAttendance)
  const pendingRegularizationsQuery = usePendingRegularizationsQuery(canViewRegularizationQueue || canReviewRegularization || canViewRegularizationLogs)
  const shiftRosterQuery = useShiftRosterQuery(canViewShiftsTab || canViewOverview)
  const employeeShiftAssignmentsQuery = useEmployeeShiftAssignmentsQuery(canViewShiftsTab || canViewOverview)
  const selectedLogsQuery = useMyPunchLogsQuery(selectedDate, canViewSelfAttendance || canSelfPunch)
  const todayLogsQuery = useMyPunchLogsQuery(todayDate, canViewSelfAttendance || canSelfPunch)
  const myRegularizationsQuery = useMyRegularizationsQuery(canViewOwnRegularizations || canCreateRegularization)
  const regularizationLogsQuery = useRegularizationLogsQuery(selectedRegularizationLogRecord?.uid, Boolean(selectedRegularizationLogRecord) && canViewRegularizationLogs)

  const employeeDirectory = employeesQuery.data || []
  const attendanceRecords = attendanceQuery.data || []
  const pendingRegularizations = pendingRegularizationsQuery.data || []
  const shiftRoster = shiftRosterQuery.data || []
  const shiftAssignments = employeeShiftAssignmentsQuery.data || []
  const selectedLogsRaw = selectedLogsQuery.data || []
  const todayLogsRaw = todayLogsQuery.data || []
  const selectedLogs = useMemo(
    () => applyLocalPunchControl(selectedLogsRaw, selectedDate),
    [punchControlVersion, selectedDate, selectedLogsRaw]
  )
  const todayLogs = useMemo(
    () => applyLocalPunchControl(todayLogsRaw, todayDate),
    [punchControlVersion, todayDate, todayLogsRaw]
  )
  const myRegularizations = myRegularizationsQuery.data || []
  const regularizationLogs = regularizationLogsQuery.data || []
  const { items: sortedSelectedLogs, sortConfig: selectedLogsSortConfig, requestSort: requestSelectedLogsSort } = useSortableData(selectedLogs, {
    initialKey: 'punchTime',
    initialDirection: 'desc',
    accessors: {
      punchType: (log) => log.punchType || '',
      punchTime: (log) => log.punchTime || '',
      source: (log) => log.source || 'SELF',
      validity: (log) => (log.isValid ? 'Valid' : 'Invalid'),
      notes: (log) => log.invalidReason || ''
    }
  })
  const currentEmployeeUid = useMemo(() => {
    const explicitEmployeeUid = String(user?.employeeUid || '').trim()
    if (explicitEmployeeUid) return explicitEmployeeUid

    const currentUserUid = String(user?.uid || '').trim()
    const currentUserEmail = String(user?.email || '').trim().toLowerCase()
    const matchedDirectoryRecord = employeeDirectory.find((employee) => (
      (currentUserUid && String(employee.userUid || '').trim() === currentUserUid)
      || (currentUserEmail && String(employee.email || '').trim().toLowerCase() === currentUserEmail)
    ))

    if (matchedDirectoryRecord?.uid) return String(matchedDirectoryRecord.uid)

    return String(
      attendanceRecords.find((record) => String(record.userUid || '').trim() === currentUserUid)?.employeeUid
      || myRegularizations.find((record) => String(record.userUid || '').trim() === currentUserUid)?.employeeUid
      || selectedLogsRaw.find((record) => String(record.userUid || '').trim() === currentUserUid)?.employeeUid
      || todayLogsRaw.find((record) => String(record.userUid || '').trim() === currentUserUid)?.employeeUid
      || ''
    )
  }, [attendanceRecords, employeeDirectory, myRegularizations, selectedLogsRaw, todayLogsRaw, user?.email, user?.employeeUid, user?.uid])

  const employeesByUid = useMemo(() => new Map(employeeDirectory.map((employee) => [String(employee.uid), employee])), [employeeDirectory])
  const shiftsByUid = useMemo(() => new Map(shiftRoster.map((shift) => [String(shift.uid), shift])), [shiftRoster])

  const attendanceRows = useMemo(() => {
    return attendanceRecords.map((record) => {
      const employee = employeesByUid.get(String(record.employeeUid))
      return {
        ...record,
        employeeName: employee?.fullName || employee?.email || `Employee ${String(record.employeeUid || '').slice(0, 8)}`,
        employeeCode: employee?.employeeCode || '—',
        department: employee?.department || '—',
        email: employee?.email || '—',
        isOwnRecord: String(record.employeeUid || '') === currentEmployeeUid
      }
    })
  }, [attendanceRecords, currentEmployeeUid, employeesByUid])

  const regularizationRows = useMemo(() => {
    return pendingRegularizations.map((record) => {
      const employee = employeesByUid.get(String(record.employeeUid))
      return {
        ...record,
        employeeName: employee?.fullName || employee?.email || `Employee ${String(record.employeeUid || '').slice(0, 8)}`,
        employeeCode: employee?.employeeCode || '—',
        isOwnRecord: String(record.employeeUid || '') === currentEmployeeUid
      }
    })
  }, [currentEmployeeUid, pendingRegularizations, employeesByUid])

  const myRegularizationRows = useMemo(() => {
    return myRegularizations.map((record) => {
      const employee = employeesByUid.get(String(record.employeeUid))
      return {
        ...record,
        employeeName: employee?.fullName || 'Me',
        employeeCode: employee?.employeeCode || '—',
        isOwnRecord: String(record.employeeUid || '') === currentEmployeeUid
      }
    })
  }, [currentEmployeeUid, employeesByUid, myRegularizations])

  const assignmentRows = useMemo(() => {
    return shiftAssignments.map((assignment) => {
      const employee = employeesByUid.get(String(assignment.employeeUid))
      const shift = shiftsByUid.get(String(assignment.shiftUid))
      return {
        ...assignment,
        employeeName: employee?.fullName || employee?.email || 'Employee',
        employeeCode: employee?.employeeCode || '—',
        shiftName: shift?.name || 'Shift',
        shiftCode: shift?.code || '—',
        shiftStartTime: shift?.startTime || '',
        shiftEndTime: shift?.endTime || ''
      }
    })
  }, [employeesByUid, shiftAssignments, shiftsByUid])
  const currentAssignedShiftCard = useMemo(() => {
    if (!canUseSelfAttendance) return null
    const currentAssignment = assignmentRows.find((row) => String(row.employeeUid || '') === currentEmployeeUid && row.isActive)

    if (!currentEmployeeUid) {
      return {
        title: 'Assigned shift unavailable',
        helper: 'Your employee record could not be resolved for shift lookup.'
      }
    }

    if (!currentAssignment) {
      return {
        title: 'No active shift',
        helper: 'Once a shift is assigned, it will appear here before the punch controls.'
      }
    }

    return {
      title: currentAssignment.shiftName,
      code: currentAssignment.shiftCode,
      window: `${formatTime(currentAssignment.shiftStartTime)} - ${formatTime(currentAssignment.shiftEndTime)}`,
      status: currentAssignment.isActive ? 'Assigned' : 'Inactive',
      helper: 'This is the shift currently linked with your attendance session.'
    }
  }, [assignmentRows, canUseSelfAttendance, currentEmployeeUid])

  const filteredAttendanceRows = useMemo(() => {
    return filterCollectionByQuery(attendanceRows, deferredSearchTerm, ['employeeName', 'employeeCode', 'department', 'email', 'remarks']).filter((row) => {
      const matchesSearch = true
      const matchesStatus = statusFilter === 'All' || row.status === statusFilter
      const matchesRegularized = regularizedFilter === 'All'
        || (regularizedFilter === 'Regularized' && row.isRegularized)
        || (regularizedFilter === 'Standard' && !row.isRegularized)
      const matchesStartDate = !dateRangeFilter?.start || row.attendanceDate >= dateRangeFilter.start
      const matchesEndDate = !dateRangeFilter?.end || row.attendanceDate <= dateRangeFilter.end
      return matchesSearch && matchesStatus && matchesRegularized && matchesStartDate && matchesEndDate
    })
  }, [attendanceRows, dateRangeFilter, deferredSearchTerm, regularizedFilter, statusFilter])

  const { items: sortedAttendanceRows, sortConfig: attendanceSortConfig, requestSort: requestAttendanceSort } = useSortableData(filteredAttendanceRows, {
    initialKey: 'attendanceDate',
    initialDirection: 'desc',
    accessors: {
      attendanceDate: (row) => row.attendanceDate,
      employeeName: (row) => row.employeeName,
      department: (row) => row.department || '',
      status: (row) => row.status,
      firstPunchIn: (row) => row.firstPunchIn || '',
      lastPunchOut: (row) => row.lastPunchOut || '',
      totalWorkedHours: (row) => row.totalWorkedHours,
      totalAssignedShiftHours: (row) => row.totalAssignedShiftHours,
      regularized: (row) => (row.isRegularized ? 'Regularized' : 'Standard'),
      remarks: (row) => row.remarks || ''
    }
  })
  const { items: sortedRegularizationRows, sortConfig: regularizationSortConfig, requestSort: requestRegularizationSort } = useSortableData(regularizationRows, {
    initialKey: 'regularizationDate',
    initialDirection: 'desc',
    accessors: {
      employeeName: (row) => row.employeeName || '',
      regularizationDate: (row) => row.regularizationDate || '',
      requestedPunchIn: (row) => row.requestedPunchIn || '',
      requestedPunchOut: (row) => row.requestedPunchOut || '',
      requestedWorkedHours: (row) => Number(row.requestedWorkedHours ?? -1),
      status: (row) => row.status || ''
    }
  })
  const { items: sortedMyRegularizationRows } = useSortableData(myRegularizationRows, {
    initialKey: 'regularizationDate',
    initialDirection: 'desc',
    accessors: {
      regularizationDate: (row) => row.regularizationDate || '',
      requestedPunchIn: (row) => row.requestedPunchIn || '',
      requestedPunchOut: (row) => row.requestedPunchOut || '',
      requestedWorkedHours: (row) => Number(row.requestedWorkedHours ?? -1),
      reason: (row) => row.reason || '',
      status: (row) => row.status || '',
      reviewerNote: (row) => row.reviewerNote || '',
      updatedAt: (row) => row.updatedAt || row.createdAt || ''
    }
  })
  const regularizationRequestRows = useMemo(() => {
    const rowsByUid = new Map()

    sortedMyRegularizationRows.forEach((row) => {
      rowsByUid.set(String(row.uid), { ...row, isOwnRecord: true })
    })

    regularizationRows.forEach((row) => {
      const rowKey = String(row.uid)
      if (rowsByUid.has(rowKey)) {
        rowsByUid.set(rowKey, {
          ...row,
          ...rowsByUid.get(rowKey),
          isOwnRecord: true
        })
        return
      }

      rowsByUid.set(rowKey, row)
    })

    return Array.from(rowsByUid.values())
  }, [regularizationRows, sortedMyRegularizationRows])
  const { items: sortedRegularizationRequestRows, sortConfig: regularizationRequestSortConfig, requestSort: requestRegularizationRequestSort } = useSortableData(regularizationRequestRows, {
    initialKey: 'regularizationDate',
    initialDirection: 'desc',
    accessors: {
      employeeName: (row) => row.employeeName || '',
      regularizationDate: (row) => row.regularizationDate || '',
      requestedPunchIn: (row) => row.requestedPunchIn || '',
      requestedPunchOut: (row) => row.requestedPunchOut || '',
      requestedWorkedHours: (row) => Number(row.requestedWorkedHours ?? -1),
      status: (row) => row.status || '',
      reviewerNote: (row) => row.reviewerNote || '',
      updatedAt: (row) => row.updatedAt || row.reviewedAt || row.createdAt || ''
    }
  })
  const { items: sortedShiftRoster, sortConfig: shiftRosterSortConfig, requestSort: requestShiftRosterSort } = useSortableData(shiftRoster, {
    initialKey: 'code',
    initialDirection: 'asc',
    accessors: {
      code: (shift) => shift.code || '',
      name: (shift) => shift.name || '',
      window: (shift) => `${shift.startTime || ''} ${shift.endTime || ''}`.trim(),
      status: (shift) => (shift.isActive ? 'Active' : 'Inactive')
    }
  })
  const { items: sortedAssignmentRows, sortConfig: assignmentSortConfig, requestSort: requestAssignmentSort } = useSortableData(assignmentRows, {
    initialKey: 'employeeName',
    initialDirection: 'asc',
    accessors: {
      employeeName: (row) => row.employeeName || '',
      shiftName: (row) => row.shiftName || '',
      window: (row) => `${row.shiftStartTime || ''} ${row.shiftEndTime || ''}`.trim(),
      status: (row) => (row.isActive ? 'Active' : 'Inactive')
    }
  })

  const summary = useMemo(() => getAttendanceSummary(attendanceRows), [attendanceRows])
  const shiftSummary = useMemo(() => getShiftOverview(shiftRoster, shiftAssignments), [shiftAssignments, shiftRoster])
  const statusOptions = useMemo(() => ['All', ...Array.from(new Set(attendanceRows.map((row) => row.status).filter(Boolean)))], [attendanceRows])
  const todaySession = useMemo(
    () => ({ ...getPunchSessionState(todayLogs), totalWorkedHours: attendanceRows.find((row) => row.attendanceDate === todayDate && row.employeeUid === currentEmployeeUid)?.totalWorkedHours }),
    [attendanceRows, currentEmployeeUid, todayDate, todayLogs]
  )
  const selectedSession = useMemo(() => getPunchSessionState(selectedLogs), [selectedLogs])
  const latestRegularizationStatus = useMemo(() => getLatestRegularizationStatus(myRegularizations), [myRegularizations])
  const elapsedSeconds = useMemo(() => Number(todaySession.workedSeconds || 0), [todaySession.workedSeconds])
  const availableTabs = useMemo(() => filterAccessibleTabs(TAB_ITEMS, (tabKey) => {
    if (tabKey === 'overview') return canViewOverview
    if (tabKey === 'attendance') return canViewAttendanceTab
    if (tabKey === 'shifts') return canViewShiftsTab
    if (tabKey === 'regularization') return canViewRegularizationTab
    return false
  }), [canViewAttendanceTab, canViewOverview, canViewRegularizationTab, canViewShiftsTab])

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
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab)
    }
  }, [activeTab, requestedTab])

  const pinnedAttendanceRows = useMemo(() => prioritizeRowsByEmployee(sortedAttendanceRows, currentEmployeeUid), [currentEmployeeUid, sortedAttendanceRows])
  const pinnedPendingRegularizationRows = useMemo(() => prioritizeRowsByEmployee(sortedRegularizationRows, currentEmployeeUid), [currentEmployeeUid, sortedRegularizationRows])
  const pinnedRegularizationRequestRows = useMemo(() => prioritizeRowsByEmployee(sortedRegularizationRequestRows, currentEmployeeUid), [currentEmployeeUid, sortedRegularizationRequestRows])
  const previewAttendance = pinnedAttendanceRows.slice(0, 5)
  const previewRegularizations = pinnedPendingRegularizationRows.slice(0, 5)

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'overview') return canViewOverview
      if (tabKey === 'attendance') return canViewAttendanceTab
      if (tabKey === 'shifts') return canViewShiftsTab
      if (tabKey === 'regularization') return canViewRegularizationTab
      return false
    }, canViewOverview ? 'overview' : availableTabs[0]?.key)

    if (!nextTab) return
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    if (requestedTab !== nextTab) {
      updateTabSearchParam(nextTab)
    }
  }, [activeTab, availableTabs, canViewAttendanceTab, canViewOverview, canViewRegularizationTab, canViewShiftsTab, requestedTab, updateTabSearchParam])

  useEffect(() => {
    if (!regularizationOpen) return
    setRegularizationDraft(buildRegularizationDraft(selectedDate, selectedLogs))
    setRegularizationTouched({})
  }, [regularizationOpen, selectedDate, selectedLogs])

  useEffect(() => {
    const handlePunchControlChanged = (event) => {
      const changedDate = String(event?.detail?.attendanceDate || '')
      if (changedDate && changedDate !== todayDate && changedDate !== selectedDate) return
      setPunchControlVersion((current) => current + 1)
    }

    window.addEventListener(PUNCH_CONTROL_CHANGED_EVENT, handlePunchControlChanged)
    return () => {
      window.removeEventListener(PUNCH_CONTROL_CHANGED_EVENT, handlePunchControlChanged)
    }
  }, [selectedDate, todayDate])

  const invalidateAttendanceState = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['employees'] })
    ])
  }

  const punchInMutation = useMutation({
    mutationFn: attendanceService.punchIn,
    onSuccess: async (result) => {
      await invalidateAttendanceState()
      showToast({ tone: 'success', title: 'Punch-in recorded', message: `${result.message} Current status: ${result.status}.` })
    },
    onError: (error) => showToast({ tone: 'danger', title: 'Punch-in failed', message: getErrorMessage(error, 'The system could not record your punch-in.') })
  })

  const punchOutMutation = useMutation({
    mutationFn: (mode = 'final') => attendanceService.punchOut(mode),
    onSuccess: async (result, mode) => {
      rememberPunchOutMode(todayDate, result?.lastPunchOut || new Date(), mode)
      setPunchControlVersion((current) => current + 1)
      await invalidateAttendanceState()
      showToast({
        tone: 'success',
        title: String(mode).toLowerCase() === 'soft' ? 'Soft punch-out recorded' : 'Final punch-out recorded',
        message: `${result.message} Total worked hours: ${formatHours(result.totalWorkedHours)}.`
      })
    },
    onError: (error) => showToast({ tone: 'danger', title: 'Punch-out failed', message: getErrorMessage(error, 'The system could not record your punch-out.') })
  })

  const regularizationMutation = useMutation({
    mutationFn: attendanceService.createRegularization,
    onSuccess: async () => {
      await invalidateAttendanceState()
      setRegularizationOpen(false)
      setRegularizationTouched({})
      showStatus({ type: 'success', title: 'Regularization submitted', message: 'Your request is now available inside the review queue.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Submission failed', message: getErrorMessage(error, 'The regularization request could not be submitted.') })
  })

  const decisionMutation = useMutation({
    mutationFn: async ({ mode, uid, note }) => (mode === 'approve' ? attendanceService.approveRegularization(uid, note) : attendanceService.rejectRegularization(uid, note)),
    onSuccess: async (_, variables) => {
      await invalidateAttendanceState()
      setDecisionState({ mode: '', record: null })
      setReviewerNote('')
      showStatus({
        type: 'success',
        title: variables.mode === 'approve' ? 'Request approved' : 'Request rejected',
        message: 'The regularization queue has been refreshed with the latest decision.'
      })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Decision failed', message: getErrorMessage(error, 'The regularization request could not be updated.') })
  })

  const updateAttendanceMutation = useMutation({
    mutationFn: ({ uid, payload }) => attendanceService.updateAttendance(uid, payload),
    onSuccess: async () => {
      await invalidateAttendanceState()
      setAttendanceEditDraft(null)
      setAttendanceEditTouched({})
      showStatus({ type: 'success', title: 'Attendance updated', message: 'The selected attendance entry has been modified successfully.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Update failed', message: getErrorMessage(error, 'The attendance entry could not be modified.') })
  })

  const shiftMutation = useMutation({
    mutationFn: (payload) => payload.uid ? attendanceService.updateShift(payload.uid, payload) : attendanceService.createShift(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'shift-roster'] })
      setShiftModalOpen(false)
      setShiftDraft({ uid: '', code: '', name: '', startTime: '', endTime: '', isActive: true })
      setShiftTouched({})
      showStatus({ type: 'success', title: 'Shift roster synced', message: 'Shift management data has been updated successfully.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Shift update failed', message: getErrorMessage(error, 'The shift roster could not be saved.') })
  })

  const deleteShiftMutation = useMutation({
    mutationFn: attendanceService.deleteShift,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'shift-roster'] })
      showStatus({ type: 'success', title: 'Shift removed', message: 'The selected shift has been deleted from the roster.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Delete failed', message: getErrorMessage(error, 'The shift could not be deleted.') })
  })

  const assignmentMutation = useMutation({
    mutationFn: (payload) => payload.uid
      ? attendanceService.updateEmployeeShiftAssignment(payload.uid, payload)
      : attendanceService.createEmployeeShiftAssignment(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'employee-shift-assignments'] })
      setAssignmentModalOpen(false)
      setAssignmentDraft({ uid: '', employeeUid: '', shiftUid: '', isActive: true })
      setAssignmentTouched({})
      showStatus({ type: 'success', title: 'Assignment saved', message: 'Employee shift assignment has been synchronized.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Assignment failed', message: getErrorMessage(error, 'The shift assignment could not be saved.') })
  })

  const deleteAssignmentMutation = useMutation({
    mutationFn: attendanceService.deleteEmployeeShiftAssignment,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['attendance', 'employee-shift-assignments'] })
      showStatus({ type: 'success', title: 'Assignment removed', message: 'The employee shift assignment has been deleted.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Delete failed', message: getErrorMessage(error, 'The assignment could not be deleted.') })
  })

  const handlePunchIn = async () => {
    if (!canSelfPunch) {
      showToast({ tone: 'danger', title: 'Attendance unavailable', message: 'Your role does not have permission to create attendance punch entries.' })
      return
    }

    if (todaySession.hasSoftPunchOut && todaySession.canPunchIn) {
      rememberSoftPunchResume(todayDate)
      setPunchControlVersion((current) => current + 1)
      showToast({
        tone: 'success',
        title: 'Timer resumed',
        message: 'Your shift timer has resumed. Use Punch Out to pause again or finalize the day.'
      })
      return
    }

    try {
      await punchInMutation.mutateAsync()
    } catch {
      // handled in mutation callbacks
    }
  }

  const handleSoftPunchOut = async () => {
    if (!canSelfPunch) {
      showToast({ tone: 'danger', title: 'Attendance unavailable', message: 'Your role does not have permission to create attendance punch entries.' })
      return
    }

    try {
      await punchOutMutation.mutateAsync('soft')
    } catch {
      // handled in mutation callbacks
    }
  }

  const handleFinalPunchOut = async () => {
    if (!canSelfPunch) {
      showToast({ tone: 'danger', title: 'Attendance unavailable', message: 'Your role does not have permission to create attendance punch entries.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Final punch-out',
      title: 'Finalize today’s attendance session?',
      message: 'Final punch-out closes the day permanently. You will not be able to resume the timer after this step.',
      confirmLabel: 'Final Punch Out',
      cancelLabel: 'Keep Session Open'
    })
    if (!accepted) return

    try {
      await punchOutMutation.mutateAsync('final')
    } catch {
      // handled in mutation callbacks
    }
  }

  const handleRegularizationSubmit = async () => {
    if (!canCreateRegularization) {
      showStatus({ type: 'error', title: 'Regularization access blocked', message: 'Your role does not have permission to create attendance regularization requests.' })
      return
    }

    const validationFields = ['regularizationDate', 'requestedWorkedHours', 'requestedPunchOut', 'reason']
    setRegularizationTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(regularizationErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => regularizationErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Regularization has validation errors', message: firstError || 'Resolve the highlighted fields before submitting the request.' })
      return
    }

    await runWithLoader(async () => regularizationMutation.mutateAsync(regularizationDraft), { title: 'Submitting request', message: 'Routing your attendance correction into the verification queue.' })
  }

  const handleDecision = async () => {
    if (!decisionState.record || !decisionState.mode) return
    if (!canReviewRegularization) {
      showStatus({ type: 'error', title: 'Regularization access blocked', message: 'Your role does not have permission to review attendance regularization requests.' })
      return
    }
    await runWithLoader(async () => decisionMutation.mutateAsync({ mode: decisionState.mode, uid: decisionState.record.uid, note: reviewerNote }), { title: 'Updating request', message: 'Applying your decision to the regularization workflow.' })
  }

  const handleAttendanceUpdate = async () => {
    if (!attendanceEditDraft) return
    if (!canModifyAttendance) {
      showStatus({ type: 'error', title: 'Attendance access blocked', message: 'Your role does not have permission to modify attendance entries.' })
      return
    }
    const validationFields = ['totalWorkedHours', 'lastPunchOut', 'status']
    setAttendanceEditTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(attendanceEditErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => attendanceEditErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Attendance entry has validation errors', message: firstError || 'Resolve the highlighted fields before saving changes.' })
      return
    }

    const { uid, ...payload } = attendanceEditDraft
    await runWithLoader(async () => updateAttendanceMutation.mutateAsync({ uid, payload }), { title: 'Saving attendance changes', message: 'Applying the admin correction to the selected attendance record.' })
  }

  const handleShiftSubmit = async () => {
    const canSaveShift = shiftDraft.uid ? canUpdateShift : canCreateShift
    if (!canSaveShift) {
      showStatus({
        type: 'error',
        title: 'Shift access blocked',
        message: shiftDraft.uid
          ? 'Your role does not have permission to update shift roster entries.'
          : 'Your role does not have permission to create shift roster entries.'
      })
      return
    }

    const validationFields = Boolean(shiftDraft.uid) ? ['name', 'startTime', 'endTime'] : ['code', 'name', 'startTime', 'endTime']
    setShiftTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(shiftErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => shiftErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Shift has validation errors', message: firstError || 'Resolve the highlighted shift fields before saving.' })
      return
    }

    await runWithLoader(async () => shiftMutation.mutateAsync({ ...shiftDraft, startTime: shiftDraft.startTime, endTime: shiftDraft.endTime }), { title: 'Saving shift roster', message: 'Updating the shift catalog and syncing assignment availability.' })
  }

  const handleAssignmentSubmit = async () => {
    const canSaveAssignment = assignmentDraft.uid ? canUpdateAssignment : canCreateAssignment
    if (!canSaveAssignment) {
      showStatus({
        type: 'error',
        title: 'Assignment access blocked',
        message: assignmentDraft.uid
          ? 'Your role does not have permission to update employee shift assignments.'
          : 'Your role does not have permission to create employee shift assignments.'
      })
      return
    }

    const validationFields = ['employeeUid', 'shiftUid']
    setAssignmentTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(assignmentErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => assignmentErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Assignment has validation errors', message: firstError || 'Resolve the highlighted assignment fields before saving.' })
      return
    }

    await runWithLoader(async () => assignmentMutation.mutateAsync(assignmentDraft), { title: 'Saving assignment', message: 'Linking the selected shift with the employee record.' })
  }

  const handleDeleteShift = async (shiftUid) => {
    if (!canDeleteShift) {
      showStatus({ type: 'error', title: 'Shift access blocked', message: 'Your role does not have permission to delete shift roster entries.' })
      return
    }
    await runWithLoader(async () => deleteShiftMutation.mutateAsync(shiftUid), { title: 'Deleting shift', message: 'Removing the selected shift from the roster.' })
  }

  const handleDeleteAssignment = async (assignmentUid) => {
    if (!canDeleteAssignment) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to delete employee shift assignments.' })
      return
    }
    await runWithLoader(async () => deleteAssignmentMutation.mutateAsync(assignmentUid), { title: 'Deleting assignment', message: 'Removing the selected employee shift assignment.' })
  }

  const handleRegularizationChange = (event) => {
    const { name, value } = event.target
    setRegularizationDraft((current) => ({ ...current, [name]: value }))
  }

  const handleRegularizationBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setRegularizationTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleShiftDraftChange = (event) => {
    const { name, value } = event.target
    setShiftDraft((current) => ({ ...current, [name]: value }))
  }

  const handleShiftBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setShiftTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleAssignmentDraftChange = (event) => {
    const { name, value } = event.target
    setAssignmentDraft((current) => ({ ...current, [name]: value }))
  }

  const handleAssignmentBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setAssignmentTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const handleAttendanceDraftChange = (event) => {
    const { name, value } = event.target
    setAttendanceEditDraft((current) => ({ ...current, [name]: value }))
  }

  const handleAttendanceDraftBlur = (event) => {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setAttendanceEditTouched((current) => ({ ...current, [fieldName]: true }))
  }

  const openAttendanceEditModal = (record) => {
    if (!canModifyAttendance) {
      showStatus({ type: 'error', title: 'Attendance access blocked', message: 'Your role does not have permission to modify attendance entries.' })
      return
    }

    setAttendanceEditDraft({
      uid: record.uid,
      employeeName: record.employeeName,
      employeeCode: record.employeeCode,
      attendanceDate: record.attendanceDate,
      firstPunchIn: toDateTimeLocalValue(record.firstPunchIn),
      lastPunchOut: toDateTimeLocalValue(record.lastPunchOut),
      totalWorkedHours: record.totalWorkedHours,
      status: record.status,
      remarks: record.remarks || '',
      isRegularized: Boolean(record.isRegularized)
    })
    setAttendanceEditTouched({})
  }

  const openShiftCreate = () => {
    if (!canCreateShift) {
      showStatus({ type: 'error', title: 'Shift access blocked', message: 'Your role does not have permission to create shift roster entries.' })
      return
    }
    setShiftDraft({ uid: '', code: '', name: '', startTime: '', endTime: '', isActive: true })
    setShiftTouched({})
    setShiftModalOpen(true)
  }

  const openShiftEdit = (shift) => {
    if (!canUpdateShift) {
      showStatus({ type: 'error', title: 'Shift access blocked', message: 'Your role does not have permission to update shift roster entries.' })
      return
    }
    setShiftDraft({ uid: shift.uid, code: shift.code, name: shift.name, startTime: toTimeInputValue(shift.startTime), endTime: toTimeInputValue(shift.endTime), isActive: shift.isActive })
    setShiftTouched({})
    setShiftModalOpen(true)
  }

  const openAssignmentCreate = () => {
    if (!canCreateAssignment) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to create employee shift assignments.' })
      return
    }
    setAssignmentDraft({ uid: '', employeeUid: '', shiftUid: '', isActive: true })
    setAssignmentTouched({})
    setAssignmentModalOpen(true)
  }

  const openAssignmentEdit = (assignment) => {
    if (!canUpdateAssignment) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to update employee shift assignments.' })
      return
    }
    setAssignmentDraft({ uid: assignment.uid, employeeUid: assignment.employeeUid, shiftUid: assignment.shiftUid, isActive: assignment.isActive })
    setAssignmentTouched({})
    setAssignmentModalOpen(true)
  }

  const attendanceEditErrors = useMemo(() => buildAttendanceEditErrors(attendanceEditDraft), [attendanceEditDraft])
  const regularizationErrors = useMemo(() => buildRegularizationErrors(regularizationDraft), [regularizationDraft])
  const shiftErrors = useMemo(() => buildShiftErrors(shiftDraft, Boolean(shiftDraft.uid)), [shiftDraft])
  const assignmentErrors = useMemo(() => buildAssignmentErrors(assignmentDraft), [assignmentDraft])

  const overviewItems = [
    { label: 'Pending approvals', value: `${regularizationRows.length} request(s)`, helper: 'Requests requiring admin verification', icon: <SparklesIcon /> },
    { label: 'Shift coverage', value: `${shiftSummary.activeAssignments} active assignment(s)`, helper: `${shiftSummary.activeShifts} active shift templates`, icon: <BriefcaseIcon /> },
    { label: 'My punch state', value: todaySession.isClockedIn ? 'Clocked In' : (todaySession.totalPunches ? 'Completed' : 'Ready'), helper: `Latest personal request: ${latestRegularizationStatus}`, icon: <CalendarIcon /> }
  ]

  const isLoading = attendanceQuery.isLoading || employeesQuery.isLoading || pendingRegularizationsQuery.isLoading || shiftRosterQuery.isLoading || employeeShiftAssignmentsQuery.isLoading || selectedLogsQuery.isLoading || todayLogsQuery.isLoading || myRegularizationsQuery.isLoading

  if (isLoading) {
    return <div className="text-muted">Loading attendance control center…</div>
  }

  return (
    <div className="d-flex flex-column gap-3 attendance-module-page employee-directory-page">
      <PageHeader
        title="Attendance Management"
        tagline="Switch between overview, attendance operations, shift control, and regularization workflows from one admin workspace."
      />

      <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />

      {activeTab === 'overview' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Total Records" value={summary.total} helper="Attendance entries currently loaded" tone="blue" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Present" value={summary.present} helper="Employees who completed assigned hours" tone="teal" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Regularized" value={summary.regularized} helper="Records corrected through workflow" tone="purple" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Active Shifts" value={shiftSummary.activeShifts} helper="Live shift templates available for assignment" tone="orange" /></div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-xl-4">
              <CardShell title="Operations Snapshot">
                <OverviewList items={overviewItems} />
              </CardShell>
            </div>
            {canUseSelfAttendance ? (
              <div className="col-12 col-xl-8">
                <CardShell title="Today’s Admin Punch Panel">
                  <PunchSessionCard
                    title="Admin self punch"
                    attendanceStateLabel={todaySession.isClockedIn ? 'Clocked In' : (todaySession.hasSoftPunchOut ? 'Paused' : (todaySession.totalPunches ? 'Completed' : 'Ready'))}
                    session={todaySession}
                    elapsedSeconds={elapsedSeconds}
                    dateValue={todayDate}
                    onPunchIn={handlePunchIn}
                    onSoftPunchOut={handleSoftPunchOut}
                    onFinalPunchOut={handleFinalPunchOut}
                    isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                    note={todaySession.isClockedIn ? 'Your admin attendance session is active. Use soft punch-out to pause or final punch-out to close the day.' : todaySession.hasSoftPunchOut ? 'Your shift is paused after soft punch-out. Resume the timer when you start working again.' : 'Use self punch controls for your own attendance and the admin register below for workforce monitoring.'}
                    secondaryNote="Both employees and admins can add their own time entries from this workspace."
                    assignedShift={currentAssignedShiftCard}
                  />
                </CardShell>
              </div>
            ) : null}
          </div>

          {canViewAttendanceTab ? (
            <CardShell title="Attendance Register Preview" right={<button type="button" className="btn btn-sm btn-outline-info" onClick={() => setActiveTab('attendance')}>Open full register</button>}>
            <PaginatedTable rows={previewAttendance}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--attendance-preview align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Date" sortKey="attendanceDate" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Employee" sortKey="employeeName" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Worked" sortKey="totalWorkedHours" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th className="table-header-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((row) => (
                      <tr key={row.uid}>
                        <td><TableCellStack title={formatDate(row.attendanceDate)} subtitle={row.department || 'Attendance entry'} /></td>
                        <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                        <td><AttendanceBadge status={row.status} /></td>
                        <td><TableBadge value={formatHours(row.totalWorkedHours)} tone="blue" /></td>
                        <td className="table-actions-cell"><TableActionCluster><TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => setSelectedRecord(row)} /></TableActionCluster></td>
                      </tr>
                    )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No attendance entries available.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
            </CardShell>
          ) : null}

          {(canViewRegularizationQueue || canReviewRegularization || canViewRegularizationLogs) ? (
            <CardShell title="Pending Regularization Preview" right={<button type="button" className="btn btn-sm btn-outline-info" onClick={() => setActiveTab('regularization')}>Open full queue</button>}>
            <PaginatedTable rows={previewRegularizations}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--regularization-preview align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Employee" sortKey="employeeName" sortConfig={regularizationSortConfig} onSort={requestRegularizationSort} /></th>
                      <th><SortableHeader label="Date" sortKey="regularizationDate" sortConfig={regularizationSortConfig} onSort={requestRegularizationSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={regularizationSortConfig} onSort={requestRegularizationSort} /></th>
                      <th className="table-header-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((row) => (
                      <tr key={row.uid}>
                        <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                        <td><TableCellStack title={formatDate(row.regularizationDate)} subtitle="Awaiting review" /></td>
                        <td><RegularizationBadge status={row.status} /></td>
                        <td className="table-actions-cell"><TableActionCluster>{canViewRegularizationLogs ? <TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => setSelectedRegularizationLogRecord(row)} /> : null}</TableActionCluster></td>
                      </tr>
                    )) : <tr><td colSpan="4"><div className="employee-empty-state text-center py-5 text-muted">No pending regularization requests.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
            </CardShell>
          ) : null}
        </>
      ) : null}

      {activeTab === 'attendance' ? (
        <>
          {canUseSelfAttendance ? (
            <div className="row g-3">
              <div className="col-12 col-xl-5">
                <CardShell title="Punch In / Punch Out">
                  <PunchSessionCard
                    title="My attendance actions"
                    attendanceStateLabel={todaySession.isClockedIn ? 'Clocked In' : (todaySession.hasSoftPunchOut ? 'Paused' : (todaySession.totalPunches ? 'Completed' : 'Ready'))}
                    session={todaySession}
                    elapsedSeconds={elapsedSeconds}
                    dateValue={todayDate}
                    onPunchIn={handlePunchIn}
                    onSoftPunchOut={handleSoftPunchOut}
                    onFinalPunchOut={handleFinalPunchOut}
                    isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                    note={todaySession.isClockedIn ? 'Your admin attendance session is active. Use soft punch-out to pause or final punch-out to close the day.' : todaySession.hasSoftPunchOut ? 'Your shift is paused after soft punch-out. Resume the timer when you start working again.' : todaySession.totalPunches ? 'Your latest attendance entries are pinned at the top of the register below.' : 'No punch has been recorded yet for today. Use punch in to start your shift.'}
                    secondaryNote="Admins can also modify workforce attendance entries directly in the register below."
                    assignedShift={currentAssignedShiftCard}
                  />
                </CardShell>
              </div>

              <div className="col-12 col-xl-7">
                <CardShell title="Daily Punch In / Punch Out Log" right={<DownloadActionGroup onCsv={() => downloadPunchLogsCsv(sortedSelectedLogs, `admin-punch-logs-${selectedDate}.csv`)} onExcel={() => downloadPunchLogsExcel(sortedSelectedLogs, `admin-punch-logs-${selectedDate}.xls`)} align="end" />}>
                  <div className="attendance-toolbar mb-3">
                    <div className="employee-toolbar-left">
                      <div className="employee-search-field attendance-date-field">
                        <label className="form-label small text-muted mb-1">Inspect Date</label>
                        <input className="form-control" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                      </div>
                    </div>
                  </div>

                  <div className="attendance-log-strip mb-3">
                    <div><div className="attendance-detail-label">Selected Date</div><div className="attendance-detail-value">{formatDate(selectedDate)}</div></div>
                    <div><div className="attendance-detail-label">Punch Count</div><div className="attendance-detail-value">{selectedSession.totalPunches}</div></div>
                    <div><div className="attendance-detail-label">First In</div><div className="attendance-detail-value">{formatTime(selectedSession.firstPunchIn)}</div></div>
                    <div><div className="attendance-detail-label">Last Out</div><div className="attendance-detail-value">{formatTime(selectedSession.lastPunchOut)}</div></div>
                  </div>

                  <PaginatedTable rows={sortedSelectedLogs}>
                    {({ rows: paginatedRows }) => (
                      <table className="table employee-table workspace-table workspace-table--attendance-log align-middle mb-0">
                        <thead>
                          <tr>
                            <th><SortableHeader label="Punch Type" sortKey="punchType" sortConfig={selectedLogsSortConfig} onSort={requestSelectedLogsSort} /></th>
                            <th><SortableHeader label="Punch Time" sortKey="punchTime" sortConfig={selectedLogsSortConfig} onSort={requestSelectedLogsSort} /></th>
                            <th><SortableHeader label="Source" sortKey="source" sortConfig={selectedLogsSortConfig} onSort={requestSelectedLogsSort} /></th>
                            <th><SortableHeader label="Validity" sortKey="validity" sortConfig={selectedLogsSortConfig} onSort={requestSelectedLogsSort} /></th>
                            <th><SortableHeader label="Notes" sortKey="notes" sortConfig={selectedLogsSortConfig} onSort={requestSelectedLogsSort} /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRows.length ? paginatedRows.map((log) => (
                            <tr key={log.uid}>
                              <td><PunchTypeBadge type={log.punchType} /></td>
                              <td><TableCellStack title={formatDateTime(log.punchTime)} subtitle={formatDate(log.punchTime)} /></td>
                              <td><TableBadge value={log.source || 'SELF'} tone="neutral" /></td>
                              <td>{log.isValid ? <TableBadge value="Valid" tone="success" /> : <TableBadge value="Invalid" tone="danger" />}</td>
                              <td className="small text-muted">{log.invalidReason || '—'}</td>
                            </tr>
                          )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No punch logs were found for the selected date.</div></td></tr>}
                        </tbody>
                      </table>
                    )}
                  </PaginatedTable>
                </CardShell>
              </div>
            </div>
          ) : null}

          {canViewAttendanceRegister ? (
            <CardShell title="Attendance Register" right={<DownloadActionGroup onCsv={() => downloadAttendanceRowsCsv(pinnedAttendanceRows, 'attendance-register.csv')} onExcel={() => downloadAttendanceRowsExcel(pinnedAttendanceRows, 'attendance-register.xls')} align="end" />}>
            <div className="attendance-toolbar attendance-toolbar--register mb-3">
  <div className="employee-toolbar-left">
    <AppSearchField value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employee, department, code, or remarks" />
    <div className="employee-filter-field">
      <label className="form-label small text-muted mb-1">Status</label>
      <AppSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions.map((option) => ({ value: option, label: option }))} placeholder="Select status" icon={<FilterIcon />} hideSelectedDescription />
    </div>
    <div className="employee-filter-field">
      <label className="form-label small text-muted mb-1">Regularization</label>
      <AppSelect
        value={regularizedFilter}
        onChange={setRegularizedFilter}
        options={[
          { value: 'All', label: 'All records' },
          { value: 'Regularized', label: 'Regularized' },
          { value: 'Standard', label: 'Standard' }
        ]}
        placeholder="Select record type"
        icon={<FilterIcon />}
        hideSelectedDescription
      />
    </div>
    <div className="employee-filter-field employee-filter-field-range">
      <label className="form-label small text-muted mb-1">Attendance Range</label>
      <AppDateRangeField value={dateRangeFilter} onChange={setDateRangeFilter} placeholder="[Select range]" />
    </div>
  </div>
</div>

            <PaginatedTable rows={pinnedAttendanceRows}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--attendance-register align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Date" sortKey="attendanceDate" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Employee" sortKey="employeeName" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Department" sortKey="department" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="First In" sortKey="firstPunchIn" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Last Out" sortKey="lastPunchOut" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Worked" sortKey="totalWorkedHours" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Shift" sortKey="totalAssignedShiftHours" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Regularized" sortKey="regularized" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th><SortableHeader label="Remarks" sortKey="remarks" sortConfig={attendanceSortConfig} onSort={requestAttendanceSort} /></th>
                      <th className="table-header-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((row) => (
                      <tr key={row.uid}>
                        <td><TableCellStack title={formatDate(row.attendanceDate)} subtitle={row.employeeCode} /></td>
                        <td><TableCellStack title={row.employeeName} subtitle={`${row.employeeCode}${row.email ? ` • ${row.email}` : ''}`} /></td>
                        <td><TableBadge value={row.department || '—'} tone="neutral" /></td>
                        <td><AttendanceBadge status={row.status} /></td>
                        <td><TableCellStack title={formatDateTime(row.firstPunchIn)} subtitle={formatTime(row.firstPunchIn)} /></td>
                        <td><TableCellStack title={formatDateTime(row.lastPunchOut)} subtitle={formatTime(row.lastPunchOut)} /></td>
                        <td><TableBadge value={formatHours(row.totalWorkedHours)} tone="blue" /></td>
                        <td><TableBadge value={formatHours(row.totalAssignedShiftHours)} tone="violet" /></td>
                        <td>{row.isRegularized ? <TableBadge value="Yes" tone="success" /> : <TableBadge value="No" tone="neutral" />}</td>
                        <td className="text-muted small attendance-reason-cell">{row.remarks || '—'}</td>
                        <td className="table-actions-cell">
                          <TableActionCluster>
                            <TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => setSelectedRecord(row)} />
                            {canModifyAttendance ? <TableActionButton icon={<PencilIcon />} label="Modify" variant="edit" onClick={() => openAttendanceEditModal(row)} /> : null}
                          </TableActionCluster>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="11"><div className="employee-empty-state text-center py-5 text-muted">No attendance records matched the current filter stack.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
            </CardShell>
          ) : null}
        </>
      ) : null}

      {activeTab === 'shifts' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Total Shifts" value={shiftSummary.totalShifts} helper="Shift templates configured" tone="blue" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Active Shifts" value={shiftSummary.activeShifts} helper="Templates available for new assignments" tone="teal" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Active Assignments" value={shiftSummary.activeAssignments} helper="Employees currently mapped to a live shift" tone="purple" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Inactive Assignments" value={shiftSummary.inactiveAssignments} helper="Assignments parked or disabled" tone="orange" /></div>
          </div>

          <CardShell title="Shift Roster" right={canCreateShift ? <button type="button" className="btn btn-primary employee-toolbar-btn" onClick={openShiftCreate}><PlusIcon /><span>New Shift</span></button> : null}>
            <PaginatedTable rows={sortedShiftRoster}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--shift-roster align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Code" sortKey="code" sortConfig={shiftRosterSortConfig} onSort={requestShiftRosterSort} /></th>
                      <th><SortableHeader label="Name" sortKey="name" sortConfig={shiftRosterSortConfig} onSort={requestShiftRosterSort} /></th>
                      <th><SortableHeader label="Window" sortKey="window" sortConfig={shiftRosterSortConfig} onSort={requestShiftRosterSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={shiftRosterSortConfig} onSort={requestShiftRosterSort} /></th>
                      <th className="table-header-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((shift) => (
                      <tr key={shift.uid}>
                        <td><TableBadge value={shift.code} tone="neutral" /></td>
                        <td><TableCellStack title={shift.name} subtitle={shift.description || 'Shift template'} /></td>
                        <td><TableCellStack title={`${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`} subtitle={formatHours(getShiftDurationHours(shift.startTime, shift.endTime))} /></td>
                        <td>{shift.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                        <td className="table-actions-cell">
                          <TableActionCluster>
                            {canUpdateShift ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openShiftEdit(shift)} /> : null}
                            {canDeleteShift ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" className="attendance-danger-btn" onClick={() => handleDeleteShift(shift.uid)} /> : null}
                          </TableActionCluster>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No shift templates are configured yet.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
          </CardShell>

          <CardShell title="Employee Shift Assignments" right={canCreateAssignment ? <button type="button" className="btn btn-primary employee-toolbar-btn" onClick={openAssignmentCreate}><UserPlusIcon /><span>Assign Shift</span></button> : null}>
            <PaginatedTable rows={sortedAssignmentRows}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--shift-assignment align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Employee" sortKey="employeeName" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} /></th>
                      <th><SortableHeader label="Shift" sortKey="shiftName" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} /></th>
                      <th><SortableHeader label="Window" sortKey="window" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} /></th>
                      <th className="table-header-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((row) => (
                      <tr key={row.uid}>
                        <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                        <td><TableCellStack title={row.shiftName} subtitle={row.shiftCode} /></td>
                        <td><TableCellStack title={`${formatTime(row.shiftStartTime)} - ${formatTime(row.shiftEndTime)}`} subtitle="Assigned window" /></td>
                        <td>{row.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                        <td className="table-actions-cell">
                          <TableActionCluster>
                            {canUpdateAssignment ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openAssignmentEdit(row)} /> : null}
                            {canDeleteAssignment ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" className="attendance-danger-btn" onClick={() => handleDeleteAssignment(row.uid)} /> : null}
                          </TableActionCluster>
                        </td>
                      </tr>
                    )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No employee shift assignments are active yet.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
          </CardShell>
        </>
      ) : null}

      {activeTab === 'regularization' ? (
        <>
          {(canCreateRegularization || canViewOwnRegularizations) ? (
            <CardShell title="Regularization Request Desk">
              <div className="row g-3 align-items-end">
                <div className="col-12 col-md-4">
                  <label className="form-label">Selected Date</label>
                  <input className="form-control" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                </div>
                <div className="col-12 col-md-8">
                  <div className="attendance-note-card mb-0">
                    Latest status: <strong>{latestRegularizationStatus}</strong>. Use this section to raise your own correction request and to process employee verification tasks.
                  </div>
                </div>
                {canCreateRegularization ? (
                  <div className="col-12 d-flex justify-content-end">
                    <button type="button" className="btn btn-primary px-4" onClick={() => setRegularizationOpen(true)}>Create Regularization Request</button>
                  </div>
                ) : null}
              </div>
            </CardShell>
          ) : null}

          {(canViewRegularizationQueue || canReviewRegularization || canViewRegularizationLogs || canViewOwnRegularizations || canCreateRegularization) ? (
            <CardShell title="Regularization Requests">
              <PaginatedTable rows={pinnedRegularizationRequestRows}>
                {({ rows: paginatedRows }) => (
                  <table className="table employee-table workspace-table workspace-table--regularization-queue align-middle mb-0">
                    <thead>
                      <tr>
                        <th><SortableHeader label="Employee" sortKey="employeeName" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th><SortableHeader label="Date" sortKey="regularizationDate" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th><SortableHeader label="Requested In" sortKey="requestedPunchIn" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th><SortableHeader label="Requested Out" sortKey="requestedPunchOut" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th><SortableHeader label="Worked Hours" sortKey="requestedWorkedHours" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th><SortableHeader label="Status" sortKey="status" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th><SortableHeader label="Reviewer Note" sortKey="reviewerNote" sortConfig={regularizationRequestSortConfig} onSort={requestRegularizationRequestSort} /></th>
                        <th className="table-header-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? paginatedRows.map((row) => (
                        <tr key={row.uid}>
                          <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                          <td><TableCellStack title={formatDate(row.regularizationDate)} subtitle="Submitted request" /></td>
                          <td><TableCellStack title={formatDateTime(row.requestedPunchIn)} subtitle={formatTime(row.requestedPunchIn)} /></td>
                          <td><TableCellStack title={formatDateTime(row.requestedPunchOut)} subtitle={formatTime(row.requestedPunchOut)} /></td>
                          <td><TableBadge value={row.requestedWorkedHours == null ? '—' : formatHours(row.requestedWorkedHours)} tone="blue" /></td>
                          <td><RegularizationBadge status={row.status} /></td>
                          <td className="small text-muted">{row.reviewerNote || '—'}</td>
                          <td className="table-actions-cell">
                            <TableActionCluster>
                              {canViewRegularizationLogs ? <TableActionButton icon={<ViewIcon />} label="Timeline" variant="view" onClick={() => setSelectedRegularizationLogRecord(row)} /> : null}
                              {canReviewRegularization && String(row.status || '').toLowerCase() === 'pending' ? <TableActionButton icon={<CheckCircleIcon />} label="Approve" variant="view" onClick={() => { setDecisionState({ mode: 'approve', record: row }); setReviewerNote('') }} /> : null}
                              {canReviewRegularization && String(row.status || '').toLowerCase() === 'pending' ? <TableActionButton icon={<XCircleIcon />} label="Reject" variant="delete" className="attendance-danger-btn" onClick={() => { setDecisionState({ mode: 'reject', record: row }); setReviewerNote('') }} /> : null}
                            </TableActionCluster>
                          </td>
                        </tr>
                      )) : <tr><td colSpan="8"><div className="employee-empty-state text-center py-5 text-muted">There are no regularization requests available right now.</div></td></tr>}
                    </tbody>
                  </table>
                )}
              </PaginatedTable>
            </CardShell>
          ) : null}
        </>
      ) : null}

      <AttendanceDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      <AttendanceEditModal draft={attendanceEditDraft} errors={attendanceEditErrors} touched={attendanceEditTouched} onChange={handleAttendanceDraftChange} onBlur={handleAttendanceDraftBlur} onClose={() => { setAttendanceEditDraft(null); setAttendanceEditTouched({}) }} onSubmit={handleAttendanceUpdate} isPending={updateAttendanceMutation.isPending} />
      <DecisionModal mode={decisionState.mode} record={decisionState.record} note={reviewerNote} onNoteChange={setReviewerNote} onClose={() => { setDecisionState({ mode: '', record: null }); setReviewerNote('') }} onSubmit={handleDecision} isPending={decisionMutation.isPending} />
      <RegularizationRequestModal open={regularizationOpen} draft={regularizationDraft} errors={regularizationErrors} touched={regularizationTouched} onChange={handleRegularizationChange} onBlur={handleRegularizationBlur} onClose={() => { setRegularizationOpen(false); setRegularizationTouched({}) }} onSubmit={handleRegularizationSubmit} isPending={regularizationMutation.isPending} />
      <ShiftModal open={shiftModalOpen} draft={shiftDraft} errors={shiftErrors} touched={shiftTouched} onChange={handleShiftDraftChange} onBlur={handleShiftBlur} onClose={() => { setShiftModalOpen(false); setShiftTouched({}) }} onSubmit={handleShiftSubmit} isPending={shiftMutation.isPending} editing={Boolean(shiftDraft.uid)} />
      <AssignmentModal open={assignmentModalOpen} draft={assignmentDraft} errors={assignmentErrors} touched={assignmentTouched} employees={employeeDirectory} shifts={shiftRoster} onChange={handleAssignmentDraftChange} onBlur={handleAssignmentBlur} onClose={() => { setAssignmentModalOpen(false); setAssignmentTouched({}) }} onSubmit={handleAssignmentSubmit} isPending={assignmentMutation.isPending} editing={Boolean(assignmentDraft.uid)} />
      <RegularizationLogsModal record={selectedRegularizationLogRecord} logs={regularizationLogs} employeesByUid={employeesByUid} isLoading={regularizationLogsQuery.isLoading} onClose={() => setSelectedRegularizationLogRecord(null)} />
    </div>
  )
}
