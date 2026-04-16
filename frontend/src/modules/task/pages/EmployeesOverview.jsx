import React, { useMemo, useState } from 'react'
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
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import { ChevronLeftIcon } from '../../../components/common/AppIcons.jsx'
import { TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'
import { useTaskAssignmentsQuery } from '../../../hooks/task/useTaskAssignmentsQuery.js'
import { useTaskEntriesQuery } from '../../../hooks/task/useTaskEntriesQuery.js'
import { useTaskProjectsQuery } from '../../../hooks/task/useTaskProjectsQuery.js'
import { formatDate } from '../../../utils/employee.js'
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
  const [datePreset, setDatePreset] = useState('today')

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

  const { items: sortedTasks, sortConfig, requestSort } = useSortableData(filteredTasks, {
    initialKey: 'taskDate',
    initialDirection: 'desc',
    accessors: {
      taskDate: (task) => task.taskDate || '',
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

  const maxHours = Math.max(...hoursChart.data.map((entry) => Number(entry.hours || 0)), 0)
  const hourTicks = buildHourTicks(maxHours, hoursChart.yAxisStep)
  const isLoading = employeesQuery.isLoading || projectsQuery.isLoading || assignmentsQuery.isLoading || tasksQuery.isLoading
  const isError = employeesQuery.isError || projectsQuery.isError || assignmentsQuery.isError || tasksQuery.isError

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
              {employee.fullName || employee.employeeCode || 'Employee'} • {employee.employeeCode || 'No code'} • {employee.roleName || 'No role'} • {employee.department || 'No department'}
            </div>
          </div>
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
          <CardShell title="Task Status Distribution" right={<AppDatePresetFilter value={datePreset} onChange={setDatePreset} />}>
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
          <CardShell title="Hours Worked Trend" right={<AppDatePresetFilter value={datePreset} onChange={setDatePreset} />}>
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

      <CardShell title="Task Entries" right={<AppDatePresetFilter value={datePreset} onChange={setDatePreset} />}>
        <PaginatedTable rows={sortedTasks}>
          {({ rows }) => (
            <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table task-management-table">
              <thead>
                <tr>
                  <th><SortableHeader label="Task Date" sortKey="taskDate" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Project" sortKey="project" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Hours" sortKey="hours" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Completed" sortKey="completed" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="In Progress" sortKey="inprogress" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Approved" sortKey="approved" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Reviewed" sortKey="reviewed" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Rework" sortKey="rework" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th><SortableHeader label="Rejected" sortKey="rejected" sortConfig={sortConfig} onSort={requestSort} /></th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? rows.map((task) => (
                  <tr key={task.uid}>
                    <td className="employee-cell-wrap"><TableCellStack title={formatDate(task.taskDate)} subtitle={task.taskDate || '—'} /></td>
                    <td className="employee-cell-wrap"><TableCellStack title={task.projectName} subtitle={task.projectCode} meta={task.assignmentStatus || 'Not mapped'} /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.hourWork || 0)} tone={task.hourWork > 8 ? 'orange' : 'blue'} /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.taskCompletedValue || 0)} tone="green" /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.taskInprogressValue || 0)} tone="blue" /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.taskApprovedValue || 0)} tone="teal" /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.taskReviewedValue || 0)} tone="purple" /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.taskReworkValue || 0)} tone="orange" /></td>
                    <td className="employee-cell-wrap"><TableBadge value={String(task.taskRejectedValue || 0)} tone="red" /></td>
                    <td className="employee-cell-wrap"><TableCellStack title={task.remarks || '—'} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="10">
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
    </div>
  )
}
