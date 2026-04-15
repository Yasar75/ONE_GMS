import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/common/PageHeader.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import PageContentLoader from '../../../components/common/PageContentLoader.jsx'
import { SearchIcon } from '../../../components/common/AppIcons.jsx'
import { TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { useMyPunchLogsQuery } from '../../../hooks/attendance/useMyPunchLogsQuery.js'
import { useMyRegularizationsQuery } from '../../../hooks/attendance/useMyRegularizationsQuery.js'
import { attendanceService } from '../../../api/services/attendance.service.js'
import { endpoints } from '../../../api/endpoints.js'
import { http } from '../../../api/http.js'
import { employeeService } from '../../../api/services/employee.service.js'
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
  normalizeShiftRoster,
  rememberPunchOutMode,
  rememberSoftPunchResume,
  toDateTimeLocalValue
} from '../../../utils/attendance.js'
import { getErrorMessage } from '../../../utils/auth.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useToast } from '../../../app/providers/ToastProvider.jsx'
import {
  AttendanceBadge,
  AttendanceTabs,
  DownloadActionGroup,
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
  filterAccessibleTabs,
  resolveAccessibleTab
} from '../../../utils/permissions.js'
import { useSortableData } from '../../../hooks/common/useSortableData.js'

const TAB_ITEMS = [
  { key: 'attendance', label: 'Mark Attendance', helper: 'Punches and log downloads' },
  { key: 'regularization', label: 'Apply Regularization', helper: 'Request time corrections' }
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

function formatShiftWindow(shift) {
  const start = shift?.startTime ? formatTime(shift.startTime) : ''
  const end = shift?.endTime ? formatTime(shift.endTime) : ''
  if (!start && !end) return 'Schedule not available'
  if (!start) return end
  if (!end) return start
  return `${start} - ${end}`
}

function RegularizationModal({ open, draft, errors = {}, touched = {}, onChange, onBlur, onClose, onSubmit, isPending }) {
  return (
    <ModalFrame
      open={open}
      title="Create attendance regularization"
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { showStatus, runWithLoader, showConfirm } = useModal()
  const { showToast } = useToast()
  const { user } = useAuth()
  const canViewAttendanceLogs = true
  const canSelfPunch = true
  // Employee shift panel should always use employee roster lookup for the logged-in employee.
  const canViewMyShift = true
  const canViewAttendanceTab = true
  const canViewRegularizationTab = true
  const canCreateRegularization = true

  const requestedTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(() => requestedTab || 'attendance')
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [regularizationOpen, setRegularizationOpen] = useState(false)
  const [regularizationDraft, setRegularizationDraft] = useState(() => buildRegularizationDraft(todayDate, []))
  const [regularizationTouched, setRegularizationTouched] = useState({})
  const [punchControlVersion, setPunchControlVersion] = useState(0)

  const selectedLogsQuery = useMyPunchLogsQuery(selectedDate, canViewAttendanceLogs || canSelfPunch)
  const todayLogsQuery = useMyPunchLogsQuery(todayDate, canViewAttendanceLogs || canSelfPunch)
  const regularizationsQuery = useMyRegularizationsQuery(canViewRegularizationTab)
  const selectedLogsRaw = selectedLogsQuery.data || []
  const todayLogsRaw = todayLogsQuery.data || []
  const regularizations = regularizationsQuery.data || []
  const currentEmployeeQuery = useQuery({
    queryKey: ['employees', 'me', 'record', 'attendance'],
    queryFn: () => employeeService.getCurrentEmployee(),
    enabled: Boolean(user),
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
  const currentEmployeeUid = useMemo(() => {
    const fallbackEmployeeUid = user?.employeeUid
      || selectedLogsRaw.find((entry) => entry?.employeeUid)?.employeeUid
      || todayLogsRaw.find((entry) => entry?.employeeUid)?.employeeUid
      || regularizations.find((entry) => entry?.employeeUid)?.employeeUid
      || ''

    return String(currentEmployeeQuery.data?.uid || fallbackEmployeeUid || '').trim()
  }, [currentEmployeeQuery.data?.uid, regularizations, selectedLogsRaw, todayLogsRaw, user?.employeeUid])
  const myShiftAssignmentQuery = useQuery({
    queryKey: ['attendance', 'employee', 'my-shift', currentEmployeeUid],
    queryFn: () => attendanceService.getEmployeeShiftAssignmentByEmployee(currentEmployeeUid),
    enabled: canViewMyShift && Boolean(currentEmployeeUid),
    retry: false,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
  const attendanceRegisterQuery = useQuery({
    queryKey: ['attendance', 'employee', 'register', currentEmployeeUid],
    queryFn: async () => {
      if (!currentEmployeeUid) return []

      try {
        return await attendanceService.getAttendanceByEmployee(currentEmployeeUid)
      } catch (error) {
        if ([401, 403, 404, 405].includes(Number(error?.response?.status || 0))) {
          return []
        }
        throw error
      }
    },
    enabled: canViewAttendanceTab && Boolean(currentEmployeeUid),
    retry: false,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
  const myShiftRosterQuery = useQuery({
    queryKey: ['attendance', 'employee', 'my-shift-roster', myShiftAssignmentQuery.data?.shiftUid || ''],
    queryFn: async () => {
      const shiftUid = String(myShiftAssignmentQuery.data?.shiftUid || '').trim()
      if (!shiftUid) return null

      try {
        const response = await http.get(endpoints.shiftRoster.detail(shiftUid))
        return normalizeShiftRoster(response.data)
      } catch (error) {
        if ([401, 403, 404, 405].includes(Number(error?.response?.status || 0))) return null
        throw error
      }
    },
    enabled: canViewMyShift && Boolean(myShiftAssignmentQuery.data?.shiftUid),
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
  const selectedLogs = useMemo(
    () => applyLocalPunchControl(selectedLogsRaw, selectedDate),
    [punchControlVersion, selectedDate, selectedLogsRaw]
  )
  const todayLogs = useMemo(
    () => applyLocalPunchControl(todayLogsRaw, todayDate),
    [punchControlVersion, todayDate, todayLogsRaw]
  )
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
  const { items: sortedRegularizations, sortConfig: regularizationsSortConfig, requestSort: requestRegularizationsSort } = useSortableData(regularizations, {
    initialKey: 'regularizationDate',
    initialDirection: 'desc',
    accessors: {
      regularizationDate: (request) => request.regularizationDate || '',
      requestedPunchIn: (request) => request.requestedPunchIn || '',
      requestedPunchOut: (request) => request.requestedPunchOut || '',
      requestedWorkedHours: (request) => Number(request.requestedWorkedHours ?? -1),
      reason: (request) => request.reason || '',
      status: (request) => request.status || '',
      reviewerNote: (request) => request.reviewerNote || '',
      updatedAt: (request) => request.updatedAt || request.createdAt || ''
    }
  })
  const attendanceRegisterRows = useMemo(() => {
    const employeeName = currentEmployeeQuery.data?.fullName || user?.displayName || user?.firstName || 'Employee'
    const employeeCode = currentEmployeeQuery.data?.employeeCode || '—'

    return (attendanceRegisterQuery.data || []).map((record) => ({
      ...record,
      employeeName,
      employeeCode
    }))
  }, [attendanceRegisterQuery.data, currentEmployeeQuery.data?.employeeCode, currentEmployeeQuery.data?.fullName, user?.displayName, user?.firstName])
  const { items: sortedAttendanceRegisterRows, sortConfig: attendanceRegisterSortConfig, requestSort: requestAttendanceRegisterSort } = useSortableData(attendanceRegisterRows, {
    initialKey: 'attendanceDate',
    initialDirection: 'desc',
    accessors: {
      attendanceDate: (row) => row.attendanceDate || '',
      status: (row) => row.status || '',
      firstPunchIn: (row) => row.firstPunchIn || '',
      lastPunchOut: (row) => row.lastPunchOut || '',
      totalWorkedHours: (row) => Number(row.totalWorkedHours ?? -1),
      totalAssignedShiftHours: (row) => Number(row.totalAssignedShiftHours ?? -1),
      regularized: (row) => (row.isRegularized ? 'Regularized' : 'Standard'),
      remarks: (row) => row.remarks || ''
    }
  })

  const todaySession = useMemo(() => getPunchSessionState(todayLogs), [todayLogs])
  const selectedSession = useMemo(() => getPunchSessionState(selectedLogs), [selectedLogs])
  const latestRegularizationStatus = useMemo(() => getLatestRegularizationStatus(regularizations), [regularizations])
  const latestAttendanceRegisterEntry = useMemo(() => (
    attendanceRegisterRows.find((record) => record.attendanceDate === todayDate)
      || attendanceRegisterRows[0]
      || null
  ), [attendanceRegisterRows, todayDate])
  const myShiftDetails = useMemo(() => {
    const assignment = myShiftAssignmentQuery.data
    if (!assignment) return null

    const shift = myShiftRosterQuery.data || null
    return {
      ...assignment,
      shiftName: shift?.name || 'Assigned shift',
      shiftCode: shift?.code || (assignment.shiftUid ? String(assignment.shiftUid).slice(0, 8).toUpperCase() : '—'),
      shiftWindow: shift
        ? formatShiftWindow(shift)
        : (latestAttendanceRegisterEntry?.totalAssignedShiftHours
            ? `${formatHours(latestAttendanceRegisterEntry.totalAssignedShiftHours)} scheduled`
            : 'Assigned roster linked'),
      shiftActive: shift?.isActive ?? assignment.isActive ?? null,
      hasRosterDetails: Boolean(shift)
    }
  }, [latestAttendanceRegisterEntry, myShiftAssignmentQuery.data, myShiftRosterQuery.data])
  const assignedShiftCard = useMemo(() => {
    if (!canViewMyShift) return null
    if (currentEmployeeQuery.isLoading || myShiftAssignmentQuery.isLoading) {
      return {
        title: 'Loading assigned shift',
        helper: 'Fetching your current shift details.'
      }
    }
    if (currentEmployeeQuery.isError) {
      return {
        title: 'Employee link unavailable',
        helper: 'Your employee record could not be resolved for shift lookup.'
      }
    }
    if (myShiftAssignmentQuery.isError) {
      return {
        title: 'Assigned shift unavailable',
        helper: 'Shift details are temporarily unavailable from the backend.'
      }
    }
    if (!myShiftDetails) {
      return {
        title: 'No active shift',
        helper: 'Once an admin assigns a shift, it will appear here.'
      }
    }

    return {
      title: myShiftDetails.shiftName,
      code: myShiftDetails.shiftCode,
      window: myShiftDetails.shiftWindow,
      status: myShiftDetails.shiftActive ? 'Assigned' : 'Inactive',
      helper: ''
    }
  }, [canViewMyShift, currentEmployeeQuery.isError, currentEmployeeQuery.isLoading, myShiftAssignmentQuery.isError, myShiftAssignmentQuery.isLoading, myShiftDetails])
  const attendanceStateLabel = todaySession.isClockedIn ? 'Clocked In' : todaySession.hasSoftPunchOut ? 'Paused' : todaySession.totalPunches > 0 ? 'Completed' : 'Ready'
  const elapsedSeconds = useMemo(() => Number(todaySession.workedSeconds || 0), [todaySession.workedSeconds])
  const regularizationErrors = useMemo(() => buildRegularizationErrors(regularizationDraft), [regularizationDraft])
  const availableTabs = useMemo(() => filterAccessibleTabs(TAB_ITEMS, (tabKey) => {
    if (tabKey === 'attendance') return canViewAttendanceTab
    if (tabKey === 'regularization') return canViewRegularizationTab
    return false
  }), [canViewAttendanceTab, canViewRegularizationTab])

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

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'attendance') return canViewAttendanceTab
      if (tabKey === 'regularization') return canViewRegularizationTab
      return false
    }, canViewAttendanceTab ? 'attendance' : availableTabs[0]?.key)

    if (!nextTab) return
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
    if (requestedTab !== nextTab) {
      updateTabSearchParam(nextTab)
    }
  }, [activeTab, availableTabs, canViewAttendanceTab, canViewRegularizationTab, requestedTab, updateTabSearchParam])

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
      showStatus({ type: 'success', title: 'Regularization submitted', message: 'Your request has been routed for review and is now visible in your attendance queue.' })
    },
    onError: (error) => showStatus({ type: 'error', title: 'Submission failed', message: getErrorMessage(error, 'The regularization request could not be submitted.') })
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

  const isAttendanceTabLoading = selectedLogsQuery.isLoading || todayLogsQuery.isLoading || attendanceRegisterQuery.isLoading
  const isRegularizationTabLoading = regularizationsQuery.isLoading

  if ((activeTab === 'attendance' && isAttendanceTabLoading) || (activeTab === 'regularization' && isRegularizationTabLoading)) {
    return <PageContentLoader cards={3} />
  }

  return (
    <div className="d-flex flex-column gap-3 attendance-module-page employee-attendance-page">
      <PageHeader
        title="Attendance"
        tagline="Mark your attendance, inspect daily logs, and create regularization requests from one employee workspace."
      />

      <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />

      {activeTab === 'attendance' ? (
        <>
          <div className="row g-3">
            {canSelfPunch || canViewMyShift ? (
              <div className="col-12 col-lg-5">
                <div className="d-flex flex-column gap-3">
                  {canSelfPunch ? (
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
                        assignedShift={assignedShiftCard}
                      />
                    </CardShell>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className={`col-12 ${canSelfPunch || canViewMyShift ? 'col-lg-7' : ''}`.trim()}>
              <CardShell title="Daily Punch In / Punch Out Log" right={<DownloadActionGroup onCsv={() => downloadPunchLogsCsv(sortedSelectedLogs, `employee-punch-logs-${selectedDate}.csv`)} onExcel={() => downloadPunchLogsExcel(sortedSelectedLogs, `employee-punch-logs-${selectedDate}.xls`)} align="end" />}>
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

          <CardShell title="Attendance Register">
            <PaginatedTable rows={sortedAttendanceRegisterRows}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--attendance-register align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Date" sortKey="attendanceDate" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="First In" sortKey="firstPunchIn" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="Last Out" sortKey="lastPunchOut" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="Worked" sortKey="totalWorkedHours" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="Shift" sortKey="totalAssignedShiftHours" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="Regularized" sortKey="regularized" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                      <th><SortableHeader label="Remarks" sortKey="remarks" sortConfig={attendanceRegisterSortConfig} onSort={requestAttendanceRegisterSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((row) => (
                      <tr key={row.uid}>
                        <td><TableCellStack title={formatDate(row.attendanceDate)} subtitle={row.employeeCode} /></td>
                        <td><AttendanceBadge status={row.status} /></td>
                        <td><TableCellStack title={formatDateTime(row.firstPunchIn)} subtitle={formatTime(row.firstPunchIn)} /></td>
                        <td><TableCellStack title={formatDateTime(row.lastPunchOut)} subtitle={formatTime(row.lastPunchOut)} /></td>
                        <td><TableBadge value={formatHours(row.totalWorkedHours)} tone="blue" /></td>
                        <td><TableBadge value={formatHours(row.totalAssignedShiftHours)} tone="violet" /></td>
                        <td>{row.isRegularized ? <TableBadge value="Yes" tone="success" /> : <TableBadge value="No" tone="neutral" />}</td>
                        <td className="text-muted small attendance-reason-cell">{row.remarks || '—'}</td>
                      </tr>
                    )) : <tr><td colSpan="8"><div className="employee-empty-state text-center py-5 text-muted">No attendance records are currently available for your account.</div></td></tr>}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
          </CardShell>
        </>
      ) : null}

      {activeTab === 'regularization' ? (
        <>
          <CardShell title="Apply Regularization">
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
                  <button type="button" className="btn btn-primary px-4" onClick={() => setRegularizationOpen(true)}>Apply Regularization</button>
                </div>
              ) : null}
            </div>
          </CardShell>

          <CardShell title="Regularization Requested">
            <PaginatedTable rows={sortedRegularizations}>
              {({ rows: paginatedRows }) => (
                <table className="table employee-table workspace-table workspace-table--regularization-history align-middle mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Date" sortKey="regularizationDate" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Requested In" sortKey="requestedPunchIn" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Requested Out" sortKey="requestedPunchOut" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Worked Hours" sortKey="requestedWorkedHours" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Reason" sortKey="reason" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Status" sortKey="status" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Reviewer Note" sortKey="reviewerNote" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                      <th><SortableHeader label="Updated" sortKey="updatedAt" sortConfig={regularizationsSortConfig} onSort={requestRegularizationsSort} /></th>
                    </tr>
                  </thead>
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
