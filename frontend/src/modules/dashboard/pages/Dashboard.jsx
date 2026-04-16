import React from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
  Cell
} from 'recharts'

import PageHeader from '../../../components/common/PageHeader.jsx'
import KpiCard from '../../../components/common/KpiCard.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useAdminDashboardQuery } from '../../../hooks/dashboard/useAdminDashboardQuery.js'
import { useEmployeeDashboardQuery } from '../../../hooks/dashboard/useEmployeeDashboardQuery.js'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { resolveDashboardVariant } from '../../../utils/permissions.js'

const KPI_TONES = ['blue', 'orange', 'teal', 'purple']
const PIE_COLORS = ['var(--gm-blue)', 'var(--gm-orange)', '#22c55e', '#a855f7']

const EMPTY_DASHBOARD = {
  kpis: [],
  charts: {},
  widgets: {
    upcomingEvents: [],
    holidayCalendar: [],
    recentlyJoined: [],
    updates: []
  }
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function DashboardScaffold({ data, title, tagline, primaryChart, secondaryChart, tertiaryChart }) {
  const dashboardData = data || EMPTY_DASHBOARD
  const kpis = ensureArray(dashboardData?.kpis)
  const upcomingEvents = ensureArray(dashboardData?.widgets?.upcomingEvents)
  const holidayCalendar = ensureArray(dashboardData?.widgets?.holidayCalendar)
  const updates = ensureArray(dashboardData?.widgets?.updates)
  const recentlyJoined = ensureArray(dashboardData?.widgets?.recentlyJoined)

  const { items: sortedRecentlyJoined, sortConfig: recentlyJoinedSortConfig, requestSort: requestRecentlyJoinedSort } = useSortableData(recentlyJoined, {
    initialKey: 'name',
    initialDirection: 'asc',
    accessors: {
      name: (member) => member.name || '',
      department: (member) => member.dept || ''
    }
  })

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader title={title} tagline={tagline} />

      <div className="row g-3">
        {kpis.map((item, index) => (
          <div className="col-12 col-sm-6 col-xl-3" key={item.label}>
            <KpiCard label={item.label} value={item.value} tone={KPI_TONES[index % KPI_TONES.length]} />
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">{primaryChart}</div>
        <div className="col-12 col-lg-5">{secondaryChart}</div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">{tertiaryChart}</div>

        <div className="col-12 col-lg-6">
          <div className="row g-3">
            <div className="col-12">
              <CardShell title="Upcoming Events">
                <ul className="list-group list-group-flush">
                  {upcomingEvents.length ? upcomingEvents.map((event) => (
                    <li className="list-group-item d-flex justify-content-between" key={event.title}>
                      <span>{event.title}</span>
                      <span className="text-muted small">{event.date}</span>
                    </li>
                  )) : <li className="list-group-item text-muted">No upcoming events found.</li>}
                </ul>
              </CardShell>
            </div>
            <div className="col-12">
              <CardShell title="Holiday Calendar">
                <ul className="list-group list-group-flush">
                  {holidayCalendar.length ? holidayCalendar.map((holiday) => (
                    <li className="list-group-item d-flex justify-content-between" key={holiday.title}>
                      <span>{holiday.title}</span>
                      <span className="text-muted small">{holiday.date}</span>
                    </li>
                  )) : <li className="list-group-item text-muted">No holidays configured.</li>}
                </ul>
              </CardShell>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <CardShell title="Recently Joined Members">
            <PaginatedTable rows={sortedRecentlyJoined}>
              {({ rows: paginatedRows }) => (
                <table className="table table-sm mb-0">
                  <thead>
                    <tr>
                      <th><SortableHeader label="Name" sortKey="name" sortConfig={recentlyJoinedSortConfig} onSort={requestRecentlyJoinedSort} /></th>
                      <th className="text-muted"><SortableHeader label="Department" sortKey="department" sortConfig={recentlyJoinedSortConfig} onSort={requestRecentlyJoinedSort} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length ? paginatedRows.map((member) => (
                      <tr key={member.name}>
                        <td className="fw-semibold">{member.name}</td>
                        <td className="text-muted">{member.dept}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="2" className="text-muted text-center py-4">No recently joined members found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </PaginatedTable>
          </CardShell>
        </div>

        <div className="col-12 col-lg-6">
          <CardShell title="Important Updates">
            <ul className="mb-0">
              {updates.length ? updates.map((update) => <li key={update}>{update}</li>) : <li className="text-muted">No updates available.</li>}
            </ul>
          </CardShell>
        </div>
      </div>
    </div>
  )
}

function AdminDashboardView() {
  const { data, isLoading, isError } = useAdminDashboardQuery(true)

  if (isLoading) return <div className="text-muted">Loading dashboard…</div>
  if (isError) return <div className="text-muted">Unable to load dashboard data.</div>

  const dashboardData = data || EMPTY_DASHBOARD
  const attendanceTrend = ensureArray(dashboardData?.charts?.attendanceTrend)
  const summarySplit = ensureArray(dashboardData?.charts?.leaveSplit?.length ? dashboardData?.charts?.leaveSplit : dashboardData?.charts?.projectStatusSplit)
  const hoursByDept = ensureArray(dashboardData?.charts?.hoursByDept?.length ? dashboardData?.charts?.hoursByDept : dashboardData?.charts?.departmentHours)

  return (
    <DashboardScaffold
      data={dashboardData}
      title="Dashboard"
      tagline="Organization-level overview of workforce, attendance, and leave utilization."
      primaryChart={(
        <CardShell title="Attendance Trend (Present vs Absent)">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" fill="var(--gm-blue)" radius={[10, 10, 0, 0]} />
                <Bar dataKey="absent" fill="var(--gm-orange)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      )}
      secondaryChart={(
        <CardShell title="Project Status Split">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={summarySplit} dataKey="value" nameKey="name" outerRadius={85} label>
                  {summarySplit.map((_, index) => (
                    <Cell key={`admin-summary-split-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      )}
      tertiaryChart={(
        <CardShell title="Hours Worked by Department">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={hoursByDept}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="var(--gm-blue)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      )}
    />
  )
}

function EmployeeDashboardView() {
  const { data, isLoading, isError } = useEmployeeDashboardQuery(true)

  if (isLoading) return <div className="text-muted">Loading dashboard…</div>
  if (isError) return <div className="text-muted">Unable to load dashboard data.</div>

  const dashboardData = data || EMPTY_DASHBOARD
  const hoursTrend = ensureArray(dashboardData?.charts?.hoursTrend)
  const taskStatusSplit = ensureArray(dashboardData?.charts?.taskStatusSplit)
  const projectStatusSplit = ensureArray(dashboardData?.charts?.projectStatusSplit)

  return (
    <DashboardScaffold
      data={dashboardData}
      title="Dashboard"
      tagline="Your monthly attendance and leave insights at a glance."
      primaryChart={(
        <CardShell title="Hours Worked (This Week)">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={hoursTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="var(--gm-blue)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      )}
      secondaryChart={(
        <CardShell title="Task Status Split">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={taskStatusSplit} dataKey="value" nameKey="name" outerRadius={85} label>
                  {taskStatusSplit.map((_, index) => (
                    <Cell key={`employee-task-status-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      )}
      tertiaryChart={(
        <CardShell title="Assigned Project Status">
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={projectStatusSplit}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="var(--gm-orange)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardShell>
      )}
    />
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const dashboardVariant = resolveDashboardVariant(user)

  if (dashboardVariant === 'management') return <AdminDashboardView />
  return <EmployeeDashboardView />
}
