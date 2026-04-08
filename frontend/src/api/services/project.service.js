import { http } from '../http.js'
import { endpoints } from '../endpoints.js'

const PROJECT_PAGE_LIMIT = 100

function toNullableString(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function normalizeProject(record = {}) {
  const projectCode = String(record?.project_code || record?.projectCode || '').trim()
  const projectName = String(record?.project_name || record?.projectName || '').trim()

  if (!projectCode || !projectName) return null

  return {
    uid: record?.uid || '',
    createdBy: record?.created_by || record?.createdBy || '',
    projectCode,
    projectName,
    description: String(record?.description || '').trim(),
    startDate: record?.start_date || record?.startDate || '',
    endDate: record?.end_date || record?.endDate || '',
    status: String(record?.status || '').trim(),
    createdAt: record?.created_at || record?.createdAt || null,
    updatedAt: record?.updated_at || record?.updatedAt || null
  }
}

function toProjectApiPayload(payload = {}) {
  return {
    project_code: String(payload.projectCode || '').trim(),
    project_name: String(payload.projectName || '').trim(),
    description: toNullableString(payload.description),
    start_date: toNullableString(payload.startDate),
    end_date: toNullableString(payload.endDate),
    status: toNullableString(payload.status)
  }
}

export const projectService = {
  async listProjects({ search = '', status = '', skip = 0, limit = PROJECT_PAGE_LIMIT } = {}) {
    const response = await http.get(endpoints.project.list, {
      params: {
        search: search || undefined,
        status: status || undefined,
        skip: Number(skip) || 0,
        limit: Math.min(Math.max(Number(limit) || PROJECT_PAGE_LIMIT, 1), PROJECT_PAGE_LIMIT)
      }
    })

    const items = Array.isArray(response.data?.items)
      ? response.data.items.map((entry) => normalizeProject(entry)).filter(Boolean)
      : []
    const total = Number(response.data?.total ?? items.length) || items.length

    return { items, total }
  },

  async listAllProjects({ search = '', status = '' } = {}) {
    let skip = 0
    let total = 0
    const records = []

    while (true) {
      const page = await projectService.listProjects({ search, status, skip, limit: PROJECT_PAGE_LIMIT })
      if (!records.length) total = page.total

      records.push(...page.items)
      skip += page.items.length

      if (!page.items.length || records.length >= page.total || page.items.length < PROJECT_PAGE_LIMIT) {
        break
      }
    }

    return {
      items: records,
      total: total || records.length
    }
  },

  async createProject(payload) {
    const response = await http.post(endpoints.project.create, toProjectApiPayload(payload))
    return normalizeProject(response.data)
  },

  async updateProject(projectUid, payload) {
    const response = await http.put(endpoints.project.detail(projectUid), toProjectApiPayload(payload))
    return normalizeProject(response.data)
  },

  async deleteProject(projectUid) {
    await http.delete(endpoints.project.detail(projectUid))
    return projectUid
  }
}
