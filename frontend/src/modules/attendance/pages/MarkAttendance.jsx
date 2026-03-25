import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../../components/common/PageHeader.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import { CalendarIcon, PlusIcon, SearchIcon, SparklesIcon } from '../../../components/common/AppIcons.jsx'
import { TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { useMyPunchLogsQuery } from '../../../hooks/attendance/useMyPunchLogsQuery.js'
import { useMyRegularizationsQuery } from '../../../hooks/attendance/useMyRegularizationsQuery.js'
import { attendanceService } from '../../../api/services/attendance.service.js'
import {
  PUNCH_CONTROL_CHANGED_EVENT,
  applyLocalPunchControl,
  downloadPunchLogsCsv,
  downloadPunchLogsExcel,
  formatDate,
  formatDateTime,
  formatHours,
  formatTime,
  getLatestRegularizationStatus,
  getPunchSessionState,
  getTodayDateInput,
  rememberPunchOutMode,
  rememberSoftPunchResume,
  toDateTimeLocalValue
} from '../../../utils/attendance.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import {
  AttendanceMetricCard,
  AttendanceTabs,
  DownloadActionGroup,
  OverviewList,
  PunchSessionCard,
  PunchTypeBadge,
  RegularizationBadge
} from '../../attendance/components/AttendanceShared.jsx'
import {
  getDateTimeRangeValidationMessage,
  getDateValidationMessage,
  getNumberValidationMessage,
  getRequiredFieldMessage,
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

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview', helper: 'My attendance snapshot' },
  { key: 'attendance', label: 'Attendance Management', helper: 'Punches and log downloads' },
  { key: 'regularization', label: 'Regularization', helper: 'Request time corrections' }
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

function RegularizationModal({ open, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending }) {
  return (
    <ModalFrame
      open={open}
      title="Request attendance regularization"
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
          <input className={`form-control${touched.requestedWorkedHours && errors.requestedWorkedHours ? ' is-invalid' : ''}`} type="number" step="0.25" min="0" max="24" name="requestedWorkedHours" value={draft.requestedWorkedHours} onChange={onChange} onBlur={onBlur} placeholder="Example: 8" />
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

export default function MarkAttendance() {
  const todayDate = getTodayDateInput()
  const queryClient = useQueryClient()
  const { showStatus, runWithLoader, showConfirm } = useModal()
  const { user } = useAuth()
  const canViewAttendanceTab = hasModuleVisibility(user, [...PERMISSION_MODULES.attendance, ...PERMISSION_MODULES.attendanceLogs])
  const canViewRegularizationTab = hasModuleVisibility(user, PERMISSION_MODULES.attendanceRegularization)
  const canViewOverview = canViewAttendanceTab || canViewRegularizationTab
  const canSelfPunch = hasModulePermission(user, PERMISSION_MODULES.attendance, PERMISSION_ACTIONS.create)
  const canCreateRegularization = hasModulePermission(user, PERMISSION_MODULES.attendanceRegularization, PERMISSION_ACTIONS.create)

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [regularizationOpen, setRegularizationOpen] = useState(false)
  const [regularizationDraft, setRegularizationDraft] = useState(() => buildRegularizationDraft(todayDate, []))
  const [regularizationTouched, setRegularizationTouched] = useState({})
  const [punchControlVersion, setPunchControlVersion] = useState(0)

  const selectedLogsQuery = useMyPunchLogsQuery(selectedDate, canViewAttendanceTab || canViewOverview)
  const todayLogsQuery = useMyPunchLogsQuery(todayDate, canViewAttendanceTab || canViewOverview)
  const regularizationsQuery = useMyRegularizationsQuery(canViewRegularizationTab || canViewOverview)

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
  const regularizations = regularizationsQuery.data || []

  const todaySession = useMemo(() => getPunchSessionState(todayLogs), [todayLogs])
  const selectedSession = useMemo(() => getPunchSessionState(selectedLogs), [selectedLogs])
  const latestRegularizationStatus = useMemo(() => getLatestRegularizationStatus(regularizations), [regularizations])
  const attendanceStateLabel = todaySession.isClockedIn ? 'Clocked In' : todaySession.hasSoftPunchOut ? 'Paused' : todaySession.totalPunches > 0 ? 'Completed' : 'Ready'
  const elapsedSeconds = useMemo(() => Number(todaySession.workedSeconds || 0), [todaySession.workedSeconds])
  const regularizationErrors = useMemo(() => buildRegularizationErrors(regularizationDraft), [regularizationDraft])
  const availableTabs = useMemo(() => filterAccessibleTabs(TAB_ITEMS, (tabKey) => {
    if (tabKey === 'overview') return canViewOverview
    if (tabKey === 'attendance') return canViewAttendanceTab
    if (tabKey === 'regularization') return canViewRegularizationTab
    return false
  }), [canViewAttendanceTab, canViewOverview, canViewRegularizationTab])

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'overview') return canViewOverview
      if (tabKey === 'attendance') return canViewAttendanceTab
      if (tabKey === 'regularization') return canViewRegularizationTab
      return false
    }, canViewOverview ? 'overview' : availableTabs[0]?.key)

    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [activeTab, availableTabs, canViewAttendanceTab, canViewOverview, canViewRegularizationTab])

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
      queryClient.invalidateQueries({ queryKey: ['attendance', 'employee', 'my-logs', todayDate] }),
      queryClient.invalidateQueries({ queryKey: ['attendance', 'employee', 'my-logs', selectedDate] }),
      queryClient.invalidateQueries({ queryKey: ['attendance', 'employee', 'regularizations', 'mine'] })
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
    mutationFn: (mode = 'final') => attendanceService.punchOut(mode),
    onSuccess: async (result, mode) => {
      rememberPunchOutMode(todayDate, result?.lastPunchOut || new Date(), mode)
      setPunchControlVersion((current) => current + 1)
      await invalidateAttendanceState()
      showStatus({
        type: 'success',
        title: String(mode).toLowerCase() === 'soft' ? 'Soft punch-out recorded' : 'Final punch-out recorded',
        message: `${result.message} Total worked hours: ${formatHours(result.totalWorkedHours)}.`
      })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Punch-out failed', message: getErrorMessage(error, 'The system could not record your punch-out.') })
  })

  const regularizationMutation = useMutation({
    mutationFn: attendanceService.createRegularization,
    onSuccess: async () => {
      await invalidateAttendanceState()
      setRegularizationOpen(false)
      setRegularizationTouched({})
      showStatus({ type: 'success', title: 'Regularization submitted', message: 'Your request has been routed for review and is now visible in your attendance queue.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Submission failed', message: getErrorMessage(error, 'The regularization request could not be submitted.') })
  })

  const handlePunchIn = async () => {
    if (!canSelfPunch) {
      showStatus({ type: 'error', title: 'Attendance access blocked', message: 'Your role does not have permission to create attendance punch entries.' })
      return
    }

    if (todaySession.hasSoftPunchOut && todaySession.canPunchIn) {
      rememberSoftPunchResume(todayDate)
      setPunchControlVersion((current) => current + 1)
      showStatus({
        type: 'success',
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
      showStatus({ type: 'error', title: 'Attendance access blocked', message: 'Your role does not have permission to create attendance punch entries.' })
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
      showStatus({ type: 'error', title: 'Attendance access blocked', message: 'Your role does not have permission to create attendance punch entries.' })
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

    await runWithLoader(async () => regularizationMutation.mutateAsync(regularizationDraft), { title: 'Submitting request', message: 'Routing your attendance correction to the reviewer workflow.' })
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

  const overviewItems = [
    { label: 'Today’s session', value: attendanceStateLabel, helper: todaySession.isClockedIn ? 'Your work session is active right now.' : 'Current state of your attendance session.', icon: <CalendarIcon /> },
    { label: 'Punch count', value: `${todaySession.totalPunches} record(s)`, helper: `${formatTime(todaySession.firstPunchIn)} / ${formatTime(todaySession.lastPunchOut)}`, icon: <SparklesIcon /> },
    { label: 'Latest request', value: latestRegularizationStatus, helper: 'Most recent regularization workflow state.', icon: <PlusIcon /> }
  ]

  const isLoading = selectedLogsQuery.isLoading || todayLogsQuery.isLoading || regularizationsQuery.isLoading

  if (isLoading) {
    return <div className="text-muted">Loading attendance workspace…</div>
  }

  return (
    <div className="d-flex flex-column gap-3 attendance-module-page employee-attendance-page">
      <PageHeader
        title="Attendance Workspace"
        tagline="Move across overview, attendance management, shift visibility, and regularization workflows from one employee-focused workspace."
      />

      <AttendanceTabs activeTab={activeTab} onChange={setActiveTab} tabs={availableTabs} />

      {activeTab === 'overview' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Today’s State" value={attendanceStateLabel} helper="Current attendance session status" tone="blue" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Punches Today" value={todaySession.totalPunches} helper="Combined IN and OUT records for today" tone="teal" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="First In / Last Out" value={`${formatTime(todaySession.firstPunchIn)} / ${formatTime(todaySession.lastPunchOut)}`} helper="Operational timestamps for today" tone="orange" /></div>
            <div className="col-12 col-sm-6 col-xl-3"><AttendanceMetricCard label="Latest Request" value={latestRegularizationStatus} helper="Most recent regularization workflow state" tone="purple" /></div>
          </div>

          <div className="row g-3">
            <div className="col-12 col-xl-4">
              <CardShell title="Quick Snapshot">
                <OverviewList items={overviewItems} />
              </CardShell>
            </div>
            {canSelfPunch ? (
              <div className="col-12 col-xl-8">
                <CardShell title="Today’s Punch Panel">
                  <PunchSessionCard
                    title="My punch actions"
                    attendanceStateLabel={attendanceStateLabel}
                    session={{ ...todaySession, totalWorkedHours: null }}
                    elapsedSeconds={elapsedSeconds}
                    dateValue={todayDate}
                    onPunchIn={handlePunchIn}
                    onSoftPunchOut={handleSoftPunchOut}
                    onFinalPunchOut={handleFinalPunchOut}
                    isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                    note={todaySession.isClockedIn ? 'You are currently clocked in. Use soft punch-out to pause or final punch-out to close the day.' : todaySession.hasSoftPunchOut ? 'Your shift is paused after soft punch-out. Resume the timer when you start working again.' : todaySession.totalPunches > 0 ? 'Your punch cycle for today is complete. Use regularization only when a correction is required.' : 'No punch has been recorded yet for today. Start the session with punch in.'}
                    secondaryNote="You can generate and download your own logs from the attendance management tab."
                  />
                </CardShell>
              </div>
            ) : null}
          </div>

          {canViewRegularizationTab ? (
            <CardShell title="Recent Regularization Requests" right={<button type="button" className="btn btn-sm btn-light" onClick={() => setActiveTab('regularization')}>Open queue</button>}>
            <PaginatedTable rows={regularizations}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--regularization-preview align-middle mb-0">
                  <thead><tr><th>Date</th><th>Requested In</th><th>Requested Out</th><th>Status</th><th>Updated</th></tr></thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((request) => (
                      <tr key={request.uid}>
                        <td><TableCellStack title={formatDate(request.regularizationDate)} subtitle="Correction request" /></td>
                        <td><TableCellStack title={formatDateTime(request.requestedPunchIn)} subtitle={formatTime(request.requestedPunchIn)} /></td>
                        <td><TableCellStack title={formatDateTime(request.requestedPunchOut)} subtitle={formatTime(request.requestedPunchOut)} /></td>
                        <td><RegularizationBadge status={request.status} /></td>
                        <td><TableCellStack title={formatDateTime(request.updatedAt || request.createdAt)} subtitle="Last update" /></td>
                      </tr>
                    )) : <tr><td colSpan="5"><div className="employee-empty-state text-center py-5 text-muted">You have not submitted any regularization requests yet.</div></td></tr>}
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
          <div className="row g-3">
            {canSelfPunch ? (
              <div className="col-12 col-lg-5">
                <CardShell title="Punch In / Punch Out">
                  <PunchSessionCard
                    title="Today’s attendance actions"
                    attendanceStateLabel={attendanceStateLabel}
                    session={{ ...todaySession, totalWorkedHours: null }}
                    elapsedSeconds={elapsedSeconds}
                    dateValue={todayDate}
                    onPunchIn={handlePunchIn}
                    onSoftPunchOut={handleSoftPunchOut}
                    onFinalPunchOut={handleFinalPunchOut}
                    isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                    note={todaySession.isClockedIn ? 'You are currently clocked in. Use soft punch-out to pause or final punch-out to close the day.' : todaySession.hasSoftPunchOut ? 'Your shift is paused after soft punch-out. Resume the timer when you start working again.' : todaySession.totalPunches > 0 ? 'Your punch cycle for today is complete. Use regularization only when a correction is required.' : 'No punch has been recorded yet for today. Start the session with punch in.'}
                    secondaryNote="Employees and admins can both add their own time entries from this module."
                  />
                </CardShell>
              </div>
            ) : null}

            <div className={`col-12 ${canSelfPunch ? 'col-lg-7' : ''}`.trim()}>
              <CardShell title="Daily Log Inspector" right={<DownloadActionGroup onCsv={() => downloadPunchLogsCsv(selectedLogs, `employee-punch-logs-${selectedDate}.csv`)} onExcel={() => downloadPunchLogsExcel(selectedLogs, `employee-punch-logs-${selectedDate}.xls`)} align="end" />}>
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

                <PaginatedTable rows={selectedLogs}>
                  {({ rows: paginatedRows }) => (
                    <table className="table employee-table workspace-table workspace-table--attendance-log align-middle mb-0">
                      <thead><tr><th>Punch Type</th><th>Punch Time</th><th>Source</th><th>Validity</th><th>Notes</th></tr></thead>
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
        </>
      ) : null}

      {activeTab === 'regularization' ? (
        <>
          <CardShell title="Request a Correction">
            <div className="row g-3 align-items-end">
              <div className="col-12 col-md-4">
                <label className="form-label">Selected Date</label>
                <input className="form-control" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              </div>
              <div className="col-12 col-md-8">
                <div className="attendance-note-card mb-0">
                  Latest status: <strong>{latestRegularizationStatus}</strong>. Use this section only for correction requests and audit follow-up.
                </div>
              </div>
              {canCreateRegularization ? (
                <div className="col-12 d-flex justify-content-end">
                  <button type="button" className="btn btn-primary px-4" onClick={() => setRegularizationOpen(true)}>Create Regularization Request</button>
                </div>
              ) : null}
            </div>
          </CardShell>

          <CardShell title="My Regularization Requests">
            <PaginatedTable rows={regularizations}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--regularization-history align-middle mb-0">
                  <thead><tr><th>Date</th><th>Requested In</th><th>Requested Out</th><th>Worked Hours</th><th>Reason</th><th>Status</th><th>Reviewer Note</th><th>Updated</th></tr></thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((request) => (
                      <tr key={request.uid}>
                        <td><TableCellStack title={formatDate(request.regularizationDate)} subtitle="Correction request" /></td>
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
              )}
            </PaginatedTable>
          </CardShell>
        </>
      ) : null}

      <RegularizationModal open={regularizationOpen} draft={regularizationDraft} errors={regularizationErrors} touched={regularizationTouched} onChange={handleRegularizationChange} onBlur={handleRegularizationBlur} onClose={() => { setRegularizationOpen(false); setRegularizationTouched({}) }} onSubmit={handleRegularizationSubmit} isPending={regularizationMutation.isPending} />
    </div>
  )
}
