import React, { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import AppDatePresetFilter from '../../../components/common/AppDatePresetFilter.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import KpiCard from '../../../components/common/KpiCard.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { ChevronLeftIcon, PencilIcon, PlusIcon, TrashIcon } from '../../../components/common/AppIcons.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'
import { useTaskAssignmentsQuery } from '../../../hooks/task/useTaskAssignmentsQuery.js'
import { TASK_ENTRIES_QUERY_KEY, useTaskEntriesQuery } from '../../../hooks/task/useTaskEntriesQuery.js'
import { useTaskProjectsQuery } from '../../../hooks/task/useTaskProjectsQuery.js'
import { projectService } from '../../../api/services/project.service.js'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { normalizeApiError } from '../../../utils/apiError.js'
import { formatDate, normalizeDateInput } from '../../../utils/employee.js'
import { PERMISSION_ACTIONS, PERMISSION_MODULES, hasModulePermission } from '../../../utils/permissions.js'
import { filterCollectionByQuery } from '../../../utils/search.js'
import { buildTaskHoursChart, buildTaskStatusChartData, filterTasksByDatePreset, TASK_STATUS_CHART_CONFIG } from '../utils/taskInsights.js'

function compactUid(value) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return '—'
  return normalizedValue.length > 8 ? `${normalizedValue.slice(0, 8)}…` : normalizedValue
}

function TaskOverviewAxisTick({ x, y, payload }) {
  const entry = payload?.payload

  return (
    <g transform={`translate(${x},${y})`}>
      <text x="0" y="0" dy="0.6em" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600">
        {entry?.label || payload?.value || ''}
      </text>
      <text x="0" y="16" textAnchor="middle" fill="var(--bs-secondary-color, #6b7280)" fontSize="11">
        {entry?.secondaryLabel || ''}
      </text>
    </g>
  )
}

function buildHourTicks(maxHours = 0, step = 1) {
  const safeStep = Math.max(Number(step) || 1, 1)
  const safeMax = Math.max(Number(maxHours) || 0, 0)
  const ceiling = Math.max(safeStep, Math.ceil(safeMax / safeStep) * safeStep)
  return Array.from({ length: Math.floor(ceiling / safeStep) + 1 }, (_, index) => index * safeStep)
}

