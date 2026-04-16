import { attendanceService } from './attendance.service.js'
import { employeeService } from './employee.service.js'
import { leaveService } from './leave.service.js'
import { projectService } from './project.service.js'
import { storage } from '../../utils/storage.js'
import { AUTH_STORAGE_KEYS } from '../../utils/auth.js'
import { hasModuleVisibility, PERMISSION_MODULES } from '../../utils/permissions.js'
import { getPresetDateRange, toIsoDateValue, toStartOfDay } from '../../utils/datePresets.js'

function formatMonthDay(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(value)
}

function formatShortDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function getTodayIsoDate() {
  return toIsoDateValue(new Date())
}

function sumTaskStatusVolume(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).reduce((total, task) => (
    total
    + Number(task.taskCompleted || 0)
    + Number(task.taskInprogress || 0)
    + Number(task.taskRework || 0)
    + Number(task.taskApproved || 0)
    + Number(task.taskRejected || 0)
    + Number(task.taskReviewed || 0)
  ), 0)
}

function buildLastSevenDaySeries(records = [], dateAccessor, bucketBuilder) {
  const today = toStartOfDay(new Date())
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const isoDate = toIsoDateValue(date)
    const scopedItems = (Array.isArray(records) ? records : []).filter((record) => String(dateAccessor(record) || '') === isoDate)
    return {
      day: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
      date: formatMonthDay(date),
      ...bucketBuilder(scopedItems, isoDate)
    }
  })
}

function buildUpcomingHolidayWidgets(holidays = []) {
  const today = getTodayIsoDate()
  return (Array.isArray(holidays) ? holidays : [])
    .filter((holiday) => holiday.isActive !== false && String(holiday.holidayDate || '') >= today)
    .sort((left, right) => String(left.holidayDate || '').localeCompare(String(right.holidayDate || '')))
    .slice(0, 5)
    .map((holiday) => ({
      title: holiday.name || 'Holiday',
      date: formatShortDate(holiday.holidayDate),
      meta: holiday.description || holiday.scope || 'Holiday calendar'
    }))
}

function buildRecentJoiners(employees = []) {
  return (Array.isArray(employees) ? employees : [])
    .filter((employee) => employee.joinDate)
    .sort((left, right) => String(right.joinDate || '').localeCompare(String(left.joinDate || '')))
    .slice(0, 5)
    .map((employee) => ({
      name: employee.fullName || employee.employeeCode || 'Employee',
      dept: employee.departmentLabel || employee.department || 'Unassigned'
    }))
}

function buildProjectStatusSplit(projects = []) {
  const counts = new Map()
  ;(Array.isArray(projects) ? projects : []).forEach((project) => {
    const label = String(project.status || 'Not set').trim() || 'Not set'
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
}

function buildDepartmentHours(tasks = [], employees = []) {
  const employeeByUid = new Map((Array.isArray(employees) ? employees : []).map((employee) => [String(employee.uid || ''), employee]))
  const totals = new Map()

  ;(Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const employee = employeeByUid.get(String(task.employeeUid || ''))
    const department = employee?.departmentLabel || employee?.department || 'Unassigned'
    totals.set(department, (totals.get(department) || 0) + Number(task.hourWork || 0))
  })

  return Array.from(totals.entries())
    .map(([name, hours]) => ({ name, hours }))
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 6)
}

function buildTaskStatusSplit(tasks = []) {
  return [
    { name: 'Completed', value: tasks.reduce((total, task) => total + Number(task.taskCompleted || 0), 0) },
    { name: 'Approved', value: tasks.reduce((total, task) => total + Number(task.taskApproved || 0), 0) },
    { name: 'Reviewed', value: tasks.reduce((total, task) => total + Number(task.taskReviewed || 0), 0) },
    { name: 'In Progress', value: tasks.reduce((total, task) => total + Number(task.taskInprogress || 0), 0) },
    { name: 'Rework', value: tasks.reduce((total, task) => total + Number(task.taskRework || 0), 0) },
    { name: 'Rejected', value: tasks.reduce((total, task) => total + Number(task.taskRejected || 0), 0) }
  ].filter((entry) => entry.value > 0)
}

function buildAssignedProjectWidgets(assignments = [], projects = []) {
  const projectByUid = new Map((Array.isArray(projects) ? projects : []).map((project) => [String(project.uid || ''), project]))
  return (Array.isArray(assignments) ? assignments : [])
    .slice(0, 5)
    .map((assignment) => {
      const project = projectByUid.get(String(assignment.projectUid || ''))
      return {
        title: project?.projectName || project?.projectCode || 'Project',
        date: project?.status || assignment.status || 'Not set',
        meta: `${project?.projectCode || 'No code'} • ${assignment.allocationPercentage || 0}% allocation`
      }
    })
}

