function getSafeDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getTodayDateInput() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toIsoOrNull(value) {
  const raw = String(value || '').trim()
  return raw || null
}

export function normalizeAttendanceStatus(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'Unknown'

  const lower = raw.toLowerCase()
  if (lower === 'pendingregularization') return 'Pending Regularization'
  if (lower === 'leave') return 'Leave'
  if (lower === 'halfday') return 'Half-Day'
  if (lower === 'present') return 'Present'
  if (lower === 'absent') return 'Absent'
  return raw
}

export function normalizeAttendanceRecord(record) {
  if (!record) return null

  return {
    uid: String(record.uid || ''),
    userUid: String(record.user_uid || record.userUid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    attendanceDate: record.attendance_date || record.attendanceDate || '',
    firstPunchIn: record.first_punch_in || record.firstPunchIn || null,
    lastPunchOut: record.last_punch_out || record.lastPunchOut || null,
    totalAssignedShiftHours: Number(record.total_assigned_shift_hours || record.totalAssignedShiftHours || 0),
    totalWorkedHours: Number(record.total_worked_hours || record.totalWorkedHours || 0),
    status: normalizeAttendanceStatus(record.status),
    rawStatus: record.status || '',
    isRegularized: Boolean(record.is_regularized ?? record.isRegularized),
    leaveRequestUid: record.leave_request_uid || record.leaveRequestUid || null,
    leaveTypeUid: record.leave_type_uid || record.leaveTypeUid || null,
    remarks: record.remarks || '',
    createdAt: record.created_at || record.createdAt || '',
    updatedAt: record.updated_at || record.updatedAt || ''
  }
}

export function normalizePunchLog(record) {
  if (!record) return null

  return {
    uid: String(record.uid || ''),
    userUid: String(record.user_uid || record.userUid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    attendanceUid: String(record.attendance_uid || record.attendanceUid || ''),
    attendanceDate: record.attendance_date || record.attendanceDate || '',
    punchType: String(record.punch_type || record.punchType || '').toUpperCase(),
    punchTime: record.punch_time || record.punchTime || null,
    isValid: Boolean(record.is_valid ?? record.isValid ?? true),
    invalidReason: record.invalid_reason || record.invalidReason || '',
    source: record.source || '',
    createdAt: record.created_at || record.createdAt || ''
  }
}

export function normalizePunchAction(record) {
  if (!record) return null

  return {
    attendanceUid: String(record.attendance_uid || record.attendanceUid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    attendanceDate: record.attendance_date || record.attendanceDate || '',
    firstPunchIn: record.first_punch_in || record.firstPunchIn || null,
    lastPunchOut: record.last_punch_out || record.lastPunchOut || null,
    totalAssignedShiftHours: Number(record.total_assigned_shift_hours || record.totalAssignedShiftHours || 0),
    totalWorkedHours: Number(record.total_worked_hours || record.totalWorkedHours || 0),
    status: normalizeAttendanceStatus(record.status),
    message: record.message || 'Attendance updated successfully.'
  }
}

export function normalizeRegularization(record) {
  if (!record) return null

  return {
    uid: String(record.uid || ''),
    userUid: String(record.user_uid || record.userUid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    attendanceUid: record.attendance_uid ? String(record.attendance_uid) : (record.attendanceUid ? String(record.attendanceUid) : ''),
    regularizationDate: record.regularization_date || record.regularizationDate || '',
    requestedPunchIn: record.requested_punch_in || record.requestedPunchIn || null,
    requestedPunchOut: record.requested_punch_out || record.requestedPunchOut || null,
    requestedWorkedHours: record.requested_worked_hours == null ? null : Number(record.requested_worked_hours),
    reason: record.reason || '',
    status: String(record.status || ''),
    approverEmployeeUid: record.approver_employee_uid ? String(record.approver_employee_uid) : (record.approverEmployeeUid ? String(record.approverEmployeeUid) : ''),
    reviewerNote: record.reviewer_note || record.reviewerNote || '',
    reviewedAt: record.reviewed_at || record.reviewedAt || null,
    createdAt: record.created_at || record.createdAt || '',
    updatedAt: record.updated_at || record.updatedAt || ''
  }
}

export function normalizeRegularizationLog(record) {
  if (!record) return null

  return {
    uid: String(record.uid || ''),
    regularizationUid: String(record.regularization_uid || record.regularizationUid || ''),
    actorEmployeeUid: record.actor_employee_uid ? String(record.actor_employee_uid) : (record.actorEmployeeUid ? String(record.actorEmployeeUid) : ''),
    action: record.action || '',
    note: record.note || '',
    createdAt: record.created_at || record.createdAt || ''
  }
}

export function normalizeShiftRoster(record) {
  if (!record) return null

  return {
    uid: String(record.uid || ''),
    code: String(record.code || '').trim(),
    name: String(record.name || '').trim(),
    startTime: record.start_time || record.startTime || '',
    endTime: record.end_time || record.endTime || '',
    isActive: Boolean(record.is_active ?? record.isActive ?? true),
    userUid: String(record.user_uid || record.userUid || ''),
    createdAt: record.created_at || record.createdAt || '',
    updatedAt: record.updated_at || record.updatedAt || ''
  }
}

export function normalizeEmployeeShift(record) {
  if (!record) return null

  return {
    uid: String(record.uid || ''),
    employeeUid: String(record.employee_uid || record.employeeUid || ''),
    shiftUid: String(record.shift_uid || record.shiftUid || ''),
    isActive: Boolean(record.is_active ?? record.isActive ?? true),
    userUid: String(record.user_uid || record.userUid || ''),
    createdAt: record.created_at || record.createdAt || '',
    updatedAt: record.updated_at || record.updatedAt || ''
  }
}

export function formatDate(value, options = {}) {
  if (!value) return '—'
  const date = getSafeDate(value)
  if (!date) return String(value)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = getSafeDate(value)
  if (!date) return String(value)
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatTime(value) {
  if (!value) return '—'
  const date = getSafeDate(value)
  if (date) {
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const [hours = '', minutes = ''] = String(value).split(':')
  if (!hours || !minutes) return String(value)
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
}

export function formatHours(value) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return '0.00h'
  return `${numeric.toFixed(2)}h`
}

export function formatDurationMinutes(value) {
  const minutes = Number(value || 0)
  if (!Number.isFinite(minutes) || minutes <= 0) return '00:00:00'

  const totalSeconds = Math.floor(minutes * 60)
  return formatElapsedSeconds(totalSeconds)
}

export function formatElapsedSeconds(value) {
  const safe = Math.max(0, Math.floor(Number(value || 0)))
  const hours = String(Math.floor(safe / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0')
  const seconds = String(safe % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

export function getElapsedSeconds(startValue, endValue = new Date()) {
  const start = getSafeDate(startValue)
  const end = getSafeDate(endValue)
  if (!start || !end) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

export function getAttendanceSummary(records = []) {
  return records.reduce((summary, record) => {
    summary.total += 1
    const status = String(record.status || '').toLowerCase()

    if (status === 'present') summary.present += 1
    else if (status === 'absent') summary.absent += 1
    else if (status === 'leave') summary.leave += 1
    else if (status === 'half-day') summary.halfDay += 1
    else if (status === 'pending regularization') summary.pendingRegularization += 1

    if (record.isRegularized) summary.regularized += 1
    return summary
  }, {
    total: 0,
    present: 0,
    absent: 0,
    leave: 0,
    halfDay: 0,
    pendingRegularization: 0,
    regularized: 0
  })
}

export function getPunchSessionState(logs = []) {
  const sortedLogs = [...logs].sort((left, right) => new Date(left.punchTime || 0).getTime() - new Date(right.punchTime || 0).getTime())
  const inCount = sortedLogs.filter((log) => log.punchType === 'IN').length
  const outCount = sortedLogs.filter((log) => log.punchType === 'OUT').length
  const lastLog = sortedLogs.at(-1) || null

  return {
    canPunchIn: inCount === outCount,
    canPunchOut: inCount > outCount && lastLog?.punchType === 'IN',
    isClockedIn: inCount > outCount && lastLog?.punchType === 'IN',
    totalPunches: sortedLogs.length,
    firstPunchIn: sortedLogs.find((log) => log.punchType === 'IN')?.punchTime || null,
    lastPunchOut: [...sortedLogs].reverse().find((log) => log.punchType === 'OUT')?.punchTime || null,
    lastLog,
    elapsedSeconds: lastLog?.punchType === 'IN' ? getElapsedSeconds(sortedLogs.find((log) => log.punchType === 'IN')?.punchTime) : 0
  }
}

export function getLatestRegularizationStatus(records = []) {
  if (!records.length) return 'No requests yet'

  const latest = [...records].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime()
    return rightTime - leftTime
  })[0]

  return latest?.status || 'No requests yet'
}

export function getRegularizationBadgeClass(status) {
  const safe = String(status || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `attendance-badge regularization ${safe}`
}

export function getAttendanceBadgeClass(status) {
  const safe = String(status || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return `attendance-badge status ${safe}`
}

export function getShiftDurationHours(startValue, endValue) {
  const [startHours = 0, startMinutes = 0] = String(startValue || '00:00').split(':').map((value) => Number(value || 0))
  const [endHours = 0, endMinutes = 0] = String(endValue || '00:00').split(':').map((value) => Number(value || 0))

  let startTotal = (startHours * 60) + startMinutes
  let endTotal = (endHours * 60) + endMinutes

  if (endTotal <= startTotal) endTotal += 24 * 60
  return Number(((endTotal - startTotal) / 60).toFixed(2))
}

export function getShiftOverview(shifts = [], assignments = []) {
  const activeShifts = shifts.filter((shift) => shift.isActive)
  const activeAssignments = assignments.filter((assignment) => assignment.isActive)

  return {
    totalShifts: shifts.length,
    activeShifts: activeShifts.length,
    inactiveShifts: Math.max(0, shifts.length - activeShifts.length),
    activeAssignments: activeAssignments.length,
    inactiveAssignments: Math.max(0, assignments.length - activeAssignments.length)
  }
}

export function toTimeInputValue(value) {
  if (!value) return ''
  const timeValue = String(value)
  if (/^\d{2}:\d{2}$/.test(timeValue)) return timeValue
  if (/^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(timeValue)) return timeValue.slice(0, 5)
  return timeValue
}

export function toDateTimeLocalValue(value) {
  if (!value) return ''
  const date = getSafeDate(value)
  if (!date) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
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

export function downloadAttendanceRowsCsv(records = [], fileName = `attendance-logs-${Date.now()}.csv`) {
  const headers = ['Date', 'Employee', 'Employee Code', 'Department', 'Status', 'First In', 'Last Out', 'Worked Hours', 'Shift Hours', 'Regularized', 'Remarks']
  const rows = records.map((record) => [
    record.attendanceDate,
    record.employeeName || record.employee_name || '',
    record.employeeCode || record.employee_code || '',
    record.department || '',
    record.status || '',
    formatDateTime(record.firstPunchIn),
    formatDateTime(record.lastPunchOut),
    record.totalWorkedHours ?? '',
    record.totalAssignedShiftHours ?? '',
    record.isRegularized ? 'Yes' : 'No',
    record.remarks || ''
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), fileName)
}

export function downloadAttendanceRowsExcel(records = [], fileName = `attendance-logs-${Date.now()}.xls`) {
  const headers = ['Date', 'Employee', 'Employee Code', 'Department', 'Status', 'First In', 'Last Out', 'Worked Hours', 'Shift Hours', 'Regularized', 'Remarks']
  const rows = records.map((record) => `
    <tr>
      <td>${escapeHtml(record.attendanceDate)}</td>
      <td>${escapeHtml(record.employeeName || record.employee_name || '')}</td>
      <td>${escapeHtml(record.employeeCode || record.employee_code || '')}</td>
      <td>${escapeHtml(record.department || '')}</td>
      <td>${escapeHtml(record.status || '')}</td>
      <td>${escapeHtml(formatDateTime(record.firstPunchIn))}</td>
      <td>${escapeHtml(formatDateTime(record.lastPunchOut))}</td>
      <td>${escapeHtml(record.totalWorkedHours ?? '')}</td>
      <td>${escapeHtml(record.totalAssignedShiftHours ?? '')}</td>
      <td>${escapeHtml(record.isRegularized ? 'Yes' : 'No')}</td>
      <td>${escapeHtml(record.remarks || '')}</td>
    </tr>
  `).join('')

  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${headers.map((value) => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `

  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), fileName)
}

export function downloadPunchLogsCsv(records = [], fileName = `punch-logs-${Date.now()}.csv`) {
  const headers = ['Date', 'Punch Type', 'Punch Time', 'Source', 'Validity', 'Notes']
  const rows = records.map((record) => [
    record.attendanceDate || '',
    record.punchType || '',
    formatDateTime(record.punchTime),
    record.source || '',
    record.isValid ? 'Valid' : 'Invalid',
    record.invalidReason || ''
  ])

  const csvContent = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n')

  downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), fileName)
}

export function downloadPunchLogsExcel(records = [], fileName = `punch-logs-${Date.now()}.xls`) {
  const headers = ['Date', 'Punch Type', 'Punch Time', 'Source', 'Validity', 'Notes']
  const rows = records.map((record) => `
    <tr>
      <td>${escapeHtml(record.attendanceDate || '')}</td>
      <td>${escapeHtml(record.punchType || '')}</td>
      <td>${escapeHtml(formatDateTime(record.punchTime))}</td>
      <td>${escapeHtml(record.source || '')}</td>
      <td>${escapeHtml(record.isValid ? 'Valid' : 'Invalid')}</td>
      <td>${escapeHtml(record.invalidReason || '')}</td>
    </tr>
  `).join('')

  const html = `
    <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table>
          <thead><tr>${headers.map((value) => `<th>${escapeHtml(value)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `

  downloadBlob(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }), fileName)
}
