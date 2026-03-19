import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import {
  normalizeHoliday,
  serializeHolidayDescription,
  normalizeLeaveBalance,
  normalizeLeavePreview,
  normalizeLeaveRequest,
  normalizeLeaveType
} from '../../utils/leave.js'

export const leaveService = {
  async getHolidayCalendar(year) {
    const response = await http.get(endpoints.leave.holidays.list, { params: { year } })
    return Array.isArray(response.data) ? response.data.map(normalizeHoliday).filter(Boolean) : []
  },

  async createHoliday(payload) {
    const response = await http.post(endpoints.leave.holidays.create, {
      holiday_date: payload.holidayDate,
      name: payload.name,
      description: serializeHolidayDescription(payload.description, payload),
      is_active: Boolean(payload.isActive ?? true)
    })
    return normalizeHoliday(response.data)
  },

  async updateHoliday(holidayUid, payload) {
    const response = await http.put(endpoints.leave.holidays.detail(holidayUid), {
      holiday_date: payload.holidayDate,
      name: payload.name,
      description: serializeHolidayDescription(payload.description, payload),
      is_active: payload.isActive
    })
    return normalizeHoliday(response.data)
  },

  async deleteHoliday(holidayUid) {
    await http.delete(endpoints.leave.holidays.detail(holidayUid))
    return holidayUid
  },

  async getLeaveTypes() {
    const response = await http.get(endpoints.leave.types.list)
    return Array.isArray(response.data) ? response.data.map(normalizeLeaveType).filter(Boolean) : []
  },

  async createLeaveType(payload) {
    const response = await http.post(endpoints.leave.types.create, {
      code: String(payload.code || '').trim().toUpperCase(),
      name: payload.name,
      annual_days: Number(payload.annualDays || 0),
      auto_allocate: Boolean(payload.autoAllocate),
      requires_manual_grant: Boolean(payload.requiresManualGrant),
      carry_forward_allowed: Boolean(payload.carryForwardAllowed),
      carry_forward_cap: payload.carryForwardCap === '' || payload.carryForwardCap == null ? null : Number(payload.carryForwardCap)
    })
    return normalizeLeaveType(response.data)
  },

  async updateLeaveType(leaveTypeUid, payload) {
    const response = await http.put(endpoints.leave.types.detail(leaveTypeUid), {
      name: payload.name,
      annual_days: Number(payload.annualDays || 0),
      auto_allocate: Boolean(payload.autoAllocate),
      requires_manual_grant: Boolean(payload.requiresManualGrant),
      carry_forward_allowed: Boolean(payload.carryForwardAllowed),
      carry_forward_cap: payload.carryForwardCap === '' || payload.carryForwardCap == null ? null : Number(payload.carryForwardCap),
      is_active: Boolean(payload.isActive)
    })
    return normalizeLeaveType(response.data)
  },

  async generateLeaveBalances(payload) {
    const response = await http.post(endpoints.leave.balances.generate, {
      year: Number(payload.year),
      employee_uid: payload.employeeUid || null
    })
    return Array.isArray(response.data) ? response.data.map(normalizeLeaveBalance).filter(Boolean) : []
  },

  async manualGrantLeaveBalance(payload) {
    const response = await http.post(endpoints.leave.balances.manualGrant, {
      employee_uid: payload.employeeUid,
      leave_type_uid: payload.leaveTypeUid,
      year: Number(payload.year),
      days: Number(payload.days)
    })
    return normalizeLeaveBalance(response.data)
  },

  async getEmployeeLeaveBalances(employeeUid, year) {
    const response = await http.get(endpoints.leave.balances.byEmployee(employeeUid), { params: { year } })
    return Array.isArray(response.data) ? response.data.map(normalizeLeaveBalance).filter(Boolean) : []
  },

  async getMyLeaveBalances(employeeUid, year) {
    if (!employeeUid) return []
    const response = await http.get(endpoints.leave.balances.byEmployee(employeeUid), { params: { year } })
    return Array.isArray(response.data) ? response.data.map(normalizeLeaveBalance).filter(Boolean) : []
  },

  async previewLeaveDays(startDate, endDate) {
    const response = await http.get(endpoints.leave.requests.preview, { params: { start_date: startDate, end_date: endDate } })
    return normalizeLeavePreview(response.data)
  },

  async applyLeave(payload) {
    const response = await http.post(endpoints.leave.requests.apply, {
      leave_type_uid: payload.leaveTypeUid,
      start_date: payload.startDate,
      end_date: payload.endDate,
      reason: payload.reason || null
    })
    return normalizeLeaveRequest(response.data)
  },

  async getMyLeaveRequests() {
    const response = await http.get(endpoints.leave.requests.mine)
    return Array.isArray(response.data) ? response.data.map(normalizeLeaveRequest).filter(Boolean) : []
  },

  async getPendingLeaveRequests() {
    const response = await http.get('/api/v1/leave-requests/leave-request-pending')
    return Array.isArray(response.data) ? response.data.map(normalizeLeaveRequest).filter(Boolean) : []
  },

  async approveLeaveRequest(leaveRequestUid, reviewerNote = '') {
    const response = await http.post(endpoints.leave.requests.approve(leaveRequestUid), {
      reviewer_note: reviewerNote || null
    })
    return normalizeLeaveRequest(response.data)
  },

  async rejectLeaveRequest(leaveRequestUid, reviewerNote = '') {
    const response = await http.post(endpoints.leave.requests.reject(leaveRequestUid), {
      reviewer_note: reviewerNote || null
    })
    return normalizeLeaveRequest(response.data)
  }
}
