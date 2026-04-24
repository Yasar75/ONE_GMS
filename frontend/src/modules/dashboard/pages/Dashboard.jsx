import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import AppDatePresetFilter from '../../../components/common/AppDatePresetFilter.jsx'
import AppDateRangeField from '../../../components/common/AppDateRangeField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import PageHeader from '../../../components/common/PageHeader.jsx'
import PageContentLoader from '../../../components/common/PageContentLoader.jsx'
import {
  BellIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ClockIcon,
  FilterIcon,
  RotateCcwIcon,
  SparklesIcon,
  UsersIcon,
  ViewIcon
} from '../../../components/common/AppIcons.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useAdminDashboardQuery } from '../../../hooks/dashboard/useAdminDashboardQuery.js'
import { useEmployeeDashboardQuery } from '../../../hooks/dashboard/useEmployeeDashboardQuery.js'
import {
  PERMISSION_MODULES,
  canAccessAppPath,
  hasModuleVisibility,
  resolveDashboardVariant,
  resolveHomePath
} from '../../../utils/permissions.js'
import {
  buildAdminDashboardSnapshot,
  buildDashboardFilterOptions,
  buildEmployeeDashboardSnapshot
} from '../utils/dashboardInsights.js'

const PIE_COLORS = ['var(--gm-blue)', 'var(--gm-orange)', '#14b8a6', '#a855f7', '#22c55e', '#ef4444']
const KPI_TONES = ['blue', 'orange', 'teal', 'purple', 'green']
const SECTION_LABELS = {
  workforce: 'People',
  attendance: 'Attendance',
  leave: 'Leave',
  project: 'Projects',
  task: 'Tasks',
  general: 'Dashboard'
}
const SECTION_ROUTE_MAP = {
  management: {
    workforce: '/admin/employees-management',
    attendance: '/admin/attendance-management',
    leave: '/admin/leave-management',
    project: '/admin/project-management',
    task: '/admin/task-management',
    general: '/admin/dashboard'
  },
  employee: {
    workforce: '/profile',
    attendance: '/employee/attendance',
    leave: '/employee/apply-leave',
    project: '/profile',
    task: '/profile',
    general: '/profile'
  }
}
const EMPTY_DASHBOARD = {
  kpis: [],
  charts: {},
  widgets: {
    upcomingEvents: [],
    holidayCalendar: [],
    recentlyJoined: [],
    updates: [],
    spotlightProjects: [],
    assignedProjects: []
  }
}

const DASHBOARD_MODULES = [
  {
    id: 'workforce',
    scope: 'management',
    label: 'Workforce',
    shortLabel: 'People',
    icon: <UsersIcon />,
    modules: [
      ...PERMISSION_MODULES.employeeDirectory,
      ...PERMISSION_MODULES.employeeMetadata,
      ...PERMISSION_MODULES.employeeStatus
    ]
  },
  {
    id: 'attendance',
    scope: 'both',
    label: 'Attendance',
    shortLabel: 'Time',
    icon: <ClockIcon />,
    managementModules: [
      ...PERMISSION_MODULES.attendanceOverview,
      ...PERMISSION_MODULES.manageRegularization,
      ...PERMISSION_MODULES.shiftRoster,
      ...PERMISSION_MODULES.assignShift
    ],
    employeeModules: [
      ...PERMISSION_MODULES.myAttendancePreview,
      ...PERMISSION_MODULES.myShift,
      ...PERMISSION_MODULES.manageRegularization
    ]
  },
  {
    id: 'leave',
    scope: 'both',
    label: 'Leave',
    shortLabel: 'Leave',
    icon: <CalendarIcon />,
    managementModules: [
      ...PERMISSION_MODULES.holidayCalendar,
      ...PERMISSION_MODULES.leaveType,
      ...PERMISSION_MODULES.assignLeave,
      ...PERMISSION_MODULES.manageLeave
    ],
    employeeModules: [
      ...PERMISSION_MODULES.holidayCalendar,
      ...PERMISSION_MODULES.leaveRequest,
      ...PERMISSION_MODULES.myLeaveBalance
    ]
  },
  {
    id: 'project',
    scope: 'both',
    label: 'Projects',
    shortLabel: 'Projects',
    icon: <BriefcaseIcon />,
    managementModules: [
      ...PERMISSION_MODULES.project,
      ...PERMISSION_MODULES.projectAssignment
    ],
    employeeModules: [
      ...PERMISSION_MODULES.project,
      ...PERMISSION_MODULES.projectAssignment
    ]
  },
  {
    id: 'task',
    scope: 'both',
    label: 'Tasks',
    shortLabel: 'Tasks',
    icon: <ChecklistIcon />,
    modules: PERMISSION_MODULES.projectTask
  }
]

