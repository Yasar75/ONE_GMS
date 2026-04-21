import { attendanceService } from './attendance.service.js'
import { employeeService } from './employee.service.js'
import { leaveService } from './leave.service.js'
import { metadataService } from './metadata.service.js'
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

function toTitleLabel(value) {
  return String(value || 'Not set')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    || 'Not set'
}

function buildCountSplit(records = [], valueAccessor, fallbackLabel = 'Not set') {
  const counts = new Map()
  ;(Array.isArray(records) ? records : []).forEach((record) => {
    const rawValue = valueAccessor(record)
    const label = toTitleLabel(rawValue || fallbackLabel)
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
}

function buildAttendanceStatusSplit(attendance = []) {
  const counts = new Map()
  ;(Array.isArray(attendance) ? attendance : []).forEach((record) => {
    const label = String(record.status || 'Not set').trim() || 'Not set'
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
}

function buildEmployeeStatusSplit(employees = []) {
  return buildCountSplit(employees, (employee) => (
    employee.status
    || employee.employmentStatus
    || employee.employeeStatus
    || employee.dojStatus
  ))
}

function buildWorkLocationSplit(employees = []) {
  return buildCountSplit(employees, (employee) => (
    employee.workLocationTypeLabel
    || employee.workLocationLabel
    || employee.workLocationType
    || employee.workLocation
  ))
}

function buildAssignmentStatusSplit(assignments = []) {
  return buildCountSplit(assignments, (assignment) => assignment.status)
}

function buildLeaveStatusSplit(requests = []) {
  return buildCountSplit(requests, (request) => request.status)
}

function buildRoleUserSplit(employees = [], roles = []) {
  const roleNameByUid = new Map((Array.isArray(roles) ? roles : [])
    .map((role) => [String(role.uid || ''), role.roleName || role.role_name || ''])
    .filter(([, roleName]) => String(roleName || '').trim()))

  return buildCountSplit(employees, (employee) => (
    employee.roleName
    || roleNameByUid.get(String(employee.roleType || ''))
    || 'Unassigned'
  ))
}

function getProjectLabel(project) {
  if (!project) return ''
  return project.projectCode
    ? `${project.projectName || project.projectCode} (${project.projectCode})`
    : project.projectName || ''
}

function buildProjectTaskVolume(tasks = [], projects = []) {
  const projectByUid = new Map((Array.isArray(projects) ? projects : []).map((project) => [String(project.uid || ''), project]))
  const totals = new Map()

  ;(Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const project = projectByUid.get(String(task.projectUid || ''))
    const label = getProjectLabel(project) || `Project ${String(task.projectUid || '').slice(0, 6) || 'Unassigned'}`
    totals.set(label, (totals.get(label) || 0) + sumTaskStatusVolume([task]))
  })

  return Array.from(totals.entries())
    .map(([name, tasks]) => ({ name, tasks }))
    .filter((entry) => entry.tasks > 0)
    .sort((left, right) => right.tasks - left.tasks)
    .slice(0, 8)
}

function buildProjectHours(tasks = [], projects = []) {
  const projectByUid = new Map((Array.isArray(projects) ? projects : []).map((project) => [String(project.uid || ''), project]))
  const totals = new Map()

  ;(Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const project = projectByUid.get(String(task.projectUid || ''))
    const label = getProjectLabel(project) || `Project ${String(task.projectUid || '').slice(0, 6) || 'Unassigned'}`
    totals.set(label, (totals.get(label) || 0) + Number(task.hourWork || 0))
  })

  return Array.from(totals.entries())
    .map(([name, hours]) => ({ name, hours }))
    .filter((entry) => entry.hours > 0)
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 8)
}

function buildLeaveReviewSplit(pendingRequests = [], pendingCancellationRequests = []) {
  return [
    { name: 'Pending Leave Requests', value: (Array.isArray(pendingRequests) ? pendingRequests : []).length },
    { name: 'Pending Cancellations', value: (Array.isArray(pendingCancellationRequests) ? pendingCancellationRequests : []).length }
  ].filter((entry) => entry.value > 0)
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

function getCurrentDashboardUser() {
  return storage.get(AUTH_STORAGE_KEYS.user, null)
}

function canViewDashboardModules(user, modules = []) {
  return hasModuleVisibility(user, modules)
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
  const currentUser = getCurrentDashboardUser()
  const canViewEmployees = canViewDashboardModules(currentUser, PERMISSION_MODULES.employeeDirectory)
  const canViewAttendance = canViewDashboardModules(currentUser, [
    ...PERMISSION_MODULES.attendanceOverview,
    ...PERMISSION_MODULES.manageRegularization,
    ...PERMISSION_MODULES.shiftRoster,
    ...PERMISSION_MODULES.assignShift
  ])
  const canViewLeave = canViewDashboardModules(currentUser, [
    ...PERMISSION_MODULES.holidayCalendar,
    ...PERMISSION_MODULES.leaveType,
    ...PERMISSION_MODULES.assignLeave,
    ...PERMISSION_MODULES.manageLeave
  ])
  const canViewProjects = canViewDashboardModules(currentUser, PERMISSION_MODULES.project)
  const canViewAssignments = canViewDashboardModules(currentUser, PERMISSION_MODULES.projectAssignment)
  const canViewTasks = canViewDashboardModules(currentUser, PERMISSION_MODULES.projectTask)
  const canViewRoles = canViewDashboardModules(currentUser, PERMISSION_MODULES.roles)

  const [employees, attendance, pendingLeaveRequests, pendingCancellationRequests, holidays, projects, assignments, tasks, roles] = await Promise.all([
    canViewEmployees ? safeRequest(() => employeeService.getDirectory(), []) : [],
    canViewAttendance ? safeRequest(() => attendanceService.getAllAttendance(), []) : [],
    canViewLeave ? safeRequest(() => leaveService.getPendingLeaveRequests(), []) : [],
    canViewLeave ? safeRequest(() => leaveService.getPendingLeaveCancellationRequests(), []) : [],
    canViewLeave ? safeRequest(() => getCurrentYearHolidays(), []) : [],
    canViewProjects ? safeRequest(() => projectService.listAllProjects(), { items: [] }) : { items: [] },
    canViewAssignments ? safeRequest(() => projectService.listAllProjectAssignments(), { items: [] }) : { items: [] },
    canViewTasks ? safeRequest(() => projectService.listAllProjectTasks(), { items: [] }) : { items: [] },
    canViewRoles ? safeRequest(() => metadataService.getRoles(), []) : []
  ])

  const employeeItems = Array.isArray(employees) ? employees : []
  const attendanceItems = Array.isArray(attendance) ? attendance : []
  const projectItems = Array.isArray(projects.items) ? projects.items : []
  const assignmentItems = Array.isArray(assignments.items) ? assignments.items : []
  const taskItems = Array.isArray(tasks.items) ? tasks.items : []
  const roleItems = Array.isArray(roles) ? roles : []
  const todayIsoDate = getTodayIsoDate()
  const todayAttendance = attendanceItems.filter((record) => String(record.attendanceDate || '') === todayIsoDate)
  const todayTasks = taskItems.filter((task) => String(task.taskDate || '') === todayIsoDate)
  const absentToday = todayAttendance.filter((record) => String(record.status || '').toLowerCase() === 'absent').length
  const activeAssignments = assignmentItems.filter((assignment) => ['assigned', 'active'].includes(String(assignment.status || '').toLowerCase())).length
  const pendingLeaveCount = pendingLeaveRequests.length
  const taskVolumeToday = sumTaskStatusVolume(todayTasks)

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
      { label: 'Absent Today', value: absentToday, helper: 'Attendance entries that need follow-up.', tone: 'orange' },
      { label: 'Leave Reviews', value: pendingLeaveCount, helper: 'Pending leave requests waiting for action.', tone: 'purple' },
      { label: 'Active Assignments', value: activeAssignments, helper: 'Current employee-project mappings.', tone: 'blue' },
      { label: 'Task Updates Today', value: taskVolumeToday, helper: 'Status movement recorded today.', tone: 'teal' }
    ],
    charts: {
      attendanceTrend,
      taskHoursTrend,
      projectStatusSplit: buildProjectStatusSplit(projectItems),
      projectTaskVolume: buildProjectTaskVolume(taskItems, projectItems),
      projectHours: buildProjectHours(taskItems, projectItems),
      attendanceStatusSplit: buildAttendanceStatusSplit(attendanceItems),
      employeeStatusSplit: buildEmployeeStatusSplit(employeeItems),
      workLocationSplit: buildWorkLocationSplit(employeeItems),
      assignmentStatusSplit: buildAssignmentStatusSplit(assignmentItems),
      roleUserSplit: buildRoleUserSplit(employeeItems, roleItems),
      leaveReviewSplit: buildLeaveReviewSplit(pendingLeaveRequests, pendingCancellationRequests),
      departmentHours: buildDepartmentHours(taskItems, employeeItems),
      taskStatusSplit: buildTaskStatusSplit(taskItems)
    },
    widgets: {
      upcomingEvents: buildUpcomingHolidayWidgets(holidays).slice(0, 3),
      holidayCalendar: buildUpcomingHolidayWidgets(holidays),
      recentlyJoined: buildRecentJoiners(employeeItems),
      updates: [
        `${pendingLeaveCount} leave request${pendingLeaveCount === 1 ? '' : 's'} waiting for review.`,
        `${activeAssignments} project assignment${activeAssignments === 1 ? '' : 's'} currently active.`,
        `${taskVolumeToday} task status update${taskVolumeToday === 1 ? '' : 's'} recorded today.`
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
  const currentUser = getCurrentDashboardUser()
  const canViewSelfAttendance = canViewDashboardModules(currentUser, [
    ...PERMISSION_MODULES.myAttendancePreview,
    ...PERMISSION_MODULES.myShift,
    ...PERMISSION_MODULES.manageRegularization
  ])
  const canViewSelfLeave = canViewDashboardModules(currentUser, [
    ...PERMISSION_MODULES.holidayCalendar,
    ...PERMISSION_MODULES.leaveRequest,
    ...PERMISSION_MODULES.myLeaveBalance
  ])
  const canViewProjects = canViewDashboardModules(currentUser, [
    ...PERMISSION_MODULES.project,
    ...PERMISSION_MODULES.projectAssignment
  ])
  const canViewTasks = canViewDashboardModules(currentUser, PERMISSION_MODULES.projectTask)
  const currentEmployee = await safeRequest(() => employeeService.getCurrentEmployee({ allowMissing: true }), null)
  const [attendance, leaveRequests, holidays, projects, assignments, tasks] = await Promise.all([
    canViewSelfAttendance ? safeRequest(() => currentEmployee?.uid ? attendanceService.getAttendanceByEmployee(currentEmployee.uid) : Promise.resolve([]), []) : [],
    canViewSelfLeave ? safeRequest(() => leaveService.getMyLeaveRequests(), []) : [],
    canViewSelfLeave ? safeRequest(() => getCurrentYearHolidays(), []) : [],
    canViewProjects ? safeRequest(() => projectService.listAllProjects(), { items: [] }) : { items: [] },
    canViewProjects ? safeRequest(() => projectService.listAllProjectAssignments(), { items: [] }) : { items: [] },
    canViewTasks ? safeRequest(() => projectService.listAllProjectTasks(), { items: [] }) : { items: [] }
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
  const pendingLeaveCount = leaveRequests.filter((request) => String(request.status || '').toLowerCase() === 'pending').length
  const assignedProjectCount = assignmentItems.length
  const monthTaskVolume = sumTaskStatusVolume(monthTasks)
  const presentRecordCount = attendanceItems.filter((record) => ['present', 'remote', 'worked'].includes(String(record.status || '').toLowerCase())).length

  return {
    variant: buildCurrentUserDashboardVariant(),
    kpis: [
      { label: 'Pending Leave', value: pendingLeaveCount, helper: 'Your leave requests still awaiting action.', tone: 'orange' },
      { label: 'Assigned Projects', value: assignedProjectCount, helper: 'Projects currently mapped to you.', tone: 'blue' },
      { label: 'Task Updates', value: monthTaskVolume, helper: 'Monthly task status movement.', tone: 'teal' },
      { label: 'Worked Records', value: presentRecordCount, helper: 'Present or worked attendance records.', tone: 'green' }
    ],
    charts: {
      hoursTrend: taskHoursTrend,
      attendanceTrend,
      projectTaskVolume: buildProjectTaskVolume(taskItems, projectItems),
      projectHours: buildProjectHours(taskItems, projectItems),
      attendanceStatusSplit: buildAttendanceStatusSplit(attendanceItems),
      assignmentStatusSplit: buildAssignmentStatusSplit(assignmentItems),
      leaveStatusSplit: buildLeaveStatusSplit(leaveRequests),
      taskStatusSplit: buildTaskStatusSplit(monthTasks),
      projectStatusSplit: buildProjectStatusSplit(projectItems.filter((project) => assignmentItems.some((assignment) => String(assignment.projectUid || '') === String(project.uid || ''))))
    },
    widgets: {
      upcomingEvents: buildUpcomingHolidayWidgets(holidays).slice(0, 3),
      holidayCalendar: buildUpcomingHolidayWidgets(holidays),
      recentlyJoined: currentEmployee ? [{ name: currentEmployee.fullName || currentEmployee.employeeCode || 'You', dept: currentEmployee.departmentLabel || currentEmployee.department || 'Unassigned' }] : [],
      updates: [
        `${pendingLeaveCount} leave request${pendingLeaveCount === 1 ? '' : 's'} currently pending.`,
        `${monthTaskVolume} task status update${monthTaskVolume === 1 ? '' : 's'} recorded this month.`,
        `${presentRecordCount} worked attendance record${presentRecordCount === 1 ? '' : 's'} available.`
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
