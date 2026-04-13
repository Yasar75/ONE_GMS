import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import AppDateRangeField from '../../../components/common/AppDateRangeField.jsx'
import { DownloadIcon, ExportIcon, FilterIcon, ImportIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from '../../../components/common/AppIcons.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { AttendanceTabs } from '../../attendance/components/AttendanceShared.jsx'

import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { useProjectsQuery, PROJECTS_QUERY_KEY } from '../../../hooks/project/useProjectsQuery.js'
import { useProjectAssignmentsQuery, PROJECT_ASSIGNMENTS_QUERY_KEY } from '../../../hooks/project/useProjectAssignmentsQuery.js'
import { useProjectTasksQuery, PROJECT_TASKS_QUERY_KEY } from '../../../hooks/project/useProjectTasksQuery.js'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'

import { projectService } from '../../../api/services/project.service.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  filterAccessibleTabs,
  hasModulePermission,
  hasModuleVisibility,
  resolveAccessibleTab
} from '../../../utils/permissions.js'
import { isIsoDateInput, normalizeDateInput } from '../../../utils/employee.js'
import {
  downloadProjectImportTemplateCsv,
  downloadProjectImportTemplateExcel,
  downloadProjectsAsCsv,
  downloadProjectsAsExcel,
  downloadTaskImportTemplateCsv,
  downloadTaskImportTemplateExcel,
  downloadTasksAsCsv,
  downloadTasksAsExcel,
  parseProjectManagementImportFile,
  pickImportValue
} from '../../../utils/projectManagement.js'
import { filterCollectionByQuery } from '../../../utils/search.js'
import { getDateRangeValidationMessage, getRequiredFieldMessage, hasValidationErrors, markFieldsTouched } from '../../../utils/validation.js'

const PROJECT_TAB_ITEMS = [
  { key: 'projects', label: 'Projects', helper: 'Create and maintain project records' },
  { key: 'assignments', label: 'Project Assignment', helper: 'Map employees to projects through backend APIs' }
]

const TASK_TAB_ITEMS = [
  { key: 'tasks', label: 'Task Management', helper: 'Manage tasks through Project-Task APIs' }
]

const PROJECT_STATUS_OPTIONS = ['Draft', 'Planned', 'Active', 'On Hold', 'Completed', 'Terminated']
const ASSIGNMENT_STATUS_OPTIONS = ['Assigned', 'Active', 'Released', 'Hold', 'Completed', 'Terminated', 'Inactive']
const PROJECT_REQUIRED_FIELDS = ['projectCode', 'projectName']
const ASSIGNMENT_REQUIRED_FIELDS = ['projectUid', 'employeeUid']
const TASK_REQUIRED_FIELDS = ['employeeUid', 'projectUid', 'taskDate']
const TASK_DEFAULT_STANDARD_HOURS = 8
const PROJECT_TIMELINE_FILTER_OPTIONS = [
  { value: 'All', label: 'All timelines', description: 'No filter applied' },
  { value: 'Upcoming', label: 'Upcoming', description: 'Starts after today' },
  { value: 'Ongoing', label: 'Ongoing', description: 'Within active timeline' },
  { value: 'Ended', label: 'Ended', description: 'Ended before today' },
  { value: 'No Schedule', label: 'No schedule', description: 'Missing timeline dates' }
]
const PROJECT_ASSIGNMENT_COVERAGE_FILTER_OPTIONS = [
  { value: 'All', label: 'All assignment coverage', description: 'No filter applied' },
  { value: 'Assigned', label: 'Assigned projects', description: 'Has one or more assignments' },
  { value: 'Unassigned', label: 'Unassigned projects', description: 'No assignments mapped' },
  { value: 'Active Assignments', label: 'Active assignments', description: 'At least one active/billable assignment' },
  { value: 'Multi Employee', label: 'Multiple employees', description: 'Mapped to more than one employee' }
]
const PROJECT_TASK_COVERAGE_FILTER_OPTIONS = [
  { value: 'All', label: 'All task coverage', description: 'No filter applied' },
  { value: 'With Tasks', label: 'With tasks', description: 'Has task entries' },
  { value: 'No Tasks', label: 'No tasks', description: 'No task entries' },
  { value: 'Hours Logged', label: 'Hours logged', description: 'Has logged work hours' },
  { value: 'No Hours', label: 'No hours', description: 'No logged work hours' }
]
const TASK_HOURS_FILTER_OPTIONS = [
  { value: 'All', label: 'All hours', description: 'No filter applied' },
  { value: 'Standard', label: 'Standard (<=8)', description: 'Up to standard workday hours' },
  { value: 'Overtime', label: 'Overtime (>8)', description: 'More than standard workday hours' },
  { value: 'Zero Hours', label: 'Zero hours', description: 'No logged hours' },
  { value: 'Logged Hours', label: 'Logged hours', description: 'At least one hour logged' }
]
const TASK_REVIEW_FILTER_OPTIONS = [
  { value: 'All', label: 'All review buckets', description: 'No filter applied' },
  { value: 'Rejected', label: 'Rejected', description: 'Rejected volume is present' },
  { value: 'Approved', label: 'Approved', description: 'Approved volume is present' },
  { value: 'Reviewed', label: 'Reviewed', description: 'Reviewed volume is present' },
  { value: 'Rework', label: 'Rework', description: 'Rework volume is present' },
  { value: 'In Progress', label: 'In Progress', description: 'In progress volume is present' },
  { value: 'Completed', label: 'Completed', description: 'Completed volume is present' },
  { value: 'No Volume', label: 'No volume', description: 'No status volumes logged' }
]
const BILLABLE_ASSIGNMENT_STATUSES = new Set(['assigned', 'active'])
const NON_BILLABLE_ASSIGNMENT_STATUSES = new Set(['released', 'hold', 'terminated', 'inactive', 'completed'])
const TASK_NUMBER_FIELDS = [
  { key: 'hourWork', label: 'Hours worked' },
  { key: 'taskCompleted', label: 'Tasks completed', tone: 'green' },
  { key: 'taskInprogress', label: 'Tasks in progress', tone: 'blue' },
  { key: 'taskRework', label: 'Tasks in rework', tone: 'orange' },
  { key: 'taskApproved', label: 'Tasks approved', tone: 'teal' },
  { key: 'taskRejected', label: 'Tasks rejected', tone: 'red' },
  { key: 'taskReviewed', label: 'Tasks reviewed', tone: 'purple' }
]

const TASK_STATUS_NUMBER_FIELDS = TASK_NUMBER_FIELDS.filter((field) => field.key !== 'hourWork')

function compactUid(value) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return '—'
  return normalizedValue.length > 8 ? `${normalizedValue.slice(0, 8)}…` : normalizedValue
}

function formatDate(value) {
  if (!value) return '—'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return String(value)
  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatDateTime(value) {
  if (!value) return '—'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return String(value)
  return parsedDate.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function parseNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function parseBoundedInteger(value, { min = 1, max = 100, fallback = 100 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < min || parsed > max) return fallback
  return parsed
}

function parseApiError(error, fallbackMessage) {
  return error?.response?.data?.detail || error?.message || fallbackMessage
}

function toIsoDateString(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayIsoDate() {
  return toIsoDateString(new Date())
}

function normalizeAssignmentStatus(value) {
  return String(value || '').trim().toLowerCase()
}

function resolveBillingStatus(assignmentStatuses = []) {
  const normalizedStatuses = Array.from(new Set((Array.isArray(assignmentStatuses) ? assignmentStatuses : [])
    .map(normalizeAssignmentStatus)
    .filter(Boolean)))

  if (normalizedStatuses.some((status) => BILLABLE_ASSIGNMENT_STATUSES.has(status))) {
    return 'Billable'
  }

  if (normalizedStatuses.length && normalizedStatuses.every((status) => NON_BILLABLE_ASSIGNMENT_STATUSES.has(status))) {
    return 'Non Billable'
  }

  return 'Non Billable'
}

function toBillingStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'billable') return 'green'
  if (normalized === 'non billable' || normalized === 'nonbillable') return 'red'
  return 'gray'
}

function parseStrictWholeNumber(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!/^-?\d+$/.test(raw)) return Number.NaN
  return Number.parseInt(raw, 10)
}

function parseYesNoBoolean(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return false
  return ['1', 'true', 'yes', 'y'].includes(raw)
}

function isAssignmentActiveForDate(assignment, taskDateValue = '') {
  if (!assignment) return false

  const normalizedTaskDate = String(taskDateValue || '').trim()
  if (!normalizedTaskDate) {
    const status = normalizeAssignmentStatus(assignment.status)
    return BILLABLE_ASSIGNMENT_STATUSES.has(status)
  }

  const assignedFrom = String(assignment.assignedFrom || '').trim()
  const assignedTo = String(assignment.assignedTo || '').trim()
  if (assignedFrom && assignedFrom > normalizedTaskDate) return false
  if (assignedTo && assignedTo < normalizedTaskDate) return false
  return true
}

function resolveTaskAssignmentUid(assignments = [], { employeeUid = '', projectUid = '', taskDate = '', preferredUid = '' } = {}) {
  const normalizedEmployeeUid = String(employeeUid || '').trim()
  const normalizedProjectUid = String(projectUid || '').trim()
  if (!normalizedEmployeeUid || !normalizedProjectUid) return ''

  const compatibleAssignments = (Array.isArray(assignments) ? assignments : [])
    .filter((assignment) => (
      String(assignment.employeeUid || '') === normalizedEmployeeUid
        && String(assignment.projectUid || '') === normalizedProjectUid
        && String(assignment.uid || '').trim()
    ))

  if (!compatibleAssignments.length) return ''

  const normalizedPreferredUid = String(preferredUid || '').trim()
  if (normalizedPreferredUid && compatibleAssignments.some((assignment) => String(assignment.uid || '') === normalizedPreferredUid)) {
    return normalizedPreferredUid
  }

  const dateScopedAssignments = compatibleAssignments.filter((assignment) => isAssignmentActiveForDate(assignment, taskDate))
  const pool = dateScopedAssignments.length ? dateScopedAssignments : compatibleAssignments

  const sorted = [...pool].sort((left, right) => {
    const leftStatusRank = BILLABLE_ASSIGNMENT_STATUSES.has(normalizeAssignmentStatus(left.status)) ? 1 : 0
    const rightStatusRank = BILLABLE_ASSIGNMENT_STATUSES.has(normalizeAssignmentStatus(right.status)) ? 1 : 0
    if (leftStatusRank !== rightStatusRank) return rightStatusRank - leftStatusRank

    const leftAssignedFrom = Date.parse(left.assignedFrom || '') || 0
    const rightAssignedFrom = Date.parse(right.assignedFrom || '') || 0
    if (leftAssignedFrom !== rightAssignedFrom) return rightAssignedFrom - leftAssignedFrom

    const leftUpdated = Date.parse(left.updatedAt || left.createdAt || '') || 0
    const rightUpdated = Date.parse(right.updatedAt || right.createdAt || '') || 0
    return rightUpdated - leftUpdated
  })

  return String(sorted[0]?.uid || '')
}

function toProjectStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'active') return 'green'
  if (normalized === 'planned' || normalized === 'draft') return 'blue'
  if (normalized === 'on hold') return 'amber'
  if (normalized === 'completed') return 'teal'
  if (normalized === 'terminated') return 'red'
  return 'gray'
}

function toAssignmentStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'assigned' || normalized === 'active') return 'green'
  if (normalized === 'completed') return 'teal'
  if (normalized === 'released' || normalized === 'hold' || normalized === 'inactive') return 'amber'
  if (normalized === 'terminated') return 'red'
  return 'gray'
}

function resolveProjectTimelineBucket(project, todayIsoDate) {
  const startDate = String(project?.startDate || '').trim()
  const endDate = String(project?.endDate || '').trim()

  if (!startDate && !endDate) return 'No Schedule'
  if (startDate && startDate > todayIsoDate) return 'Upcoming'
  if (endDate && endDate < todayIsoDate) return 'Ended'
  if (startDate && startDate <= todayIsoDate && (!endDate || endDate >= todayIsoDate)) return 'Ongoing'
  return 'No Schedule'
}

function isDateInRange(dateValue, range) {
  if (!dateValue) return !range?.start && !range?.end
  const normalizedValue = String(dateValue || '').trim()
  if (range?.start && normalizedValue < String(range.start)) return false
  if (range?.end && normalizedValue > String(range.end)) return false
  return true
}

function resolveTaskReviewBucket(task) {
  if (Number(task?.taskRejected || 0) > 0) return 'Rejected'
  if (Number(task?.taskApproved || 0) > 0) return 'Approved'
  if (Number(task?.taskReviewed || 0) > 0) return 'Reviewed'
  if (Number(task?.taskRework || 0) > 0) return 'Rework'
  if (Number(task?.taskInprogress || 0) > 0) return 'In Progress'
  if (Number(task?.taskCompleted || 0) > 0) return 'Completed'
  return 'No Volume'
}

function createProjectDraft(project = null) {
  const todayIsoDate = getTodayIsoDate()
  const initialStartDate = project
    ? (normalizeDateInput(project?.startDate || '') || '')
    : todayIsoDate
  const initialEndDate = normalizeDateInput(project?.endDate || '')

  return {
    projectCode: project?.projectCode || '',
    projectName: project?.projectName || '',
    description: project?.description || '',
    startDate: initialStartDate,
    endDate: initialEndDate,
    isInactive: Boolean(initialEndDate),
    status: project?.status || ''
  }
}

function createAssignmentDraft(assignment = null) {
  return {
    projectUid: assignment?.projectUid || '',
    employeeUid: assignment?.employeeUid || '',
    assignedFrom: assignment?.assignedFrom || '',
    assignedTo: assignment?.assignedTo || '',
    podName: assignment?.podName || '',
    teamLead: assignment?.teamLead || '',
    allocationPercentage: String(assignment?.allocationPercentage ?? 100),
    status: assignment?.status || '',
    remarks: assignment?.remarks || ''
  }
}

