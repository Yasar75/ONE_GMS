import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import KpiCard from '../../../components/common/KpiCard.jsx'
import CardShell from '../../../components/common/CardShell.jsx'
import { useAdminDashboardQuery } from '../../../hooks/dashboard/useAdminDashboardQuery.js'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart, Pie, Legend, Cell
} from 'recharts'

export default function AdminDashboard() {
  const kpiTones = ['blue', 'orange', 'teal', 'purple']
  const pieColors = ['var(--gm-blue)', 'var(--gm-orange)', '#22c55e', '#a855f7']
  const { data, isLoading } = useAdminDashboardQuery()

  if (isLoading) return <div className="text-muted">Loading dashboard…</div>

  return (
    <div className="d-flex flex-column gap-3">
      <PageHeader title="Dashboard" tagline="Organization-level overview of workforce, attendance, and leave utilization." />

      <div className="row g-3">
        {data.kpis.map((k, idx) => (
          <div className="col-12 col-sm-6 col-xl-3" key={k.label}>
            <KpiCard label={k.label} value={k.value} tone={kpiTones[idx % kpiTones.length]} />
          </div>
        ))}
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-7">
          <CardShell title="Attendance Trend (Present vs Absent)">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={data.charts.attendanceTrend}>
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
        </div>

        <div className="col-12 col-lg-5">
          <CardShell title="Leave Split">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={data.charts.leaveSplit} dataKey="value" nameKey="name" outerRadius={85} label>
                    {data.charts.leaveSplit.map((_, idx) => (
                      <Cell key={`cell-${idx}`} fill={pieColors[idx % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <CardShell title="Hours Worked by Department">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data.charts.hoursByDept}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="hours" stroke="var(--gm-blue)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardShell>
        </div>

        <div className="col-12 col-lg-6">
          <div className="row g-3">
            <div className="col-12">
              <CardShell title="Upcoming Events">
                <ul className="list-group list-group-flush">
                  {data.widgets.upcomingEvents.map((e) => (
                    <li className="list-group-item d-flex justify-content-between" key={e.title}>
                      <span>{e.title}</span>
                      <span className="text-muted small">{e.date}</span>
                    </li>
                  ))}
                </ul>
              </CardShell>
            </div>
            <div className="col-12">
              <CardShell title="Holiday Calendar">
                <ul className="list-group list-group-flush">
                  {data.widgets.holidayCalendar.map((h) => (
                    <li className="list-group-item d-flex justify-content-between" key={h.title}>
                      <span>{h.title}</span>
                      <span className="text-muted small">{h.date}</span>
                    </li>
                  ))}
                </ul>
              </CardShell>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-6">
          <CardShell title="Recently Joined Members">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr><th>Name</th><th className="text-muted">Department</th></tr>
                </thead>
                <tbody>
                  {data.widgets.recentlyJoined.map((m) => (
                    <tr key={m.name}><td className="fw-semibold">{m.name}</td><td className="text-muted">{m.dept}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardShell>
        </div>
        <div className="col-12 col-lg-6">
          <CardShell title="Important Updates">
            <ul className="mb-0">
              {data.widgets.updates.map((u) => (<li key={u}>{u}</li>))}
            </ul>
          </CardShell>
        </div>
      </div>
    </div>
  )
}