export default function EmployeesOverview() {
  const navigate = useNavigate()
  const { employeeUid = '' } = useParams()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const todayIsoDate = getTodayIsoDate()
  const [datePreset, setDatePreset] = useState('overall')
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState('create')
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskDraft, setTaskDraft] = useState(() => createTaskDraft({ employeeUid, todayIsoDate }))
  const [taskTouched, setTaskTouched] = useState({})
  const currentTaskUid = taskModalMode === 'edit' ? String(selectedTask?.uid || '').trim() : ''
  const [taskSearch, setTaskSearch] = useState('')
  const deferredTaskSearch = useDeferredValue(taskSearch)
  const taskPermissionModules = [...PERMISSION_MODULES.projectTask, ...PERMISSION_MODULES.project]
  const canCreateTasks = hasModulePermission(user, taskPermissionModules, PERMISSION_ACTIONS.create)
  const canUpdateTasks = hasModulePermission(user, taskPermissionModules, PERMISSION_ACTIONS.update)
  const canDeleteTasks = hasModulePermission(user, taskPermissionModules, PERMISSION_ACTIONS.delete)

  const employeesQuery = useEmployeeLookupQuery(true)
  const projectsQuery = useTaskProjectsQuery(true)
  const assignmentsQuery = useTaskAssignmentsQuery(true)
  const tasksQuery = useTaskEntriesQuery(true)

  const employees = useMemo(() => (Array.isArray(employeesQuery.data) ? employeesQuery.data : []), [employeesQuery.data])
  const projects = useMemo(() => (Array.isArray(projectsQuery.data?.items) ? projectsQuery.data.items : []), [projectsQuery.data?.items])
  const assignments = useMemo(() => (Array.isArray(assignmentsQuery.data?.items) ? assignmentsQuery.data.items : []), [assignmentsQuery.data?.items])
  const tasks = useMemo(() => (Array.isArray(tasksQuery.data?.items) ? tasksQuery.data.items : []), [tasksQuery.data?.items])

  const employee = useMemo(() => employees.find((entry) => String(entry.uid || '') === String(employeeUid || '')) || null, [employeeUid, employees])
  const projectByUid = useMemo(() => new Map(projects.map((project) => [String(project.uid || ''), project])), [projects])
  const assignmentByUid = useMemo(() => new Map(assignments.map((assignment) => [String(assignment.uid || ''), assignment])), [assignments])
  const occupiedProjectUidsForTaskDate = useMemo(() => {
    const normalizedTaskDate = normalizeTaskEntryDate(taskDraft.taskDate)
    if (!normalizedTaskDate) return new Set()

    return new Set(tasks
      .filter((task) => (
        String(task?.uid || '').trim() !== currentTaskUid
          && String(task?.employeeUid || '').trim() === String(employeeUid || '').trim()
          && normalizeTaskEntryDate(task?.taskDate) === normalizedTaskDate
      ))
      .map((task) => String(task?.projectUid || '').trim())
      .filter(Boolean))
  }, [currentTaskUid, employeeUid, taskDraft.taskDate, tasks])

  const employeeProjectUids = useMemo(() => {
    const employeeAssignments = assignments.filter((assignment) => String(assignment.employeeUid || '') === String(employeeUid || ''))
    const mappedProjectUids = Array.from(new Set(employeeAssignments.map((assignment) => String(assignment.projectUid || '')).filter(Boolean)))

    return mappedProjectUids.length
      ? mappedProjectUids
      : projects.map((project) => String(project.uid || '')).filter(Boolean)
  }, [assignments, employeeUid, projects])

  const projectOptions = useMemo(() => {
    const hasMappedProjects = assignments.some((assignment) => String(assignment.employeeUid || '') === String(employeeUid || ''))

    return employeeProjectUids
      .map((projectUid) => {
        const project = projectByUid.get(projectUid)
        const isAlreadyLogged = occupiedProjectUidsForTaskDate.has(projectUid)
        return {
          value: projectUid,
          label: project ? `${project.projectName} (${project.projectCode})` : `Project ${compactUid(projectUid)}`,
          description: isAlreadyLogged ? 'Already logged on this date' : (project?.status || (hasMappedProjects ? 'Mapped project' : 'Project record')),
          disabled: isAlreadyLogged
        }
      })
  }, [assignments, employeeProjectUids, employeeUid, occupiedProjectUidsForTaskDate, projectByUid])

  const employeeTaskRows = useMemo(() => tasks
    .filter((task) => String(task.employeeUid || '') === String(employeeUid || ''))
    .map((task) => {
      const project = projectByUid.get(String(task.projectUid || ''))
      const assignment = assignmentByUid.get(String(task.projectAssignmentUid || ''))

      return {
        ...task,
        projectName: project?.projectName || `Project ${compactUid(task.projectUid)}`,
        projectCode: project?.projectCode || compactUid(task.projectUid),
        assignmentStatus: assignment?.status || 'Not mapped',
        hourWork: Number(task.hourWork || 0),
        taskCompletedValue: Number(task.taskCompleted || 0),
        taskInprogressValue: Number(task.taskInprogress || 0),
        taskReworkValue: Number(task.taskRework || 0),
        taskApprovedValue: Number(task.taskApproved || 0),
        taskRejectedValue: Number(task.taskRejected || 0),
        taskReviewedValue: Number(task.taskReviewed || 0)
      }
    }), [assignmentByUid, employeeUid, projectByUid, tasks])

  const filteredTasks = useMemo(() => filterTasksByDatePreset(employeeTaskRows, datePreset), [datePreset, employeeTaskRows])
  const visibleTaskRows = useMemo(() => filterCollectionByQuery(filteredTasks, deferredTaskSearch, [
    'projectName',
    'projectCode',
    'assignmentStatus',
    'remarks',
    'taskDate'
  ]), [filteredTasks, deferredTaskSearch])
  const taskStatusChartData = useMemo(() => buildTaskStatusChartData(filteredTasks), [filteredTasks])
  const hoursChart = useMemo(() => buildTaskHoursChart(employeeTaskRows, datePreset), [datePreset, employeeTaskRows])
  const totalHours = useMemo(() => filteredTasks.reduce((total, task) => total + Number(task.hourWork || 0), 0), [filteredTasks])
  const totalVolume = useMemo(() => filteredTasks.reduce((total, task) => (
    total
    + Number(task.taskCompletedValue || 0)
    + Number(task.taskInprogressValue || 0)
    + Number(task.taskReworkValue || 0)
    + Number(task.taskApprovedValue || 0)
    + Number(task.taskRejectedValue || 0)
    + Number(task.taskReviewedValue || 0)
  ), 0), [filteredTasks])

  const { items: sortedTasks, sortConfig, requestSort } = useSortableData(visibleTaskRows, {
    initialKey: 'updated',
    initialDirection: 'desc',
    accessors: {
      updated: (task) => task.updatedAt || task.createdAt || task.taskDate || '',
      project: (task) => `${task.projectName || ''} ${task.projectCode || ''}`.trim(),
      hours: (task) => Number(task.hourWork || 0),
      completed: (task) => Number(task.taskCompletedValue || 0),
      inprogress: (task) => Number(task.taskInprogressValue || 0),
      rework: (task) => Number(task.taskReworkValue || 0),
      approved: (task) => Number(task.taskApprovedValue || 0),
      reviewed: (task) => Number(task.taskReviewedValue || 0),
      rejected: (task) => Number(task.taskRejectedValue || 0)
    }
  })

  const duplicateTaskEntry = useMemo(() => (
    findDuplicateTaskEntry(tasks, taskDraft, currentTaskUid)
  ), [currentTaskUid, taskDraft.employeeUid, taskDraft.projectUid, taskDraft.taskDate, tasks])

  const duplicateTaskDateMessage = useMemo(() => {
    if (!String(taskDraft.projectUid || '').trim()) return ''
    return duplicateTaskEntry
      ? 'This employee already has a task entry for the selected project on this date.'
      : ''
  }, [duplicateTaskEntry, taskDraft.projectUid])

  const taskErrors = useMemo(() => buildTaskDraftErrors(taskDraft, todayIsoDate, duplicateTaskDateMessage), [duplicateTaskDateMessage, taskDraft, todayIsoDate])

  const maxHours = Math.max(...hoursChart.data.map((entry) => Number(entry.hours || 0)), 0)
  const hourTicks = buildHourTicks(maxHours, hoursChart.yAxisStep)
  const isLoading = employeesQuery.isLoading || projectsQuery.isLoading || assignmentsQuery.isLoading || tasksQuery.isLoading
  const isError = employeesQuery.isError || projectsQuery.isError || assignmentsQuery.isError || tasksQuery.isError

  useEffect(() => {
    if (!isTaskModalOpen) return

    setTaskDraft((current) => {
      const optionProjectUids = projectOptions
        .map((option) => String(option.value || '').trim())
        .filter(Boolean)
      const availableProjectUids = projectOptions
        .filter((option) => !option.disabled)
        .map((option) => String(option.value || '').trim())
        .filter(Boolean)

      const currentProjectUid = String(current.projectUid || '').trim()
      let nextProjectUid = currentProjectUid

      if (!currentProjectUid && optionProjectUids.length === 1) {
        nextProjectUid = optionProjectUids[0]
      } else if (!currentProjectUid && availableProjectUids.length === 1) {
        nextProjectUid = availableProjectUids[0]
      } else if (currentProjectUid && !optionProjectUids.includes(currentProjectUid)) {
        nextProjectUid = ''
      }

      if (nextProjectUid === currentProjectUid) return current

      return {
        ...current,
        projectUid: nextProjectUid,
        projectAssignmentUid: resolveTaskAssignmentUid(assignments, {
          employeeUid,
          projectUid: nextProjectUid,
          preferredUid: current.projectAssignmentUid
        })
      }
    })
  }, [assignments, employeeUid, isTaskModalOpen, projectOptions])

  function resetTaskModal() {
    setTaskModalMode('create')
    setSelectedTask(null)
    setTaskDraft(createTaskDraft({ employeeUid, todayIsoDate }))
    setTaskTouched({})
  }

  function openCreateTask(seedTask = null) {
    if (!canCreateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to add tasks.' })
      return
    }

    setTaskModalMode('create')
    setSelectedTask(null)
    setTaskDraft(createTaskDraft({
      employeeUid,
      todayIsoDate,
      task: seedTask
        ? {
            ...seedTask,
            uid: '',
            taskDate: todayIsoDate,
            hourWork: TASK_DEFAULT_STANDARD_HOURS,
            taskCompleted: 0,
            taskInprogress: 0,
            taskApproved: 0,
            taskReviewed: 0,
            taskRework: 0,
            taskRejected: 0,
            remarks: ''
          }
        : null
    }))
    setTaskTouched({})
    setIsTaskModalOpen(true)
  }

  function openEditTask(task) {
    if (!canUpdateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to edit tasks.' })
      return
    }

    setTaskModalMode('edit')
    setSelectedTask(task)
    setTaskDraft(createTaskDraft({ employeeUid, todayIsoDate, task }))
    setTaskTouched({})
    setIsTaskModalOpen(true)
  }

  function handleTaskDraftChange(event) {
    const { name } = event.target
    const value = name === 'overtime' ? Boolean(event.target.checked) : event.target.value

    setTaskDraft((current) => {
      const next = {
        ...current,
        [name]: name === 'taskDate'
          ? (normalizeDateInput(value || todayIsoDate) || todayIsoDate)
          : value
      }

      if (name === 'overtime' && !next.overtime && parseNonNegativeInteger(next.hourWork, 0) > TASK_DEFAULT_STANDARD_HOURS) {
        next.hourWork = String(TASK_DEFAULT_STANDARD_HOURS)
      }

      if (name === 'hourWork') {
        const parsedHourWork = parseStrictWholeNumber(next.hourWork)
        if (Number.isInteger(parsedHourWork) && parsedHourWork <= TASK_DEFAULT_STANDARD_HOURS && next.overtime) {
          next.overtime = false
        }
      }

      if (name === 'projectUid' || name === 'taskDate') {
        next.projectAssignmentUid = resolveTaskAssignmentUid(assignments, {
          employeeUid,
          projectUid: next.projectUid,
          preferredUid: next.projectAssignmentUid
        })
      }

      return next
    })
  }

  function handleTaskDraftBlur(event) {
    const { name } = event.target
    setTaskTouched((current) => ({ ...current, [name]: true }))
  }

  async function handleSaveTask() {
    if (taskModalMode === 'create' && !canCreateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to add tasks.' })
      return
    }
    if (taskModalMode === 'edit' && !canUpdateTasks) {
      showStatus({ type: 'error', title: 'Task access blocked', message: 'Your role does not have permission to edit tasks.' })
      return
    }

    const touchedFields = ['projectUid', 'taskDate', ...TASK_NUMBER_FIELDS.map((field) => field.key)]
    setTaskTouched(touchedFields.reduce((accumulator, field) => ({ ...accumulator, [field]: true }), {}))
    if (touchedFields.some((field) => taskErrors[field])) {
      showStatus({ type: 'error', title: 'Task form is incomplete', message: 'Fill required fields and resolve validation errors before saving.' })
      return
    }

    const projectAssignmentUid = resolveTaskAssignmentUid(assignments, {
      employeeUid,
      projectUid: taskDraft.projectUid,
      preferredUid: taskDraft.projectAssignmentUid
    })

    if (!projectAssignmentUid) {
      showStatus({
        type: 'error',
        title: 'Project mapping not found',
        message: 'This employee is not mapped to the selected project. Update project assignments before saving the task.'
      })
      return
    }

    const payload = {
      ...taskDraft,
      employeeUid,
      projectAssignmentUid,
      taskDate: normalizeDateInput(taskDraft.taskDate || todayIsoDate) || todayIsoDate,
      hourWork: parseNonNegativeInteger(taskDraft.hourWork, TASK_DEFAULT_STANDARD_HOURS),
      taskCompleted: parseNonNegativeInteger(taskDraft.taskCompleted, 0),
      taskInprogress: parseNonNegativeInteger(taskDraft.taskInprogress, 0),
      taskApproved: parseNonNegativeInteger(taskDraft.taskApproved, 0),
      taskReviewed: parseNonNegativeInteger(taskDraft.taskReviewed, 0),
      taskRework: parseNonNegativeInteger(taskDraft.taskRework, 0),
      taskRejected: parseNonNegativeInteger(taskDraft.taskRejected, 0)
    }

    try {
      await runWithLoader(async () => {
        if (taskModalMode === 'edit') await projectService.updateProjectTask(selectedTask.uid, payload)
        else await projectService.createProjectTask(payload)
        await queryClient.invalidateQueries({ queryKey: TASK_ENTRIES_QUERY_KEY })
      }, {
        title: taskModalMode === 'edit' ? 'Updating task' : 'Adding task',
        message: taskModalMode === 'edit' ? 'Applying task updates.' : 'Saving the new task entry.'
      })

      setIsTaskModalOpen(false)
      resetTaskModal()
      showStatus({ type: 'success', title: taskModalMode === 'edit' ? 'Task updated' : 'Task added', message: taskModalMode === 'edit' ? 'Task has been updated successfully.' : 'Task has been added successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: taskModalMode === 'edit' ? 'Task update failed' : 'Task creation failed', message: normalizeApiError(error, 'The task could not be saved.') })
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
      message: 'This task entry will be removed from the employee task history.',
      confirmLabel: 'Delete'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        await projectService.deleteProjectTask(task.uid)
        await queryClient.invalidateQueries({ queryKey: TASK_ENTRIES_QUERY_KEY })
      }, {
        title: 'Deleting task',
        message: 'Removing task record and refreshing the employee overview.'
      })

      showStatus({ type: 'success', title: 'Task deleted', message: 'Task has been removed successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Task deletion failed', message: normalizeApiError(error, 'The task could not be removed.') })
    }
  }

  if (isLoading) {
    return <div className="text-muted">Loading employee overview…</div>
  }

  if (isError) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-2">Employee overview could not be loaded.</div>
          <div className="text-muted small">One or more task-management requests failed while building this page.</div>
        </div>
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="fw-semibold mb-2">Employee not found.</div>
          <div className="text-muted small">The selected employee could not be matched from the current directory data.</div>
        </div>
      </div>
    )
  }

  const employeeRoleName = String(employee.roleName || '').trim()
  const employeeHeaderMeta = [
    employee.employeeCode || 'No code',
    employeeRoleName,
    employee.department || 'No department'
  ].filter(Boolean)

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
        <div className="d-flex align-items-start gap-3">
          <button
            type="button"
            className="employee-action-btn employee-action-btn-view"
            aria-label="Back"
            onClick={() => navigate('/admin/task-management')}
            style={{ '--action-label-chars': 4 }}
          >
            <span className="employee-action-btn__icon" aria-hidden="true"><ChevronLeftIcon /></span>
            <span className="employee-action-btn__label" aria-hidden="true">Back</span>
          </button>
          <div>
            <h1 className="fw-bold mb-1">Employees Overview</h1>
            <div className="text-muted small">
              {employee.fullName || employee.employeeCode || 'Employee'}{employeeHeaderMeta.length ? ` • ${employeeHeaderMeta.join(' • ')}` : ''}
            </div>
          </div>
        </div>
        <div className="d-flex align-items-center justify-content-end gap-2 flex-wrap">
          <AppDatePresetFilter value={datePreset} onChange={setDatePreset} name="employee-task-overview-range" />
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Task Entries" value={filteredTasks.length} tone="blue" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Hours Worked" value={totalHours} tone="teal" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Total Volume" value={totalVolume} tone="orange" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Projects" value={new Set(filteredTasks.map((task) => String(task.projectUid || ''))).size} tone="purple" /></div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <CardShell title="Task Status Distribution">
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={taskStatusChartData.length ? taskStatusChartData : [{ name: 'No Data', value: 1, color: '#cbd5e1' }]} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
                    {(taskStatusChartData.length ? taskStatusChartData : [{ color: '#cbd5e1' }]).map((entry, index) => (
                      <Cell key={`task-status-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="d-flex flex-wrap gap-2 mt-3">
              {(taskStatusChartData.length ? taskStatusChartData : TASK_STATUS_CHART_CONFIG.map((entry) => ({ name: entry.label, value: 0, color: entry.color, tone: entry.tone }))).map((entry) => (
                <TableBadge key={entry.name} value={`${entry.name}: ${entry.value}`} tone={entry.tone || 'neutral'} />
              ))}
            </div>
          </CardShell>
        </div>

        <div className="col-12 col-xl-8">
          <CardShell title="Hours Worked Trend">
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={hoursChart.data} margin={{ top: 12, right: 12, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={<TaskOverviewAxisTick />} interval={0} height={56} />
                  <YAxis ticks={hourTicks} domain={[0, hourTicks.at(-1) || hoursChart.yAxisStep]} />
                  <Tooltip formatter={(value) => [`${value} hrs`, 'Hours']} />
                  <Bar dataKey="hours" fill="var(--gm-blue, #2563eb)" radius={[12, 12, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>
      </div>

      <CardShell title="Task Entries">
        <div className="employee-toolbar employee-toolbar-top mb-3">
          <AppSearchField
            className="employee-toolbar-search"
            value={taskSearch}
            onChange={(event) => setTaskSearch(event.target.value)}
            placeholder="Search by project, date, status, or remarks"
          />
          <div className="employee-toolbar-actions">
            {canCreateTasks ? (
              <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={() => openCreateTask()}>
                <PlusIcon />
                <span>Add Task</span>
              </button>
            ) : null}
          </div>
        </div>
        <PaginatedTable rows={sortedTasks}>
          {({ rows }) => (
            <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table task-management-table">
              <colgroup>
                <col className="task-col-date" />
                <col className="task-col-project" />
                <col className="task-col-count task-col-hours" />
                <col className="task-col-count" />
                <col className="task-col-count task-col-progress" />
                <col className="task-col-count" />
                <col className="task-col-count" />
                <col className="task-col-count" />
                <col className="task-col-count" />
                <col className="task-col-remarks" />
                <col className="task-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th><SortableHeader label="Task Date" sortKey="updated" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Project" sortKey="project" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="Hours" sortKey="hours" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="Completed" sortKey="completed" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="In Progress" sortKey="inprogress" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="Approved" sortKey="approved" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="Reviewed" sortKey="reviewed" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="Rework" sortKey="rework" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th className="text-center task-count-cell"><SortableHeader label="Rejected" sortKey="rejected" sortConfig={sortConfig} onSort={requestSort} className="justify-content-center" /></th>
                  <th>Remarks</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((task) => (
                  <tr key={task.uid}>
                    <td className="employee-cell-wrap"><TableCellStack title={formatDate(task.taskDate)} subtitle={task.taskDate || '—'} /></td>
                    <td className="employee-cell-wrap"><TableCellStack title={task.projectName} subtitle={task.projectCode} meta={task.assignmentStatus || 'Not mapped'} /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.hourWork || 0)} tone={task.hourWork > 8 ? 'orange' : 'blue'} /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.taskCompletedValue || 0)} tone="green" /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.taskInprogressValue || 0)} tone="blue" /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.taskApprovedValue || 0)} tone="teal" /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.taskReviewedValue || 0)} tone="purple" /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.taskReworkValue || 0)} tone="orange" /></td>
                    <td className="employee-cell-wrap text-center task-count-cell"><TableBadge value={String(task.taskRejectedValue || 0)} tone="red" /></td>
                    <td className="employee-cell-wrap"><TableCellStack title={task.remarks || '—'} /></td>
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
                        <div className="fw-semibold mb-1">No task entries are available for this preset.</div>
                        <div className="text-muted small">Switch the date range or add task records for this employee.</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </PaginatedTable>
      </CardShell>

      <TaskEntryModal
        open={isTaskModalOpen}
        mode={taskModalMode}
        draft={taskDraft}
        errors={taskErrors}
        touched={taskTouched}
        projectOptions={projectOptions}
        duplicateTaskDateMessage={duplicateTaskDateMessage}
        disableDuplicateFields={Boolean(duplicateTaskDateMessage)}
        onChange={handleTaskDraftChange}
        onBlur={handleTaskDraftBlur}
        onClose={() => {
          setIsTaskModalOpen(false)
          resetTaskModal()
        }}
        onSubmit={handleSaveTask}
      />
    </div>
  )
}

const TASK_DEFAULT_STANDARD_HOURS = 8
const TASK_NUMBER_FIELDS = [
  { key: 'hourWork', label: 'Hours worked' },
  { key: 'taskCompleted', label: 'Completed', tone: 'green' },
  { key: 'taskInprogress', label: 'In progress', tone: 'blue' },
  { key: 'taskApproved', label: 'Approved', tone: 'teal' },
  { key: 'taskReviewed', label: 'Reviewed', tone: 'purple' },
  { key: 'taskRework', label: 'Rework', tone: 'orange' },
  { key: 'taskRejected', label: 'Rejected', tone: 'red' }
]
const TASK_STATUS_NUMBER_FIELDS = TASK_NUMBER_FIELDS.filter((field) => field.key !== 'hourWork')

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

function parseNonNegativeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

function parseStrictWholeNumber(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (!/^-?\d+$/.test(raw)) return Number.NaN
  return Number.parseInt(raw, 10)
}

function resolveTaskAssignmentUid(assignments = [], { employeeUid = '', projectUid = '', preferredUid = '' } = {}) {
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

  const sorted = [...compatibleAssignments].sort((left, right) => {
    const leftUpdated = Date.parse(left.updatedAt || left.createdAt || '') || 0
    const rightUpdated = Date.parse(right.updatedAt || right.createdAt || '') || 0
    return rightUpdated - leftUpdated
  })
  return String(sorted[0]?.uid || '')
}

function normalizeTaskEntryDate(value) {
  return normalizeDateInput(value || '') || String(value || '').trim()
}

function getTaskEntryIdentity(task = {}) {
  const employeeUid = String(task.employeeUid || '').trim()
  const projectUid = String(task.projectUid || '').trim()
  const taskDate = normalizeTaskEntryDate(task.taskDate)

  if (!employeeUid || !projectUid || !taskDate) return ''
  return `${employeeUid}::${projectUid}::${taskDate}`
}

function findDuplicateTaskEntry(tasks = [], draft = {}, currentTaskUid = '') {
  const draftIdentity = getTaskEntryIdentity(draft)
  if (!draftIdentity) return null

  const normalizedCurrentTaskUid = String(currentTaskUid || '').trim()
  return (Array.isArray(tasks) ? tasks : []).find((task) => (
    getTaskEntryIdentity(task) === draftIdentity
      && String(task?.uid || '').trim() !== normalizedCurrentTaskUid
  )) || null
}

function createTaskDraft({ employeeUid = '', task = null, todayIsoDate = getTodayIsoDate() } = {}) {
  return {
    employeeUid: task?.employeeUid || employeeUid,
    projectUid: task?.projectUid || '',
    projectAssignmentUid: task?.projectAssignmentUid || '',
    taskDate: normalizeDateInput(task?.taskDate || todayIsoDate) || todayIsoDate,
    hourWork: String(task?.hourWork ?? TASK_DEFAULT_STANDARD_HOURS),
    overtime: Number(task?.hourWork ?? TASK_DEFAULT_STANDARD_HOURS) > TASK_DEFAULT_STANDARD_HOURS,
    taskCompleted: String(task?.taskCompletedValue ?? task?.taskCompleted ?? 0),
    taskInprogress: String(task?.taskInprogressValue ?? task?.taskInprogress ?? 0),
    taskApproved: String(task?.taskApprovedValue ?? task?.taskApproved ?? 0),
    taskReviewed: String(task?.taskReviewedValue ?? task?.taskReviewed ?? 0),
    taskRework: String(task?.taskReworkValue ?? task?.taskRework ?? 0),
    taskRejected: String(task?.taskRejectedValue ?? task?.taskRejected ?? 0),
    remarks: task?.remarks || ''
  }
}

function buildTaskDraftErrors(draft = {}, todayIsoDate = getTodayIsoDate(), duplicateTaskDateMessage = '') {
  const errors = {
    projectUid: String(draft.projectUid || '').trim() ? '' : 'Project is required.',
    taskDate: String(draft.taskDate || '').trim() ? '' : 'Task date is required.'
  }

  if (!errors.taskDate && String(draft.taskDate || '') > todayIsoDate) {
    errors.taskDate = 'Task date cannot be in the future.'
  }

  if (!errors.taskDate && duplicateTaskDateMessage) {
    errors.taskDate = duplicateTaskDateMessage
  }

  TASK_NUMBER_FIELDS.forEach(({ key, label }) => {
    const raw = String(draft[key] ?? '').trim()
    const numeric = Number(raw)
    if (!raw) errors[key] = ''
    else if (!Number.isInteger(numeric)) errors[key] = `${label} must be a whole number.`
    else if (numeric < 0) errors[key] = `${label} cannot be negative.`
    else if (key === 'hourWork' && !draft.overtime && numeric > TASK_DEFAULT_STANDARD_HOURS) errors[key] = `Enable Overtime to log more than ${TASK_DEFAULT_STANDARD_HOURS} hours.`
    else errors[key] = ''
  })

  return errors
}

function TaskEntryModal({
  open,
  mode,
  draft,
  errors,
  touched,
  projectOptions,
  duplicateTaskDateMessage = '',
  disableDuplicateFields = false,
  onChange,
  onBlur,
  onClose,
  onSubmit
}) {
  const showTaskDateError = Boolean(errors.taskDate && (touched.taskDate || duplicateTaskDateMessage))

  return (
    <ModalFrame
      open={open}
      title={mode === 'edit' ? 'Edit Task' : 'Add Task'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={disableDuplicateFields}>{mode === 'edit' ? 'Save Task' : 'Add Task'}</button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12">
          <label className="form-label">Project</label>
          <AppSelect name="projectUid" value={draft.projectUid} onChange={onChange} onBlur={onBlur} options={projectOptions} placeholder="Select project" invalid={Boolean(touched.projectUid && errors.projectUid)} />
          {touched.projectUid && errors.projectUid ? <div className="invalid-feedback d-block">{errors.projectUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Task Date</label>
          <input type="date" name="taskDate" max={getTodayIsoDate()} className={`form-control${showTaskDateError ? ' is-invalid' : ''}`} value={draft.taskDate} onChange={onChange} onBlur={onBlur} />
          {showTaskDateError ? <div className="task-hours-note is-danger small mt-2">{errors.taskDate}</div> : null}
        </div>

        <div className="col-12 col-md-6">
          <div className="task-hours-control">
            <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
              <label className="form-label mb-0">Hours worked</label>
              <div className="form-check task-hours-overtime-toggle">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="employee-task-hours-overtime"
                  name="overtime"
                  checked={Boolean(draft.overtime)}
                  onChange={onChange}
                  onBlur={onBlur}
                  disabled={disableDuplicateFields}
                />
                <label className="form-check-label" htmlFor="employee-task-hours-overtime">Overtime</label>
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
              disabled={disableDuplicateFields}
            />
            {touched.hourWork && errors.hourWork ? <div className="invalid-feedback d-block">{errors.hourWork}</div> : null}
            <div className={`task-hours-note text-muted small ${!draft.overtime ? 'is-highlighted' : ''}`.trim()}>
              Default workday is {TASK_DEFAULT_STANDARD_HOURS} hours. Enable Overtime to log entries above {TASK_DEFAULT_STANDARD_HOURS} hours.
            </div>
          </div>
        </div>

        {TASK_STATUS_NUMBER_FIELDS.map((field) => (
          <div className="col-12 col-md-4" key={field.key}>
            <label className="form-label">
              <span className={`task-status-label task-status-label-${field.tone}`}>{field.label}</span>
            </label>
            <input type="number" min="0" step="1" name={field.key} className={`form-control${touched[field.key] && errors[field.key] ? ' is-invalid' : ''}`} value={draft[field.key]} onChange={onChange} onBlur={onBlur} disabled={disableDuplicateFields} />
            {touched[field.key] && errors[field.key] ? <div className="invalid-feedback d-block">{errors[field.key]}</div> : null}
          </div>
        ))}
        <div className="col-12">
          <label className="form-label">Remarks</label>
          <textarea rows="3" name="remarks" className="form-control" value={draft.remarks} onChange={onChange} onBlur={onBlur} disabled={disableDuplicateFields} />
        </div>
      </div>
    </ModalFrame>
  )
}
