import { http } from '../http.js'
import { endpoints } from '../endpoints.js'

const DEFAULT_ROLE_MODULES = [
  'Roles',
  'Employee',
  'Employee Documents',
  'Employee Skills',
  'Shift Roster',
  'Assign Shift',
  'Employee Leave Balance',
  'Employee Metadata',
  'Holiday Calendar',
  'Leave Request',
  'Leave Type',
  'Attendance',
  'Attendance Punch Log',
  'Attendance Regularization Logs',
  'Attendance Regularization',
]

function normalizeMetadataEntry(record) {
  if (!record) return null
  return {
    uid: record.uid || record.id || null,
    category: record.category || '',
    value: record.value || '',
    label: record.label || record.value || '',
    description: record.description || '',
    isActive: Boolean(record.is_active ?? record.isActive ?? true),
    sortOrder: Number(record.sort_order ?? record.sortOrder ?? 0),
    createdAt: record.created_at || record.createdAt || null,
    updatedAt: record.updated_at || record.updatedAt || null
  }
}

function normalizeRoleEntry(record) {
  if (!record) return null
  return {
    uid: record.id || record.uid || null,
    roleName: record.role_name || record.roleName || '',
    description: record.description || '',
    access: record.access || {}
  }
}

function normalizeRoleModules(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .filter(Boolean)
    .map((moduleName) => String(moduleName).trim())
    .filter(Boolean)))
}

export const metadataService = {
  async getEntries() {
    const response = await http.get(endpoints.employeeMetadata.list)
    return (Array.isArray(response.data) ? response.data : []).map(normalizeMetadataEntry).filter(Boolean)
  },

  async createEntry(payload) {
    const response = await http.post(endpoints.employeeMetadata.create, {
      category: payload.category,
      value: payload.value,
      label: payload.label,
      description: payload.description || null,
      is_active: payload.isActive ?? true,
      sort_order: Number(payload.sortOrder || 0)
    })
    return normalizeMetadataEntry(response.data)
  },

  async updateEntry(metadataUid, payload) {
    const response = await http.put(endpoints.employeeMetadata.detail(metadataUid), {
      value: payload.value,
      label: payload.label,
      description: payload.description || null,
      is_active: payload.isActive,
      sort_order: Number(payload.sortOrder || 0)
    })
    return normalizeMetadataEntry(response.data)
  },

  async deleteEntry(metadataUid) {
    await http.delete(endpoints.employeeMetadata.detail(metadataUid))
    return metadataUid
  },

  async getRoles() {
    const response = await http.get(endpoints.roles.list)
    return (Array.isArray(response.data) ? response.data : []).map(normalizeRoleEntry).filter(Boolean)
  },

  async getRoleModules() {
    try {
      const response = await http.get(endpoints.roles.modules)
      const modules = normalizeRoleModules(response.data)
      return modules.length ? modules : DEFAULT_ROLE_MODULES
    } catch (error) {
      return DEFAULT_ROLE_MODULES
    }
  },

  async createRole(payload) {
    const response = await http.post(endpoints.roles.create, {
      role_name: payload.roleName,
      description: payload.description || null,
      access: payload.access || {}
    })
    return normalizeRoleEntry(response.data)
  },

  async updateRole(roleUid, payload) {
    const response = await http.put(endpoints.roles.detail(roleUid), {
      role_name: payload.roleName,
      description: payload.description || null,
      access: payload.access || {}
    })
    return normalizeRoleEntry(response.data)
  },

  async deleteRole(roleUid) {
    await http.delete(endpoints.roles.detail(roleUid))
    return roleUid
  }
}