function createTaskDraft(task = null) {
  const todayIsoDate = getTodayIsoDate()
  const resolvedHourWork = parseNonNegativeInteger(task?.hourWork, TASK_DEFAULT_STANDARD_HOURS)
  const normalizedTaskDate = normalizeDateInput(task?.taskDate || todayIsoDate)

  return {
    projectUid: task?.projectUid || '',
    employeeUid: task?.employeeUid || '',
    projectAssignmentUid: task?.projectAssignmentUid || '',
    taskDate: normalizedTaskDate || todayIsoDate,
    hourWork: String(resolvedHourWork),
    overtime: resolvedHourWork > TASK_DEFAULT_STANDARD_HOURS,
    taskCompleted: String(task?.taskCompleted ?? 0),
    taskInprogress: String(task?.taskInprogress ?? 0),
    taskRework: String(task?.taskRework ?? 0),
    taskApproved: String(task?.taskApproved ?? 0),
    taskRejected: String(task?.taskRejected ?? 0),
    taskReviewed: String(task?.taskReviewed ?? 0),
    remarks: task?.remarks || ''
  }
}

function buildProjectErrors(draft) {
  const endDateRequired = draft.isInactive ? getRequiredFieldMessage(draft.endDate, 'End date') : ''
  const endDateRange = draft.isInactive
    ? getDateRangeValidationMessage(draft.startDate, draft.endDate, {
      startLabel: 'Start date',
      endLabel: 'End date'
    })
    : ''

  return {
    projectCode: getRequiredFieldMessage(draft.projectCode, 'Project code'),
    projectName: getRequiredFieldMessage(draft.projectName, 'Project name'),
    endDate: endDateRequired || endDateRange
  }
}

function buildAssignmentErrors(draft) {
  const allocationRaw = String(draft.allocationPercentage ?? '').trim()
  let allocationError = ''
  if (!allocationRaw) allocationError = 'Allocation percentage is required.'
  else if (!Number.isInteger(Number(allocationRaw))) allocationError = 'Allocation percentage must be a whole number.'
  else if (Number(allocationRaw) < 1 || Number(allocationRaw) > 100) allocationError = 'Allocation percentage must be between 1 and 100.'

  return {
    projectUid: getRequiredFieldMessage(draft.projectUid, 'Project'),
    employeeUid: getRequiredFieldMessage(draft.employeeUid, 'Employee'),
    assignedTo: getDateRangeValidationMessage(draft.assignedFrom, draft.assignedTo, {
      startLabel: 'Assigned from date',
      endLabel: 'Assigned to date'
    }),
    allocationPercentage: allocationError
  }
}

function buildTaskErrors(draft) {
  const todayIsoDate = getTodayIsoDate()
  const errors = {
    employeeUid: getRequiredFieldMessage(draft.employeeUid, 'Employee'),
    projectUid: getRequiredFieldMessage(draft.projectUid, 'Project'),
    taskDate: getRequiredFieldMessage(draft.taskDate, 'Task date')
  }

  if (!errors.taskDate && draft.taskDate && String(draft.taskDate) > todayIsoDate) {
    errors.taskDate = 'Task date cannot be in the future.'
  }

  TASK_NUMBER_FIELDS.forEach(({ key, label }) => {
    const raw = String(draft?.[key] ?? '').trim()
    if (!raw) {
      errors[key] = ''
      return
    }

    const numeric = Number(raw)
    if (!Number.isInteger(numeric)) {
      errors[key] = `${label} must be a whole number.`
      return
    }

    if (numeric < 0) {
      errors[key] = `${label} cannot be negative.`
      return
    }

    if (key === 'hourWork' && !draft.overtime && numeric > TASK_DEFAULT_STANDARD_HOURS) {
      errors[key] = `Enable Overtime to log more than ${TASK_DEFAULT_STANDARD_HOURS} hours.`
      return
    }

    errors[key] = ''
  })

  return errors
}

function buildProjectOptions(projects = [], withAll = false) {
  const options = (Array.isArray(projects) ? projects : []).map((project) => ({
    value: project.uid,
    label: `${project.projectName} (${project.projectCode})`,
    description: project.status || 'Status not set'
  }))

  if (!withAll) return options
  return [{ value: 'All', label: 'All projects', description: 'No filter applied' }, ...options]
}

function buildEmployeeOptions(employees = [], withAll = false) {
  const options = (Array.isArray(employees) ? employees : [])
    .filter((employee) => String(employee?.uid || '').trim())
    .map((employee) => ({
      value: employee.uid,
      label: `${employee.fullName || 'Unknown employee'} • ${employee.employeeCode || compactUid(employee.uid)}`,
      description: employee.email || employee.department || 'Employee'
    }))

  if (!withAll) return options
  return [{ value: 'All', label: 'All employees', description: 'No filter applied' }, ...options]
}

function buildAssignmentOptions(assignments = [], projectByUid = new Map(), employeeByUid = new Map(), withAll = false) {
  const options = (Array.isArray(assignments) ? assignments : []).map((assignment) => {
    const project = projectByUid.get(String(assignment.projectUid || ''))
    const employee = employeeByUid.get(String(assignment.employeeUid || ''))

    return {
      value: assignment.uid,
      label: `${project?.projectCode || compactUid(assignment.projectUid)} • ${employee?.employeeCode || employee?.fullName || compactUid(assignment.employeeUid)}`,
      description: assignment.status || 'Status not set'
    }
  })

  if (!withAll) return options
  return [{ value: 'All', label: 'All assignments', description: 'No filter applied' }, ...options]
}

function buildProjectImportPayloads(rows = [], projects = []) {
  const existingCodes = new Set((Array.isArray(projects) ? projects : [])
    .map((project) => String(project.projectCode || '').trim().toUpperCase())
    .filter(Boolean))
  const pendingCodes = new Set()
  const payloads = []
  const errors = []

  ;(Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const rowNumber = index + 2
    const projectCode = pickImportValue(row, ['Project Code', 'Code']).trim()
    const projectName = pickImportValue(row, ['Project Name', 'Name']).trim()
    const status = pickImportValue(row, ['Status']).trim()
    const description = pickImportValue(row, ['Description', 'Remarks']).trim()
    const startDateInput = pickImportValue(row, ['Start Date']).trim()
    const endDateInput = pickImportValue(row, ['End Date']).trim()
    const startDate = normalizeDateInput(startDateInput)
    const endDate = normalizeDateInput(endDateInput)
    const normalizedProjectCode = projectCode.toUpperCase()

    if (startDateInput && !isIsoDateInput(startDate)) {
      errors.push(`Row ${rowNumber}: invalid Start Date "${startDateInput}". Use YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or Excel serial date.`)
      return
    }

    if (endDateInput && !isIsoDateInput(endDate)) {
      errors.push(`Row ${rowNumber}: invalid End Date "${endDateInput}". Use YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or Excel serial date.`)
      return
    }

    const requiredChecks = [
      ['Project Code', projectCode],
      ['Project Name', projectName]
    ]
    const missing = requiredChecks.filter(([, value]) => !value).map(([label]) => label)
    if (missing.length) {
      errors.push(`Row ${rowNumber}: missing ${missing.join(', ')}.`)
      return
    }

    if (existingCodes.has(normalizedProjectCode) || pendingCodes.has(normalizedProjectCode)) {
      errors.push(`Row ${rowNumber}: project code ${projectCode} already exists.`)
      return
    }

    if (startDate && endDate && endDate < startDate) {
      errors.push(`Row ${rowNumber}: End Date cannot be earlier than Start Date.`)
      return
    }

    pendingCodes.add(normalizedProjectCode)
    payloads.push({
      projectCode,
      projectName,
      status,
      startDate: startDate || '',
      endDate: endDate || '',
      description
    })
  })

  return { payloads, errors }
}

function buildTaskImportPayloads(rows = [], {
  employees = [],
  projects = [],
  assignments = []
} = {}) {
  const todayIsoDate = getTodayIsoDate()
  const payloads = []
  const errors = []

  const employeeByCode = new Map((Array.isArray(employees) ? employees : [])
    .map((employee) => [String(employee.employeeCode || '').trim().toUpperCase(), employee])
    .filter(([key]) => key))

  const projectUidByCode = new Map((Array.isArray(projects) ? projects : [])
    .map((project) => [String(project.projectCode || '').trim().toUpperCase(), String(project.uid || '')])
    .filter(([key, value]) => key && value))

  const assignmentsByEmployee = new Map()
  ;(Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    const employeeUid = String(assignment.employeeUid || '').trim()
    if (!employeeUid) return
    const bucket = assignmentsByEmployee.get(employeeUid) || []
    bucket.push(assignment)
    assignmentsByEmployee.set(employeeUid, bucket)
  })

  ;(Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const rowNumber = index + 2
    const employeeCodeInput = pickImportValue(row, ['Employee Code']).trim().toUpperCase()
    const projectCodeInput = pickImportValue(row, ['Project Code']).trim().toUpperCase()
    const taskDateInput = pickImportValue(row, ['Task Date', 'Date']).trim()
    const taskDate = normalizeDateInput(taskDateInput || todayIsoDate)
    const remarks = pickImportValue(row, ['Remarks', 'Comment']).trim()

    const overtime = parseYesNoBoolean(pickImportValue(row, ['Overtime']))
    const hourWorkRaw = pickImportValue(row, ['Hours Worked', 'Hours Work', 'Hour Work', 'Hours']).trim()
    const parsedHourWork = hourWorkRaw ? parseStrictWholeNumber(hourWorkRaw) : TASK_DEFAULT_STANDARD_HOURS

    if (!employeeCodeInput) {
      errors.push(`Row ${rowNumber}: Employee Code is required.`)
      return
    }

    const employee = employeeByCode.get(employeeCodeInput)
    if (!employee) {
      errors.push(`Row ${rowNumber}: employee code ${employeeCodeInput} was not found.`)
      return
    }

    if (taskDateInput && !isIsoDateInput(taskDate)) {
      errors.push(`Row ${rowNumber}: invalid Task Date "${taskDateInput}". Use YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, or Excel serial date.`)
      return
    }

    if (!taskDate || !isIsoDateInput(taskDate)) {
      errors.push(`Row ${rowNumber}: Task Date is invalid.`)
      return
    }

    if (taskDate > todayIsoDate) {
      errors.push(`Row ${rowNumber}: Task Date cannot be in the future.`)
      return
    }

    if (!Number.isInteger(parsedHourWork) || parsedHourWork < 0) {
      errors.push(`Row ${rowNumber}: Hours Worked must be a non-negative whole number.`)
      return
    }

    if (!overtime && parsedHourWork > TASK_DEFAULT_STANDARD_HOURS) {
      errors.push(`Row ${rowNumber}: Hours Worked above ${TASK_DEFAULT_STANDARD_HOURS} requires Overtime = Yes.`)
      return
    }

    const employeeAssignments = assignmentsByEmployee.get(String(employee.uid || '')) || []
    if (!employeeAssignments.length) {
      errors.push(`Row ${rowNumber}: employee ${employeeCodeInput} is not mapped to any project assignment.`)
      return
    }

    let projectUid = ''
    if (projectCodeInput) {
      projectUid = projectUidByCode.get(projectCodeInput) || ''
      if (!projectUid) {
        errors.push(`Row ${rowNumber}: project code ${projectCodeInput} was not found.`)
        return
      }
    } else {
      const mappedProjectUids = Array.from(new Set(employeeAssignments.map((assignment) => String(assignment.projectUid || '')).filter(Boolean)))
      if (mappedProjectUids.length === 1) {
        projectUid = mappedProjectUids[0]
      } else {
        errors.push(`Row ${rowNumber}: Project Code is required when the employee is mapped to multiple projects.`)
        return
      }
    }

    const projectCompatibleAssignments = employeeAssignments.filter((assignment) => String(assignment.projectUid || '') === String(projectUid || ''))
    if (!projectCompatibleAssignments.length) {
      errors.push(`Row ${rowNumber}: employee ${employeeCodeInput} is not mapped to project ${projectCodeInput || compactUid(projectUid)}.`)
      return
    }

    const projectAssignmentUid = resolveTaskAssignmentUid(projectCompatibleAssignments, {
      employeeUid: employee.uid,
      projectUid,
      taskDate
    })
    if (!projectAssignmentUid) {
      errors.push(`Row ${rowNumber}: project assignment could not be resolved for employee ${employeeCodeInput}.`)
      return
    }

    const numericValues = {}
    for (const field of TASK_STATUS_NUMBER_FIELDS) {
      const rawValue = pickImportValue(row, [field.label, field.label.replace(/\s+/g, '')]).trim()
      const parsedValue = rawValue ? parseStrictWholeNumber(rawValue) : 0
      if (!Number.isInteger(parsedValue) || parsedValue < 0) {
        errors.push(`Row ${rowNumber}: ${field.label} must be a non-negative whole number.`)
        return
      }
      numericValues[field.key] = parsedValue
    }

    payloads.push({
      employeeUid: String(employee.uid || ''),
      projectUid: String(projectUid || ''),
      projectAssignmentUid: String(projectAssignmentUid || ''),
      taskDate,
      hourWork: parsedHourWork,
      taskCompleted: numericValues.taskCompleted || 0,
      taskInprogress: numericValues.taskInprogress || 0,
      taskRework: numericValues.taskRework || 0,
      taskApproved: numericValues.taskApproved || 0,
      taskRejected: numericValues.taskRejected || 0,
      taskReviewed: numericValues.taskReviewed || 0,
      remarks
    })
  })

  return { payloads, errors }
}

