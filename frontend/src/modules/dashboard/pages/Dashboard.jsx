import React, { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import PageHeader from '../../../components/common/PageHeader.jsx'
import PageContentLoader from '../../../components/common/PageContentLoader.jsx'
import {
  BellIcon,
  BriefcaseIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ClockIcon,
  SparklesIcon,
  UsersIcon
} from '../../../components/common/AppIcons.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useAdminDashboardQuery } from '../../../hooks/dashboard/useAdminDashboardQuery.js'
import { useEmployeeDashboardQuery } from '../../../hooks/dashboard/useEmployeeDashboardQuery.js'
import {
  PERMISSION_MODULES,
  hasModuleVisibility,
  resolveDashboardVariant
} from '../../../utils/permissions.js'

const PIE_COLORS = ['var(--gm-blue)', 'var(--gm-orange)', '#14b8a6', '#a855f7', '#22c55e', '#ef4444']
const KPI_TONES = ['blue', 'orange', 'teal', 'purple', 'green']
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
  if (/employee|member|people|workforce/.test(normalizedLabel)) return 'workforce'
  if (/present|absent|worked|attendance|shift|punch/.test(normalizedLabel)) return 'attendance'
  if (/leave|holiday/.test(normalizedLabel)) return 'leave'
  if (/project|assignment/.test(normalizedLabel)) return 'project'
  if (/hour|task|approved|logged/.test(normalizedLabel)) return 'task'
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

function getSplitTotal(data = []) {
  return ensureArray(data).reduce((total, entry) => total + readNumericValue(entry?.value), 0)
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

function DashboardPulsePanel({ user, scope, modules, kpis, updates, charts }) {
  const visibleUpdates = ensureArray(updates)
  const displayName = user?.displayName || user?.fullName || user?.firstName || 'there'
  const roleLabel = getRoleLabel(user)
  const leaderKpis = ensureArray(kpis).slice(0, 4)
  const availableModules = DASHBOARD_MODULES.filter((moduleConfig) => moduleConfig.scope === 'both' || moduleConfig.scope === scope)
  const primarySplit = scope === 'management' ? charts?.projectStatusSplit : charts?.taskStatusSplit
  const secondarySplit = scope === 'management' ? charts?.attendanceStatusSplit : charts?.leaveStatusSplit
  const primaryTotal = getSplitTotal(primarySplit)
  const secondaryTotal = getSplitTotal(secondarySplit)
  const signalTotal = Math.max(primaryTotal + secondaryTotal, 1)
  const kpiPeak = Math.max(...leaderKpis.map((kpi) => readNumericValue(kpi.value)), 1)
  const feedItems = visibleUpdates.length
    ? visibleUpdates.slice(0, 2)
    : ['No urgent workspace update right now.']

  return (
    <section className="dashboard-pulse-panel">
      <div className="dashboard-pulse-copy">
        <div className="dashboard-eyebrow">
          <SparklesIcon />
          <span>{scope === 'management' ? 'Operational pulse' : 'Today focus'}</span>
        </div>
        <h2>{scope === 'management' ? "Today's team pulse" : `Welcome back, ${displayName}`}</h2>
        <p>{scope === 'management' ? 'People, attendance, projects, and approvals that need a quick look today.' : 'Your attendance, leave, projects, and task updates for the day.'}</p>
        <div className="dashboard-permission-strip">
          <span className="dashboard-role-pill">{roleLabel}</span>
          {modules.map((moduleConfig) => (
            <span className="dashboard-module-pill" key={moduleConfig.id}>
              {moduleConfig.icon}
              {moduleConfig.shortLabel}
            </span>
          ))}
        </div>
      </div>

      <div className="dashboard-pulse-rings">
        <DashboardPulseRing
          label="Visible modules"
          value={modules.length}
          total={availableModules.length}
          tone="blue"
          meta={`${roleLabel} access`}
        />
        <DashboardPulseRing
          label={scope === 'management' ? 'Portfolio signals' : 'Task signals'}
          value={primaryTotal}
          total={signalTotal}
          tone="orange"
          meta="Split volume"
        />
        <DashboardPulseRing
          label={scope === 'management' ? 'Attendance signals' : 'Leave signals'}
          value={secondaryTotal}
          total={signalTotal}
          tone="teal"
          meta="Status volume"
        />
      </div>

      <div className="dashboard-pulse-feed">
        <div className="dashboard-pulse-bars" aria-hidden="true">
          {leaderKpis.map((kpi, index) => {
            const value = readNumericValue(kpi.value)
            const width = `${Math.max(8, Math.min(100, Math.round((value / kpiPeak) * 100)))}%`
            return (
              <div className="dashboard-pulse-bar" key={`${kpi.label}-${index}`}>
                <span>{kpi.label}</span>
                <strong>{formatNumber(kpi.value)}</strong>
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

function DashboardPanel({ title, eyebrow, icon, children, className = '', right = null }) {
  return (
    <section className={`dashboard-panel ${className}`.trim()}>
      <div className="dashboard-panel-header">
        <div>
          {eyebrow ? <div className="dashboard-panel-eyebrow">{eyebrow}</div> : null}
          <h2>{title}</h2>
        </div>
        <div className="dashboard-panel-icon">{icon}</div>
        {right}
      </div>
      <div className="dashboard-panel-body">{children}</div>
    </section>
  )
}

function HoursTrendChart({ data, titleKey = 'hours' }) {
  const chartData = ensureArray(data)
  if (!hasChartData(chartData, [titleKey])) return <ChartEmpty label="No hours logged for this period." />

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
          <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip />
          <Area type="monotone" dataKey={titleKey} stroke="var(--gm-blue)" strokeWidth={3} fill="url(#hoursGradient)" />
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
  if (!hasChartData(chartData, ['value'])) return <ChartEmpty label="No task status volume yet." />

  return (
    <div className="dashboard-chart dashboard-chart-compact">
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 12, right: 16, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} interval={0} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="var(--gm-orange)" strokeWidth={3} dot={{ r: 4 }} />
        </LineChart>
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

function DashboardSplitListPanel({ title, eyebrow, icon, data, emptyLabel }) {
  const rows = ensureArray(data).filter((item) => readNumericValue(item.value) > 0)
  const total = Math.max(getSplitTotal(rows), 1)

  return (
    <DashboardPanel title={title} eyebrow={eyebrow} icon={icon}>
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

function UpdatesPanel({ updates }) {
  const items = ensureArray(updates).map((update) => ({ title: update, meta: 'Important update' }))
  return (
    <DashboardPanel title="Important Updates" eyebrow="Signals" icon={<BellIcon />}>
      <DashboardList items={items} emptyLabel="No updates available." compact />
    </DashboardPanel>
  )
}

function RoleCountsPanel({ data }) {
  return (
    <DashboardSplitListPanel
      title="Users by Role"
      eyebrow="Headcount"
      icon={<UsersIcon />}
      data={data}
      emptyLabel="No role headcount is available."
    />
  )
}

function DashboardLayout({ data, user, scope, title, tagline, children }) {
  const dashboardData = data || EMPTY_DASHBOARD
  const modules = useMemo(() => getDashboardModules(user, scope), [user, scope])
  const visibleKpis = useMemo(() => getVisibleKpis(dashboardData.kpis, modules), [dashboardData.kpis, modules])

  return (
    <div className="dashboard-page">
      <PageHeader title={title} tagline={tagline} />
      <DashboardPulsePanel
        user={user}
        scope={scope}
        modules={modules}
        kpis={visibleKpis}
        updates={dashboardData.widgets?.updates}
        charts={dashboardData.charts}
      />

      <div className="dashboard-kpi-grid">
        {visibleKpis.map((item, index) => (
          <DashboardKpiCard item={item} index={index} key={`${item.label}-${index}`} />
        ))}
      </div>

      {children(modules, dashboardData)}
    </div>
  )
}

function AdminDashboardView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useAdminDashboardQuery(true)

  if (isLoading) return <DashboardLoader />
  if (isError) return <DashboardError />

  const dashboardData = data || EMPTY_DASHBOARD
  const charts = dashboardData.charts || {}
  const widgets = dashboardData.widgets || {}

  return (
    <DashboardLayout
      data={dashboardData}
      user={user}
      scope="management"
      title="Dashboard"
      tagline="Organization overview for the work that needs attention today."
    >
      {(modules) => (
        <div className="dashboard-cross-stack">
          <DashboardCrossRow variant="chart-list-chart">
            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Project Tasks Performed" eyebrow="Project work" icon={<ChecklistIcon />}>
                <ProjectMetricChart
                  data={charts.projectTaskVolume}
                  dataKey="tasks"
                  color="var(--gm-orange)"
                  emptyLabel="No project task volume recorded."
                />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Project Hours Performed" eyebrow="Project work" icon={<ClockIcon />}>
                <ProjectMetricChart
                  data={charts.projectHours}
                  dataKey="hours"
                  color="#14b8a6"
                  emptyLabel="No project hours recorded."
                />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'project') ? (
              <DashboardPanel title="Project Status" eyebrow="Portfolio" icon={<BriefcaseIcon />}>
                <SplitDonutChart data={charts.projectStatusSplit} emptyLabel="No project status split recorded." />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="chart-list-chart">
            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Task Hours Trend" eyebrow="Last seven days" icon={<ChecklistIcon />}>
                <HoursTrendChart data={charts.taskHoursTrend} />
              </DashboardPanel>
            ) : null}

            <UpdatesPanel updates={widgets.updates} />

            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Task Status Volume" eyebrow="Delivery health" icon={<CheckCircleIcon />}>
                <TaskStatusChart data={charts.taskStatusSplit} />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="list-list-chart">
            {hasDashboardModule(modules, 'leave') ? (
              <DashboardSplitListPanel
                title="Employee Leave Reviews"
                eyebrow="Leave queue"
                icon={<CalendarIcon />}
                data={charts.leaveReviewSplit}
                emptyLabel="No employee leave reviews are pending."
              />
            ) : null}

            {hasDashboardModule(modules, 'leave') ? (
              <DashboardPanel title="Upcoming Events" eyebrow="Calendar" icon={<CalendarIcon />}>
                <DashboardList items={widgets.upcomingEvents?.length ? widgets.upcomingEvents : widgets.holidayCalendar} emptyLabel="No upcoming events found." />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'attendance') ? (
              <DashboardSplitListPanel
                title="Attendance Status Mix"
                eyebrow="Live attendance"
                icon={<ClockIcon />}
                data={charts.attendanceStatusSplit}
                emptyLabel="No attendance status split recorded."
              />
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="list-list-chart">
            {hasDashboardModule(modules, 'workforce') ? (
              <RoleCountsPanel data={charts.roleUserSplit} />
            ) : null}

            {hasDashboardModule(modules, 'workforce') ? (
              <DashboardPanel title="Recently Joined Members" eyebrow="People" icon={<UsersIcon />}>
                <DashboardList items={widgets.recentlyJoined} emptyLabel="No recently joined members found." />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'workforce') ? (
              <DashboardPanel title="Employee Status" eyebrow="Directory" icon={<UsersIcon />}>
                <SplitDonutChart data={charts.employeeStatusSplit} emptyLabel="No employee status split recorded." />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="chart-list">
            {hasDashboardModule(modules, 'workforce') ? (
              <DashboardSplitListPanel
                title="Work Location Mix"
                eyebrow="Workforce"
                icon={<UsersIcon />}
                data={charts.workLocationSplit}
                emptyLabel="No work location split recorded."
              />
            ) : null}

            {hasDashboardModule(modules, 'workforce') ? (
              <DashboardPanel title="Hours by Department" eyebrow="Workforce load" icon={<UsersIcon />}>
                <DepartmentHoursChart data={charts.departmentHours} />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          {hasDashboardModule(modules, 'project') ? (
            <DashboardCrossRow variant="list-chart">
              <DashboardPanel title="Project Spotlight" eyebrow="Recent movement" icon={<BriefcaseIcon />}>
                <DashboardList items={widgets.spotlightProjects} emptyLabel="No project updates available." />
              </DashboardPanel>
            </DashboardCrossRow>
          ) : null}
        </div>
      )}
    </DashboardLayout>
  )
}

function EmployeeDashboardView() {
  const { user } = useAuth()
  const { data, isLoading, isError } = useEmployeeDashboardQuery(true)

  if (isLoading) return <DashboardLoader />
  if (isError) return <DashboardError />

  const dashboardData = data || EMPTY_DASHBOARD
  const charts = dashboardData.charts || {}
  const widgets = dashboardData.widgets || {}

  return (
    <DashboardLayout
      data={dashboardData}
      user={user}
      scope="employee"
      title="Dashboard"
      tagline="Your workday view for attendance, leave, projects, and tasks."
    >
      {(modules) => (
        <div className="dashboard-cross-stack">
          <DashboardCrossRow variant="chart-list">
            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Project Tasks Performed" eyebrow="My project work" icon={<ChecklistIcon />}>
                <ProjectMetricChart
                  data={charts.projectTaskVolume}
                  dataKey="tasks"
                  color="var(--gm-orange)"
                  emptyLabel="No project task volume recorded."
                />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Project Hours Performed" eyebrow="My project work" icon={<ClockIcon />}>
                <ProjectMetricChart
                  data={charts.projectHours}
                  dataKey="hours"
                  color="#14b8a6"
                  emptyLabel="No project hours recorded."
                />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="list-list-chart">
            {hasDashboardModule(modules, 'project') ? (
              <DashboardPanel title="Assigned Projects" eyebrow="Portfolio" icon={<BriefcaseIcon />}>
                <DashboardList items={widgets.assignedProjects} emptyLabel="No assigned projects found." />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'project') ? (
              <DashboardSplitListPanel
                title="Assignment Status Mix"
                eyebrow="Project access"
                icon={<BriefcaseIcon />}
                data={charts.assignmentStatusSplit}
                emptyLabel="No assignment status split recorded."
              />
            ) : null}

            {hasDashboardModule(modules, 'project') ? (
              <DashboardPanel title="Assigned Project Status" eyebrow="Project access" icon={<BriefcaseIcon />}>
                <SplitDonutChart data={charts.projectStatusSplit} emptyLabel="No assigned project status yet." />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="chart-list-chart">
            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Hours Worked" eyebrow="This week" icon={<ChecklistIcon />}>
                <HoursTrendChart data={charts.hoursTrend} />
              </DashboardPanel>
            ) : null}

            <DashboardPanel title="Profile Snapshot" eyebrow="Your workspace" icon={<UsersIcon />}>
              <DashboardList items={widgets.recentlyJoined} emptyLabel="No profile snapshot found." />
            </DashboardPanel>

            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Task Status" eyebrow="This month" icon={<CheckCircleIcon />}>
                <SplitDonutChart data={charts.taskStatusSplit} emptyLabel="No task status split recorded." />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="list-chart">
            <UpdatesPanel updates={widgets.updates} />

            {hasDashboardModule(modules, 'task') ? (
              <DashboardPanel title="Task Status Volume" eyebrow="Monthly flow" icon={<ChecklistIcon />}>
                <TaskStatusChart data={charts.taskStatusSplit} />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

          <DashboardCrossRow variant="list-list-chart">
            {hasDashboardModule(modules, 'leave') ? (
              <DashboardPanel title="Leave and Holidays" eyebrow="Calendar" icon={<CalendarIcon />}>
                <DashboardList items={widgets.upcomingEvents?.length ? widgets.upcomingEvents : widgets.holidayCalendar} emptyLabel="No holidays configured." />
              </DashboardPanel>
            ) : null}

            {hasDashboardModule(modules, 'leave') ? (
              <DashboardSplitListPanel
                title="Leave Status Mix"
                eyebrow="Requests"
                icon={<CalendarIcon />}
                data={charts.leaveStatusSplit}
                emptyLabel="No leave status split recorded."
              />
            ) : null}

            {hasDashboardModule(modules, 'attendance') ? (
              <DashboardPanel title="Attendance Status" eyebrow="My records" icon={<ClockIcon />}>
                <SplitDonutChart data={charts.attendanceStatusSplit} emptyLabel="No attendance status split recorded." />
              </DashboardPanel>
            ) : null}
          </DashboardCrossRow>

        </div>
      )}
    </DashboardLayout>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const dashboardVariant = resolveDashboardVariant(user)

  if (dashboardVariant === 'management') return <AdminDashboardView />
  return <EmployeeDashboardView />
}
