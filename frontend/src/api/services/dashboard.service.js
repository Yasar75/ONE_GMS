import { attendanceService } from './attendance.service.js'
import { employeeService } from './employee.service.js'
import { leaveService } from './leave.service.js'
import { metadataService } from './metadata.service.js'
import { projectService } from './project.service.js'
import { storage } from '../../utils/storage.js'
import { AUTH_STORAGE_KEYS } from '../../utils/auth.js'
import { hasModuleVisibility, PERMISSION_MODULES } from '../../utils/permissions.js'
import {
  buildAdminDashboardSnapshot,
  buildEmployeeDashboardSnapshot
} from '../../modules/dashboard/utils/dashboardInsights.js'

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

  const raw = {
    employees: Array.isArray(employees) ? employees : [],
    attendance: Array.isArray(attendance) ? attendance : [],
    leaveRequests: Array.isArray(pendingLeaveRequests) ? pendingLeaveRequests : [],
    leaveCancellationRequests: Array.isArray(pendingCancellationRequests) ? pendingCancellationRequests : [],
    holidays: Array.isArray(holidays) ? holidays : [],
    projects: Array.isArray(projects.items) ? projects.items : [],
    assignments: Array.isArray(assignments.items) ? assignments.items : [],
    tasks: Array.isArray(tasks.items) ? tasks.items : [],
    roles: Array.isArray(roles) ? roles : [],
    currentEmployee: null
  }

  return {
    raw,
    ...buildAdminDashboardSnapshot(raw)
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
    canViewSelfAttendance
      ? safeRequest(() => (
        currentEmployee?.uid
          ? attendanceService.getAttendanceByEmployee(currentEmployee.uid)
          : Promise.resolve([])
      ), [])
      : [],
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
  const scopedProjects = projectItems.filter((project) => assignmentItems.some((assignment) => String(assignment.projectUid || '') === String(project.uid || '')))

  const raw = {
    employees: currentEmployee ? [currentEmployee] : [],
    attendance: Array.isArray(attendance) ? attendance : [],
    leaveRequests: Array.isArray(leaveRequests) ? leaveRequests : [],
    leaveCancellationRequests: [],
    holidays: Array.isArray(holidays) ? holidays : [],
    projects: scopedProjects,
    assignments: assignmentItems,
    tasks: taskItems,
    roles: [],
    currentEmployee
  }

  return {
    raw,
    variant: buildCurrentUserDashboardVariant(),
    ...buildEmployeeDashboardSnapshot(raw)
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