function MetricCard({ title, value, helper, tone = 'blue' }) {
  return (
    <div className="card border-0 shadow-sm employee-metric-card h-100">
      <div className={`employee-metric-accent tone-${tone}`} />
      <div className="card-body">
        <div className="text-muted small mb-2">{title}</div>
        <div className="fs-4 fw-bold mb-1">{value}</div>
        <div className="small text-muted">{helper}</div>
      </div>
    </div>
  )
}

function StateCard({ title, message, actionLabel = '', onAction = null }) {
  return (
    <div className="card border-0 shadow-sm glass employee-directory-shell">
      <div className="card-body py-5 text-center">
        <div className="fw-semibold mb-2">{title}</div>
        <div className="text-muted small mb-3">{message}</div>
        {actionLabel && onAction ? <button type="button" className="btn btn-primary" onClick={onAction}>{actionLabel}</button> : null}
      </div>
    </div>
  )
}

function ProjectFormModal({ open, mode, draft, errors, touched, onChange, onBlur, onClose, onSubmit }) {
  const statusOptions = [{ value: '', label: 'Not set', description: 'No status selected' }, ...PROJECT_STATUS_OPTIONS.map((value) => ({ value, label: value }))]
  const showEndDate = Boolean(draft.isInactive)

  return (
    <ModalFrame
      open={open}
      title={mode === 'create' ? 'Create Project' : 'Edit Project'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>{mode === 'create' ? 'Create Project' : 'Save Changes'}</button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Project Code</label>
          <input type="text" name="projectCode" className={`form-control${touched.projectCode && errors.projectCode ? ' is-invalid' : ''}`} value={draft.projectCode} onChange={onChange} onBlur={onBlur} />
          {touched.projectCode && errors.projectCode ? <div className="invalid-feedback d-block">{errors.projectCode}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Project Name</label>
          <input type="text" name="projectName" className={`form-control${touched.projectName && errors.projectName ? ' is-invalid' : ''}`} value={draft.projectName} onChange={onChange} onBlur={onBlur} />
          {touched.projectName && errors.projectName ? <div className="invalid-feedback d-block">{errors.projectName}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Status</label>
          <AppSelect name="status" value={draft.status} onChange={onChange} onBlur={onBlur} options={statusOptions} placeholder="Select status" />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Start Date</label>
          <input type="date" name="startDate" className="form-control" value={draft.startDate} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12">
          <div className="row g-3 align-items-start justify-content-start">
            <div className={`col-12 ${showEndDate ? 'col-md-4' : 'col-md-3'}`}>
              <div className="form-check project-inactive-toggle mb-0">
                <input
                  id="projectInactiveToggle"
                  type="checkbox"
                  className="form-check-input"
                  name="isInactive"
                  checked={Boolean(draft.isInactive)}
                  onChange={onChange}
                  onBlur={onBlur}
                />
                <label className="form-check-label" htmlFor="projectInactiveToggle">Inactive</label>
              </div>
            </div>
            {showEndDate ? (
              <div className="col-12 col-md-4">
                <label className="form-label">End Date</label>
                <input type="date" name="endDate" className={`form-control${touched.endDate && errors.endDate ? ' is-invalid' : ''}`} value={draft.endDate} onChange={onChange} onBlur={onBlur} />
                {touched.endDate && errors.endDate ? <div className="invalid-feedback d-block">{errors.endDate}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea rows="4" name="description" className="form-control" value={draft.description} onChange={onChange} onBlur={onBlur} />
        </div>
      </div>
    </ModalFrame>
  )
}

function AssignmentFormModal({ open, mode, draft, errors, touched, projectOptions, employeeOptions, onChange, onBlur, onClose, onSubmit }) {
  const statusOptions = [{ value: '', label: 'Not set', description: 'No status selected' }, ...ASSIGNMENT_STATUS_OPTIONS.map((value) => ({ value, label: value }))]

  return (
    <ModalFrame
      open={open}
      title={mode === 'create' ? 'Create Project Assignment' : 'Edit Project Assignment'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>{mode === 'create' ? 'Create Assignment' : 'Save Changes'}</button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Project</label>
          <AppSelect name="projectUid" value={draft.projectUid} onChange={onChange} onBlur={onBlur} options={projectOptions} placeholder="Select project" invalid={Boolean(touched.projectUid && errors.projectUid)} />
          {touched.projectUid && errors.projectUid ? <div className="invalid-feedback d-block">{errors.projectUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Employee</label>
          <AppSelect name="employeeUid" value={draft.employeeUid} onChange={onChange} onBlur={onBlur} options={employeeOptions} placeholder="Select employee" invalid={Boolean(touched.employeeUid && errors.employeeUid)} />
          {touched.employeeUid && errors.employeeUid ? <div className="invalid-feedback d-block">{errors.employeeUid}</div> : null}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Assigned From</label>
          <input type="date" name="assignedFrom" className="form-control" value={draft.assignedFrom} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Assigned To</label>
          <input type="date" name="assignedTo" className={`form-control${touched.assignedTo && errors.assignedTo ? ' is-invalid' : ''}`} value={draft.assignedTo} onChange={onChange} onBlur={onBlur} />
          {touched.assignedTo && errors.assignedTo ? <div className="invalid-feedback d-block">{errors.assignedTo}</div> : null}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Allocation %</label>
          <input type="number" min="1" max="100" step="1" name="allocationPercentage" className={`form-control${touched.allocationPercentage && errors.allocationPercentage ? ' is-invalid' : ''}`} value={draft.allocationPercentage} onChange={onChange} onBlur={onBlur} />
          {touched.allocationPercentage && errors.allocationPercentage ? <div className="invalid-feedback d-block">{errors.allocationPercentage}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Pod Name</label>
          <input type="text" name="podName" className="form-control" value={draft.podName} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Team Lead</label>
          <input type="text" name="teamLead" className="form-control" value={draft.teamLead} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Status</label>
          <AppSelect name="status" value={draft.status} onChange={onChange} onBlur={onBlur} options={statusOptions} placeholder="Select status" />
        </div>
        <div className="col-12">
          <label className="form-label">Remarks</label>
          <textarea rows="3" name="remarks" className="form-control" value={draft.remarks} onChange={onChange} onBlur={onBlur} />
        </div>
      </div>
    </ModalFrame>
  )
}

function TaskFormModal({
  open,
  mode,
  draft,
  errors,
  touched,
  taskProjectOptions,
  employeeOptions,
  selectedBillingStatus,
  todayIsoDate,
  onChange,
  onBlur,
  onClose,
  onSubmit
}) {
  const selectedProjectCount = taskProjectOptions.length
  const taskDateColumnClass = 'col-12 col-md-6'

  return (
    <ModalFrame
      open={open}
      title={mode === 'create' ? 'Create Project Task' : 'Edit Project Task'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>{mode === 'create' ? 'Create Task' : 'Save Changes'}</button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Employee</label>
          <AppSelect name="employeeUid" value={draft.employeeUid} onChange={onChange} onBlur={onBlur} options={employeeOptions} placeholder="Select employee" invalid={Boolean(touched.employeeUid && errors.employeeUid)} />
          {touched.employeeUid && errors.employeeUid ? <div className="invalid-feedback d-block">{errors.employeeUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Project</label>
          <AppSelect
            name="projectUid"
            value={draft.projectUid}
            onChange={onChange}
            onBlur={onBlur}
            options={taskProjectOptions}
            placeholder={draft.employeeUid ? 'Select mapped project' : 'Select employee first'}
            disabled={!draft.employeeUid}
            invalid={Boolean(touched.projectUid && errors.projectUid)}
          />
          {touched.projectUid && errors.projectUid ? <div className="invalid-feedback d-block">{errors.projectUid}</div> : null}
          {draft.employeeUid ? (
            <div className="form-text">
              {selectedProjectCount === 0 ? 'No mapped project found for this employee.' : `Mapped projects: ${selectedProjectCount}`}
            </div>
          ) : null}
        </div>
        <div className={taskDateColumnClass}>
          <label className="form-label">Task Date</label>
          <input type="date" name="taskDate" max={todayIsoDate} className={`form-control${touched.taskDate && errors.taskDate ? ' is-invalid' : ''}`} value={draft.taskDate} onChange={onChange} onBlur={onBlur} />
          {touched.taskDate && errors.taskDate ? <div className="invalid-feedback d-block">{errors.taskDate}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <div className="task-hours-control">
            <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
              <label className="form-label mb-0">Hours worked</label>
              <div className="form-check task-hours-overtime-toggle">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="task-hours-overtime"
                  name="overtime"
                  checked={Boolean(draft.overtime)}
                  onChange={onChange}
                  onBlur={onBlur}
                />
                <label className="form-check-label" htmlFor="task-hours-overtime">Overtime</label>
              </div>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              name="hourWork"
              className={`form-control${touched.hourWork && errors.hourWork ? ' is-invalid' : ''}`}
              value={draft.hourWork}
              onChange={onChange}
              onBlur={onBlur}
            />
            {touched.hourWork && errors.hourWork ? <div className="invalid-feedback d-block">{errors.hourWork}</div> : null}
            <div className={`task-hours-note text-muted small ${!draft.overtime ? 'is-highlighted' : ''}`.trim()}>
              Default workday is {TASK_DEFAULT_STANDARD_HOURS} hours. Enable Overtime to log entries above {TASK_DEFAULT_STANDARD_HOURS} hours.
            </div>
          </div>
        </div>

        {draft.projectUid ? (
          <div className="col-12">
            <label className="form-label">Billing Status</label>
            <div className="task-billing-status-shell">
              <TableBadge value={selectedBillingStatus || 'Non Billable'} tone={toBillingStatusTone(selectedBillingStatus)} />
              <span className="task-billing-status-note text-muted small">Read only (derived from assignment status)</span>
            </div>
          </div>
        ) : null}

        {TASK_STATUS_NUMBER_FIELDS.map((field) => (
          <div className="col-12 col-md-4" key={field.key}>
            <label className="form-label">
              <span className={`task-status-label task-status-label-${field.tone}`}>{field.label}</span>
            </label>
            <input type="number" min="0" step="1" name={field.key} className={`form-control${touched[field.key] && errors[field.key] ? ' is-invalid' : ''}`} value={draft[field.key]} onChange={onChange} onBlur={onBlur} />
            {touched[field.key] && errors[field.key] ? <div className="invalid-feedback d-block">{errors[field.key]}</div> : null}
          </div>
        ))}

        <div className="col-12">
          <label className="form-label">Remarks</label>
          <textarea rows="3" name="remarks" className="form-control" value={draft.remarks} onChange={onChange} onBlur={onBlur} />
        </div>
      </div>
    </ModalFrame>
  )
}
export default function ProjectManagement({ view = 'project' }) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const { user } = useAuth()
  const isTaskView = view === 'task'
  const todayIsoDate = getTodayIsoDate()
  const projectExportMenuId = 'projectManagementExportMenu'
  const taskExportMenuId = 'taskManagementExportMenu'

  const canViewProjects = hasModuleVisibility(user, PERMISSION_MODULES.project)
  const canCreateProjects = hasModulePermission(user, PERMISSION_MODULES.project, PERMISSION_ACTIONS.create)
  const canUpdateProjects = hasModulePermission(user, PERMISSION_MODULES.project, PERMISSION_ACTIONS.update)
  const canDeleteProjects = hasModulePermission(user, PERMISSION_MODULES.project, PERMISSION_ACTIONS.delete)

  const assignmentPermissionModules = [...PERMISSION_MODULES.projectAssignment, ...PERMISSION_MODULES.project]
  const canViewAssignments = hasModuleVisibility(user, assignmentPermissionModules)
  const canCreateAssignments = hasModulePermission(user, assignmentPermissionModules, PERMISSION_ACTIONS.create)
  const canUpdateAssignments = hasModulePermission(user, assignmentPermissionModules, PERMISSION_ACTIONS.update)
  const canDeleteAssignments = hasModulePermission(user, assignmentPermissionModules, PERMISSION_ACTIONS.delete)

  const taskPermissionModules = [...PERMISSION_MODULES.projectTask, ...PERMISSION_MODULES.project]
  const canViewTasks = hasModuleVisibility(user, taskPermissionModules)
  const canCreateTasks = hasModulePermission(user, taskPermissionModules, PERMISSION_ACTIONS.create)
  const canUpdateTasks = hasModulePermission(user, taskPermissionModules, PERMISSION_ACTIONS.update)
  const canDeleteTasks = hasModulePermission(user, taskPermissionModules, PERMISSION_ACTIONS.delete)

  const canViewAnyTab = isTaskView ? canViewTasks : (canViewProjects || canViewAssignments)

  const projectsQuery = useProjectsQuery(canViewAnyTab)
  const assignmentsQuery = useProjectAssignmentsQuery(canViewAssignments || canViewTasks)
  const tasksQuery = useProjectTasksQuery(canViewTasks)
  const employeesQuery = useEmployeeLookupQuery(canViewAssignments || canViewTasks)

  const projects = useMemo(() => (Array.isArray(projectsQuery.data?.items) ? projectsQuery.data.items : []), [projectsQuery.data?.items])
  const assignments = useMemo(() => (Array.isArray(assignmentsQuery.data?.items) ? assignmentsQuery.data.items : []), [assignmentsQuery.data?.items])
  const tasks = useMemo(() => (Array.isArray(tasksQuery.data?.items) ? tasksQuery.data.items : []), [tasksQuery.data?.items])
  const employees = useMemo(() => (Array.isArray(employeesQuery.data) ? employeesQuery.data : []), [employeesQuery.data])

  const projectByUid = useMemo(() => new Map(projects.map((project) => [String(project.uid || ''), project])), [projects])
  const employeeByUid = useMemo(() => new Map(employees.map((employee) => [String(employee.uid || ''), employee])), [employees])
  const assignmentByUid = useMemo(() => new Map(assignments.map((assignment) => [String(assignment.uid || ''), assignment])), [assignments])

  const requestedTab = searchParams.get('tab')
  const defaultTab = isTaskView ? 'tasks' : 'projects'
  const [activeTab, setActiveTab] = useState(() => requestedTab || defaultTab)
  const scopedTabs = useMemo(() => (isTaskView ? TASK_TAB_ITEMS : PROJECT_TAB_ITEMS), [isTaskView])

  const [projectSearch, setProjectSearch] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState('All')
  const [projectTimelineFilter, setProjectTimelineFilter] = useState('All')
  const [projectAssignmentCoverageFilter, setProjectAssignmentCoverageFilter] = useState('All')
  const [projectTaskCoverageFilter, setProjectTaskCoverageFilter] = useState('All')
  const [projectStartDateRange, setProjectStartDateRange] = useState({ start: '', end: '' })

  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('All')
  const [assignmentProjectFilter, setAssignmentProjectFilter] = useState('All')
  const [assignmentEmployeeFilter, setAssignmentEmployeeFilter] = useState('All')

  const [taskSearch, setTaskSearch] = useState('')
  const [taskProjectFilter, setTaskProjectFilter] = useState('All')
  const [taskEmployeeFilter, setTaskEmployeeFilter] = useState('All')
  const [taskAssignmentFilter, setTaskAssignmentFilter] = useState('All')
  const [taskDateRangeFilter, setTaskDateRangeFilter] = useState({ start: '', end: '' })
  const [taskBillingFilter, setTaskBillingFilter] = useState('All')
  const [taskAssignmentStatusFilter, setTaskAssignmentStatusFilter] = useState('All')
  const [taskHoursFilter, setTaskHoursFilter] = useState('All')
  const [taskProjectStatusFilter, setTaskProjectStatusFilter] = useState('All')
  const [taskReviewFilter, setTaskReviewFilter] = useState('All')

  const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
  const [projectFormMode, setProjectFormMode] = useState('create')
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectDraft, setProjectDraft] = useState(() => createProjectDraft())
  const [projectTouched, setProjectTouched] = useState({})

  const [isAssignmentFormOpen, setIsAssignmentFormOpen] = useState(false)
  const [assignmentFormMode, setAssignmentFormMode] = useState('create')
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [assignmentDraft, setAssignmentDraft] = useState(() => createAssignmentDraft())
  const [assignmentTouched, setAssignmentTouched] = useState({})

  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [taskFormMode, setTaskFormMode] = useState('create')
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskDraft, setTaskDraft] = useState(() => createTaskDraft())
  const [taskTouched, setTaskTouched] = useState({})

  const [isProjectImportOpen, setIsProjectImportOpen] = useState(false)
  const [projectImportFile, setProjectImportFile] = useState(null)
  const [isTaskImportOpen, setIsTaskImportOpen] = useState(false)
  const [taskImportFile, setTaskImportFile] = useState(null)

  const availableTabs = useMemo(() => filterAccessibleTabs(scopedTabs, (tabKey) => {
    if (tabKey === 'projects') return canViewProjects
    if (tabKey === 'assignments') return canViewAssignments
    if (tabKey === 'tasks') return canViewTasks
    return false
  }), [canViewAssignments, canViewProjects, canViewTasks, scopedTabs])

  const updateTabSearchParam = useCallback((nextTab) => {
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current)
      if (availableTabs.length > 1 && nextTab) nextParams.set('tab', nextTab)
      else nextParams.delete('tab')
      return nextParams
    }, { replace: true })
  }, [availableTabs.length, setSearchParams])

  useEffect(() => {
    if (!availableTabs.length) return

    const resolvedTab = resolveAccessibleTab(availableTabs, requestedTab || activeTab, () => true, availableTabs[0]?.key || defaultTab)
    if (resolvedTab && resolvedTab !== activeTab) setActiveTab(resolvedTab)
    if (availableTabs.length > 1 && resolvedTab && resolvedTab !== requestedTab) updateTabSearchParam(resolvedTab)
    if (availableTabs.length <= 1 && requestedTab) updateTabSearchParam('')
  }, [activeTab, availableTabs, defaultTab, requestedTab, updateTabSearchParam])

  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab)
    updateTabSearchParam(nextTab)
  }, [updateTabSearchParam])

  const projectStatusFilterOptions = useMemo(() => {
    const discoveredStatuses = Array.from(new Set([...PROJECT_STATUS_OPTIONS, ...projects.map((project) => String(project.status || '').trim()).filter(Boolean)]))
    return [{ value: 'All', label: 'All statuses', description: 'No filter applied' }, ...discoveredStatuses.map((value) => ({ value, label: value, description: `${value} projects` }))]
  }, [projects])

  const assignmentStatusFilterOptions = useMemo(() => {
    const discoveredStatuses = Array.from(new Set([...ASSIGNMENT_STATUS_OPTIONS, ...assignments.map((assignment) => String(assignment.status || '').trim()).filter(Boolean)]))
    return [{ value: 'All', label: 'All statuses', description: 'No filter applied' }, ...discoveredStatuses.map((value) => ({ value, label: value, description: `${value} assignments` }))]
  }, [assignments])

  const taskAssignmentStatusFilterOptions = useMemo(() => {
    const discoveredStatuses = Array.from(new Set(['Not mapped', ...ASSIGNMENT_STATUS_OPTIONS, ...assignments.map((assignment) => String(assignment.status || '').trim()).filter(Boolean)]))
    return [{ value: 'All', label: 'All assignment statuses', description: 'No filter applied' }, ...discoveredStatuses.map((value) => ({ value, label: value, description: `${value} task assignments` }))]
  }, [assignments])

  const taskProjectStatusFilterOptions = useMemo(() => {
    const discoveredStatuses = Array.from(new Set(['Not set', ...PROJECT_STATUS_OPTIONS, ...projects.map((project) => String(project.status || '').trim()).filter(Boolean)]))
    return [{ value: 'All', label: 'All project statuses', description: 'No filter applied' }, ...discoveredStatuses.map((value) => ({ value, label: value, description: `${value} linked projects` }))]
  }, [projects])

  const taskBillingFilterOptions = useMemo(() => ([
    { value: 'All', label: 'All billing statuses', description: 'No filter applied' },
    { value: 'Billable', label: 'Billable', description: 'Assignment status is billable' },
    { value: 'Non Billable', label: 'Non Billable', description: 'Assignment status is non billable' }
  ]), [])

  const projectFilterOptions = useMemo(() => buildProjectOptions(projects, true), [projects])
  const projectFormOptions = useMemo(() => buildProjectOptions(projects, false), [projects])
  const employeeFilterOptions = useMemo(() => buildEmployeeOptions(employees, true), [employees])
  const employeeFormOptions = useMemo(() => buildEmployeeOptions(employees, false), [employees])
  const assignmentFilterOptions = useMemo(() => buildAssignmentOptions(assignments, projectByUid, employeeByUid, true), [assignments, employeeByUid, projectByUid])
  const assignmentsByEmployeeUid = useMemo(() => {
    const lookup = new Map()

    assignments.forEach((assignment) => {
      const employeeUid = String(assignment.employeeUid || '').trim()
      if (!employeeUid) return

      const bucket = lookup.get(employeeUid) || []
      bucket.push(assignment)
      lookup.set(employeeUid, bucket)
    })

    return lookup
  }, [assignments])

  const assignmentsByProjectUid = useMemo(() => {
    const lookup = new Map()

    assignments.forEach((assignment) => {
      const projectUid = String(assignment.projectUid || '').trim()
      if (!projectUid) return

      const bucket = lookup.get(projectUid) || []
      bucket.push(assignment)
      lookup.set(projectUid, bucket)
    })

    return lookup
  }, [assignments])

  const tasksByProjectUid = useMemo(() => {
    const lookup = new Map()

    tasks.forEach((task) => {
      const projectUid = String(task.projectUid || '').trim()
      if (!projectUid) return

      const bucket = lookup.get(projectUid) || []
      bucket.push(task)
      lookup.set(projectUid, bucket)
    })

    return lookup
  }, [tasks])

  const assignmentStatusesByEmployeeUid = useMemo(() => {
    const lookup = new Map()

    assignments.forEach((assignment) => {
      const employeeUid = String(assignment.employeeUid || '').trim()
      const normalizedStatus = normalizeAssignmentStatus(assignment.status)
      if (!employeeUid || !normalizedStatus) return

      const bucket = lookup.get(employeeUid) || new Set()
      bucket.add(normalizedStatus)
      lookup.set(employeeUid, bucket)
    })

    return new Map(Array.from(lookup.entries()).map(([employeeUid, statusSet]) => [employeeUid, Array.from(statusSet)]))
  }, [assignments])

  const deferredProjectSearch = useDeferredValue(projectSearch)
  const deferredAssignmentSearch = useDeferredValue(assignmentSearch)
  const deferredTaskSearch = useDeferredValue(taskSearch)

  const projectErrors = useMemo(() => buildProjectErrors(projectDraft), [projectDraft])
  const assignmentErrors = useMemo(() => buildAssignmentErrors(assignmentDraft), [assignmentDraft])
  const taskErrors = useMemo(() => buildTaskErrors(taskDraft), [taskDraft])

  const projectRows = useMemo(() => projects.map((project) => {
    const projectUid = String(project.uid || '').trim()
    const linkedAssignments = assignmentsByProjectUid.get(projectUid) || []
    const linkedTasks = tasksByProjectUid.get(projectUid) || []
    const timelineBucket = resolveProjectTimelineBucket(project, todayIsoDate)
    const assignmentCount = linkedAssignments.length
    const employeeCount = new Set(linkedAssignments.map((assignment) => String(assignment.employeeUid || '').trim()).filter(Boolean)).size
    const activeAssignmentCount = linkedAssignments.filter((assignment) => BILLABLE_ASSIGNMENT_STATUSES.has(normalizeAssignmentStatus(assignment.status))).length
    const taskEntryCount = linkedTasks.length
    const taskTotalHours = linkedTasks.reduce((total, task) => total + Number(task.hourWork || 0), 0)
    const taskTotalVolume = linkedTasks.reduce((total, task) => (
      total
      + Number(task.taskCompleted || 0)
      + Number(task.taskInprogress || 0)
      + Number(task.taskRework || 0)
      + Number(task.taskApproved || 0)
      + Number(task.taskRejected || 0)
      + Number(task.taskReviewed || 0)
    ), 0)
    const billableTaskEntries = linkedTasks.reduce((total, task) => {
      const assignment = assignmentByUid.get(String(task.projectAssignmentUid || ''))
      return BILLABLE_ASSIGNMENT_STATUSES.has(normalizeAssignmentStatus(assignment?.status)) ? total + 1 : total
    }, 0)
    const lastTaskDate = linkedTasks
      .map((task) => String(task.taskDate || '').trim())
      .filter(Boolean)
      .sort()
      .at(-1) || ''

    return {
      ...project,
      timelineBucket,
      assignmentCount,
      employeeCount,
      activeAssignmentCount,
      assignmentCoverageBucket: assignmentCount === 0 ? 'Unassigned' : (activeAssignmentCount > 0 ? 'Active Assignments' : 'Assigned'),
      taskEntryCount,
      taskTotalHours,
      taskTotalVolume,
      taskCoverageBucket: taskEntryCount === 0 ? 'No Tasks' : (taskTotalHours > 0 ? 'Hours Logged' : 'With Tasks'),
      billableTaskEntries,
      lastTaskDate
    }
  }), [assignmentByUid, assignmentsByProjectUid, projects, tasksByProjectUid, todayIsoDate])

  const filteredProjects = useMemo(() => (
    filterCollectionByQuery(projectRows, deferredProjectSearch, ['projectCode', 'projectName', 'description', 'status', 'timelineBucket', 'assignmentCoverageBucket', 'taskCoverageBucket'])
      .filter((project) => {
        const matchStatus = projectStatusFilter === 'All' || String(project.status || '') === String(projectStatusFilter)
        const matchTimeline = projectTimelineFilter === 'All' || String(project.timelineBucket || '') === String(projectTimelineFilter)
        const matchAssignmentCoverage = projectAssignmentCoverageFilter === 'All'
          || (projectAssignmentCoverageFilter === 'Assigned' && Number(project.assignmentCount || 0) > 0)
          || (projectAssignmentCoverageFilter === 'Unassigned' && Number(project.assignmentCount || 0) === 0)
          || (projectAssignmentCoverageFilter === 'Active Assignments' && Number(project.activeAssignmentCount || 0) > 0)
          || (projectAssignmentCoverageFilter === 'Multi Employee' && Number(project.employeeCount || 0) > 1)
        const matchTaskCoverage = projectTaskCoverageFilter === 'All'
          || (projectTaskCoverageFilter === 'With Tasks' && Number(project.taskEntryCount || 0) > 0)
          || (projectTaskCoverageFilter === 'No Tasks' && Number(project.taskEntryCount || 0) === 0)
          || (projectTaskCoverageFilter === 'Hours Logged' && Number(project.taskTotalHours || 0) > 0)
          || (projectTaskCoverageFilter === 'No Hours' && Number(project.taskTotalHours || 0) === 0)
        const matchStartRange = isDateInRange(project.startDate, projectStartDateRange)
        return matchStatus && matchTimeline && matchAssignmentCoverage && matchTaskCoverage && matchStartRange
      })
  ), [
    deferredProjectSearch,
    projectRows,
    projectStatusFilter,
    projectTimelineFilter,
    projectAssignmentCoverageFilter,
    projectTaskCoverageFilter,
    projectStartDateRange
  ])

  const assignmentRows = useMemo(() => assignments.map((assignment) => {
    const project = projectByUid.get(String(assignment.projectUid || ''))
    const employee = employeeByUid.get(String(assignment.employeeUid || ''))
    return {
      ...assignment,
      projectName: project?.projectName || `Project ${compactUid(assignment.projectUid)}`,
      projectCode: project?.projectCode || compactUid(assignment.projectUid),
      employeeName: employee?.fullName || `Employee ${compactUid(assignment.employeeUid)}`,
      employeeCode: employee?.employeeCode || compactUid(assignment.employeeUid)
    }
  }), [assignments, employeeByUid, projectByUid])

  const filteredAssignments = useMemo(() => (
    filterCollectionByQuery(assignmentRows, deferredAssignmentSearch, ['projectName', 'projectCode', 'employeeName', 'employeeCode', 'status', 'podName', 'teamLead', 'remarks'])
      .filter((assignment) => {
        const matchStatus = assignmentStatusFilter === 'All' || String(assignment.status || '') === String(assignmentStatusFilter)
        const matchProject = assignmentProjectFilter === 'All' || String(assignment.projectUid || '') === String(assignmentProjectFilter)
        const matchEmployee = assignmentEmployeeFilter === 'All' || String(assignment.employeeUid || '') === String(assignmentEmployeeFilter)
        return matchStatus && matchProject && matchEmployee
      })
  ), [assignmentEmployeeFilter, assignmentProjectFilter, assignmentRows, assignmentStatusFilter, deferredAssignmentSearch])

  const taskRows = useMemo(() => tasks.map((task) => {
    const project = projectByUid.get(String(task.projectUid || ''))
    const employee = employeeByUid.get(String(task.employeeUid || ''))
    const assignment = assignmentByUid.get(String(task.projectAssignmentUid || ''))
    const assignmentProject = assignment ? projectByUid.get(String(assignment.projectUid || '')) : null
    const assignmentEmployee = assignment ? employeeByUid.get(String(assignment.employeeUid || '')) : null
    const normalizedAssignmentStatus = String(assignment?.status || '').trim()
    const billingStatus = normalizedAssignmentStatus
      ? resolveBillingStatus([normalizedAssignmentStatus])
      : resolveBillingStatus(assignmentStatusesByEmployeeUid.get(String(task.employeeUid || '')) || [])

    return {
      ...task,
      projectName: project?.projectName || `Project ${compactUid(task.projectUid)}`,
      projectCode: project?.projectCode || compactUid(task.projectUid),
      projectStatus: String(project?.status || '').trim() || 'Not set',
      employeeName: employee?.fullName || `Employee ${compactUid(task.employeeUid)}`,
      employeeCode: employee?.employeeCode || compactUid(task.employeeUid),
      assignmentLabel: assignment
        ? `${assignmentProject?.projectCode || compactUid(assignment.projectUid)} • ${assignmentEmployee?.employeeCode || assignmentEmployee?.fullName || compactUid(assignment.employeeUid)}`
        : (task.projectAssignmentUid ? compactUid(task.projectAssignmentUid) : 'No assignment'),
      assignmentStatus: normalizedAssignmentStatus || 'Not mapped',
      podName: String(assignment?.podName || '').trim(),
      teamLead: String(assignment?.teamLead || '').trim(),
      billingStatus,
      reviewBucket: resolveTaskReviewBucket(task),
      overtimeLogged: Number(task.hourWork || 0) > TASK_DEFAULT_STANDARD_HOURS,
      taskVolume: Number(task.taskCompleted || 0)
        + Number(task.taskInprogress || 0)
        + Number(task.taskRework || 0)
        + Number(task.taskApproved || 0)
        + Number(task.taskRejected || 0)
        + Number(task.taskReviewed || 0),
      taskCompletedValue: Number(task.taskCompleted || 0),
      taskInprogressValue: Number(task.taskInprogress || 0),
      taskReworkValue: Number(task.taskRework || 0),
      taskApprovedValue: Number(task.taskApproved || 0),
      taskRejectedValue: Number(task.taskRejected || 0),
      taskReviewedValue: Number(task.taskReviewed || 0)
    }
  }), [assignmentByUid, assignmentStatusesByEmployeeUid, employeeByUid, projectByUid, tasks])

  const filteredTasks = useMemo(() => (
    filterCollectionByQuery(taskRows, deferredTaskSearch, [
      'projectName',
      'projectCode',
      'projectStatus',
      'employeeName',
      'employeeCode',
      'remarks',
      'assignmentLabel',
      'assignmentStatus',
      'billingStatus',
      'podName',
      'teamLead',
      'reviewBucket'
    ])
      .filter((task) => {
        const matchProject = taskProjectFilter === 'All' || String(task.projectUid || '') === String(taskProjectFilter)
        const matchEmployee = taskEmployeeFilter === 'All' || String(task.employeeUid || '') === String(taskEmployeeFilter)
        const matchAssignment = taskAssignmentFilter === 'All' || String(task.projectAssignmentUid || '') === String(taskAssignmentFilter)
        const matchTaskDateRange = isDateInRange(task.taskDate, taskDateRangeFilter)
        const matchBilling = taskBillingFilter === 'All' || String(task.billingStatus || '') === String(taskBillingFilter)
        const matchAssignmentStatus = taskAssignmentStatusFilter === 'All' || String(task.assignmentStatus || '') === String(taskAssignmentStatusFilter)
        const matchProjectStatus = taskProjectStatusFilter === 'All' || String(task.projectStatus || '') === String(taskProjectStatusFilter)
        const matchReview = taskReviewFilter === 'All' || String(task.reviewBucket || '') === String(taskReviewFilter)
        const hoursWorked = Number(task.hourWork || 0)
        const matchHours = taskHoursFilter === 'All'
          || (taskHoursFilter === 'Standard' && hoursWorked <= TASK_DEFAULT_STANDARD_HOURS)
          || (taskHoursFilter === 'Overtime' && hoursWorked > TASK_DEFAULT_STANDARD_HOURS)
          || (taskHoursFilter === 'Zero Hours' && hoursWorked === 0)
          || (taskHoursFilter === 'Logged Hours' && hoursWorked > 0)
        return matchProject
          && matchEmployee
          && matchAssignment
          && matchTaskDateRange
          && matchBilling
          && matchAssignmentStatus
          && matchProjectStatus
          && matchReview
          && matchHours
      })
  ), [
    deferredTaskSearch,
    taskAssignmentFilter,
    taskAssignmentStatusFilter,
    taskBillingFilter,
    taskEmployeeFilter,
    taskDateRangeFilter,
    taskHoursFilter,
    taskProjectFilter,
    taskProjectStatusFilter,
    taskReviewFilter,
    taskRows
  ])

  const { items: sortedProjects, sortConfig: projectSortConfig, requestSort: requestProjectSort } = useSortableData(filteredProjects, {
    initialKey: 'updated',
    initialDirection: 'desc',
    accessors: {
      project: (project) => `${project.projectName || ''} ${project.projectCode || ''}`,
      status: (project) => project.status || '',
      timeline: (project) => `${project.startDate || ''}|${project.endDate || ''}`,
      assignments: (project) => Number(project.assignmentCount || 0),
      taskCoverage: (project) => Number(project.taskEntryCount || 0) * 100000 + Number(project.taskTotalHours || 0),
      lastTaskDate: (project) => project.lastTaskDate || '',
      updated: (project) => project.updatedAt || project.createdAt || ''
    }
  })

  const { items: sortedAssignments, sortConfig: assignmentSortConfig, requestSort: requestAssignmentSort } = useSortableData(filteredAssignments, {
    initialKey: 'updated',
    initialDirection: 'desc',
    accessors: {
      project: (assignment) => `${assignment.projectName || ''} ${assignment.projectCode || ''}`,
      employee: (assignment) => `${assignment.employeeName || ''} ${assignment.employeeCode || ''}`,
      allocation: (assignment) => Number(assignment.allocationPercentage || 0),
      status: (assignment) => assignment.status || '',
      updated: (assignment) => assignment.updatedAt || assignment.createdAt || ''
    }
  })

  const { items: sortedTasks, sortConfig: taskSortConfig, requestSort: requestTaskSort } = useSortableData(filteredTasks, {
    initialKey: 'taskDate',
    initialDirection: 'desc',
    accessors: {
      taskDate: (task) => task.taskDate || task.updatedAt || task.createdAt || '',
      project: (task) => `${task.projectName || ''} ${task.projectCode || ''}`,
      employee: (task) => `${task.employeeName || ''} ${task.employeeCode || ''}`,
      hours: (task) => Number(task.hourWork || 0),
      taskCompleted: (task) => Number(task.taskCompleted || 0),
      taskInprogress: (task) => Number(task.taskInprogress || 0),
      taskRework: (task) => Number(task.taskRework || 0),
      taskApproved: (task) => Number(task.taskApproved || 0),
      taskRejected: (task) => Number(task.taskRejected || 0),
      taskReviewed: (task) => Number(task.taskReviewed || 0),
      updated: (task) => task.updatedAt || task.createdAt || ''
    }
  })

  const projectMetrics = useMemo(() => ({
    active: projects.filter((project) => String(project.status || '').trim().toLowerCase() === 'active').length,
    planned: projects.filter((project) => ['planned', 'draft'].includes(String(project.status || '').trim().toLowerCase())).length,
    unscheduled: projects.filter((project) => !project.startDate || !project.endDate).length
  }), [projects])

  const assignmentMetrics = useMemo(() => {
    const active = assignments.filter((assignment) => ['assigned', 'active'].includes(String(assignment.status || '').trim().toLowerCase())).length
    const totalAllocation = assignments.reduce((total, assignment) => total + Number(assignment.allocationPercentage || 0), 0)
    return { active, avgAllocation: assignments.length ? Math.round(totalAllocation / assignments.length) : 0 }
  }, [assignments])

  const taskMetrics = useMemo(() => ({
    totalHours: tasks.reduce((total, task) => total + Number(task.hourWork || 0), 0),
    completed: tasks.reduce((total, task) => total + Number(task.taskCompleted || 0), 0),
    approved: tasks.reduce((total, task) => total + Number(task.taskApproved || 0), 0)
  }), [tasks])

  const taskMappedProjectOptions = useMemo(() => {
    const normalizedEmployeeUid = String(taskDraft.employeeUid || '').trim()
    if (!normalizedEmployeeUid) return []

    const mappedAssignments = assignmentsByEmployeeUid.get(normalizedEmployeeUid) || []
    const mappedProjectUids = Array.from(new Set(mappedAssignments.map((assignment) => String(assignment.projectUid || '')).filter(Boolean)))

    return mappedProjectUids.map((projectUid) => {
      const project = projectByUid.get(projectUid)
      return {
        value: projectUid,
        label: project ? `${project.projectName} (${project.projectCode})` : `Project ${compactUid(projectUid)}`,
        description: project?.status || 'Mapped project'
      }
    })
  }, [assignmentsByEmployeeUid, projectByUid, taskDraft.employeeUid])

  const selectedTaskAssignmentUid = useMemo(() => resolveTaskAssignmentUid(assignments, {
    employeeUid: taskDraft.employeeUid,
    projectUid: taskDraft.projectUid,
    taskDate: taskDraft.taskDate,
    preferredUid: taskDraft.projectAssignmentUid
  }), [assignments, taskDraft.employeeUid, taskDraft.projectAssignmentUid, taskDraft.projectUid, taskDraft.taskDate])

  const selectedTaskAssignment = useMemo(() => assignmentByUid.get(String(selectedTaskAssignmentUid || '')) || null, [assignmentByUid, selectedTaskAssignmentUid])
  const selectedTaskBillingStatus = useMemo(() => {
    const selectedStatus = selectedTaskAssignment?.status
    if (selectedStatus) return resolveBillingStatus([selectedStatus])
    return resolveBillingStatus(assignmentStatusesByEmployeeUid.get(String(taskDraft.employeeUid || '')) || [])
  }, [assignmentStatusesByEmployeeUid, selectedTaskAssignment?.status, taskDraft.employeeUid])

  useEffect(() => {
    setTaskDraft((current) => {
      const normalizedEmployeeUid = String(current.employeeUid || '').trim()
      const availableProjectUids = taskMappedProjectOptions.map((option) => String(option.value || '')).filter(Boolean)

      let nextProjectUid = String(current.projectUid || '').trim()
      if (!normalizedEmployeeUid) {
        nextProjectUid = ''
      } else if (availableProjectUids.length === 1) {
        nextProjectUid = availableProjectUids[0]
      } else if (!availableProjectUids.includes(nextProjectUid)) {
        nextProjectUid = ''
      }

      const nextAssignmentUid = resolveTaskAssignmentUid(assignments, {
        employeeUid: normalizedEmployeeUid,
        projectUid: nextProjectUid,
        taskDate: current.taskDate,
        preferredUid: current.projectAssignmentUid
      })

      if (
        nextProjectUid === String(current.projectUid || '')
        && nextAssignmentUid === String(current.projectAssignmentUid || '')
      ) {
        return current
      }

      return {
        ...current,
        projectUid: nextProjectUid,
        projectAssignmentUid: nextAssignmentUid
      }
    })
  }, [assignments, taskMappedProjectOptions])
  function resetProjectComposer() {
    setSelectedProject(null)
    setProjectFormMode('create')
    setProjectDraft(createProjectDraft())
    setProjectTouched({})
  }

  function resetAssignmentComposer() {
    setSelectedAssignment(null)
    setAssignmentFormMode('create')
    setAssignmentDraft(createAssignmentDraft())
    setAssignmentTouched({})
  }

  function resetTaskComposer() {
    setSelectedTask(null)
    setTaskFormMode('create')
    setTaskDraft(createTaskDraft())
    setTaskTouched({})
  }

  function openCreateProject() {
    if (!canCreateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to create projects.' })
      return
    }
    resetProjectComposer()
    setProjectFormMode('create')
    setIsProjectFormOpen(true)
  }

  function openEditProject(project) {
    if (!canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to update projects.' })
      return
    }
    setSelectedProject(project)
    setProjectFormMode('edit')
    setProjectDraft(createProjectDraft(project))
    setProjectTouched({})
    setIsProjectFormOpen(true)
  }

  function openCreateAssignment() {
    if (!canCreateAssignments) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to create assignments.' })
      return
    }
    resetAssignmentComposer()
    setAssignmentFormMode('create')
    setIsAssignmentFormOpen(true)
  }

  function openEditAssignment(assignment) {
    if (!canUpdateAssignments) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to update assignments.' })
      return
    }
    setSelectedAssignment(assignment)
    setAssignmentFormMode('edit')
    setAssignmentDraft(createAssignmentDraft(assignment))
    setAssignmentTouched({})
    setIsAssignmentFormOpen(true)
  }

  function openCreateTask() {
    if (!canCreateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to create tasks.' })
      return
    }
    resetTaskComposer()
    setTaskFormMode('create')
    setIsTaskFormOpen(true)
  }

  function openEditTask(task) {
    if (!canUpdateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to update tasks.' })
      return
    }
    setSelectedTask(task)
    setTaskFormMode('edit')
    setTaskDraft(createTaskDraft(task))
    setTaskTouched({})
    setIsTaskFormOpen(true)
  }

  const handleProjectDraftChange = useCallback((event) => {
    const { name, value, checked, type } = event.target
    setProjectDraft((current) => {
      if (name === 'isInactive') {
        const isInactive = Boolean(checked)
        return {
          ...current,
          isInactive,
          endDate: isInactive ? (normalizeDateInput(current.endDate || todayIsoDate) || todayIsoDate) : ''
        }
      }

      if (name === 'startDate') {
        const normalizedStartDate = normalizeDateInput(value || '')
        const nextStartDate = normalizedStartDate || ''
        const next = { ...current, startDate: nextStartDate }

        if (current.isInactive && current.endDate && nextStartDate && String(current.endDate) < nextStartDate) {
          next.endDate = nextStartDate
        }

        return next
      }

      if (name === 'endDate') {
        return {
          ...current,
          endDate: normalizeDateInput(value || '') || ''
        }
      }

      return {
        ...current,
        [name]: type === 'checkbox' ? Boolean(checked) : value
      }
    })
  }, [todayIsoDate])

  const handleProjectDraftBlur = useCallback((event) => {
    const { name } = event.target
    setProjectTouched((current) => ({ ...current, [name]: true }))
  }, [])

  const handleAssignmentDraftChange = useCallback((event) => {
    const { name, value } = event.target
    setAssignmentDraft((current) => ({ ...current, [name]: value }))
  }, [])

  const handleAssignmentDraftBlur = useCallback((event) => {
    const { name } = event.target
    setAssignmentTouched((current) => ({ ...current, [name]: true }))
  }, [])

  const handleTaskDraftChange = useCallback((event) => {
    const { name } = event.target
    const value = name === 'overtime' ? Boolean(event.target.checked) : event.target.value

    setTaskDraft((current) => {
      const next = { ...current, [name]: value }

      if (name === 'overtime' && !next.overtime && parseNonNegativeInteger(next.hourWork, 0) > TASK_DEFAULT_STANDARD_HOURS) {
        next.hourWork = String(TASK_DEFAULT_STANDARD_HOURS)
      }

      if (name === 'hourWork') {
        const parsedHourWork = parseStrictWholeNumber(next.hourWork)
        if (Number.isInteger(parsedHourWork) && parsedHourWork <= TASK_DEFAULT_STANDARD_HOURS && next.overtime) {
          next.overtime = false
        }
      }

      if (name === 'taskDate') {
        const normalizedTaskDate = normalizeDateInput(next.taskDate || todayIsoDate)
        next.taskDate = normalizedTaskDate || todayIsoDate
      }

      if (name === 'employeeUid' && !next.employeeUid) {
        next.projectUid = ''
        next.projectAssignmentUid = ''
        return next
      }

      if (name === 'employeeUid' && next.employeeUid) {
        const mappedAssignments = assignmentsByEmployeeUid.get(String(next.employeeUid || '')) || []
        const mappedProjectUids = Array.from(new Set(mappedAssignments.map((assignment) => String(assignment.projectUid || '')).filter(Boolean)))
        if (mappedProjectUids.length === 1) {
          next.projectUid = mappedProjectUids[0]
        } else if (!mappedProjectUids.includes(String(next.projectUid || ''))) {
          next.projectUid = ''
        }
      }

      if (name === 'projectUid' && !next.projectUid) {
        next.projectAssignmentUid = ''
        return next
      }

      if (name === 'projectUid' || name === 'employeeUid' || name === 'taskDate') {
        next.projectAssignmentUid = resolveTaskAssignmentUid(assignments, {
          employeeUid: next.employeeUid,
          projectUid: next.projectUid,
          taskDate: next.taskDate,
          preferredUid: next.projectAssignmentUid
        })
      }

      return next
    })
  }, [assignments, assignmentsByEmployeeUid, todayIsoDate])

  const handleTaskDraftBlur = useCallback((event) => {
    const { name } = event.target
    setTaskTouched((current) => ({ ...current, [name]: true }))
  }, [])

  async function handleSaveProject() {
    if (projectFormMode === 'create' && !canCreateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to create projects.' })
      return
    }
    if (projectFormMode === 'edit' && !canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to update projects.' })
      return
    }

    setProjectTouched(markFieldsTouched([...PROJECT_REQUIRED_FIELDS, 'endDate']))
    if (hasValidationErrors(projectErrors, [...PROJECT_REQUIRED_FIELDS, 'endDate'])) {
      showStatus({ type: 'error', title: 'Project form is incomplete', message: 'Fill required fields and resolve date validation before saving.' })
      return
    }

    try {
      await runWithLoader(async () => {
        const payload = {
          ...projectDraft,
          startDate: normalizeDateInput(projectDraft.startDate || todayIsoDate) || todayIsoDate,
          endDate: projectDraft.isInactive
            ? (normalizeDateInput(projectDraft.endDate || todayIsoDate) || todayIsoDate)
            : ''
        }

        if (projectFormMode === 'create') await projectService.createProject(payload)
        else await projectService.updateProject(selectedProject.uid, payload)
        await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
      }, {
        title: projectFormMode === 'create' ? 'Creating project' : 'Updating project',
        message: projectFormMode === 'create' ? 'Saving project record to backend API.' : 'Applying project updates to backend API.'
      })

      setIsProjectFormOpen(false)
      resetProjectComposer()
      showStatus({ type: 'success', title: projectFormMode === 'create' ? 'Project created' : 'Project updated', message: projectFormMode === 'create' ? 'Project has been created successfully.' : 'Project has been updated successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: projectFormMode === 'create' ? 'Project creation failed' : 'Project update failed', message: parseApiError(error, 'The project could not be saved.') })
    }
  }

  async function handleSaveAssignment() {
    if (assignmentFormMode === 'create' && !canCreateAssignments) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to create assignments.' })
      return
    }
    if (assignmentFormMode === 'edit' && !canUpdateAssignments) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to update assignments.' })
      return
    }

    setAssignmentTouched(markFieldsTouched([...ASSIGNMENT_REQUIRED_FIELDS, 'assignedTo', 'allocationPercentage']))
    if (hasValidationErrors(assignmentErrors, [...ASSIGNMENT_REQUIRED_FIELDS, 'assignedTo', 'allocationPercentage'])) {
      showStatus({ type: 'error', title: 'Assignment form is incomplete', message: 'Fill required fields and resolve validation errors before saving.' })
      return
    }

    try {
      await runWithLoader(async () => {
        const payload = { ...assignmentDraft, allocationPercentage: parseBoundedInteger(assignmentDraft.allocationPercentage, { min: 1, max: 100, fallback: 100 }) }
        if (assignmentFormMode === 'create') await projectService.createProjectAssignment(payload)
        else await projectService.updateProjectAssignment(selectedAssignment.uid, payload)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PROJECT_ASSIGNMENTS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: PROJECT_TASKS_QUERY_KEY })
        ])
      }, {
        title: assignmentFormMode === 'create' ? 'Creating assignment' : 'Updating assignment',
        message: assignmentFormMode === 'create' ? 'Saving assignment through backend API.' : 'Applying assignment updates through backend API.'
      })

      setIsAssignmentFormOpen(false)
      resetAssignmentComposer()
      showStatus({ type: 'success', title: assignmentFormMode === 'create' ? 'Assignment created' : 'Assignment updated', message: assignmentFormMode === 'create' ? 'Assignment has been created successfully.' : 'Assignment has been updated successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: assignmentFormMode === 'create' ? 'Assignment creation failed' : 'Assignment update failed', message: parseApiError(error, 'The assignment could not be saved.') })
    }
  }

  async function handleSaveTask() {
    if (taskFormMode === 'create' && !canCreateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to create tasks.' })
      return
    }
    if (taskFormMode === 'edit' && !canUpdateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to update tasks.' })
      return
    }

    setTaskTouched(markFieldsTouched([...TASK_REQUIRED_FIELDS, ...TASK_NUMBER_FIELDS.map((field) => field.key)]))
    if (hasValidationErrors(taskErrors, [...TASK_REQUIRED_FIELDS, ...TASK_NUMBER_FIELDS.map((field) => field.key)])) {
      showStatus({ type: 'error', title: 'Task form is incomplete', message: 'Fill required fields and resolve number validation before saving.' })
      return
    }

    if (!selectedTaskAssignmentUid) {
      showStatus({
        type: 'error',
        title: 'Project mapping not found',
        message: 'The selected employee is not mapped to the selected project. Update project assignments and try again.'
      })
      return
    }

    try {
      await runWithLoader(async () => {
        const payload = {
          ...taskDraft,
          taskDate: normalizeDateInput(taskDraft.taskDate || todayIsoDate) || todayIsoDate,
          projectAssignmentUid: selectedTaskAssignmentUid,
          hourWork: parseNonNegativeInteger(taskDraft.hourWork, TASK_DEFAULT_STANDARD_HOURS),
          taskCompleted: parseNonNegativeInteger(taskDraft.taskCompleted, 0),
          taskInprogress: parseNonNegativeInteger(taskDraft.taskInprogress, 0),
          taskRework: parseNonNegativeInteger(taskDraft.taskRework, 0),
          taskApproved: parseNonNegativeInteger(taskDraft.taskApproved, 0),
          taskRejected: parseNonNegativeInteger(taskDraft.taskRejected, 0),
          taskReviewed: parseNonNegativeInteger(taskDraft.taskReviewed, 0)
        }

        if (taskFormMode === 'create') await projectService.createProjectTask(payload)
        else await projectService.updateProjectTask(selectedTask.uid, payload)
        await queryClient.invalidateQueries({ queryKey: PROJECT_TASKS_QUERY_KEY })
      }, {
        title: taskFormMode === 'create' ? 'Creating task record' : 'Updating task record',
        message: taskFormMode === 'create' ? 'Saving task through backend API.' : 'Applying task updates through backend API.'
      })

      setIsTaskFormOpen(false)
      resetTaskComposer()
      showStatus({ type: 'success', title: taskFormMode === 'create' ? 'Task created' : 'Task updated', message: taskFormMode === 'create' ? 'Task has been created successfully.' : 'Task has been updated successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: taskFormMode === 'create' ? 'Task creation failed' : 'Task update failed', message: parseApiError(error, 'The task could not be saved.') })
    }
  }

  async function handleDeleteProject(project) {
    if (!canDeleteProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to delete projects.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Project',
      title: `Delete ${project.projectName}?`,
      message: 'This project and related records may be removed from backend storage.'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        await projectService.deleteProject(project.uid)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: PROJECT_ASSIGNMENTS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: PROJECT_TASKS_QUERY_KEY })
        ])
      }, {
        title: 'Deleting project',
        message: `Removing ${project.projectName} and refreshing related records.`
      })

      showStatus({ type: 'success', title: 'Project deleted', message: `${project.projectName} has been removed successfully.` })
    } catch (error) {
      showStatus({ type: 'error', title: 'Project deletion failed', message: parseApiError(error, 'The project could not be removed.') })
    }
  }

  async function handleDeleteAssignment(assignment) {
    if (!canDeleteAssignments) {
      showStatus({ type: 'error', title: 'Assignment access blocked', message: 'Your role does not have permission to delete assignments.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Assignment',
      title: `Delete assignment for ${assignment.employeeName}?`,
      message: 'This assignment will be removed from backend Project-Assignment API.'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        await projectService.deleteProjectAssignment(assignment.uid)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: PROJECT_ASSIGNMENTS_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: PROJECT_TASKS_QUERY_KEY })
        ])
      }, {
        title: 'Deleting assignment',
        message: 'Removing assignment and refreshing related records.'
      })

      showStatus({ type: 'success', title: 'Assignment deleted', message: 'Assignment has been removed successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Assignment deletion failed', message: parseApiError(error, 'The assignment could not be removed.') })
    }
  }

  async function handleDeleteTask(task) {
    if (!canDeleteTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to delete tasks.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Task',
      title: `Delete task on ${formatDate(task.taskDate)}?`,
      message: 'This task record will be removed from backend Project-Task API.'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        await projectService.deleteProjectTask(task.uid)
        await queryClient.invalidateQueries({ queryKey: PROJECT_TASKS_QUERY_KEY })
      }, {
        title: 'Deleting task',
        message: 'Removing task record and refreshing task list.'
      })

      showStatus({ type: 'success', title: 'Task deleted', message: 'Task has been removed successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Task deletion failed', message: parseApiError(error, 'The task could not be removed.') })
    }
  }

  async function handleProjectImportSubmit() {
    if (!canCreateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to import projects.' })
      return
    }

    if (!projectImportFile) {
      showStatus({ type: 'error', title: 'No file selected', message: 'Upload the populated CSV or Excel template before starting bulk import.' })
      return
    }

    let rows = []
    try {
      const parsedFile = await parseProjectManagementImportFile(projectImportFile)
      rows = parsedFile.rows
    } catch (fileParseError) {
      showStatus({ type: 'error', title: 'Unsupported import file', message: fileParseError?.message || 'The selected file could not be parsed.' })
      return
    }

    const { payloads, errors } = buildProjectImportPayloads(rows, projects)
    if (!payloads.length) {
      showStatus({ type: 'error', title: 'Import file is not ready', message: errors[0] || 'The uploaded file did not contain valid project rows.' })
      return
    }

    if (errors.length) {
      showStatus({ type: 'error', title: 'Import validation failed', message: errors.slice(0, 3).join(' ') })
      return
    }

    try {
      await runWithLoader(async () => {
        for (const payload of payloads) {
          await projectService.createProject(payload)
        }
        await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
      }, {
        title: 'Importing projects',
        message: `Creating ${payloads.length} project record${payloads.length === 1 ? '' : 's'} from template.`
      })

      showStatus({
        type: 'success',
        title: 'Bulk import completed',
        message: `${payloads.length} project record${payloads.length === 1 ? '' : 's'} imported successfully.`
      })
      setProjectImportFile(null)
      setIsProjectImportOpen(false)
    } catch (importError) {
      showStatus({ type: 'error', title: 'Bulk import failed', message: parseApiError(importError, 'The selected project file could not be imported.') })
    }
  }

  async function handleTaskImportSubmit() {
    if (!canCreateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to import task records.' })
      return
    }

    if (!taskImportFile) {
      showStatus({ type: 'error', title: 'No file selected', message: 'Upload the populated CSV or Excel template before starting bulk import.' })
      return
    }

    let rows = []
    try {
      const parsedFile = await parseProjectManagementImportFile(taskImportFile)
      rows = parsedFile.rows
    } catch (fileParseError) {
      showStatus({ type: 'error', title: 'Unsupported import file', message: fileParseError?.message || 'The selected file could not be parsed.' })
      return
    }

    const { payloads, errors } = buildTaskImportPayloads(rows, {
      employees,
      projects,
      assignments
    })

    if (!payloads.length) {
      showStatus({ type: 'error', title: 'Import file is not ready', message: errors[0] || 'The uploaded file did not contain valid task rows.' })
      return
    }

    if (errors.length) {
      showStatus({ type: 'error', title: 'Import validation failed', message: errors.slice(0, 3).join(' ') })
      return
    }

    try {
      await runWithLoader(async () => {
        for (const payload of payloads) {
          await projectService.createProjectTask(payload)
        }
        await queryClient.invalidateQueries({ queryKey: PROJECT_TASKS_QUERY_KEY })
      }, {
        title: 'Importing task records',
        message: `Creating ${payloads.length} task record${payloads.length === 1 ? '' : 's'} from template.`
      })

      showStatus({
        type: 'success',
        title: 'Bulk import completed',
        message: `${payloads.length} task record${payloads.length === 1 ? '' : 's'} imported successfully.`
      })
      setTaskImportFile(null)
      setIsTaskImportOpen(false)
    } catch (importError) {
      showStatus({ type: 'error', title: 'Bulk import failed', message: parseApiError(importError, 'The selected task file could not be imported.') })
    }
  }

  function resetProjectFilters() {
    setProjectSearch('')
    setProjectStatusFilter('All')
    setProjectTimelineFilter('All')
    setProjectAssignmentCoverageFilter('All')
    setProjectTaskCoverageFilter('All')
    setProjectStartDateRange({ start: '', end: '' })
  }

  function resetAssignmentFilters() {
    setAssignmentSearch('')
    setAssignmentStatusFilter('All')
    setAssignmentProjectFilter('All')
    setAssignmentEmployeeFilter('All')
  }

  function resetTaskFilters() {
    setTaskSearch('')
    setTaskProjectFilter('All')
    setTaskEmployeeFilter('All')
    setTaskAssignmentFilter('All')
    setTaskDateRangeFilter({ start: '', end: '' })
    setTaskBillingFilter('All')
    setTaskAssignmentStatusFilter('All')
    setTaskHoursFilter('All')
    setTaskProjectStatusFilter('All')
    setTaskReviewFilter('All')
  }

  const pageHeaderTitle = isTaskView ? 'Task Management' : 'Project Management'
  const pageHeaderTagline = isTaskView
    ? 'Backend-aligned task monitoring and operations using Project-Task APIs.'
    : 'Backend-aligned project and assignment operations.'
  const emptyStateTitle = isTaskView
    ? 'Task module is not available for this account.'
    : 'Project module is not available for this account.'
  const emptyStateMessage = isTaskView
    ? 'Your role currently does not have access to task management permissions.'
    : 'Your role currently does not have access to project or assignment management permissions.'

  if (!canViewAnyTab || !availableTabs.length) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title={pageHeaderTitle} tagline={pageHeaderTagline} />
        <StateCard
          title={emptyStateTitle}
          message={emptyStateMessage}
        />
      </div>
    )
  }
  return (
    <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
      <PageHeader title={pageHeaderTitle} tagline={pageHeaderTagline} />

      {availableTabs.length > 1 ? (
        <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />
      ) : null}

      {activeTab === 'projects' ? (
        projectsQuery.isLoading ? (
          <StateCard title="Loading project management" message="Pulling project records from backend Project API." />
        ) : projectsQuery.isError ? (
          <StateCard title="Project module could not be loaded" message={parseApiError(projectsQuery.error, 'The Project API request failed.')} actionLabel="Retry" onAction={projectsQuery.refetch} />
        ) : (
          <>
            <div className="row g-3">
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Total Projects" value={projects.length} helper="Projects synced from backend records." tone="blue" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Active Projects" value={projectMetrics.active} helper="Projects currently marked active." tone="green" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Planned / Draft" value={projectMetrics.planned} helper="Projects in planning stages." tone="teal" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Pending Dates" value={projectMetrics.unscheduled} helper="Projects missing start or end date." tone="orange" /></div>
            </div>

            <div className="card border-0 shadow-sm glass employee-directory-shell">
              <div className="card-body d-flex flex-column gap-3">
                <div className="employee-toolbar employee-toolbar-top">
                  <AppSearchField className="employee-toolbar-search" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Search by project code, name, status, or description" />
                  <div className="employee-toolbar-actions">
                    {canCreateProjects ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-icon-inline employee-toolbar-btn"
                        onClick={() => {
                          setProjectImportFile(null)
                          setIsProjectImportOpen(true)
                        }}
                      >
                        <ImportIcon />
                        <span>Import</span>
                      </button>
                    ) : null}
                    <div className="dropdown">
                      <button className="btn btn-outline-secondary btn-icon-inline dropdown-toggle employee-toolbar-btn" data-bs-toggle="dropdown" aria-expanded="false" id={projectExportMenuId}>
                        <ExportIcon />
                        <span>Export</span>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end" aria-labelledby={projectExportMenuId}>
                        <li><button type="button" className="dropdown-item" onClick={() => downloadProjectsAsCsv(sortedProjects)}>Export CSV</button></li>
                        <li><button type="button" className="dropdown-item" onClick={() => downloadProjectsAsExcel(sortedProjects)}>Export Excel</button></li>
                      </ul>
                    </div>
                    {canCreateProjects ? (
                      <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateProject}>
                        <PlusIcon />
                        <span>Add Project</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="employee-toolbar employee-toolbar-filters">
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Status</label>
                    <AppSelect value={projectStatusFilter} onChange={setProjectStatusFilter} options={projectStatusFilterOptions} placeholder="All statuses" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Timeline</label>
                    <AppSelect value={projectTimelineFilter} onChange={setProjectTimelineFilter} options={PROJECT_TIMELINE_FILTER_OPTIONS} placeholder="All timelines" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Assignment Coverage</label>
                    <AppSelect value={projectAssignmentCoverageFilter} onChange={setProjectAssignmentCoverageFilter} options={PROJECT_ASSIGNMENT_COVERAGE_FILTER_OPTIONS} placeholder="All assignment coverage" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Task Coverage</label>
                    <AppSelect value={projectTaskCoverageFilter} onChange={setProjectTaskCoverageFilter} options={PROJECT_TASK_COVERAGE_FILTER_OPTIONS} placeholder="All task coverage" />
                  </div>
                  <div className="employee-filter-field employee-filter-field-range">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Start Date Range</label>
                    <AppDateRangeField value={projectStartDateRange} onChange={setProjectStartDateRange} className="employee-range-field" placeholder="[Select range]" />
                  </div>
                  <div className="employee-filter-actions">
                    <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetProjectFilters}>
                      <XIcon />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <PaginatedTable rows={sortedProjects}>
                  {({ rows: paginatedRows }) => (
                    <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                      <thead>
                        <tr>
                          <th><SortableHeader label="Project (Code)" sortKey="project" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Status" sortKey="status" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Timeline" sortKey="timeline" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Assignments" sortKey="assignments" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Task Coverage" sortKey="taskCoverage" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Last Task Date" sortKey="lastTaskDate" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Last Updated" sortKey="updated" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((project) => (
                          <tr key={project.uid}>
                            <td className="employee-cell-wrap"><TableCellStack title={project.projectName} subtitle={project.projectCode} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={project.status || 'Not set'} tone={toProjectStatusTone(project.status)} />} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={`${formatDate(project.startDate)} - ${formatDate(project.endDate)}`} subtitle={project.timelineBucket || (project.startDate && project.endDate ? 'Scheduled window' : 'Schedule incomplete')} /></td>
                            <td className="employee-cell-wrap">
                              <TableCellStack
                                title={<TableBadge value={`${project.assignmentCount || 0} assignments`} tone={Number(project.assignmentCount || 0) > 0 ? 'blue' : 'gray'} />}
                                subtitle={`${project.activeAssignmentCount || 0} active • ${project.employeeCount || 0} employees`}
                              />
                            </td>
                            <td className="employee-cell-wrap">
                              <TableCellStack
                                title={<TableBadge value={`${project.taskEntryCount || 0} entries`} tone={Number(project.taskEntryCount || 0) > 0 ? 'teal' : 'gray'} />}
                                subtitle={`${project.taskTotalHours || 0} hours • ${project.taskTotalVolume || 0} volume`}
                                meta={Number(project.billableTaskEntries || 0) > 0 ? `${project.billableTaskEntries} billable entries` : 'No billable entries'}
                              />
                            </td>
                            <td className="employee-cell-wrap"><TableCellStack title={formatDate(project.lastTaskDate)} subtitle={project.lastTaskDate ? 'Latest task activity' : 'No task activity'} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={formatDateTime(project.updatedAt)} subtitle={formatDateTime(project.createdAt)} meta="Created / Updated" /></td>
                            <td className="employee-actions-cell">
                              <TableActionCluster>
                                {canUpdateProjects ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditProject(project)} /> : null}
                                {canDeleteProjects ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteProject(project)} /> : null}
                              </TableActionCluster>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="8">
                              <div className="employee-empty-state text-center py-4">
                                <div className="fw-semibold mb-1">No projects matched the current filters.</div>
                                <div className="text-muted small">Reset filters or broaden your search query.</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </PaginatedTable>

                {projectsQuery.isFetching ? <div className="text-muted small">Refreshing project records…</div> : null}
              </div>
            </div>
          </>
        )
      ) : null}

      {activeTab === 'assignments' ? (
        assignmentsQuery.isLoading ? (
          <StateCard title="Loading project assignments" message="Pulling assignment records from backend Project-Assignment API." />
        ) : assignmentsQuery.isError ? (
          <StateCard title="Assignment module could not be loaded" message={parseApiError(assignmentsQuery.error, 'The Project-Assignment API request failed.')} actionLabel="Retry" onAction={assignmentsQuery.refetch} />
        ) : (
          <>
            <div className="row g-3">
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Total Assignments" value={assignments.length} helper="Assignments synced from backend records." tone="blue" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Active Assignments" value={assignmentMetrics.active} helper="Assignments in active state." tone="green" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Avg Allocation" value={`${assignmentMetrics.avgAllocation}%`} helper="Average allocation across assignments." tone="teal" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Employees" value={new Set(assignments.map((item) => item.employeeUid)).size} helper="Employees mapped to projects." tone="orange" /></div>
            </div>

            <div className="card border-0 shadow-sm glass employee-directory-shell">
              <div className="card-body d-flex flex-column gap-3">
                {employeesQuery.isError ? <div className="alert alert-warning py-2 mb-0">Employee lookup unavailable. {parseApiError(employeesQuery.error, 'Labels may show raw IDs.')}</div> : null}

                <div className="employee-toolbar employee-toolbar-top">
                  <AppSearchField className="employee-toolbar-search" value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Search by project, employee, pod, team lead, or remarks" />
                  <div className="employee-toolbar-actions">
                    {canCreateAssignments ? (
                      <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateAssignment}>
                        <PlusIcon />
                        <span>Add Assignment</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="employee-toolbar employee-toolbar-filters">
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Status</label>
                    <AppSelect value={assignmentStatusFilter} onChange={setAssignmentStatusFilter} options={assignmentStatusFilterOptions} placeholder="All statuses" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Project</label>
                    <AppSelect value={assignmentProjectFilter} onChange={setAssignmentProjectFilter} options={projectFilterOptions} placeholder="All projects" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Employee</label>
                    <AppSelect value={assignmentEmployeeFilter} onChange={setAssignmentEmployeeFilter} options={employeeFilterOptions} placeholder="All employees" />
                  </div>
                  <div className="employee-filter-actions">
                    <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetAssignmentFilters}>
                      <XIcon />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <PaginatedTable rows={sortedAssignments}>
                  {({ rows: paginatedRows }) => (
                    <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                      <thead>
                        <tr>
                          <th><SortableHeader label="Project" sortKey="project" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Employee" sortKey="employee" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Allocation" sortKey="allocation" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Status" sortKey="status" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Last Updated" sortKey="updated" sortConfig={assignmentSortConfig} onSort={requestAssignmentSort} className="employee-header-wrap" /></th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((assignment) => (
                          <tr key={assignment.uid}>
                            <td className="employee-cell-wrap"><TableCellStack title={assignment.projectName} subtitle={assignment.projectCode} meta={`${formatDate(assignment.assignedFrom)} - ${formatDate(assignment.assignedTo)}`} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={assignment.employeeName} subtitle={assignment.employeeCode} meta={assignment.teamLead ? `TL: ${assignment.teamLead}` : (assignment.podName ? `Pod: ${assignment.podName}` : null)} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={`${assignment.allocationPercentage || 0}%`} subtitle="Allocation" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={assignment.status || 'Not set'} tone={toAssignmentStatusTone(assignment.status)} />} subtitle={assignment.remarks || 'No remarks'} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={formatDateTime(assignment.updatedAt)} subtitle={formatDateTime(assignment.createdAt)} meta="Created / Updated" /></td>
                            <td className="employee-actions-cell">
                              <TableActionCluster>
                                {canUpdateAssignments ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditAssignment(assignment)} /> : null}
                                {canDeleteAssignments ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteAssignment(assignment)} /> : null}
                              </TableActionCluster>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="6">
                              <div className="employee-empty-state text-center py-4">
                                <div className="fw-semibold mb-1">No assignments matched the current filters.</div>
                                <div className="text-muted small">Reset filters or create a new assignment to get started.</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </PaginatedTable>
                {assignmentsQuery.isFetching ? <div className="text-muted small">Refreshing assignment records…</div> : null}
              </div>
            </div>
          </>
        )
      ) : null}

      {activeTab === 'tasks' ? (
        tasksQuery.isLoading ? (
          <StateCard title="Loading task management" message="Pulling task records from backend Project-Task API." />
        ) : tasksQuery.isError ? (
          <StateCard title="Task module could not be loaded" message={parseApiError(tasksQuery.error, 'The Project-Task API request failed.')} actionLabel="Retry" onAction={tasksQuery.refetch} />
        ) : (
          <>
            <div className="row g-3">
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Task Entries" value={tasks.length} helper="Task records synced from backend." tone="blue" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Total Hours" value={taskMetrics.totalHours} helper="Sum of hours worked." tone="green" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Completed" value={taskMetrics.completed} helper="Total completed tasks." tone="teal" /></div>
              <div className="col-12 col-sm-6 col-xl-3"><MetricCard title="Approved" value={taskMetrics.approved} helper="Total approved tasks." tone="orange" /></div>
            </div>

            <div className="card border-0 shadow-sm glass employee-directory-shell">
              <div className="card-body d-flex flex-column gap-3">
                {employeesQuery.isError ? <div className="alert alert-warning py-2 mb-0">Employee lookup unavailable. {parseApiError(employeesQuery.error, 'Labels may show raw IDs.')}</div> : null}
                {projectsQuery.isError ? <div className="alert alert-warning py-2 mb-0">Project lookup unavailable. {parseApiError(projectsQuery.error, 'Labels may show raw IDs.')}</div> : null}

                <div className="employee-toolbar employee-toolbar-top">
                  <AppSearchField className="employee-toolbar-search" value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="Search by project, employee, assignment, or remarks" />
                  <div className="employee-toolbar-actions">
                    {canCreateTasks ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-icon-inline employee-toolbar-btn"
                        onClick={() => {
                          setTaskImportFile(null)
                          setIsTaskImportOpen(true)
                        }}
                      >
                        <ImportIcon />
                        <span>Import</span>
                      </button>
                    ) : null}
                    <div className="dropdown">
                      <button className="btn btn-outline-secondary btn-icon-inline dropdown-toggle employee-toolbar-btn" data-bs-toggle="dropdown" aria-expanded="false" id={taskExportMenuId}>
                        <ExportIcon />
                        <span>Export</span>
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end" aria-labelledby={taskExportMenuId}>
                        <li><button type="button" className="dropdown-item" onClick={() => downloadTasksAsCsv(sortedTasks)}>Export CSV</button></li>
                        <li><button type="button" className="dropdown-item" onClick={() => downloadTasksAsExcel(sortedTasks)}>Export Excel</button></li>
                      </ul>
                    </div>
                    {canCreateTasks ? (
                      <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateTask}>
                        <PlusIcon />
                        <span>Add Task</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="employee-toolbar employee-toolbar-filters">
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Employee</label>
                    <AppSelect value={taskEmployeeFilter} onChange={setTaskEmployeeFilter} options={employeeFilterOptions} placeholder="All employees" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Project</label>
                    <AppSelect value={taskProjectFilter} onChange={setTaskProjectFilter} options={projectFilterOptions} placeholder="All projects" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Assignment</label>
                    <AppSelect value={taskAssignmentFilter} onChange={setTaskAssignmentFilter} options={assignmentFilterOptions} placeholder="All assignments" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Billing Status</label>
                    <AppSelect value={taskBillingFilter} onChange={setTaskBillingFilter} options={taskBillingFilterOptions} placeholder="All billing statuses" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Assignment Status</label>
                    <AppSelect value={taskAssignmentStatusFilter} onChange={setTaskAssignmentStatusFilter} options={taskAssignmentStatusFilterOptions} placeholder="All assignment statuses" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Project Status</label>
                    <AppSelect value={taskProjectStatusFilter} onChange={setTaskProjectStatusFilter} options={taskProjectStatusFilterOptions} placeholder="All project statuses" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Hours</label>
                    <AppSelect value={taskHoursFilter} onChange={setTaskHoursFilter} options={TASK_HOURS_FILTER_OPTIONS} placeholder="All hours" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Review Bucket</label>
                    <AppSelect value={taskReviewFilter} onChange={setTaskReviewFilter} options={TASK_REVIEW_FILTER_OPTIONS} placeholder="All review buckets" />
                  </div>
                  <div className="employee-filter-field employee-filter-field-range">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Task Date Range</label>
                    <AppDateRangeField value={taskDateRangeFilter} onChange={setTaskDateRangeFilter} className="employee-range-field" placeholder="[Select range]" />
                  </div>
                  <div className="employee-filter-actions">
                    <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetTaskFilters}>
                      <XIcon />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                <PaginatedTable rows={sortedTasks}>
                  {({ rows: paginatedRows }) => (
                    <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table task-management-table">
                      <colgroup>
                        <col className="task-col-date" />
                        <col className="task-col-project" />
                        <col className="task-col-employee" />
                        <col className="task-col-hours" />
                        <col className="task-col-status" />
                        <col className="task-col-status" />
                        <col className="task-col-status" />
                        <col className="task-col-status" />
                        <col className="task-col-status" />
                        <col className="task-col-status" />
                        <col className="task-col-actions" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th><SortableHeader label="Task Date" sortKey="taskDate" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Project" sortKey="project" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Employee" sortKey="employee" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Hours" sortKey="hours" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Tasks Completed" sortKey="taskCompleted" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Tasks In Progress" sortKey="taskInprogress" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Tasks In Rework" sortKey="taskRework" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Tasks Approved" sortKey="taskApproved" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Tasks Rejected" sortKey="taskRejected" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Tasks Reviewed" sortKey="taskReviewed" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((task) => (
                          <tr key={task.uid}>
                            <td className="employee-cell-wrap"><TableCellStack title={formatDate(task.taskDate)} subtitle={task.taskDate || '—'} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={task.projectName} subtitle={task.projectCode} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={task.employeeName} subtitle={task.employeeCode} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={String(task.hourWork ?? 0)} subtitle={task.overtimeLogged ? <TableBadge value="Overtime" tone="orange" /> : 'Hours worked'} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={String(task.taskCompletedValue ?? 0)} tone="green" />} subtitle="Completed" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={String(task.taskInprogressValue ?? 0)} tone="blue" />} subtitle="In Progress" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={String(task.taskReworkValue ?? 0)} tone="orange" />} subtitle="Rework" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={String(task.taskApprovedValue ?? 0)} tone="teal" />} subtitle="Approved" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={String(task.taskRejectedValue ?? 0)} tone="red" />} subtitle="Rejected" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={String(task.taskReviewedValue ?? 0)} tone="purple" />} subtitle="Reviewed" /></td>
                            <td className="employee-actions-cell">
                              <TableActionCluster className="justify-content-center mx-auto">
                                {canUpdateTasks ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditTask(task)} /> : null}
                                {canDeleteTasks ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteTask(task)} /> : null}
                              </TableActionCluster>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="11">
                              <div className="employee-empty-state text-center py-4">
                                <div className="fw-semibold mb-1">No task entries matched the current filters.</div>
                                <div className="text-muted small">Reset filters or create a new task record to get started.</div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </PaginatedTable>
                {tasksQuery.isFetching ? <div className="text-muted small">Refreshing task records…</div> : null}
              </div>
            </div>
          </>
        )
      ) : null}

      <ProjectFormModal
        open={isProjectFormOpen}
        mode={projectFormMode}
        draft={projectDraft}
        errors={projectErrors}
        touched={projectTouched}
        onChange={handleProjectDraftChange}
        onBlur={handleProjectDraftBlur}
        onClose={() => {
          setIsProjectFormOpen(false)
          resetProjectComposer()
        }}
        onSubmit={handleSaveProject}
      />

      <AssignmentFormModal
        open={isAssignmentFormOpen}
        mode={assignmentFormMode}
        draft={assignmentDraft}
        errors={assignmentErrors}
        touched={assignmentTouched}
        projectOptions={projectFormOptions}
        employeeOptions={employeeFormOptions}
        onChange={handleAssignmentDraftChange}
        onBlur={handleAssignmentDraftBlur}
        onClose={() => {
          setIsAssignmentFormOpen(false)
          resetAssignmentComposer()
        }}
        onSubmit={handleSaveAssignment}
      />

      <ModalFrame
        open={isProjectImportOpen}
        title="Import Projects"
        onClose={() => {
          setIsProjectImportOpen(false)
          setProjectImportFile(null)
        }}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadProjectImportTemplateCsv}><DownloadIcon /><span>CSV Template</span></button>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadProjectImportTemplateExcel}><DownloadIcon /><span>Excel Template</span></button>
            <button type="button" className="btn btn-primary" onClick={handleProjectImportSubmit}>Start Import</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => {
              setIsProjectImportOpen(false)
              setProjectImportFile(null)
            }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-3">
          <div className="employee-import-note">
            <div className="fw-semibold mb-1">Bulk project template</div>
            <div className="text-muted small">Download the CSV or Excel template, fill one project per row, and upload the completed file.</div>
            <div className="text-muted small mt-2">Validation checks: required Project Code and Project Name, unique project code, supported date formats (`YYYY-MM-DD`, `DD/MM/YYYY`, `MM/DD/YYYY`, and Excel serial dates), and End Date must not be earlier than Start Date.</div>
          </div>
          <div className="employee-import-upload">
            <label className="form-label">Upload populated template</label>
            <input type="file" className="form-control" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setProjectImportFile(event.target.files?.[0] || null)} />
            <div className="form-text">Accepted formats: CSV and Excel (.xlsx). The file is validated before records are created.</div>
          </div>
          {projectImportFile ? <div className="employee-import-file-chip"><span className="fw-semibold">Selected file:</span> {projectImportFile.name}</div> : null}
        </div>
      </ModalFrame>

      <ModalFrame
        open={isTaskImportOpen}
        title="Import Task Records"
        onClose={() => {
          setIsTaskImportOpen(false)
          setTaskImportFile(null)
        }}
        size="lg"
        footer={(
          <>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadTaskImportTemplateCsv}><DownloadIcon /><span>CSV Template</span></button>
            <button type="button" className="btn btn-light btn-icon-inline" onClick={downloadTaskImportTemplateExcel}><DownloadIcon /><span>Excel Template</span></button>
            <button type="button" className="btn btn-primary" onClick={handleTaskImportSubmit}>Start Import</button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => {
              setIsTaskImportOpen(false)
              setTaskImportFile(null)
            }}
            >
              Cancel
            </button>
          </>
        )}
      >
        <div className="d-flex flex-column gap-3">
          <div className="employee-import-note">
            <div className="fw-semibold mb-1">Bulk task template</div>
            <div className="text-muted small">Task import is employee-first. The system maps each employee to valid project assignments and auto-sends `project_assignment_uid` in the background.</div>
            <div className="text-muted small mt-2">Validation checks: Employee Code must exist, Task Date cannot be in the future, project must be mapped to the employee, and Hours Worked above {TASK_DEFAULT_STANDARD_HOURS} requires Overtime = Yes.</div>
          </div>
          <div className="employee-import-upload">
            <label className="form-label">Upload populated template</label>
            <input type="file" className="form-control" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setTaskImportFile(event.target.files?.[0] || null)} />
            <div className="form-text">Accepted formats: CSV and Excel (.xlsx). The file is validated before records are created.</div>
          </div>
          {taskImportFile ? <div className="employee-import-file-chip"><span className="fw-semibold">Selected file:</span> {taskImportFile.name}</div> : null}
        </div>
      </ModalFrame>

      <TaskFormModal
        open={isTaskFormOpen}
        mode={taskFormMode}
        draft={taskDraft}
        errors={taskErrors}
        touched={taskTouched}
        taskProjectOptions={taskMappedProjectOptions}
        employeeOptions={employeeFormOptions}
        selectedBillingStatus={selectedTaskBillingStatus}
        todayIsoDate={todayIsoDate}
        onChange={handleTaskDraftChange}
        onBlur={handleTaskDraftBlur}
        onClose={() => {
          setIsTaskFormOpen(false)
          resetTaskComposer()
        }}
        onSubmit={handleSaveTask}
      />
    </div>
  )
}
