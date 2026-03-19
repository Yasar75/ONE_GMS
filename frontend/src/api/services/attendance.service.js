import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import {
  normalizeAttendanceRecord,
  normalizeEmployeeShift,
  normalizePunchAction,
  normalizePunchLog,
  normalizeRegularization,
  normalizeRegularizationLog,
  normalizeShiftRoster,
  toIsoOrNull
} from '../../utils/attendance.js'

export const attendanceService = {
  async getDirectoryAttendance({ employeeUid } = {}) {
    const response = await http.get(endpoints.attendance.list, {
      params: employeeUid ? { employee_uid: employeeUid } : undefined
    })

    return Array.isArray(response.data)
      ? response.data.map(normalizeAttendanceRecord).filter(Boolean)
      : []
  },

  async getAttendanceDetail(attendanceUid) {
    const response = await http.get(endpoints.attendance.detail(attendanceUid))
    return normalizeAttendanceRecord(response.data)
  },

  async updateAttendance(attendanceUid, payload) {
    const response = await http.patch(endpoints.attendance.update(attendanceUid), {
      first_punch_in: toIsoOrNull(payload.firstPunchIn),
      last_punch_out: toIsoOrNull(payload.lastPunchOut),
      total_worked_hours: payload.totalWorkedHours === '' || payload.totalWorkedHours == null
        ? null
        : Number(payload.totalWorkedHours),
      status: payload.status || null,
      remarks: payload.remarks || null,
      is_regularized: payload.isRegularized ?? null
    })

    return normalizeAttendanceRecord(response.data)
  },

  async punchIn() {
    const response = await http.post(endpoints.punchLog.punchIn)
    return normalizePunchAction(response.data)
  },

  async punchOut() {
    const response = await http.post(endpoints.punchLog.punchOut)
    return normalizePunchAction(response.data)
  },

  async getMyPunchLogs(attendanceDate) {
    const response = await http.get(endpoints.punchLog.myLogs, {
      params: { attendance_date: attendanceDate }
    })

    return Array.isArray(response.data)
      ? response.data.map(normalizePunchLog).filter(Boolean)
      : []
  },

  async createRegularization(payload) {
    const response = await http.post(endpoints.regularization.create, {
      regularization_date: payload.regularizationDate,
      requested_punch_in: toIsoOrNull(payload.requestedPunchIn),
      requested_punch_out: toIsoOrNull(payload.requestedPunchOut),
      requested_worked_hours: payload.requestedWorkedHours === '' || payload.requestedWorkedHours == null
        ? null
        : Number(payload.requestedWorkedHours),
      reason: payload.reason
    })

    return normalizeRegularization(response.data)
  },

  async getMyRegularizations() {
    const response = await http.get(endpoints.regularization.myRequests)
    return Array.isArray(response.data)
      ? response.data.map(normalizeRegularization).filter(Boolean)
      : []
  },

  async getManagerPendingRegularizations() {
    const response = await http.get(endpoints.regularization.managerPending)
    return Array.isArray(response.data)
      ? response.data.map(normalizeRegularization).filter(Boolean)
      : []
  },

  async getRegularizationLogs(regularizationUid) {
    const response = await http.get(endpoints.regularization.logs(regularizationUid))
    return Array.isArray(response.data)
      ? response.data.map(normalizeRegularizationLog).filter(Boolean)
      : []
  },

  async approveRegularization(regularizationUid, reviewerNote = '') {
    const response = await http.post(endpoints.regularization.approve(regularizationUid), {
      reviewer_note: reviewerNote || null
    })
    return normalizeRegularization(response.data)
  },

  async rejectRegularization(regularizationUid, reviewerNote = '') {
    const response = await http.post(endpoints.regularization.reject(regularizationUid), {
      reviewer_note: reviewerNote || null
    })
    return normalizeRegularization(response.data)
  },

  async getShiftRoster() {
    const response = await http.get(endpoints.shiftRoster.list)
    return Array.isArray(response.data)
      ? response.data.map(normalizeShiftRoster).filter(Boolean)
      : []
  },

  async createShift(payload) {
    const response = await http.post(endpoints.shiftRoster.create, {
      code: payload.code,
      name: payload.name,
      start_time: payload.startTime,
      end_time: payload.endTime,
      is_active: Boolean(payload.isActive ?? true)
    })
    return normalizeShiftRoster(response.data)
  },

  async updateShift(shiftUid, payload) {
    const response = await http.patch(endpoints.shiftRoster.detail(shiftUid), {
      name: payload.name,
      start_time: payload.startTime,
      end_time: payload.endTime,
      is_active: payload.isActive
    })
    return normalizeShiftRoster(response.data)
  },

  async deleteShift(shiftUid) {
    await http.delete(endpoints.shiftRoster.detail(shiftUid))
    return shiftUid
  },

  async getEmployeeShiftAssignments() {
    const response = await http.get(endpoints.employeeShift.list)
    return Array.isArray(response.data)
      ? response.data.map(normalizeEmployeeShift).filter(Boolean)
      : []
  },

  async createEmployeeShiftAssignment(payload) {
    const response = await http.post(endpoints.employeeShift.create, {
      employee_uid: payload.employeeUid,
      shift_uid: payload.shiftUid,
      is_active: Boolean(payload.isActive ?? true)
    })
    return normalizeEmployeeShift(response.data)
  },

  async updateEmployeeShiftAssignment(assignmentUid, payload) {
    const response = await http.patch(endpoints.employeeShift.detail(assignmentUid), {
      shift_uid: payload.shiftUid || undefined,
      is_active: payload.isActive
    })
    return normalizeEmployeeShift(response.data)
  },

  async deleteEmployeeShiftAssignment(assignmentUid) {
    await http.delete(endpoints.employeeShift.detail(assignmentUid))
    return assignmentUid
  }
}
