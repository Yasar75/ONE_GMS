import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import { dedupePermissionModules, ROLE_MATRIX_MODULES } from '../../utils/permissions.js'

function parsePositionMetadataDescription(category, rawDescription, rawDepartmentUid) {
  const fallbackDescription = String(rawDescription || '')
  const normalizedDepartmentUid = String(rawDepartmentUid || '').trim()

  if (category !== 'position') {
    return {
      description: fallbackDescription,
      departmentUid: normalizedDepartmentUid || null
    }
  }

  if (normalizedDepartmentUid) {
    return {
      description: fallbackDescription,
      departmentUid: normalizedDepartmentUid
    }
  }

  const trimmedDescription = fallbackDescription.trim()
  if (!trimmedDescription.startsWith('{')) {
    return {
      description: fallbackDescription,
      departmentUid: null
    }
  }

  try {
    const parsed = JSON.parse(trimmedDescription)
    if (!parsed || typeof parsed !== 'object') {
      return {
        description: fallbackDescription,
        departmentUid: null
      }
    }

    const parsedDepartmentUid = String(parsed.departmentUid || parsed.department_uid || '').trim()
    const parsedKind = String(parsed.kind || parsed.type || '').trim().toLowerCase()

    if (!parsedDepartmentUid && !['position-mapping', 'position_mapping'].includes(parsedKind)) {
      return {
        description: fallbackDescription,
        departmentUid: null
      }
    }

    return {
      description: typeof parsed.note === 'string'
        ? parsed.note
        : (typeof parsed.description === 'string' ? parsed.description : ''),
      departmentUid: parsedDepartmentUid || null
    }
  } catch {
    return {
      description: fallbackDescription,
      departmentUid: null
    }
  }
}

function serializeMetadataDescription(payload = {}) {
  const description = String(payload.description || '').trim()

  if (payload.category !== 'position') {
    return description || null
  }

  const departmentUid = String(payload.departmentUid || '').trim()
  if (!departmentUid) return description || null

  return JSON.stringify({
    kind: 'position-mapping',
    departmentUid,
    note: description
  })
}

function normalizeMetadataEntry(record) {
  if (!record) return null
  const normalizedCategory = record.category || ''
  const parsedDescription = parsePositionMetadataDescription(
    normalizedCategory,
    record.description,
    record.department_uid || record.departmentUid || null
  )

  return {
    uid: record.uid || record.id || null,
    category: normalizedCategory,
    value: record.value || record.label || '',
    label: record.label || record.value || '',
    description: parsedDescription.description,
    departmentUid: parsedDescription.departmentUid,
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
  const normalizedModules = dedupePermissionModules(Array.isArray(value) ? value : [])
  return normalizedModules.length ? normalizedModules : dedupePermissionModules(ROLE_MATRIX_MODULES)
}

export const metadataService = {
  async getEntries() {
    const response = await http.get(endpoints.employeeMetadata.list)
    return (Array.isArray(response.data) ? response.data : []).map(normalizeMetadataEntry).filter(Boolean)
  },

  async createEntry(payload) {
    const response = await http.post(endpoints.employeeMetadata.create, {
      category: payload.category,
      label: payload.label,
      value: payload.label,
      description: serializeMetadataDescription(payload),
      is_active: payload.isActive ?? true,
      sort_order: Number(payload.sortOrder || 0)
    })
    return normalizeMetadataEntry(response.data)
  },

  async updateEntry(metadataUid, payload) {
    const response = await http.put(endpoints.employeeMetadata.detail(metadataUid), {
      label: payload.label,
      value: payload.label,
      description: serializeMetadataDescription(payload),
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
      return normalizeRoleModules(response.data)
    } catch (error) {
      return dedupePermissionModules(ROLE_MATRIX_MODULES)
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