function buildCurrentUserDashboardVariant() {
  const currentUser = storage.get(AUTH_STORAGE_KEYS.user, null)
  if (hasModuleVisibility(currentUser, [...PERMISSION_MODULES.project, ...PERMISSION_MODULES.projectTask])) {
    return 'delivery'
  }
  return 'employee'
}

async function safeRequest(requestFn, fallbackValue) {
  try {
    return await requestFn()
  } catch {
    return fallbackValue
  }
}

async function getCurrentYearHolidays() {
  return leaveService.getHolidayCalendar(new Date().getFullYear())
}

async function buildAdminDashboard() {
  const [employees, attendance, pendingLeaveRequests, holidays, projects, assignments, tasks] = await Promise.all([
    safeRequest(() => employeeService.getDirectory(), []),
    safeRequest(() => attendanceService.getAllAttendance(), []),
    safeRequest(() => leaveService.getPendingLeaveRequests(), []),
    safeRequest(() => getCurrentYearHolidays(), []),
    safeRequest(() => projectService.listAllProjects(), { items: [] }),
    safeRequest(() => projectService.listAllProjectAssignments(), { items: [] }),
    safeRequest(() => projectService.listAllProjectTasks(), { items: [] })
  ])

  const employeeItems = Array.isArray(employees) ? employees : []
  const attendanceItems = Array.isArray(attendance) ? attendance : []
  const projectItems = Array.isArray(projects.items) ? projects.items : []
  const assignmentItems = Array.isArray(assignments.items) ? assignments.items : []
  const taskItems = Array.isArray(tasks.items) ? tasks.items : []
  const todayIsoDate = getTodayIsoDate()
  const todayAttendance = attendanceItems.filter((record) => String(record.attendanceDate || '') === todayIsoDate)
  const todayTasks = taskItems.filter((task) => String(task.taskDate || '') === todayIsoDate)

  const attendanceTrend = buildLastSevenDaySeries(attendanceItems, (record) => record.attendanceDate, (items) => ({
    present: items.filter((record) => ['present', 'remote'].includes(String(record.status || '').toLowerCase())).length,
    absent: items.filter((record) => ['absent'].includes(String(record.status || '').toLowerCase())).length
  }))

  const taskHoursTrend = buildLastSevenDaySeries(taskItems, (record) => record.taskDate, (items) => ({
    hours: items.reduce((total, task) => total + Number(task.hourWork || 0), 0)
  }))

  return {
    variant: 'admin',
    kpis: [
      { label: 'Total Employees', value: employeeItems.length, helper: 'Directory records synced from backend.', tone: 'blue' },
      { label: 'Present Today', value: todayAttendance.filter((record) => ['present', 'remote'].includes(String(record.status || '').toLowerCase())).length, helper: 'Attendance marked for today.', tone: 'green' },
      { label: 'Hours Logged Today', value: todayTasks.reduce((total, task) => total + Number(task.hourWork || 0), 0), helper: 'Task hours logged today.', tone: 'teal' },
      { label: 'Active Projects', value: projectItems.filter((project) => String(project.status || '').toLowerCase() === 'active').length, helper: 'Projects currently marked active.', tone: 'orange' }
    ],
    charts: {
      attendanceTrend,
      taskHoursTrend,
      projectStatusSplit: buildProjectStatusSplit(projectItems),
      departmentHours: buildDepartmentHours(taskItems, employeeItems),
      taskStatusSplit: buildTaskStatusSplit(taskItems)
    },
    widgets: {
      upcomingEvents: buildUpcomingHolidayWidgets(holidays).slice(0, 3),
      holidayCalendar: buildUpcomingHolidayWidgets(holidays),
      recentlyJoined: buildRecentJoiners(employeeItems),
      updates: [
        `${pendingLeaveRequests.length} leave request${pendingLeaveRequests.length === 1 ? '' : 's'} waiting for review.`,
        `${assignmentItems.filter((assignment) => ['assigned', 'active'].includes(String(assignment.status || '').toLowerCase())).length} project assignment${assignmentItems.length === 1 ? '' : 's'} currently active.`,
        `${sumTaskStatusVolume(todayTasks)} task status volume recorded today.`
      ],
      spotlightProjects: projectItems
        .slice()
        .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
        .slice(0, 5)
        .map((project) => ({
          title: project.projectName,
          date: project.status || 'Not set',
          meta: `${project.projectCode} • ${formatShortDate(project.updatedAt || project.createdAt)}`
        }))
    }
  }
}

