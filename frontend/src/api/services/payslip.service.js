import { http } from '../http.js'
import { endpoints } from '../endpoints.js'

function toOptionalInteger(value, { min = null, max = null } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return undefined
  if (min != null && parsed < min) return undefined
  if (max != null && parsed > max) return undefined
  return parsed
}

function normalizePayslip(record = {}) {
  const uid = String(record?.uid || '').trim()
  if (!uid) return null

  return {
    uid,
    createdBy: record?.created_by || record?.createdBy || '',
    employeeUid: String(record?.employee_uid || record?.employeeUid || '').trim(),
    salaryMonth: toOptionalInteger(record?.salary_month ?? record?.salaryMonth, { min: 1, max: 12 }) || null,
    salaryYear: toOptionalInteger(record?.salary_year ?? record?.salaryYear, { min: 2000, max: 2100 }) || null,
    originalFilename: String(record?.original_filename || record?.originalFilename || '').trim(),
    fileUrl: String(record?.file_url || record?.fileUrl || '').trim(),
    cloudinaryPublicId: String(record?.cloudinary_public_id || record?.cloudinaryPublicId || '').trim(),
    fileFormat: String(record?.file_format || record?.fileFormat || 'pdf').trim(),
    fileSize: Number(record?.file_size ?? record?.fileSize ?? 0) || 0,
    createdAt: record?.created_at || record?.createdAt || null,
    updatedAt: record?.updated_at || record?.updatedAt || null
  }
}

function normalizePayslipList(responseData = {}) {
  const items = Array.isArray(responseData?.items)
    ? responseData.items.map((entry) => normalizePayslip(entry)).filter(Boolean)
    : []
  const total = Number(responseData?.total ?? items.length) || items.length
  return { items, total }
}

export const payslipService = {
  async listAllPayslips({ employeeUid = '', month = '', year = '' } = {}) {
    const response = await http.get(endpoints.payslip.all, {
      params: {
        employee_uid: String(employeeUid || '').trim() || undefined,
        month: toOptionalInteger(month, { min: 1, max: 12 }),
        year: toOptionalInteger(year, { min: 2000, max: 2100 })
      }
    })

    return normalizePayslipList(response.data)
  },

  async listMyPayslips({ month = '', year = '' } = {}) {
    const response = await http.get(endpoints.payslip.my, {
      params: {
        month: toOptionalInteger(month, { min: 1, max: 12 }),
        year: toOptionalInteger(year, { min: 2000, max: 2100 })
      }
    })

    return normalizePayslipList(response.data)
  },

  async uploadPayslip({ employeeUid, month, year, file }) {
    const formData = new FormData()
    formData.append('employee_uid', String(employeeUid || '').trim())
    formData.append('month', String(month || '').trim())
    formData.append('year', String(year || '').trim())
    formData.append('file', file)

    const response = await http.post(endpoints.payslip.upload, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return normalizePayslip(response.data?.data || response.data)
  },

  async deletePayslip(payslipUid) {
    await http.delete(endpoints.payslip.detail(payslipUid))
    return payslipUid
  },

  async downloadPayslip(payslipUid) {
    const response = await http.get(endpoints.payslip.download(payslipUid), {
      responseType: 'blob',
      timeout: 60000
    })

    return response.data
  }
}
