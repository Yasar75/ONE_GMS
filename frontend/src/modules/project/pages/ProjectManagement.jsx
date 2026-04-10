import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { FilterIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from '../../../components/common/AppIcons.jsx'
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
const TASK_REQUIRED_FIELDS = ['projectUid', 'employeeUid']
const TASK_NUMBER_FIELDS = [
  { key: 'hourWork', label: 'Hours worked' },
  { key: 'taskCompleted', label: 'Tasks completed' },
  { key: 'taskInprogress', label: 'Tasks in progress' },
  { key: 'taskRework', label: 'Tasks in rework' },
  { key: 'taskApproved', label: 'Tasks approved' },
  { key: 'taskRejected', label: 'Tasks rejected' },
  { key: 'taskReviewed', label: 'Tasks reviewed' }
]

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

function toTaskReviewTone(task) {
  if (Number(task?.taskRejected || 0) > 0) return 'red'
  if (Number(task?.taskApproved || 0) > 0) return 'green'
  if (Number(task?.taskReviewed || 0) > 0) return 'teal'
  if (Number(task?.taskInprogress || 0) > 0 || Number(task?.taskRework || 0) > 0) return 'amber'
  return 'gray'
}

function createProjectDraft(project = null) {
  return {
    projectCode: project?.projectCode || '',
    projectName: project?.projectName || '',
    description: project?.description || '',
    startDate: project?.startDate || '',
    endDate: project?.endDate || '',
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
  return {
    projectUid: task?.projectUid || '',
    employeeUid: task?.employeeUid || '',
    projectAssignmentUid: task?.projectAssignmentUid || '',
    taskDate: task?.taskDate || '',
    hourWork: String(task?.hourWork ?? 0),
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
  return {
    projectCode: getRequiredFieldMessage(draft.projectCode, 'Project code'),
    projectName: getRequiredFieldMessage(draft.projectName, 'Project name'),
    endDate: getDateRangeValidationMessage(draft.startDate, draft.endDate, {
      startLabel: 'Start date',
      endLabel: 'End date'
    })
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
  const errors = {
    projectUid: getRequiredFieldMessage(draft.projectUid, 'Project'),
    employeeUid: getRequiredFieldMessage(draft.employeeUid, 'Employee')
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

function isAssignmentCompatible(assignment, projectUid = '', employeeUid = '') {
  if (!assignment) return false
  const normalizedProjectUid = String(projectUid || '').trim()
  const normalizedEmployeeUid = String(employeeUid || '').trim()
  const projectMatch = !normalizedProjectUid || String(assignment.projectUid || '') === normalizedProjectUid
  const employeeMatch = !normalizedEmployeeUid || String(assignment.employeeUid || '') === normalizedEmployeeUid
  return projectMatch && employeeMatch
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
        <div className="col-12 col-md-4">
          <label className="form-label">Status</label>
          <AppSelect name="status" value={draft.status} onChange={onChange} onBlur={onBlur} options={statusOptions} placeholder="Select status" />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Start Date</label>
          <input type="date" name="startDate" className="form-control" value={draft.startDate} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">End Date</label>
          <input type="date" name="endDate" className={`form-control${touched.endDate && errors.endDate ? ' is-invalid' : ''}`} value={draft.endDate} onChange={onChange} onBlur={onBlur} />
          {touched.endDate && errors.endDate ? <div className="invalid-feedback d-block">{errors.endDate}</div> : null}
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

function TaskFormModal({ open, mode, draft, errors, touched, projectOptions, employeeOptions, assignmentOptions, onChange, onBlur, onClose, onSubmit }) {
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
          <label className="form-label">Project</label>
          <AppSelect name="projectUid" value={draft.projectUid} onChange={onChange} onBlur={onBlur} options={projectOptions} placeholder="Select project" invalid={Boolean(touched.projectUid && errors.projectUid)} />
          {touched.projectUid && errors.projectUid ? <div className="invalid-feedback d-block">{errors.projectUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Employee</label>
          <AppSelect name="employeeUid" value={draft.employeeUid} onChange={onChange} onBlur={onBlur} options={employeeOptions} placeholder="Select employee" invalid={Boolean(touched.employeeUid && errors.employeeUid)} />
          {touched.employeeUid && errors.employeeUid ? <div className="invalid-feedback d-block">{errors.employeeUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Project Assignment (Optional)</label>
          <AppSelect name="projectAssignmentUid" value={draft.projectAssignmentUid} onChange={onChange} onBlur={onBlur} options={assignmentOptions} placeholder="Select assignment" />
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Task Date</label>
          <input type="date" name="taskDate" className="form-control" value={draft.taskDate} onChange={onChange} onBlur={onBlur} />
        </div>

        {TASK_NUMBER_FIELDS.map((field) => (
          <div className="col-12 col-md-4" key={field.key}>
            <label className="form-label">{field.label}</label>
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

  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState('All')
  const [assignmentProjectFilter, setAssignmentProjectFilter] = useState('All')
  const [assignmentEmployeeFilter, setAssignmentEmployeeFilter] = useState('All')

  const [taskSearch, setTaskSearch] = useState('')
  const [taskProjectFilter, setTaskProjectFilter] = useState('All')
  const [taskEmployeeFilter, setTaskEmployeeFilter] = useState('All')
  const [taskAssignmentFilter, setTaskAssignmentFilter] = useState('All')
  const [taskFromDateFilter, setTaskFromDateFilter] = useState('')
  const [taskToDateFilter, setTaskToDateFilter] = useState('')

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

  const projectFilterOptions = useMemo(() => buildProjectOptions(projects, true), [projects])
  const projectFormOptions = useMemo(() => buildProjectOptions(projects, false), [projects])
  const employeeFilterOptions = useMemo(() => buildEmployeeOptions(employees, true), [employees])
  const employeeFormOptions = useMemo(() => buildEmployeeOptions(employees, false), [employees])
  const assignmentFilterOptions = useMemo(() => buildAssignmentOptions(assignments, projectByUid, employeeByUid, true), [assignments, employeeByUid, projectByUid])

  const deferredProjectSearch = useDeferredValue(projectSearch)
  const deferredAssignmentSearch = useDeferredValue(assignmentSearch)
  const deferredTaskSearch = useDeferredValue(taskSearch)

  const projectErrors = useMemo(() => buildProjectErrors(projectDraft), [projectDraft])
  const assignmentErrors = useMemo(() => buildAssignmentErrors(assignmentDraft), [assignmentDraft])
  const taskErrors = useMemo(() => buildTaskErrors(taskDraft), [taskDraft])

  const filteredProjects = useMemo(() => (
    filterCollectionByQuery(projects, deferredProjectSearch, ['projectCode', 'projectName', 'description', 'status'])
      .filter((project) => projectStatusFilter === 'All' || String(project.status || '') === String(projectStatusFilter))
  ), [deferredProjectSearch, projectStatusFilter, projects])

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

    return {
      ...task,
      projectName: project?.projectName || `Project ${compactUid(task.projectUid)}`,
      projectCode: project?.projectCode || compactUid(task.projectUid),
      employeeName: employee?.fullName || `Employee ${compactUid(task.employeeUid)}`,
      employeeCode: employee?.employeeCode || compactUid(task.employeeUid),
      assignmentLabel: assignment
        ? `${assignmentProject?.projectCode || compactUid(assignment.projectUid)} • ${assignmentEmployee?.employeeCode || assignmentEmployee?.fullName || compactUid(assignment.employeeUid)}`
        : (task.projectAssignmentUid ? compactUid(task.projectAssignmentUid) : 'No assignment'),
      taskVolume: Number(task.taskCompleted || 0)
        + Number(task.taskInprogress || 0)
        + Number(task.taskRework || 0)
        + Number(task.taskApproved || 0)
        + Number(task.taskRejected || 0)
        + Number(task.taskReviewed || 0)
    }
  }), [assignmentByUid, employeeByUid, projectByUid, tasks])

  const filteredTasks = useMemo(() => (
    filterCollectionByQuery(taskRows, deferredTaskSearch, ['projectName', 'projectCode', 'employeeName', 'employeeCode', 'remarks', 'assignmentLabel'])
      .filter((task) => {
        const matchProject = taskProjectFilter === 'All' || String(task.projectUid || '') === String(taskProjectFilter)
        const matchEmployee = taskEmployeeFilter === 'All' || String(task.employeeUid || '') === String(taskEmployeeFilter)
        const matchAssignment = taskAssignmentFilter === 'All' || String(task.projectAssignmentUid || '') === String(taskAssignmentFilter)
        const matchFromDate = !taskFromDateFilter || String(task.taskDate || '') >= String(taskFromDateFilter)
        const matchToDate = !taskToDateFilter || String(task.taskDate || '') <= String(taskToDateFilter)
        return matchProject && matchEmployee && matchAssignment && matchFromDate && matchToDate
      })
  ), [deferredTaskSearch, taskAssignmentFilter, taskEmployeeFilter, taskFromDateFilter, taskProjectFilter, taskRows, taskToDateFilter])

  const { items: sortedProjects, sortConfig: projectSortConfig, requestSort: requestProjectSort } = useSortableData(filteredProjects, {
    initialKey: 'updated',
    initialDirection: 'desc',
    accessors: {
      project: (project) => `${project.projectName || ''} ${project.projectCode || ''}`,
      status: (project) => project.status || '',
      timeline: (project) => `${project.startDate || ''}|${project.endDate || ''}`,
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
      volume: (task) => Number(task.taskVolume || 0),
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

  const scopedTaskAssignmentOptions = useMemo(() => {
    const scopedAssignments = assignments.filter((assignment) => isAssignmentCompatible(assignment, taskDraft.projectUid, taskDraft.employeeUid))
    return [
      { value: '', label: 'No assignment', description: 'Optional link for this task' },
      ...buildAssignmentOptions(scopedAssignments, projectByUid, employeeByUid, false)
    ]
  }, [assignments, employeeByUid, projectByUid, taskDraft.employeeUid, taskDraft.projectUid])
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
    const { name, value } = event.target
    setProjectDraft((current) => ({ ...current, [name]: value }))
  }, [])

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
    const { name, value } = event.target
    setTaskDraft((current) => {
      const next = { ...current, [name]: value }
      if ((name === 'projectUid' || name === 'employeeUid') && next.projectAssignmentUid) {
        const matchedAssignment = assignments.find((assignment) => String(assignment.uid || '') === String(next.projectAssignmentUid || ''))
        if (!isAssignmentCompatible(matchedAssignment, next.projectUid, next.employeeUid)) {
          next.projectAssignmentUid = ''
        }
      }
      return next
    })
  }, [assignments])

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
        if (projectFormMode === 'create') await projectService.createProject(projectDraft)
        else await projectService.updateProject(selectedProject.uid, projectDraft)
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

    try {
      await runWithLoader(async () => {
        const payload = {
          ...taskDraft,
          hourWork: parseNonNegativeInteger(taskDraft.hourWork, 0),
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

  function resetProjectFilters() {
    setProjectSearch('')
    setProjectStatusFilter('All')
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
    setTaskFromDateFilter('')
    setTaskToDateFilter('')
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
                      <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateProject}>
                        <PlusIcon />
                        <span>Add Project</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="employee-toolbar employee-toolbar-filters project-toolbar-filters">
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Status</label>
                    <AppSelect value={projectStatusFilter} onChange={setProjectStatusFilter} options={projectStatusFilterOptions} placeholder="All statuses" />
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
                          <th><SortableHeader label="Last Updated" sortKey="updated" sortConfig={projectSortConfig} onSort={requestProjectSort} className="employee-header-wrap" /></th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((project) => (
                          <tr key={project.uid}>
                            <td className="employee-cell-wrap"><TableCellStack title={project.projectName} subtitle={project.projectCode} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={<TableBadge value={project.status || 'Not set'} tone={toProjectStatusTone(project.status)} />} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={`${formatDate(project.startDate)} - ${formatDate(project.endDate)}`} subtitle={project.startDate && project.endDate ? 'Scheduled window' : 'Schedule incomplete'} /></td>
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
                            <td colSpan="5">
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

                <div className="employee-toolbar employee-toolbar-filters project-toolbar-filters">
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
                      <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateTask}>
                        <PlusIcon />
                        <span>Add Task</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="employee-toolbar employee-toolbar-filters project-toolbar-filters">
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Project</label>
                    <AppSelect value={taskProjectFilter} onChange={setTaskProjectFilter} options={projectFilterOptions} placeholder="All projects" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Employee</label>
                    <AppSelect value={taskEmployeeFilter} onChange={setTaskEmployeeFilter} options={employeeFilterOptions} placeholder="All employees" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Assignment</label>
                    <AppSelect value={taskAssignmentFilter} onChange={setTaskAssignmentFilter} options={assignmentFilterOptions} placeholder="All assignments" />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted">From Date</label>
                    <input type="date" className="form-control" value={taskFromDateFilter} onChange={(event) => setTaskFromDateFilter(event.target.value)} />
                  </div>
                  <div className="employee-filter-field">
                    <label className="form-label small text-muted">To Date</label>
                    <input type="date" className="form-control" value={taskToDateFilter} onChange={(event) => setTaskToDateFilter(event.target.value)} />
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
                    <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                      <thead>
                        <tr>
                          <th><SortableHeader label="Task Date" sortKey="taskDate" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Project" sortKey="project" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Employee" sortKey="employee" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Hours" sortKey="hours" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Task Volume" sortKey="volume" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th><SortableHeader label="Last Updated" sortKey="updated" sortConfig={taskSortConfig} onSort={requestTaskSort} className="employee-header-wrap" /></th>
                          <th className="text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length ? paginatedRows.map((task) => (
                          <tr key={task.uid}>
                            <td className="employee-cell-wrap"><TableCellStack title={formatDate(task.taskDate)} subtitle={task.assignmentLabel} meta={task.remarks || null} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={task.projectName} subtitle={task.projectCode} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={task.employeeName} subtitle={task.employeeCode} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={task.hourWork} subtitle="Hours worked" /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={task.taskVolume} subtitle={`Completed ${task.taskCompleted} • In Progress ${task.taskInprogress} • Rework ${task.taskRework}`} meta={<TableBadge value={`Approved ${task.taskApproved} • Rejected ${task.taskRejected}`} tone={toTaskReviewTone(task)} />} /></td>
                            <td className="employee-cell-wrap"><TableCellStack title={formatDateTime(task.updatedAt)} subtitle={formatDateTime(task.createdAt)} meta="Created / Updated" /></td>
                            <td className="employee-actions-cell">
                              <TableActionCluster>
                                {canUpdateTasks ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditTask(task)} /> : null}
                                {canDeleteTasks ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteTask(task)} /> : null}
                              </TableActionCluster>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="7">
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

      <TaskFormModal
        open={isTaskFormOpen}
        mode={taskFormMode}
        draft={taskDraft}
        errors={taskErrors}
        touched={taskTouched}
        projectOptions={projectFormOptions}
        employeeOptions={employeeFormOptions}
        assignmentOptions={scopedTaskAssignmentOptions}
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
