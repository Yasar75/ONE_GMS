import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../../components/common/PageHeader.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
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
  SearchIcon,
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
  downloadAttendanceRowsCsv,
  downloadAttendanceRowsExcel,
  downloadPunchLogsCsv,
  downloadPunchLogsExcel,
  formatDate,
  formatDateTime,
  formatHours,
  formatTime,
  getAttendanceSummary,
  getElapsedSeconds,
  getLatestRegularizationStatus,
  getPunchSessionState,
  getShiftDurationHours,
  getShiftOverview,
  getTodayDateInput,
  toDateTimeLocalValue,
  toTimeInputValue
} from '../../../utils/attendance.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import {
  AttendanceBadge,
  AttendanceMetricCard,
  AttendanceTabs,
  DownloadActionGroup,
  OverviewList,
  PunchSessionCard,
  PunchTypeBadge,
  RegularizationBadge
} from '../../attendance/components/AttendanceShared.jsx'

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview', helper: 'Unified workforce summary' },
  { key: 'attendance', label: 'Attendance Management', helper: 'Punches, edits, and exports' },
  { key: 'shifts', label: 'Shift Management', helper: 'Shift roster and assignment control' },
  { key: 'regularization', label: 'Regularization', helper: 'Review, verify, and action requests' }
]

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

function AttendanceEditModal({ draft, onChange, onClose, onSubmit, isPending }) {
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
            <input className="form-control" type="datetime-local" name="firstPunchIn" value={draft.firstPunchIn} onChange={onChange} />
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label">Last Punch Out</label>
            <input className="form-control" type="datetime-local" name="lastPunchOut" value={draft.lastPunchOut} onChange={onChange} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Worked Hours</label>
            <input className="form-control" type="number" step="0.25" min="0" max="24" name="totalWorkedHours" value={draft.totalWorkedHours} onChange={onChange} />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Status</label>
            <AppSelect
              name="status"
              value={draft.status}
              onChange={onChange}
              options={['Present', 'Absent', 'Leave', 'Half-Day', 'Pending Regularization'].map((value) => ({ value, label: value }))}
            />
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

function RegularizationRequestModal({ open, draft, onChange, onClose, onSubmit, isPending }) {
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
          <input className="form-control" type="date" name="regularizationDate" value={draft.regularizationDate} onChange={onChange} required />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Worked Hours</label>
          <input className="form-control" type="number" step="0.25" min="0" max="24" name="requestedWorkedHours" value={draft.requestedWorkedHours} onChange={onChange} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Punch In</label>
          <input className="form-control" type="datetime-local" name="requestedPunchIn" value={draft.requestedPunchIn} onChange={onChange} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Punch Out</label>
          <input className="form-control" type="datetime-local" name="requestedPunchOut" value={draft.requestedPunchOut} onChange={onChange} />
        </div>
        <div className="col-12">
          <label className="form-label">Reason*</label>
          <textarea className="form-control" rows="4" name="reason" value={draft.reason} onChange={onChange} placeholder="Explain why this attendance entry needs to be corrected." required />
        </div>
      </div>
    </ModalFrame>
  )
}