async function buildEmployeeDashboard() {
  const currentEmployee = await safeRequest(() => employeeService.getCurrentEmployee({ allowMissing: true }), null)
  const [attendance, leaveRequests, holidays, projects, assignments, tasks] = await Promise.all([
    safeRequest(() => currentEmployee?.uid ? attendanceService.getAttendanceByEmployee(currentEmployee.uid) : Promise.resolve([]), []),
    safeRequest(() => leaveService.getMyLeaveRequests(), []),
    safeRequest(() => getCurrentYearHolidays(), []),
    safeRequest(() => projectService.listAllProjects(), { items: [] }),
    safeRequest(() => projectService.listAllProjectAssignments(), { items: [] }),
    safeRequest(() => projectService.listAllProjectTasks(), { items: [] })
  ])

  const projectItems = Array.isArray(projects.items) ? projects.items : []
  const assignmentItems = (Array.isArray(assignments.items) ? assignments.items : [])
    .filter((assignment) => String(assignment.employeeUid || '') === String(currentEmployee?.uid || ''))
  const taskItems = (Array.isArray(tasks.items) ? tasks.items : [])
    .filter((task) => String(task.employeeUid || '') === String(currentEmployee?.uid || ''))
  const attendanceItems = Array.isArray(attendance) ? attendance : []
  const currentMonthRange = getPresetDateRange('month')
  const monthTasks = taskItems.filter((task) => {
    const taskDate = toStartOfDay(task.taskDate)
    return taskDate >= currentMonthRange.start && taskDate <= currentMonthRange.end
  })

  const taskHoursTrend = buildLastSevenDaySeries(taskItems, (record) => record.taskDate, (items) => ({
    hours: items.reduce((total, task) => total + Number(task.hourWork || 0), 0)
  }))
  const attendanceTrend = buildLastSevenDaySeries(attendanceItems, (record) => record.attendanceDate, (items) => ({
    present: items.filter((record) => ['present', 'remote'].includes(String(record.status || '').toLowerCase())).length,
    leave: items.filter((record) => ['leave', 'on leave'].includes(String(record.status || '').toLowerCase())).length
  }))

  return {
    variant: buildCurrentUserDashboardVariant(),
    kpis: [
      { label: 'Hours This Month', value: monthTasks.reduce((total, task) => total + Number(task.hourWork || 0), 0), helper: 'Task hours logged in the current month.', tone: 'blue' },
      { label: 'Task Entries', value: taskItems.length, helper: 'All task entries linked to you.', tone: 'teal' },
      { label: 'Approved Tasks', value: monthTasks.reduce((total, task) => total + Number(task.taskApproved || 0), 0), helper: 'Approved volume this month.', tone: 'green' },
      { label: 'Active Assignments', value: assignmentItems.filter((assignment) => ['assigned', 'active'].includes(String(assignment.status || '').toLowerCase())).length, helper: 'Current project assignments.', tone: 'orange' }
    ],
    charts: {
      hoursTrend: taskHoursTrend,
      attendanceTrend,
      taskStatusSplit: buildTaskStatusSplit(monthTasks),
      projectStatusSplit: buildProjectStatusSplit(projectItems.filter((project) => assignmentItems.some((assignment) => String(assignment.projectUid || '') === String(project.uid || ''))))
    },
    widgets: {
      upcomingEvents: buildUpcomingHolidayWidgets(holidays).slice(0, 3),
      holidayCalendar: buildUpcomingHolidayWidgets(holidays),
      recentlyJoined: currentEmployee ? [{ name: currentEmployee.fullName || currentEmployee.employeeCode || 'You', dept: currentEmployee.departmentLabel || currentEmployee.department || 'Unassigned' }] : [],
      updates: [
        `${leaveRequests.filter((request) => String(request.status || '').toLowerCase() === 'pending').length} leave request${leaveRequests.length === 1 ? '' : 's'} currently pending.`,
        `${sumTaskStatusVolume(monthTasks)} task status volume recorded this month.`,
        `${attendanceItems.filter((record) => String(record.status || '').toLowerCase() === 'present').length} present attendance record${attendanceItems.length === 1 ? '' : 's'} available.`
      ],
      assignedProjects: buildAssignedProjectWidgets(assignmentItems, projectItems)
    }
  }
}

export const dashboardService = {
  async getAdminDashboard() {
    return buildAdminDashboard()
  },

  async getEmployeeDashboard() {
    return buildEmployeeDashboard()
  }
}
