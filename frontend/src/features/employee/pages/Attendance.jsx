import React, { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import PageHeader from '../../../components/common/PageHeader.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import { CalendarIcon, PlusIcon, SearchIcon, SparklesIcon } from '../../../components/common/AppIcons.jsx'
import { TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { useMyPunchLogsQuery } from '../../../hooks/attendance/useMyPunchLogsQuery.js'
import { useMyRegularizationsQuery } from '../../../hooks/attendance/useMyRegularizationsQuery.js'
import { attendanceService } from '../../../api/services/attendance.service.js'
import {
  downloadPunchLogsCsv,
  downloadPunchLogsExcel,
  formatDate,
  formatDateTime,
  formatHours,
  formatTime,
  getElapsedSeconds,
  getLatestRegularizationStatus,
  getPunchSessionState,
  getTodayDateInput,
  toDateTimeLocalValue
} from '../../../utils/attendance.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import {
  AttendanceMetricCard,
  AttendanceTabs,
  DownloadActionGroup,
  OverviewList,
  PunchSessionCard,
  PunchTypeBadge,
  RegularizationBadge
} from '../../attendance/components/AttendanceShared.jsx'

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

function RegularizationModal({ open, draft, onChange, onClose, onSubmit, isPending }) {
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
          <input className="form-control" type="date" name="regularizationDate" value={draft.regularizationDate} onChange={onChange} required />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Requested Worked Hours</label>
          <input className="form-control" type="number" step="0.25" min="0" max="24" name="requestedWorkedHours" value={draft.requestedWorkedHours} onChange={onChange} placeholder="Example: 8" />
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

export default function EmployeeAttendance() {
  const todayDate = getTodayDateInput()
  const queryClient = useQueryClient()
  const { showStatus, runWithLoader } = useModal()

  const [activeTab, setActiveTab] = useState('overview')
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [regularizationOpen, setRegularizationOpen] = useState(false)
  const [regularizationDraft, setRegularizationDraft] = useState(() => buildRegularizationDraft(todayDate, []))

  const selectedLogsQuery = useMyPunchLogsQuery(selectedDate)
  const todayLogsQuery = useMyPunchLogsQuery(todayDate)
  const regularizationsQuery = useMyRegularizationsQuery()

  const selectedLogs = selectedLogsQuery.data || []
  const todayLogs = todayLogsQuery.data || []
  const regularizations = regularizationsQuery.data || []

  const todaySession = useMemo(() => getPunchSessionState(todayLogs), [todayLogs])
  const selectedSession = useMemo(() => getPunchSessionState(selectedLogs), [selectedLogs])
  const latestRegularizationStatus = useMemo(() => getLatestRegularizationStatus(regularizations), [regularizations])
  const attendanceStateLabel = todaySession.isClockedIn ? 'Clocked In' : todaySession.totalPunches > 0 ? 'Completed' : 'Ready'
  const elapsedSeconds = useMemo(() => todaySession.isClockedIn ? getElapsedSeconds(todaySession.firstPunchIn) : (todaySession.firstPunchIn && todaySession.lastPunchOut ? getElapsedSeconds(todaySession.firstPunchIn, todaySession.lastPunchOut) : 0), [todaySession])

  useEffect(() => {
    if (!regularizationOpen) return
    setRegularizationDraft(buildRegularizationDraft(selectedDate, selectedLogs))
  }, [regularizationOpen, selectedDate, selectedLogs])

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
      showStatus({ type: 'success', title: 'Regularization submitted', message: 'Your request has been routed for review and is now visible in your attendance queue.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Submission failed', message: getErrorMessage(error, 'The regularization request could not be submitted.') })
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
    await runWithLoader(async () => regularizationMutation.mutateAsync(regularizationDraft), { title: 'Submitting request', message: 'Routing your attendance correction to the reviewer workflow.' })
  }

  const handleRegularizationChange = (event) => {
    const { name, value } = event.target
    setRegularizationDraft((current) => ({ ...current, [name]: value }))
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

      <AttendanceTabs activeTab={activeTab} onChange={setActiveTab} tabs={TAB_ITEMS} />

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
            <div className="col-12 col-xl-8">
              <CardShell title="Today’s Punch Panel">
                <PunchSessionCard
                  title="My punch actions"
                  attendanceStateLabel={attendanceStateLabel}
                  session={{ ...todaySession, totalWorkedHours: null }}
                  elapsedSeconds={elapsedSeconds}
                  dateValue={todayDate}
                  onPunchIn={handlePunchIn}
                  onPunchOut={handlePunchOut}
                  isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                  note={todaySession.isClockedIn ? 'You are currently clocked in. Close the session with punch out once your shift ends.' : todaySession.totalPunches > 0 ? 'Your punch cycle for today is complete. Use regularization only when a correction is required.' : 'No punch has been recorded yet for today. Start the session with punch in.'}
                  secondaryNote="You can generate and download your own logs from the attendance management tab."
                />
              </CardShell>
            </div>
          </div>

          <CardShell title="Recent Regularization Requests" right={<button type="button" className="btn btn-sm btn-light" onClick={() => setActiveTab('regularization')}>Open queue</button>}>
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--regularization-preview align-middle mb-0">
                <thead><tr><th>Date</th><th>Requested In</th><th>Requested Out</th><th>Status</th><th>Updated</th></tr></thead>
                <tbody>
                  {regularizations.length ? regularizations.slice(0, 5).map((request) => (
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
            </div>
          </CardShell>
        </>
      ) : null}

      {activeTab === 'attendance' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-lg-5">
              <CardShell title="Punch In / Punch Out">
                <PunchSessionCard
                  title="Today’s attendance actions"
                  attendanceStateLabel={attendanceStateLabel}
                  session={{ ...todaySession, totalWorkedHours: null }}
                  elapsedSeconds={elapsedSeconds}
                  dateValue={todayDate}
                  onPunchIn={handlePunchIn}
                  onPunchOut={handlePunchOut}
                  isPunchPending={punchInMutation.isPending || punchOutMutation.isPending}
                  note={todaySession.isClockedIn ? 'You are currently clocked in. Close the session with punch out once your shift ends.' : todaySession.totalPunches > 0 ? 'Your punch cycle for today is complete. Use regularization only when a correction is required.' : 'No punch has been recorded yet for today. Start the session with punch in.'}
                  secondaryNote="Employees and admins can both add their own time entries from this module."
                />
              </CardShell>
            </div>

            <div className="col-12 col-lg-7">
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
              <div className="col-12 d-flex justify-content-end">
                <button type="button" className="btn btn-primary px-4" onClick={() => setRegularizationOpen(true)}>Create Regularization Request</button>
              </div>
            </div>
          </CardShell>

          <CardShell title="My Regularization Requests">
            <div className="employee-table-wrap table-responsive">
              <table className="table employee-table workspace-table workspace-table--regularization-history align-middle mb-0">
                <thead><tr><th>Date</th><th>Requested In</th><th>Requested Out</th><th>Worked Hours</th><th>Reason</th><th>Status</th><th>Reviewer Note</th><th>Updated</th></tr></thead>
                <tbody>
                  {regularizations.length ? regularizations.map((request) => (
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
            </div>
          </CardShell>
        </>
      ) : null}

      <RegularizationModal open={regularizationOpen} draft={regularizationDraft} onChange={handleRegularizationChange} onClose={() => setRegularizationOpen(false)} onSubmit={handleRegularizationSubmit} isPending={regularizationMutation.isPending} />
    </div>
  )
}