function ShiftModal({ open, draft, onChange, onClose, onSubmit, isPending, editing }) {
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
          <input className="form-control" name="code" value={draft.code} onChange={onChange} placeholder="MORN-1" disabled={editing} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Shift Name*</label>
          <input className="form-control" name="name" value={draft.name} onChange={onChange} placeholder="Morning Shift" />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Start Time*</label>
          <input className="form-control" type="time" name="startTime" value={draft.startTime} onChange={onChange} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">End Time*</label>
          <input className="form-control" type="time" name="endTime" value={draft.endTime} onChange={onChange} />
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

function AssignmentModal({ open, draft, employees, shifts, onChange, onClose, onSubmit, isPending, editing }) {
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
            options={employees.map((employee) => ({ value: employee.uid, label: employee.fullName, description: employee.employeeCode }))}
            placeholder="Select employee"
            disabled={editing}
          />
        </div>
        <div className="col-12">
          <label className="form-label">Shift*</label>
          <AppSelect
            name="shiftUid"
            value={draft.shiftUid}
            onChange={onChange}
            options={shifts.map((shift) => ({ value: shift.uid, label: shift.name, description: `${shift.code} • ${formatTime(shift.startTime)}-${formatTime(shift.endTime)}` }))}
            placeholder="Select shift"
          />
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

export default function AdminAttendance() {
  const todayDate = getTodayDateInput()
  const queryClient = useQueryClient()
  const { showStatus, runWithLoader } = useModal()

  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [regularizedFilter, setRegularizedFilter] = useState('All')
  const [dateRangeFilter, setDateRangeFilter] = useState({ start: '', end: '' })
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [attendanceEditDraft, setAttendanceEditDraft] = useState(null)
  const [decisionState, setDecisionState] = useState({ mode: '', record: null })
  const [reviewerNote, setReviewerNote] = useState('')
  const [regularizationOpen, setRegularizationOpen] = useState(false)
  const [regularizationDraft, setRegularizationDraft] = useState(() => buildRegularizationDraft(todayDate, []))
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftDraft, setShiftDraft] = useState({ uid: '', code: '', name: '', startTime: '', endTime: '', isActive: true })
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [assignmentDraft, setAssignmentDraft] = useState({ uid: '', employeeUid: '', shiftUid: '', isActive: true })
  const [selectedRegularizationLogRecord, setSelectedRegularizationLogRecord] = useState(null)

  const employeesQuery = useEmployeeLookupQuery()
  const attendanceQuery = useAdminAttendanceQuery()
  const pendingRegularizationsQuery = usePendingRegularizationsQuery()
  const shiftRosterQuery = useShiftRosterQuery(true)
  const employeeShiftAssignmentsQuery = useEmployeeShiftAssignmentsQuery(true)
  const selectedLogsQuery = useMyPunchLogsQuery(selectedDate)
  const todayLogsQuery = useMyPunchLogsQuery(todayDate)
  const myRegularizationsQuery = useMyRegularizationsQuery()
  const regularizationLogsQuery = useRegularizationLogsQuery(selectedRegularizationLogRecord?.uid, Boolean(selectedRegularizationLogRecord))

  const employeeDirectory = employeesQuery.data || []
  const attendanceRecords = attendanceQuery.data || []
  const pendingRegularizations = pendingRegularizationsQuery.data || []
  const shiftRoster = shiftRosterQuery.data || []
  const shiftAssignments = employeeShiftAssignmentsQuery.data || []
  const selectedLogs = selectedLogsQuery.data || []
  const todayLogs = todayLogsQuery.data || []
  const myRegularizations = myRegularizationsQuery.data || []
  const regularizationLogs = regularizationLogsQuery.data || []

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
        email: employee?.email || '—'
      }
    })
  }, [attendanceRecords, employeesByUid])

  const regularizationRows = useMemo(() => {
    return pendingRegularizations.map((record) => {
      const employee = employeesByUid.get(String(record.employeeUid))
      return {
        ...record,
        employeeName: employee?.fullName || employee?.email || `Employee ${String(record.employeeUid || '').slice(0, 8)}`,
        employeeCode: employee?.employeeCode || '—'
      }
    })
  }, [pendingRegularizations, employeesByUid])

  const myRegularizationRows = useMemo(() => {
    return myRegularizations.map((record) => ({
      ...record,
      employeeName: employeesByUid.get(String(record.employeeUid))?.fullName || 'Me'
    }))
  }, [employeesByUid, myRegularizations])

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

  const filteredAttendanceRows = useMemo(() => {
    return attendanceRows.filter((row) => {
      const query = searchTerm.trim().toLowerCase()
      const matchesSearch = !query || [row.employeeName, row.employeeCode, row.department, row.email, row.remarks].join(' ').toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'All' || row.status === statusFilter
      const matchesRegularized = regularizedFilter === 'All'
        || (regularizedFilter === 'Regularized' && row.isRegularized)
        || (regularizedFilter === 'Standard' && !row.isRegularized)
      const matchesStartDate = !dateRangeFilter?.start || row.attendanceDate >= dateRangeFilter.start
      const matchesEndDate = !dateRangeFilter?.end || row.attendanceDate <= dateRangeFilter.end
      return matchesSearch && matchesStatus && matchesRegularized && matchesStartDate && matchesEndDate
    })
  }, [attendanceRows, dateRangeFilter, regularizedFilter, searchTerm, statusFilter])

  const { items: sortedAttendanceRows, sortConfig, requestSort } = useSortableData(filteredAttendanceRows, {
    initialKey: 'attendanceDate',
    initialDirection: 'desc',
    accessors: {
      attendanceDate: (row) => row.attendanceDate,
      employeeName: (row) => row.employeeName,
      status: (row) => row.status,
      firstPunchIn: (row) => row.firstPunchIn || '',
      lastPunchOut: (row) => row.lastPunchOut || '',
      totalWorkedHours: (row) => row.totalWorkedHours,
      totalAssignedShiftHours: (row) => row.totalAssignedShiftHours
    }
  })

  const summary = useMemo(() => getAttendanceSummary(attendanceRows), [attendanceRows])
  const shiftSummary = useMemo(() => getShiftOverview(shiftRoster, shiftAssignments), [shiftAssignments, shiftRoster])
  const statusOptions = useMemo(() => ['All', ...Array.from(new Set(attendanceRows.map((row) => row.status).filter(Boolean)))], [attendanceRows])
  const todaySession = useMemo(() => ({ ...getPunchSessionState(todayLogs), totalWorkedHours: attendanceRows.find((row) => row.attendanceDate === todayDate && row.employeeUid === '')?.totalWorkedHours }), [attendanceRows, todayDate, todayLogs])
  const selectedSession = useMemo(() => getPunchSessionState(selectedLogs), [selectedLogs])
  const latestRegularizationStatus = useMemo(() => getLatestRegularizationStatus(myRegularizations), [myRegularizations])
  const elapsedSeconds = useMemo(() => todaySession.isClockedIn ? getElapsedSeconds(todaySession.firstPunchIn) : (todaySession.totalPunches > 1 ? getElapsedSeconds(todaySession.firstPunchIn, todaySession.lastPunchOut) : 0), [todaySession])

  const previewAttendance = sortedAttendanceRows.slice(0, 5)
  const previewRegularizations = regularizationRows.slice(0, 5)

  useEffect(() => {
    if (!regularizationOpen) return
    setRegularizationDraft(buildRegularizationDraft(selectedDate, selectedLogs))
  }, [regularizationOpen, selectedDate, selectedLogs])

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
      showStatus({ type: 'success', title: 'Punch-in recorded', message: `${result.message} Current status: ${result.status}.` })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Punch-in failed', message: getErrorMessage(error, 'The system could not record your punch-in.') })
  })

  const punchOutMutation = useMutation({
    mutationFn: attendanceService.punchOut,
    onSuccess: async (result) => {
      await invalidateAttendanceState()
      showStatus({ type: 'success', title: 'Punch-out recorded', message: `${result.message} Total worked hours: ${formatHours(result.totalWorkedHours)}.` })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Punch-out failed', message: getErrorMessage(error, 'The system could not record your punch-out.') })
  })

  const regularizationMutation = useMutation({
    mutationFn: attendanceService.createRegularization,
    onSuccess: async () => {
      await invalidateAttendanceState()
      setRegularizationOpen(false)
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
    try {
      await punchInMutation.mutateAsync()
    } catch {
      // handled in mutation callbacks
    }
  }

  const handlePunchOut = async () => {
    try {
      await punchOutMutation.mutateAsync()
    } catch {
      // handled in mutation callbacks
    }
  }

  const handleRegularizationSubmit = async () => {
    await runWithLoader(async () => regularizationMutation.mutateAsync(regularizationDraft), { title: 'Submitting request', message: 'Routing your attendance correction into the verification queue.' })
  }

  const handleDecision = async () => {
    if (!decisionState.record || !decisionState.mode) return
    await runWithLoader(async () => decisionMutation.mutateAsync({ mode: decisionState.mode, uid: decisionState.record.uid, note: reviewerNote }), { title: 'Updating request', message: 'Applying your decision to the regularization workflow.' })
  }

  const handleAttendanceUpdate = async () => {
    if (!attendanceEditDraft) return
    const { uid, ...payload } = attendanceEditDraft
    await runWithLoader(async () => updateAttendanceMutation.mutateAsync({ uid, payload }), { title: 'Saving attendance changes', message: 'Applying the admin correction to the selected attendance record.' })
  }

  const handleShiftSubmit = async () => {
    await runWithLoader(async () => shiftMutation.mutateAsync({ ...shiftDraft, startTime: shiftDraft.startTime, endTime: shiftDraft.endTime }), { title: 'Saving shift roster', message: 'Updating the shift catalog and syncing assignment availability.' })
  }

  const handleAssignmentSubmit = async () => {
    await runWithLoader(async () => assignmentMutation.mutateAsync(assignmentDraft), { title: 'Saving assignment', message: 'Linking the selected shift with the employee record.' })
  }

  const handleDeleteShift = async (shiftUid) => {
    await runWithLoader(async () => deleteShiftMutation.mutateAsync(shiftUid), { title: 'Deleting shift', message: 'Removing the selected shift from the roster.' })
  }

  const handleDeleteAssignment = async (assignmentUid) => {
    await runWithLoader(async () => deleteAssignmentMutation.mutateAsync(assignmentUid), { title: 'Deleting assignment', message: 'Removing the selected employee shift assignment.' })
  }

  const handleRegularizationChange = (event) => {
    const { name, value } = event.target
    setRegularizationDraft((current) => ({ ...current, [name]: value }))
  }

  const handleShiftDraftChange = (event) => {
    const { name, value } = event.target
    setShiftDraft((current) => ({ ...current, [name]: value }))
  }

  const handleAssignmentDraftChange = (event) => {
    const { name, value } = event.target
    setAssignmentDraft((current) => ({ ...current, [name]: value }))
  }

  const handleAttendanceDraftChange = (event) => {
    const { name, value } = event.target
    setAttendanceEditDraft((current) => ({ ...current, [name]: value }))
  }

  const openAttendanceEditModal = (record) => {
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
  }

  const openShiftCreate = () => {
    setShiftDraft({ uid: '', code: '', name: '', startTime: '', endTime: '', isActive: true })
    setShiftModalOpen(true)
  }

  const openShiftEdit = (shift) => {
    setShiftDraft({ uid: shift.uid, code: shift.code, name: shift.name, startTime: toTimeInputValue(shift.startTime), endTime: toTimeInputValue(shift.endTime), isActive: shift.isActive })
    setShiftModalOpen(true)
  }

  const openAssignmentCreate = () => {
    setAssignmentDraft({ uid: '', employeeUid: '', shiftUid: '', isActive: true })
    setAssignmentModalOpen(true)
  }

  const openAssignmentEdit = (assignment) => {
    setAssignmentDraft({ uid: assignment.uid, employeeUid: assignment.employeeUid, shiftUid: assignment.shiftUid, isActive: assignment.isActive })
    setAssignmentModalOpen(true)
  }

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
        title="Attendance Control Center"
        tagline="Switch between overview, operational attendance management, shift orchestration, and regularization workflows from one unified admin workspace."
      />

      <AttendanceTabs activeTab={activeTab} onChange={setActiveTab} tabs={TAB_ITEMS} />

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
            <div className="col-12 col-xl-8">
              <CardShell title="Today’s Admin Punch Panel">
                <PunchSessionCard
                  title="Admin self punch"
                  attendanceStateLabel={todaySession.isClockedIn ? 'Clocked In' : (todaySession.totalPunches ? 'Completed' : 'Ready')}
                  session={todaySession}
                  elapsedSeconds={elapsedSeconds}
                  dateValue={todayDate}
                  onPunchIn={handlePunchIn}
                  onPunchOut={handlePunchOut}
                  isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                  note={todaySession.isClockedIn ? 'Your admin attendance session is active. Close it with punch out when your shift is done.' : 'Use self punch controls for your own attendance and the admin register below for workforce monitoring.'}
                  secondaryNote="Both employees and admins can add their own time entries from this workspace."
                />
              </CardShell>
            </div>
          </div>

          <CardShell title="Attendance Register Preview" right={<button type="button" className="btn btn-sm btn-light" onClick={() => setActiveTab('attendance')}>Open full register</button>}>
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--attendance-preview align-middle mb-0">
                <thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>Worked</th><th className="table-header-center">Action</th></tr></thead>
                <tbody>
                  {previewAttendance.length ? previewAttendance.map((row) => (
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
            </div>
          </CardShell>

          <CardShell title="Pending Regularization Preview" right={<button type="button" className="btn btn-sm btn-light" onClick={() => setActiveTab('regularization')}>Open full queue</button>}>
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--regularization-preview align-middle mb-0">
                <thead><tr><th>Employee</th><th>Date</th><th>Status</th><th className="table-header-center">Action</th></tr></thead>
                <tbody>
                  {previewRegularizations.length ? previewRegularizations.map((row) => (
                    <tr key={row.uid}>
                      <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                      <td><TableCellStack title={formatDate(row.regularizationDate)} subtitle="Awaiting review" /></td>
                      <td><RegularizationBadge status={row.status} /></td>
                      <td className="table-actions-cell"><TableActionCluster><TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => setSelectedRegularizationLogRecord(row)} /></TableActionCluster></td>
                    </tr>
                  )) : <tr><td colSpan="4"><div className="employee-empty-state text-center py-5 text-muted">No pending regularization requests.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>
        </>
      ) : null}

      {activeTab === 'attendance' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-xl-5">
              <CardShell title="Punch In / Punch Out">
                <PunchSessionCard
                  title="My attendance actions"
                  attendanceStateLabel={todaySession.isClockedIn ? 'Clocked In' : (todaySession.totalPunches ? 'Completed' : 'Ready')}
                  session={todaySession}
                  elapsedSeconds={elapsedSeconds}
                  dateValue={todayDate}
                  onPunchIn={handlePunchIn}
                  onPunchOut={handlePunchOut}
                  isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                  note={todaySession.totalPunches ? 'Generate and download your own punch logs from the inspector on the right.' : 'No punch has been recorded yet for today. Use punch in to start your shift.'}
                  secondaryNote="Admins can also modify workforce attendance entries directly in the register below."
                />
              </CardShell>
            </div>
            <div className="col-12 col-xl-7">
              <CardShell title="My Daily Log Inspector" right={<DownloadActionGroup onCsv={() => downloadPunchLogsCsv(selectedLogs, `admin-punch-logs-${selectedDate}.csv`)} onExcel={() => downloadPunchLogsExcel(selectedLogs, `admin-punch-logs-${selectedDate}.xls`)} align="end" />}>
                <div className="attendance-toolbar mb-3">
                  <div className="employee-toolbar-left">
                    <div className="employee-search-field attendance-date-field">
                      <label className="form-label small text-muted mb-1">Inspect Date</label>
                      <div className="input-group employee-search-group">
                        <span className="input-group-text"><SearchIcon /></span>
                        <input className="form-control" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="attendance-log-strip mb-3">
                  <div><div className="attendance-detail-label">Selected Date</div><div className="attendance-detail-value">{formatDate(selectedDate)}</div></div>
                  <div><div className="attendance-detail-label">Punch Count</div><div className="attendance-detail-value">{selectedSession.totalPunches}</div></div>
                  <div><div className="attendance-detail-label">First In</div><div className="attendance-detail-value">{formatTime(selectedSession.firstPunchIn)}</div></div>
                  <div><div className="attendance-detail-label">Last Out</div><div className="attendance-detail-value">{formatTime(selectedSession.lastPunchOut)}</div></div>
                </div>

                <div className="employee-table-wrap table-responsive">
                  <table className="table employee-table workspace-table workspace-table--attendance-log align-middle mb-0">
                    <thead><tr><th>Punch Type</th><th>Punch Time</th><th>Source</th><th>Validity</th><th>Notes</th></tr></thead>
                    <tbody>
                      {selectedLogs.length ? selectedLogs.map((log) => (
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
                </div>
              </CardShell>
            </div>
          </div>

          <CardShell title="Attendance Register" right={<DownloadActionGroup onCsv={() => downloadAttendanceRowsCsv(sortedAttendanceRows, 'attendance-register.csv')} onExcel={() => downloadAttendanceRowsExcel(sortedAttendanceRows, 'attendance-register.xls')} align="end" />}>
            <div className="attendance-toolbar attendance-toolbar--register mb-3">
  <div className="employee-toolbar-left">
    <div className="employee-search-field">
      <label className="form-label small text-muted mb-1">Search</label>
      <div className="input-group employee-search-group">
        <span className="input-group-text"><SearchIcon /></span>
        <input className="form-control" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search employee, department, code, or remarks" />
      </div>
    </div>
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

<div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--attendance-register align-middle mb-0">
                <thead>
                  <tr>
                    <th><SortableHeader label="Date" sortKey="attendanceDate" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th><SortableHeader label="Employee" sortKey="employeeName" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th>Department</th>
                    <th><SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th><SortableHeader label="First In" sortKey="firstPunchIn" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th><SortableHeader label="Last Out" sortKey="lastPunchOut" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th><SortableHeader label="Worked" sortKey="totalWorkedHours" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th><SortableHeader label="Shift" sortKey="totalAssignedShiftHours" sortConfig={sortConfig} onSort={requestSort} /></th>
                    <th>Regularized</th>
                    <th>Remarks</th>
                    <th className="table-header-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAttendanceRows.length ? sortedAttendanceRows.map((row) => (
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
                          <TableActionButton icon={<PencilIcon />} label="Modify" variant="edit" onClick={() => openAttendanceEditModal(row)} />
                        </TableActionCluster>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="11"><div className="employee-empty-state text-center py-5 text-muted">No attendance records matched the current filter stack.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>
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

          <CardShell title="Shift Roster" right={<button type="button" className="btn btn-primary employee-toolbar-btn" onClick={openShiftCreate}><PlusIcon /><span>New Shift</span></button>}>
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--shift-roster align-middle mb-0">
                <thead><tr><th>Code</th><th>Name</th><th>Window</th><th>Status</th><th className="table-header-center">Action</th></tr></thead>
                <tbody>
                  {shiftRoster.length ? shiftRoster.map((shift) => (
                    <tr key={shift.uid}>
                      <td><TableBadge value={shift.code} tone="neutral" /></td>
                      <td><TableCellStack title={shift.name} subtitle={shift.description || 'Shift template'} /></td>
                      <td><TableCellStack title={`${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`} subtitle={formatHours(getShiftDurationHours(shift.startTime, shift.endTime))} /></td>
                      <td>{shift.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                      <td className="table-actions-cell">
                        <TableActionCluster>
                          <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openShiftEdit(shift)} />
                          <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" className="attendance-danger-btn" onClick={() => handleDeleteShift(shift.uid)} />
                        </TableActionCluster>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No shift templates are configured yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>

          <CardShell title="Employee Shift Assignments" right={<button type="button" className="btn btn-primary employee-toolbar-btn" onClick={openAssignmentCreate}><UserPlusIcon /><span>Assign Shift</span></button>}>
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--shift-assignment align-middle mb-0">
                <thead><tr><th>Employee</th><th>Shift</th><th>Window</th><th>Status</th><th className="table-header-center">Action</th></tr></thead>
                <tbody>
                  {assignmentRows.length ? assignmentRows.map((row) => (
                    <tr key={row.uid}>
                      <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                      <td><TableCellStack title={row.shiftName} subtitle={row.shiftCode} /></td>
                      <td><TableCellStack title={`${formatTime(row.shiftStartTime)} - ${formatTime(row.shiftEndTime)}`} subtitle="Assigned window" /></td>
                      <td>{row.isActive ? <TableBadge value="Active" tone="success" /> : <TableBadge value="Inactive" tone="neutral" />}</td>
                      <td className="table-actions-cell">
                        <TableActionCluster>
                          <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openAssignmentEdit(row)} />
                          <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" className="attendance-danger-btn" onClick={() => handleDeleteAssignment(row.uid)} />
                        </TableActionCluster>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">No employee shift assignments are active yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>
        </>
      ) : null}

      {activeTab === 'regularization' ? (
        <>
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
              <div className="col-12 d-flex justify-content-end">
                <button type="button" className="btn btn-primary px-4" onClick={() => setRegularizationOpen(true)}>Create Regularization Request</button>
              </div>
            </div>
          </CardShell>

          <CardShell title="Employees Regularization Requests">
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--regularization-queue align-middle mb-0">
                <thead><tr><th>Employee</th><th>Date</th><th>Requested In</th><th>Requested Out</th><th>Worked Hours</th><th>Status</th><th className="table-header-center">Decision</th></tr></thead>
                <tbody>
                  {regularizationRows.length ? regularizationRows.map((row) => (
                    <tr key={row.uid}>
                      <td><TableCellStack title={row.employeeName} subtitle={row.employeeCode} /></td>
                      <td><TableCellStack title={formatDate(row.regularizationDate)} subtitle="Submitted request" /></td>
                      <td><TableCellStack title={formatDateTime(row.requestedPunchIn)} subtitle={formatTime(row.requestedPunchIn)} /></td>
                      <td><TableCellStack title={formatDateTime(row.requestedPunchOut)} subtitle={formatTime(row.requestedPunchOut)} /></td>
                      <td><TableBadge value={row.requestedWorkedHours == null ? '—' : formatHours(row.requestedWorkedHours)} tone="blue" /></td>
                      <td><RegularizationBadge status={row.status} /></td>
                      <td className="table-actions-cell">
                        <TableActionCluster>
                          <TableActionButton icon={<ViewIcon />} label="Timeline" variant="view" onClick={() => setSelectedRegularizationLogRecord(row)} />
                          <TableActionButton icon={<CheckCircleIcon />} label="Approve" variant="view" onClick={() => { setDecisionState({ mode: 'approve', record: row }); setReviewerNote('') }} />
                          <TableActionButton icon={<XCircleIcon />} label="Reject" variant="delete" className="attendance-danger-btn" onClick={() => { setDecisionState({ mode: 'reject', record: row }); setReviewerNote('') }} />
                        </TableActionCluster>
                      </td>
                    </tr>
                  )) : <tr><td colSpan="7"><div className="employee-empty-state text-center py-5 text-muted">There are no pending regularization requests in the queue.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>

          <CardShell title="My Submitted Regularization Requests">
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--regularization-history align-middle mb-0">
                <thead><tr><th>Date</th><th>Requested In</th><th>Requested Out</th><th>Worked Hours</th><th>Reason</th><th>Status</th><th>Reviewer Note</th><th>Updated</th></tr></thead>
                <tbody>
                  {myRegularizationRows.length ? myRegularizationRows.map((request) => (
                    <tr key={request.uid}>
                      <td><TableCellStack title={formatDate(request.regularizationDate)} subtitle={formatDateTime(request.updatedAt || request.createdAt)} /></td>
                      <td><TableCellStack title={formatDateTime(request.requestedPunchIn)} subtitle={formatTime(request.requestedPunchIn)} /></td>
                      <td><TableCellStack title={formatDateTime(request.requestedPunchOut)} subtitle={formatTime(request.requestedPunchOut)} /></td>
                      <td><TableBadge value={request.requestedWorkedHours == null ? '—' : formatHours(request.requestedWorkedHours)} tone="blue" /></td>
                      <td className="small text-muted attendance-reason-cell">{request.reason}</td>
                      <td><RegularizationBadge status={request.status} /></td>
                      <td className="small text-muted">{request.reviewerNote || '—'}</td>
                      <td><TableCellStack title={formatDateTime(request.updatedAt || request.createdAt)} subtitle="Last update" /></td>
                    </tr>
                  )) : <tr><td colSpan="8"><div className="employee-empty-state text-center py-5 text-muted">You have not submitted any attendance regularization requests yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </CardShell>
        </>
      ) : null}

      <AttendanceDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      <AttendanceEditModal draft={attendanceEditDraft} onChange={handleAttendanceDraftChange} onClose={() => setAttendanceEditDraft(null)} onSubmit={handleAttendanceUpdate} isPending={updateAttendanceMutation.isPending} />
      <DecisionModal mode={decisionState.mode} record={decisionState.record} note={reviewerNote} onNoteChange={setReviewerNote} onClose={() => { setDecisionState({ mode: '', record: null }); setReviewerNote('') }} onSubmit={handleDecision} isPending={decisionMutation.isPending} />
      <RegularizationRequestModal open={regularizationOpen} draft={regularizationDraft} onChange={handleRegularizationChange} onClose={() => setRegularizationOpen(false)} onSubmit={handleRegularizationSubmit} isPending={regularizationMutation.isPending} />
      <ShiftModal open={shiftModalOpen} draft={shiftDraft} onChange={handleShiftDraftChange} onClose={() => setShiftModalOpen(false)} onSubmit={handleShiftSubmit} isPending={shiftMutation.isPending} editing={Boolean(shiftDraft.uid)} />
      <AssignmentModal open={assignmentModalOpen} draft={assignmentDraft} employees={employeeDirectory} shifts={shiftRoster} onChange={handleAssignmentDraftChange} onClose={() => setAssignmentModalOpen(false)} onSubmit={handleAssignmentSubmit} isPending={assignmentMutation.isPending} editing={Boolean(assignmentDraft.uid)} />
      <RegularizationLogsModal record={selectedRegularizationLogRecord} logs={regularizationLogs} employeesByUid={employeesByUid} isLoading={regularizationLogsQuery.isLoading} onClose={() => setSelectedRegularizationLogRecord(null)} />
    </div>
  )
}
