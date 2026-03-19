import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import {
  formatDate,
  normalizeEmployee,
  sortEmployees,
  toEmployeeApiPayload
} from '../../utils/employee.js'

function normalizeEmployeeDocumentRecord(document) {
  return {
    uid: document?.uid || '',
    documentType: document?.document_type || document?.documentType || '',
    name: document?.name || '',
    fileUrl: document?.file_url || document?.fileUrl || '',
    uploadDate: document?.upload_date || document?.uploadDate || '',
    fileFormat: document?.file_format || document?.fileFormat || '',
    fileSize: Number(document?.file_size || document?.fileSize || 0) || 0,
    uploadDateLabel: formatDate(document?.upload_date || document?.uploadDate)
  }
}

function normalizeEmployeeProfileResponse(payload) {
  const employee = normalizeEmployee(payload?.employee)
  return {
    employee,
    nickname: payload?.nickname || '',
    profileImageUrl: payload?.profile_image_url || '',
    canEditProfileDetails: Boolean(payload?.can_edit_profile_details ?? true),
    profileCompletedAt: payload?.profile_completed_at || null,
    mustChangePassword: Boolean(payload?.must_change_password),
    skills: Array.isArray(payload?.skills)
      ? payload.skills.map((skill) => ({
        uid: skill.uid || '',
        skill: skill.skill || ''
      }))
      : [],
    documents: Array.isArray(payload?.documents)
      ? payload.documents.map((document) => normalizeEmployeeDocumentRecord(document))
      : []
  }
}

function normalizeProfileRequest(record) {
  return {
    employeeUid: record.employee_uid || '',
    userUid: record.user_uid || '',
    employeeCode: record.employee_code || '',
    fullName: record.full_name || '',
    email: record.email || '',
    status: record.status || '',
    canEditProfileDetails: Boolean(record.can_edit_profile_details),
    profileCompletedAt: record.profile_completed_at || null,
    mustChangePassword: Boolean(record.must_change_password),
    isLocked: Boolean(record.is_locked),
    lockedReason: record.locked_reason || ''
  }
}

export const employeeService = {
  async getLookupDirectory() {
    const response = await http.get(endpoints.employee.list)
    const employeeRecords = Array.isArray(response.data) ? response.data : []
    return sortEmployees(employeeRecords.map(normalizeEmployee).filter(Boolean))
  },

  async getDirectory() {
    const response = await http.get(endpoints.employee.list)
    const employeeRecords = Array.isArray(response.data) ? response.data : []
    return sortEmployees(employeeRecords.map(normalizeEmployee).filter(Boolean))
  },

  async createEmployee(payload) {
    const response = await http.post(endpoints.employee.create, toEmployeeApiPayload(payload))
    return normalizeEmployee(response.data)
  },

  async updateEmployee(employeeUid, payload) {
    const response = await http.put(endpoints.employee.detail(employeeUid), toEmployeeApiPayload(payload))
    return normalizeEmployee(response.data)
  },

  async deleteEmployee(employeeUid) {
    await http.delete(endpoints.employee.detail(employeeUid))
    return employeeUid
  },

  async getMyProfile() {
    const response = await http.get(endpoints.employee.profile.me)
    return normalizeEmployeeProfileResponse(response.data)
  },

  async updateMyProfile(payload) {
    const response = await http.put(endpoints.employee.profile.me, payload)
    return normalizeEmployeeProfileResponse(response.data)
  },

  async uploadMyProfilePhoto(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await http.post(endpoints.employee.profile.photo, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return normalizeEmployeeProfileResponse(response.data)
  },

  async uploadEmployeeDocument({ documentType, name, file }) {
    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('name', name)
    formData.append('file', file)

    const response = await http.post(endpoints.employee.profile.documents, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return normalizeEmployeeProfileResponse(response.data)
  },

  async listEmployeeDocuments(employeeUid) {
    const response = await http.get(endpoints.employeeDocuments.byEmployee(employeeUid))
    const items = Array.isArray(response.data?.items) ? response.data.items : []
    return items.map((item) => normalizeEmployeeDocumentRecord(item))
  },

  async deleteEmployeeDocument(documentUid) {
    await http.delete(endpoints.employeeDocuments.detail(documentUid))
    return documentUid
  },

  async getEmployeeProfile(employeeUid) {
    const response = await http.get(endpoints.employee.profile.byEmployee(employeeUid))
    return normalizeEmployeeProfileResponse(response.data)
  },

  async getProfileRequests() {
    const response = await http.get(endpoints.employee.requests.list)
    return (Array.isArray(response.data) ? response.data : []).map(normalizeProfileRequest)
  },

  async updateProfileEditLock(employeeUid, canEditProfileDetails) {
    const response = await http.put(endpoints.employee.requests.editLock(employeeUid), {
      can_edit_profile_details: Boolean(canEditProfileDetails)
    })
    return normalizeProfileRequest(response.data)
  }
}