function createDefaultDashboardFilters() {
  return {
    datePreset: 'overall',
    employeeUid: '',
    projectUid: '',
    department: '',
    position: '',
    projectStatus: '',
    assignmentStatus: '',
    dateRange: {
      start: '',
      end: ''
    }
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function formatNumber(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return value ?? '0'
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(number)
}

function readNumericValue(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function hasChartData(data = [], valueKeys = ['value']) {
  return ensureArray(data).some((entry) => valueKeys.some((key) => readNumericValue(entry?.[key]) > 0))
}

function getModulePermissionKeys(moduleConfig, scope) {
  if (scope === 'management') return moduleConfig.managementModules || moduleConfig.modules || []
  return moduleConfig.employeeModules || moduleConfig.modules || []
}

function getDashboardModules(user, scope) {
  return DASHBOARD_MODULES.filter((moduleConfig) => (
    (moduleConfig.scope === 'both' || moduleConfig.scope === scope)
    && hasModuleVisibility(user, getModulePermissionKeys(moduleConfig, scope))
  ))
}

function hasDashboardModule(modules = [], moduleId) {
  return modules.some((moduleConfig) => moduleConfig.id === moduleId)
}

function resolveKpiModuleId(label = '') {
  const normalizedLabel = String(label).toLowerCase()
  if (/employee|member|people|workforce|role|department/.test(normalizedLabel)) return 'workforce'
  if (/attendance|absent|worked|time/.test(normalizedLabel)) return 'attendance'
  if (/leave|holiday/.test(normalizedLabel)) return 'leave'
  if (/project|assignment/.test(normalizedLabel)) return 'project'
  if (/task|hour/.test(normalizedLabel)) return 'task'
  return 'general'
}

function getVisibleKpis(kpis = [], modules = []) {
  const allowedModuleIds = new Set(modules.map((moduleConfig) => moduleConfig.id))
  const visibleKpis = ensureArray(kpis).filter((kpi) => {
    const moduleId = resolveKpiModuleId(kpi.label)
    return moduleId === 'general' || allowedModuleIds.has(moduleId)
  })

  return visibleKpis.length ? visibleKpis : ensureArray(kpis).slice(0, 4)
}

function getRoleLabel(user) {
  return user?.roleName || user?.role_name || user?.role || 'Role'
}

function getDisplayName(user) {
  return user?.displayName || user?.fullName || user?.firstName || user?.username || 'there'
}

function getSplitTotal(data = [], key = 'value') {
  return ensureArray(data).reduce((total, entry) => total + readNumericValue(entry?.[key]), 0)
}

function countActiveFilters(filterState = {}) {
  return [
    filterState.employeeUid,
    filterState.projectUid,
    filterState.department,
    filterState.position,
    filterState.projectStatus,
    filterState.assignmentStatus,
    filterState.dateRange?.start,
    filterState.dateRange?.end
  ].filter(Boolean).length
}

function resolveSectionRoute(user, scope, moduleId = 'general') {
  const routeMap = SECTION_ROUTE_MAP[scope] || SECTION_ROUTE_MAP.management
  const candidates = [
    routeMap[moduleId],
    routeMap.general,
    resolveHomePath(user),
    '/profile',
    '/dashboard'
  ].filter(Boolean)

  return candidates.find((path) => canAccessAppPath(user, path)) || resolveHomePath(user)
}

function buildPulseFeedMetrics(scope, charts = {}, modules = []) {
  const visibleModuleIds = new Set(ensureArray(modules).map((moduleConfig) => moduleConfig.id))
  const metricSet = scope === 'management'
    ? [
      {
        moduleId: 'workforce',
        label: 'Team members in scope',
        value: getSplitTotal(charts.roleUserSplit?.length ? charts.roleUserSplit : charts.employeeStatusSplit)
      },
      {
        moduleId: 'project',
        label: 'Projects tracked',
        value: getSplitTotal(charts.projectStatusSplit)
      },
      {
        moduleId: 'leave',
        label: 'Leave queue items',
        value: getSplitTotal(charts.leaveReviewSplit)
      },
      {
        moduleId: 'task',
        label: 'Hours logged',
        value: getSplitTotal(charts.taskHoursTrend, 'hours')
      }
    ]
    : [
      {
        moduleId: 'project',
        label: 'Projects tracked',
        value: getSplitTotal(charts.projectStatusSplit)
      },
      {
        moduleId: 'project',
        label: 'Assignment records',
        value: getSplitTotal(charts.assignmentStatusSplit)
      },
      {
        moduleId: 'leave',
        label: 'Leave requests by status',
        value: getSplitTotal(charts.leaveStatusSplit)
      },
      {
        moduleId: 'task',
        label: 'Hours logged',
        value: getSplitTotal(charts.hoursTrend, 'hours')
      }
    ]

  const visibleMetrics = metricSet.filter((metric) => visibleModuleIds.has(metric.moduleId))
  return (visibleMetrics.length ? visibleMetrics : metricSet).slice(0, 4)
}

function ChartEmpty({ label = 'No data available yet.' }) {
  return (
    <div className="dashboard-empty-visual">
      <SparklesIcon />
      <span>{label}</span>
    </div>
  )
}

function DashboardLoader() {
  return <PageContentLoader cards={4} slowDelayMs={5000} showSlowLoader={false} />
}

function DashboardError() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-empty-state">
        <BellIcon />
        <div>
          <div className="fw-semibold">Dashboard data is unavailable</div>
          <div className="text-muted small">Refresh once the connected modules are available.</div>
        </div>
      </div>
    </div>
  )
}

function DashboardSectionButton({ label, onClick, compact = false }) {
  return (
    <button
      type="button"
      className={`dashboard-section-button ${compact ? 'dashboard-section-button-compact' : ''}`.trim()}
      onClick={onClick}
    >
      <ViewIcon />
      <span>{label}</span>
    </button>
  )
}

function DashboardPulseRing({ label, value, total, tone = 'blue', meta }) {
  const numericValue = readNumericValue(value)
  const numericTotal = Math.max(readNumericValue(total), numericValue, 1)
  const percent = Math.max(0, Math.min(100, Math.round((numericValue / numericTotal) * 100)))

  return (
    <div
      className={`dashboard-pulse-ring tone-${tone}`}
      style={{ '--ring-value': `${percent}%` }}
    >
      <div className="dashboard-ring-meter">
        <span>{formatNumber(numericValue)}</span>
      </div>
      <div className="dashboard-ring-copy">
        <strong>{label}</strong>
        <span>{meta || `${percent}% in view`}</span>
      </div>
    </div>
  )
}

function DashboardPulsePanel({ user, scope, modules, updates, charts }) {
  const displayName = getDisplayName(user)
  const roleLabel = getRoleLabel(user)
  const pulseBars = buildPulseFeedMetrics(scope, charts, modules)
  const availableModules = DASHBOARD_MODULES.filter((moduleConfig) => moduleConfig.scope === 'both' || moduleConfig.scope === scope)
  const primarySplit = scope === 'management' ? charts?.projectStatusSplit : charts?.taskStatusSplit
  const secondarySplit = scope === 'management' ? charts?.attendanceStatusSplit : charts?.leaveStatusSplit
  const primaryTotal = getSplitTotal(primarySplit)
  const secondaryTotal = getSplitTotal(secondarySplit)
  const signalTotal = Math.max(primaryTotal + secondaryTotal, 1)
  const pulsePeak = Math.max(...pulseBars.map((metric) => readNumericValue(metric.value)), 1)
  const feedItems = ensureArray(updates).length
    ? ensureArray(updates).slice(0, 2)
    : ['No urgent workspace update right now.']

  return (
    <section className="dashboard-pulse-panel">
      <div className="dashboard-pulse-copy">
        <div className="dashboard-eyebrow">
          <SparklesIcon />
          <span>{scope === 'management' ? 'Operations dashboard' : 'Workspace dashboard'}</span>
        </div>
        <h2>{`Welcome, ${displayName}`}</h2>
        <p>
          {scope === 'management'
            ? 'Track people, attendance, leave, projects, and task execution from a single filtered view.'
            : 'Review your attendance, leave, project workload, and task progress from one place.'}
        </p>

        <div className="dashboard-context-grid">
          <div className="dashboard-context-item">
            <span>Signed in as</span>
            <strong>{roleLabel}</strong>
          </div>
          <div className="dashboard-context-item dashboard-context-item-wide">
            <span>Workspace access</span>
            <strong>{modules.length ? modules.map((moduleConfig) => moduleConfig.shortLabel).join(' • ') : 'Dashboard access only'}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-pulse-rings">
        <DashboardPulseRing
          label="Modules available"
          value={modules.length}
          total={availableModules.length}
          tone="blue"
          meta={`${roleLabel} workspace access`}
        />
        <DashboardPulseRing
          label={scope === 'management' ? 'Projects in view' : 'Task updates'}
          value={primaryTotal}
          total={signalTotal}
          tone="orange"
          meta={scope === 'management' ? 'Project records in the selected filters' : 'Task status changes in the current view'}
        />
        <DashboardPulseRing
          label={scope === 'management' ? 'Attendance records' : 'Leave requests'}
          value={secondaryTotal}
          total={signalTotal}
          tone="teal"
          meta={scope === 'management' ? 'Attendance entries in the selected filters' : 'Leave requests in the current view'}
        />
      </div>

      <div className="dashboard-pulse-feed">
        <div className="dashboard-pulse-bars" aria-hidden="true">
          {pulseBars.map((metric, index) => {
            const value = readNumericValue(metric.value)
            const width = `${Math.max(8, Math.min(100, Math.round((value / pulsePeak) * 100)))}%`
            return (
              <div className="dashboard-pulse-bar" key={`${metric.label}-${index}`}>
                <span>{metric.label}</span>
                <strong>{formatNumber(metric.value)}</strong>
                <i style={{ '--bar-width': width }} />
              </div>
            )
          })}
        </div>
        <div className="dashboard-pulse-updates">
          {feedItems.map((update, index) => (
            <span key={`${update}-${index}`}>{update}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function DashboardCrossRow({ children, variant = 'chart-list' }) {
  const items = React.Children.toArray(children).filter(Boolean)
  if (!items.length) return null

  return (
    <div className={`dashboard-cross-row dashboard-cross-row-${Math.min(items.length, 3)} dashboard-cross-row--${variant}`}>
      {items}
    </div>
  )
}

function DashboardKpiCard({ item, index }) {
  const tone = item.tone || KPI_TONES[index % KPI_TONES.length]
  const value = readNumericValue(item.value)
  const progress = Math.max(12, Math.min(100, value ? value * 8 : 12))

  return (
    <article className={`dashboard-kpi-card tone-${tone}`}>
      <div className="dashboard-kpi-accent" />
      <div className="dashboard-kpi-topline">
        <span>{item.label}</span>
        <CheckCircleIcon />
      </div>
      <div className="dashboard-kpi-value">{formatNumber(item.value)}</div>
      <div className="dashboard-kpi-helper">{item.helper || 'Current snapshot'}</div>
      <div className="dashboard-kpi-track">
        <span style={{ width: `${progress}%` }} />
      </div>
    </article>
  )
}

function DashboardPanel({ title, eyebrow, icon, children, className = '', action = null, right = null }) {
  return (
    <section className={`dashboard-panel ${className}`.trim()}>
      <div className="dashboard-panel-header">
        <div>
          {eyebrow ? <div className="dashboard-panel-eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
        </div>
        <div className="dashboard-panel-header-actions">
          {action ? <DashboardSectionButton compact label={action.label} onClick={action.onClick} /> : null}
          {right}
          <div className="dashboard-panel-icon">{icon}</div>
        </div>
      </div>
      <div className="dashboard-panel-body">{children}</div>
    </section>
  )
}

function HoursTrendChart({ data }) {
  const chartData = ensureArray(data)
  if (!hasChartData(chartData, ['hours'])) return <ChartEmpty label="No hours logged for this view." />

  return (
    <div className="dashboard-chart dashboard-chart-tall">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--gm-blue)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--gm-blue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval={0} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip
            formatter={(value) => [`${value} hrs`, 'Hours']}
            labelFormatter={(label, payload) => {
              const detail = payload?.[0]?.payload?.secondaryLabel
              return detail ? `${label} • ${detail}` : label
            }}
          />
          <Area type="monotone" dataKey="hours" stroke="var(--gm-blue)" strokeWidth={3} fill="url(#hoursGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function DepartmentHoursChart({ data }) {
  const chartData = ensureArray(data)
  if (!hasChartData(chartData, ['hours'])) return <ChartEmpty label="No department hours recorded." />

  return (
    <div className="dashboard-chart dashboard-chart-tall">
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis type="category" dataKey="name" width={88} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip />
          <Bar dataKey="hours" fill="#14b8a6" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function ProjectMetricChart({ data, dataKey, emptyLabel, color = 'var(--gm-blue)' }) {
  const chartData = ensureArray(data)
  if (!hasChartData(chartData, [dataKey])) return <ChartEmpty label={emptyLabel} />

  return (
    <div className="dashboard-chart dashboard-chart-tall">
      <ResponsiveContainer>
        <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip />
          <Bar dataKey={dataKey} fill={color} radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SplitDonutChart({ data, emptyLabel = 'No split data recorded.' }) {
  const chartData = ensureArray(data)
  if (!hasChartData(chartData, ['value'])) return <ChartEmpty label={emptyLabel} />

  return (
    <div className="dashboard-chart dashboard-chart-tall">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius="52%"
            outerRadius="78%"
            paddingAngle={3}
            labelLine={false}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {chartData.map((_, index) => (
              <Cell key={`dashboard-split-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function TaskStatusChart({ data }) {
  const chartData = ensureArray(data)
  if (!hasChartData(chartData, ['value'])) return <ChartEmpty label="No task activity recorded for this view." />

  return (
    <div className="dashboard-chart dashboard-chart-compact">
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="var(--gm-orange)" radius={[8, 8, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function DashboardList({ items, emptyLabel, compact = false }) {
  const rows = ensureArray(items)
  if (!rows.length) return <ChartEmpty label={emptyLabel} />

  return (
    <div className={`dashboard-list ${compact ? 'dashboard-list-compact' : ''}`.trim()}>
      {rows.map((item, index) => (
        <div className="dashboard-list-item" key={`${item.title || item.name || item}-${index}`}>
          <div className="dashboard-list-index">{String(index + 1).padStart(2, '0')}</div>
          <div className="dashboard-list-content">
            <div className="dashboard-list-title">{item.title || item.name || item}</div>
            <div className="dashboard-list-meta">{item.meta || item.dept || item.date || 'Workspace update'}</div>
          </div>
          {item.date ? <span className="dashboard-list-tag">{item.date}</span> : null}
        </div>
      ))}
    </div>
  )
}

function DashboardSplitListPanel({ title, eyebrow, icon, data, emptyLabel, action = null }) {
  const rows = ensureArray(data).filter((item) => readNumericValue(item.value) > 0)
  const total = Math.max(getSplitTotal(rows), 1)

  return (
    <DashboardPanel title={title} eyebrow={eyebrow} icon={icon} action={action}>
      {rows.length ? (
        <div className="dashboard-breakdown-list">
          {rows.map((item, index) => {
            const value = readNumericValue(item.value)
            const percent = Math.max(6, Math.min(100, Math.round((value / total) * 100)))
            return (
              <div className="dashboard-breakdown-item" key={`${item.name}-${index}`}>
                <div className="dashboard-breakdown-row">
                  <span>{item.name}</span>
                  <strong>{formatNumber(value)}</strong>
                </div>
                <div className="dashboard-breakdown-track">
                  <span style={{ '--bar-width': `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <ChartEmpty label={emptyLabel} />
      )}
    </DashboardPanel>
  )
}

function UpdatesPanel({ updates, action }) {
  const items = ensureArray(updates).map((update) => ({ title: update, meta: 'Important update' }))
  return (
    <DashboardPanel title="Key Updates" eyebrow="Signals" icon={<BellIcon />} action={action}>
      <DashboardList items={items} emptyLabel="No updates available." compact />
    </DashboardPanel>
  )
}

function RoleCountsPanel({ data, action }) {
  return (
    <DashboardSplitListPanel
      title="Team Members by Role"
      eyebrow="People"
      icon={<UsersIcon />}
      data={data}
      emptyLabel="No role headcount is available."
      action={action}
    />
  )
}

function DashboardFiltersBar({ scope, filterState, onFilterChange, onDatePresetChange, onDateRangeChange, onReset, filterOptions }) {
  const hasActiveFilters = filterState.datePreset !== 'overall' || countActiveFilters(filterState) > 0
  const filterFields = [
    { key: 'employeeUid', label: 'Employee', options: filterOptions.employees, hideInEmployeeScope: true },
    { key: 'projectUid', label: 'Project', options: filterOptions.projects },
    { key: 'department', label: 'Department', options: filterOptions.departments, hideInEmployeeScope: true },
    { key: 'position', label: 'Position', options: filterOptions.positions, hideInEmployeeScope: true },
    { key: 'projectStatus', label: 'Project status', options: filterOptions.projectStatuses },
    { key: 'assignmentStatus', label: 'Assignment status', options: filterOptions.assignmentStatuses }
  ].filter((field) => {
    if (scope === 'employee' && field.hideInEmployeeScope) return false
    return ensureArray(field.options).length > 1
  })

  return (
    <section className="dashboard-filter-shell">
      <div className="dashboard-filter-header">
        <div>
          <div className="dashboard-panel-eyebrow">Filters</div>
          <h2>Adjust the dashboard view</h2>
        </div>
        <AppDatePresetFilter
          value={filterState.datePreset}
          onChange={onDatePresetChange}
          includeOverall
          className="dashboard-date-preset-filter"
          name={`dashboard-date-preset-${scope}`}
        />
      </div>

      <div className="dashboard-filter-grid">
        {filterFields.map((field) => (
          <div className="dashboard-filter-field" key={field.key}>
            <label className="form-label small text-muted d-flex align-items-center gap-2">
              <FilterIcon />
              {field.label}
            </label>
            <AppSelect
              value={filterState[field.key]}
              onChange={(nextValue) => onFilterChange(field.key, nextValue)}
              options={field.options}
              placeholder={field.options?.[0]?.label || `All ${field.label.toLowerCase()}s`}
            />
          </div>
        ))}

        <div className="dashboard-filter-field dashboard-filter-field-range">
          <label className="form-label small text-muted d-flex align-items-center gap-2">
            <FilterIcon />
            Date range
          </label>
          <AppDateRangeField
            value={filterState.dateRange}
            onChange={onDateRangeChange}
            className="dashboard-range-field"
            placeholder="[Select range]"
          />
        </div>

        <div className="dashboard-filter-actions">
          <button
            type="button"
            className="dashboard-filter-reset"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            <RotateCcwIcon />
            <span>Reset</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function DashboardLayout({ rawData, user, scope, title, tagline, buildSnapshot, children }) {
  const navigate = useNavigate()
  const [filterState, setFilterState] = useState(() => createDefaultDashboardFilters())
  const modules = useMemo(() => getDashboardModules(user, scope), [user, scope])
  const filterOptions = useMemo(() => buildDashboardFilterOptions(rawData?.raw || {}), [rawData?.raw])
  const dashboardData = useMemo(() => (
    buildSnapshot(rawData?.raw || {}, filterState)
  ), [buildSnapshot, filterState, rawData?.raw])
  const visibleKpis = useMemo(() => getVisibleKpis(dashboardData.kpis, modules), [dashboardData.kpis, modules])

  function openSection(moduleId = 'general') {
    navigate(resolveSectionRoute(user, scope, moduleId))
  }

  function createSectionAction(moduleId = 'general') {
    return {
      label: `Open ${SECTION_LABELS[moduleId] || 'Section'}`,
      onClick: () => openSection(moduleId)
    }
  }

  function handleFilterChange(key, value) {
    setFilterState((current) => ({
      ...current,
      [key]: value
    }))
  }

  function handleDateRangeChange(nextRange) {
    setFilterState((current) => ({
      ...current,
      dateRange: {
        start: nextRange?.start || '',
        end: nextRange?.end || ''
      }
    }))
  }

  function resetFilters() {
    setFilterState(createDefaultDashboardFilters())
  }

  return (
    <div className="dashboard-page">
      <PageHeader title={title} tagline={tagline} />

      <DashboardFiltersBar
        scope={scope}
        filterState={filterState}
        onFilterChange={handleFilterChange}
        onDatePresetChange={(nextValue) => handleFilterChange('datePreset', nextValue)}
        onDateRangeChange={handleDateRangeChange}
        onReset={resetFilters}
        filterOptions={filterOptions}
      />

      <DashboardPulsePanel
        user={user}
        scope={scope}
        modules={modules}
        updates={dashboardData.widgets?.updates}
        charts={dashboardData.charts}
      />

      <div className="dashboard-kpi-grid">
        {visibleKpis.map((item, index) => (
          <DashboardKpiCard
            item={item}
            index={index}
            key={`${item.label}-${index}`}
          />
        ))}
      </div>

      {children({
        modules,
        dashboardData: dashboardData || EMPTY_DASHBOARD,
        createSectionAction,
        openSection
      })}
    </div>
  )
}

function AdminDashboardView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useAdminDashboardQuery(true)

  if (isLoading) return <DashboardLoader />
  if (isError) return <DashboardError />

  return (
    <DashboardLayout
      rawData={data}
      user={user}
      scope="management"
      title="Dashboard"
      tagline="Organization overview for the work that needs attention right now."
      buildSnapshot={buildAdminDashboardSnapshot}
    >
      {({ modules, dashboardData, createSectionAction }) => {
        const charts = dashboardData.charts || {}
        const widgets = dashboardData.widgets || {}

        return (
          <div className="dashboard-cross-stack">
            <DashboardCrossRow variant="chart-list-chart">
              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="Task Output by Project" eyebrow="Project work" icon={<ChecklistIcon />} action={createSectionAction('task')}>
                  <ProjectMetricChart
                    data={charts.projectTaskVolume}
                    dataKey="tasks"
                    color="var(--gm-orange)"
                    emptyLabel="No task output recorded for the selected view."
                  />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="Hours Logged by Project" eyebrow="Project work" icon={<ClockIcon />} action={createSectionAction('task')}>
                  <ProjectMetricChart
                    data={charts.projectHours}
                    dataKey="hours"
                    color="#14b8a6"
                    emptyLabel="No project hours recorded for the selected view."
                  />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'project') ? (
                <DashboardPanel title="Projects by Status" eyebrow="Portfolio" icon={<BriefcaseIcon />} action={createSectionAction('project')}>
                  <SplitDonutChart data={charts.projectStatusSplit} emptyLabel="No project status data recorded." />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="chart-list-chart">
              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="Hours Logged Over Time" eyebrow="Trend" icon={<ChecklistIcon />} action={createSectionAction('task')}>
                  <HoursTrendChart data={charts.taskHoursTrend} />
                </DashboardPanel>
              ) : null}

              <UpdatesPanel updates={widgets.updates} action={createSectionAction('general')} />

              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="Task Activity by Status" eyebrow="Delivery" icon={<CheckCircleIcon />} action={createSectionAction('task')}>
                  <TaskStatusChart data={charts.taskStatusSplit} />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="list-list-chart">
              {hasDashboardModule(modules, 'leave') ? (
                <DashboardSplitListPanel
                  title="Leave Review Queue"
                  eyebrow="Leave"
                  icon={<CalendarIcon />}
                  data={charts.leaveReviewSplit}
                  emptyLabel="No leave reviews are pending."
                  action={createSectionAction('leave')}
                />
              ) : null}

              {hasDashboardModule(modules, 'leave') ? (
                <DashboardPanel title="Upcoming Events" eyebrow="Calendar" icon={<CalendarIcon />} action={createSectionAction('leave')}>
                  <DashboardList items={widgets.upcomingEvents?.length ? widgets.upcomingEvents : widgets.holidayCalendar} emptyLabel="No upcoming events found." />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'attendance') ? (
                <DashboardSplitListPanel
                  title="Attendance Breakdown"
                  eyebrow="Attendance"
                  icon={<ClockIcon />}
                  data={charts.attendanceStatusSplit}
                  emptyLabel="No attendance records found for this view."
                  action={createSectionAction('attendance')}
                />
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="list-list-chart">
              {hasDashboardModule(modules, 'workforce') ? (
                <RoleCountsPanel data={charts.roleUserSplit} action={createSectionAction('workforce')} />
              ) : null}

              {hasDashboardModule(modules, 'workforce') ? (
                <DashboardPanel title="Recent Joiners" eyebrow="People" icon={<UsersIcon />} action={createSectionAction('workforce')}>
                  <DashboardList items={widgets.recentlyJoined} emptyLabel="No recently joined members found." />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'workforce') ? (
                <DashboardPanel title="Employee Status Breakdown" eyebrow="Directory" icon={<UsersIcon />} action={createSectionAction('workforce')}>
                  <SplitDonutChart data={charts.employeeStatusSplit} emptyLabel="No employee status data recorded." />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="chart-list">
              {hasDashboardModule(modules, 'workforce') ? (
                <DashboardSplitListPanel
                  title="Work Location Breakdown"
                  eyebrow="Workforce"
                  icon={<UsersIcon />}
                  data={charts.workLocationSplit}
                  emptyLabel="No work location split recorded."
                  action={createSectionAction('workforce')}
                />
              ) : null}

              {hasDashboardModule(modules, 'workforce') ? (
                <DashboardPanel title="Hours Logged by Department" eyebrow="Workload" icon={<UsersIcon />} action={createSectionAction('workforce')}>
                  <DepartmentHoursChart data={charts.departmentHours} />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            {hasDashboardModule(modules, 'project') ? (
              <DashboardCrossRow variant="list-chart">
                <DashboardPanel title="Recent Project Updates" eyebrow="Portfolio" icon={<BriefcaseIcon />} action={createSectionAction('project')}>
                  <DashboardList items={widgets.spotlightProjects} emptyLabel="No project updates available." />
                </DashboardPanel>
              </DashboardCrossRow>
            ) : null}
          </div>
        )
      }}
    </DashboardLayout>
  )
}

function EmployeeDashboardView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useEmployeeDashboardQuery(true)

  if (isLoading) return <DashboardLoader />
  if (isError) return <DashboardError />

  return (
    <DashboardLayout
      rawData={data}
      user={user}
      scope="employee"
      title="Dashboard"
      tagline="Your workspace view for attendance, leave, assigned projects, and task progress."
      buildSnapshot={buildEmployeeDashboardSnapshot}
    >
      {({ modules, dashboardData, createSectionAction }) => {
        const charts = dashboardData.charts || {}
        const widgets = dashboardData.widgets || {}

        return (
          <div className="dashboard-cross-stack">
            <DashboardCrossRow variant="chart-list">
              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="My Task Output by Project" eyebrow="Project work" icon={<ChecklistIcon />} action={createSectionAction('task')}>
                  <ProjectMetricChart
                    data={charts.projectTaskVolume}
                    dataKey="tasks"
                    color="var(--gm-orange)"
                    emptyLabel="No task output recorded for this view."
                  />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="My Hours by Project" eyebrow="Project work" icon={<ClockIcon />} action={createSectionAction('task')}>
                  <ProjectMetricChart
                    data={charts.projectHours}
                    dataKey="hours"
                    color="#14b8a6"
                    emptyLabel="No project hours recorded for this view."
                  />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="list-list-chart">
              {hasDashboardModule(modules, 'project') ? (
                <DashboardPanel title="Assigned Projects" eyebrow="Projects" icon={<BriefcaseIcon />} action={createSectionAction('project')}>
                  <DashboardList items={widgets.assignedProjects} emptyLabel="No assigned projects found." />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'project') ? (
                <DashboardSplitListPanel
                  title="Assignment Status Breakdown"
                  eyebrow="Assignments"
                  icon={<BriefcaseIcon />}
                  data={charts.assignmentStatusSplit}
                  emptyLabel="No assignment status data recorded."
                  action={createSectionAction('project')}
                />
              ) : null}

              {hasDashboardModule(modules, 'project') ? (
                <DashboardPanel title="Assigned Projects by Status" eyebrow="Projects" icon={<BriefcaseIcon />} action={createSectionAction('project')}>
                  <SplitDonutChart data={charts.projectStatusSplit} emptyLabel="No project status data recorded." />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="chart-list-chart">
              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="Hours Logged Over Time" eyebrow="Trend" icon={<ChecklistIcon />} action={createSectionAction('task')}>
                  <HoursTrendChart data={charts.hoursTrend} />
                </DashboardPanel>
              ) : null}

              <DashboardPanel title="Profile Snapshot" eyebrow="Workspace" icon={<UsersIcon />} action={createSectionAction('workforce')}>
                <DashboardList items={widgets.recentlyJoined} emptyLabel="No profile snapshot available." />
              </DashboardPanel>

              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="My Task Status Breakdown" eyebrow="Tasks" icon={<CheckCircleIcon />} action={createSectionAction('task')}>
                  <SplitDonutChart data={charts.taskStatusSplit} emptyLabel="No task status data recorded." />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="list-chart">
              <UpdatesPanel updates={widgets.updates} action={createSectionAction('general')} />

              {hasDashboardModule(modules, 'task') ? (
                <DashboardPanel title="My Task Activity by Status" eyebrow="Tasks" icon={<ChecklistIcon />} action={createSectionAction('task')}>
                  <TaskStatusChart data={charts.taskStatusSplit} />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>

            <DashboardCrossRow variant="list-list-chart">
              {hasDashboardModule(modules, 'leave') ? (
                <DashboardPanel title="Holiday & Leave Calendar" eyebrow="Leave" icon={<CalendarIcon />} action={createSectionAction('leave')}>
                  <DashboardList items={widgets.upcomingEvents?.length ? widgets.upcomingEvents : widgets.holidayCalendar} emptyLabel="No holidays configured." />
                </DashboardPanel>
              ) : null}

              {hasDashboardModule(modules, 'leave') ? (
                <DashboardSplitListPanel
                  title="Leave Status Breakdown"
                  eyebrow="Leave"
                  icon={<CalendarIcon />}
                  data={charts.leaveStatusSplit}
                  emptyLabel="No leave status data recorded."
                  action={createSectionAction('leave')}
                />
              ) : null}

              {hasDashboardModule(modules, 'attendance') ? (
                <DashboardPanel title="Attendance Breakdown" eyebrow="Attendance" icon={<ClockIcon />} action={createSectionAction('attendance')}>
                  <SplitDonutChart data={charts.attendanceStatusSplit} emptyLabel="No attendance status data recorded." />
                </DashboardPanel>
              ) : null}
            </DashboardCrossRow>
          </div>
        )
      }}
    </DashboardLayout>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const dashboardVariant = resolveDashboardVariant(user)

  if (dashboardVariant === 'management') return <AdminDashboardView />
  return <EmployeeDashboardView />
}
