import { http } from '../http.js'
import { endpoints } from '../endpoints.js'

const PROJECT_PAGE_LIMIT = 100
const PROJECT_ASSIGNMENT_PAGE_LIMIT = 100
const PROJECT_TASK_PAGE_LIMIT = 100

function toNullableString(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function toNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function toBoundedInteger(value, { fallback = null, min = null, max = null } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  if (min != null && parsed < min) return fallback
  if (max != null && parsed > max) return fallback
  return parsed
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

function normalizeProjectAssignment(record = {}) {
  const uid = String(record?.uid || '').trim()
  if (!uid) return null

  return {
    uid,
    createdBy: record?.created_by || record?.createdBy || '',
    projectUid: String(record?.project_uid || record?.projectUid || '').trim(),
    employeeUid: String(record?.employee_uid || record?.employeeUid || '').trim(),
    assignedFrom: record?.assigned_from || record?.assignedFrom || '',
    assignedTo: record?.assigned_to || record?.assignedTo || '',
    podName: String(record?.pod_name || record?.podName || '').trim(),
    teamLead: String(record?.team_lead || record?.teamLead || '').trim(),
    allocationPercentage: toBoundedInteger(record?.allocation_percentage ?? record?.allocationPercentage, {
      fallback: 100,
      min: 1,
      max: 100
    }),
    status: String(record?.status || '').trim(),
    remarks: String(record?.remarks || '').trim(),
    createdAt: record?.created_at || record?.createdAt || null,
    updatedAt: record?.updated_at || record?.updatedAt || null
  }
}

function normalizeProjectTask(record = {}) {
  const uid = String(record?.uid || '').trim()
  if (!uid) return null

  return {
    uid,
    createdBy: record?.created_by || record?.createdBy || '',
    projectUid: String(record?.project_uid || record?.projectUid || '').trim(),
    employeeUid: String(record?.employee_uid || record?.employeeUid || '').trim(),
    projectAssignmentUid: String(record?.project_assignment_uid || record?.projectAssignmentUid || '').trim(),
    taskDate: record?.task_date || record?.taskDate || '',
    hourWork: toNonNegativeInteger(record?.hour_work ?? record?.hourWork, 0),
    taskCompleted: toNonNegativeInteger(record?.task_completed ?? record?.taskCompleted, 0),
    taskInprogress: toNonNegativeInteger(record?.task_inprogress ?? record?.taskInprogress, 0),
    taskRework: toNonNegativeInteger(record?.task_rework ?? record?.taskRework, 0),
    taskApproved: toNonNegativeInteger(record?.task_approved ?? record?.taskApproved, 0),
    taskRejected: toNonNegativeInteger(record?.task_rejected ?? record?.taskRejected, 0),
    taskReviewed: toNonNegativeInteger(record?.task_reviewed ?? record?.taskReviewed, 0),
    remarks: String(record?.remarks || '').trim(),
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

function toProjectAssignmentApiPayload(payload = {}) {
  return {
    project_uid: String(payload.projectUid || '').trim(),
    employee_uid: String(payload.employeeUid || '').trim(),
    assigned_from: toNullableString(payload.assignedFrom),
    assigned_to: toNullableString(payload.assignedTo),
    pod_name: toNullableString(payload.podName),
    team_lead: toNullableString(payload.teamLead),
    allocation_percentage: toBoundedInteger(payload.allocationPercentage, {
      fallback: 100,
      min: 1,
      max: 100
    }),
    status: toNullableString(payload.status),
    remarks: toNullableString(payload.remarks)
  }
}

function toProjectTaskApiPayload(payload = {}) {
  return {
    project_uid: String(payload.projectUid || '').trim(),
    employee_uid: String(payload.employeeUid || '').trim(),
    project_assignment_uid: toNullableString(payload.projectAssignmentUid),
    task_date: toNullableString(payload.taskDate),
    hour_work: toNonNegativeInteger(payload.hourWork, 0),
    task_completed: toNonNegativeInteger(payload.taskCompleted, 0),
    task_inprogress: toNonNegativeInteger(payload.taskInprogress, 0),
    task_rework: toNonNegativeInteger(payload.taskRework, 0),
    task_approved: toNonNegativeInteger(payload.taskApproved, 0),
    task_rejected: toNonNegativeInteger(payload.taskRejected, 0),
    task_reviewed: toNonNegativeInteger(payload.taskReviewed, 0),
    remarks: toNullableString(payload.remarks)
  }
}

async function listProjectCollection({
  listMethod,
  search = '',
  status = '',
  projectUid = '',
  employeeUid = '',
  projectAssignmentUid = '',
  taskDate = '',
  fromDate = '',
  toDate = '',
  pageLimit = 100
} = {}) {
  let skip = 0
  let total = 0
  const records = []

  while (true) {
    const page = await listMethod({
      search,
      status,
      projectUid,
      employeeUid,
      projectAssignmentUid,
      taskDate,
      fromDate,
      toDate,
      skip,
      limit: pageLimit
    })

    if (!records.length) total = page.total

    records.push(...page.items)
    skip += page.items.length

    if (!page.items.length || records.length >= page.total || page.items.length < pageLimit) {
      break
    }
  }

  return {
    items: records,
    total: total || records.length
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
    return listProjectCollection({
      listMethod: projectService.listProjects,
      search,
      status,
      pageLimit: PROJECT_PAGE_LIMIT
    })
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
  },

  async listProjectAssignments({ search = '', projectUid = '', employeeUid = '', status = '', skip = 0, limit = PROJECT_ASSIGNMENT_PAGE_LIMIT } = {}) {
    const response = await http.get(endpoints.projectAssignment.list, {
      params: {
        search: search || undefined,
        project_uid: projectUid || undefined,
        employee_uid: employeeUid || undefined,
        status: status || undefined,
        skip: Number(skip) || 0,
        limit: Math.min(Math.max(Number(limit) || PROJECT_ASSIGNMENT_PAGE_LIMIT, 1), PROJECT_ASSIGNMENT_PAGE_LIMIT)
      }
    })

    const items = Array.isArray(response.data?.items)
      ? response.data.items.map((entry) => normalizeProjectAssignment(entry)).filter(Boolean)
      : []
    const total = Number(response.data?.total ?? items.length) || items.length

    return { items, total }
  },

  async listAllProjectAssignments({ search = '', projectUid = '', employeeUid = '', status = '' } = {}) {
    return listProjectCollection({
      listMethod: projectService.listProjectAssignments,
      search,
      status,
      projectUid,
      employeeUid,
      pageLimit: PROJECT_ASSIGNMENT_PAGE_LIMIT
    })
  },

  async createProjectAssignment(payload) {
    const response = await http.post(endpoints.projectAssignment.create, toProjectAssignmentApiPayload(payload))
    return normalizeProjectAssignment(response.data)
  },

  async updateProjectAssignment(assignmentUid, payload) {
    const response = await http.put(endpoints.projectAssignment.detail(assignmentUid), toProjectAssignmentApiPayload(payload))
    return normalizeProjectAssignment(response.data)
  },

  async deleteProjectAssignment(assignmentUid) {
    await http.delete(endpoints.projectAssignment.detail(assignmentUid))
    return assignmentUid
  },

  async listProjectTasks({
    search = '',
    projectUid = '',
    employeeUid = '',
    projectAssignmentUid = '',
    taskDate = '',
    fromDate = '',
    toDate = '',
    skip = 0,
    limit = PROJECT_TASK_PAGE_LIMIT
  } = {}) {
    const response = await http.get(endpoints.projectTask.list, {
      params: {
        search: search || undefined,
        project_uid: projectUid || undefined,
        employee_uid: employeeUid || undefined,
        project_assignment_uid: projectAssignmentUid || undefined,
        task_date: taskDate || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        skip: Number(skip) || 0,
        limit: Math.min(Math.max(Number(limit) || PROJECT_TASK_PAGE_LIMIT, 1), PROJECT_TASK_PAGE_LIMIT)
      }
    })

    const items = Array.isArray(response.data?.items)
      ? response.data.items.map((entry) => normalizeProjectTask(entry)).filter(Boolean)
      : []
    const total = Number(response.data?.total ?? items.length) || items.length

    return { items, total }
  },

  async listAllProjectTasks({
    search = '',
    projectUid = '',
    employeeUid = '',
    projectAssignmentUid = '',
    taskDate = '',
    fromDate = '',
    toDate = ''
  } = {}) {
    return listProjectCollection({
      listMethod: projectService.listProjectTasks,
      search,
      projectUid,
      employeeUid,
      projectAssignmentUid,
      taskDate,
      fromDate,
      toDate,
      pageLimit: PROJECT_TASK_PAGE_LIMIT
    })
  },

  async createProjectTask(payload) {
    const response = await http.post(endpoints.projectTask.create, toProjectTaskApiPayload(payload))
    return normalizeProjectTask(response.data)
  },

  async updateProjectTask(taskUid, payload) {
    const response = await http.put(endpoints.projectTask.detail(taskUid), toProjectTaskApiPayload(payload))
    return normalizeProjectTask(response.data)
  },

  async deleteProjectTask(taskUid) {
    await http.delete(endpoints.projectTask.detail(taskUid))
    return taskUid
  }
}