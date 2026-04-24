import { getPresetDateRange, toEndOfDay, toIsoDateValue, toStartOfDay } from '../../../utils/datePresets.js'

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function formatMonthDay(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(value)
}

function formatShortDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function formatMonthLabel(value) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(value)
}

function parseDateValue(value, endOfDay = false) {
  if (!value) return null
  const date = endOfDay ? toEndOfDay(value) : toStartOfDay(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function maxDateValue(left, right) {
  if (!left) return right || null
  if (!right) return left
  return left > right ? left : right
}

function minDateValue(left, right) {
  if (!left) return right || null
  if (!right) return left
  return left < right ? left : right
}

function getDateDifferenceInDays(start, end) {
  if (!start || !end) return 0
  const startTime = toStartOfDay(start).getTime()
  const endTime = toStartOfDay(end).getTime()
  return Math.max(Math.round((endTime - startTime) / (24 * 60 * 60 * 1000)), 0)
}

function getSelectableEmployeeUid(employee = {}) {
  return String(employee.uid || '').trim()
}

function getProjectStatusLabel(project = {}) {
  return String(project.status || 'Not set').trim() || 'Not set'
}

function getAssignmentStatusLabel(assignment = {}) {
  return String(assignment.status || 'Not set').trim() || 'Not set'
}

function getEmployeeDepartmentLabel(employee = {}) {
  return String(employee.departmentLabel || employee.department || '').trim()
}

function getEmployeePositionLabel(employee = {}) {
  return String(employee.positionLabel || employee.position || '').trim()
}

function getProjectLabel(project) {
  if (!project) return ''
  return project.projectCode
    ? `${project.projectName || project.projectCode} (${project.projectCode})`
    : project.projectName || ''
}

function buildSimpleSelectOptions(entries = [], { allLabel, allDescription = 'No filter applied' } = {}) {
  return [
    { value: '', label: allLabel, description: allDescription },
    ...entries
  ]
}

function buildUniqueValueOptions(values = [], { allLabel }) {
  const normalizedEntries = Array.from(new Set(ensureArray(values).map((value) => String(value || '').trim()).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value,
      description: 'Matching records'
    }))

  return buildSimpleSelectOptions(normalizedEntries, { allLabel })
}

function resolveFilterRange(filterState = {}, referenceDate = new Date()) {
  const datePreset = String(filterState.datePreset || 'overall').trim() || 'overall'
  const presetRange = getPresetDateRange(datePreset, referenceDate)
  const presetStart = parseDateValue(presetRange.start)
  const presetEnd = parseDateValue(presetRange.end, true)
  const explicitStart = parseDateValue(filterState.dateRange?.start)
  const explicitEnd = parseDateValue(filterState.dateRange?.end, true)
  const start = maxDateValue(presetStart, explicitStart)
  const end = minDateValue(presetEnd, explicitEnd)

  return {
    datePreset,
    start,
    end,
    hasDateFilter: Boolean(start || end)
  }
}

function isDateWithinRange(value, range) {
  if (!range?.hasDateFilter) return true

  const date = parseDateValue(value)
  if (!date) return false
  if (range.start && date < range.start) return false
  if (range.end && date > range.end) return false
  return true
}

function doesRangeOverlap(startValue, endValue, range) {
  if (!range?.hasDateFilter) return true

  const start = parseDateValue(startValue)
  const end = parseDateValue(endValue, true) || start
  if (!start && !end) return false

  const rangeStart = start || end
  const rangeEnd = end || start

  if (range.start && rangeEnd < range.start) return false
  if (range.end && rangeStart > range.end) return false
  return true
}

function buildLastSevenDaySeries(records = [], dateAccessor, bucketBuilder) {
  const today = toStartOfDay(new Date())
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    const isoDate = toIsoDateValue(date)
    const scopedItems = ensureArray(records).filter((record) => String(dateAccessor(record) || '') === isoDate)
    return {
      day: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
      date: formatMonthDay(date),
      ...bucketBuilder(scopedItems, isoDate)
    }
  })
}

function sumHoursForTaskBucket(tasks = [], predicate = () => false) {
  return ensureArray(tasks).reduce((total, task) => (
    predicate(task)
      ? total + Number(task.hourWork || 0)
      : total
  ), 0)
}

function buildDailyHoursSeries(tasks = [], start, end) {
  const totalDays = getDateDifferenceInDays(start, end)
  return Array.from({ length: totalDays + 1 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    const isoDate = toIsoDateValue(date)

    return {
      label: new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(date),
      secondaryLabel: formatMonthDay(date),
      hours: sumHoursForTaskBucket(tasks, (task) => String(task.taskDate || '') === isoDate)
    }
  })
}

function buildWeeklyHoursSeries(tasks = [], start, end) {
  const items = []
  let weekNumber = 0

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const bucketStart = new Date(cursor)
    const bucketEnd = toEndOfDay(new Date(bucketStart.getFullYear(), bucketStart.getMonth(), bucketStart.getDate() + 6))
    if (bucketEnd > end) bucketEnd.setTime(end.getTime())

    weekNumber += 1
    items.push({
      label: `Week ${weekNumber}`,
      secondaryLabel: `${formatMonthDay(bucketStart)} - ${formatMonthDay(bucketEnd)}`,
      hours: sumHoursForTaskBucket(tasks, (task) => {
        const taskDate = parseDateValue(task.taskDate)
        return Boolean(taskDate && taskDate >= bucketStart && taskDate <= bucketEnd)
      })
    })
  }

  return items
}

function buildMonthlyHoursSeries(tasks = [], start, end) {
  const items = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)

  while (cursor <= end) {
    const monthStart = new Date(cursor)
    const monthEnd = toEndOfDay(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0))

    items.push({
      label: formatMonthLabel(monthStart),
      secondaryLabel: String(monthStart.getFullYear()),
      hours: sumHoursForTaskBucket(tasks, (task) => {
        const taskDate = parseDateValue(task.taskDate)
        return Boolean(
          taskDate
          && taskDate.getFullYear() === monthStart.getFullYear()
          && taskDate.getMonth() === monthStart.getMonth()
        )
      })
    })

    cursor.setMonth(cursor.getMonth() + 1, 1)
  }

  return items
}

function buildHoursTrendSeries(tasks = [], filterState = {}, referenceDate = new Date()) {
  const range = resolveFilterRange(filterState, referenceDate)

  if (range.start && range.end) {
    const totalDays = getDateDifferenceInDays(range.start, range.end)
    if (totalDays <= 1) {
      return [{
        label: totalDays === 0 ? 'Today' : formatMonthDay(range.start),
        secondaryLabel: formatShortDate(range.start),
        hours: sumHoursForTaskBucket(tasks, (task) => String(task.taskDate || '') === toIsoDateValue(range.start))
      }]
    }

    if (totalDays <= 14) return buildDailyHoursSeries(tasks, range.start, range.end)
    if (totalDays <= 93) return buildWeeklyHoursSeries(tasks, range.start, range.end)
    return buildMonthlyHoursSeries(tasks, range.start, range.end)
  }

  const overallStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11, 1)
  const overallEnd = toEndOfDay(new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0))
  return buildMonthlyHoursSeries(tasks, overallStart, overallEnd)
}

function buildUpcomingHolidayWidgets(holidays = []) {
  const today = getTodayIsoDate()
  return ensureArray(holidays)
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
  return ensureArray(employees)
    .filter((employee) => employee.joinDate)
    .sort((left, right) => String(right.joinDate || '').localeCompare(String(left.joinDate || '')))
    .slice(0, 5)
    .map((employee) => ({
      name: employee.fullName || employee.employeeCode || 'Employee',
      dept: getEmployeeDepartmentLabel(employee) || 'Unassigned'
    }))
}

function buildProjectStatusSplit(projects = []) {
  const counts = new Map()
  ensureArray(projects).forEach((project) => {
    const label = getProjectStatusLabel(project)
    counts.set(label, (counts.get(label) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
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
  ensureArray(records).forEach((record) => {
    const label = toTitleLabel(valueAccessor(record) || fallbackLabel)
    counts.set(label, (counts.get(label) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((left, right) => right.value - left.value)
}

function buildAttendanceStatusSplit(attendance = []) {
  return buildCountSplit(attendance, (record) => record.status)
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
  const roleNameByUid = new Map(ensureArray(roles)
    .map((role) => [String(role.uid || ''), role.roleName || role.role_name || ''])
    .filter(([, roleName]) => String(roleName || '').trim()))

  return buildCountSplit(employees, (employee) => (
    employee.roleName
    || roleNameByUid.get(String(employee.roleType || ''))
    || 'Unassigned'
  ))
}

function buildProjectTaskVolume(tasks = [], projects = []) {
  const projectByUid = new Map(ensureArray(projects).map((project) => [String(project.uid || ''), project]))
  const totals = new Map()

  ensureArray(tasks).forEach((task) => {
    const project = projectByUid.get(String(task.projectUid || ''))
    const label = getProjectLabel(project) || `Project ${String(task.projectUid || '').slice(0, 6) || 'Unassigned'}`
    totals.set(label, (totals.get(label) || 0) + sumTaskStatusVolume([task]))
  })

  return Array.from(totals.entries())
    .map(([name, tasksValue]) => ({ name, tasks: tasksValue }))
    .filter((entry) => entry.tasks > 0)
    .sort((left, right) => right.tasks - left.tasks)
    .slice(0, 8)
}

function buildProjectHours(tasks = [], projects = []) {
  const projectByUid = new Map(ensureArray(projects).map((project) => [String(project.uid || ''), project]))
  const totals = new Map()

  ensureArray(tasks).forEach((task) => {
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
    { name: 'Pending Leave Requests', value: ensureArray(pendingRequests).length },
    { name: 'Pending Cancellations', value: ensureArray(pendingCancellationRequests).length }
  ].filter((entry) => entry.value > 0)
}

function buildDepartmentHours(tasks = [], employees = []) {
  const employeeByUid = new Map(ensureArray(employees).map((employee) => [String(employee.uid || ''), employee]))
  const totals = new Map()

  ensureArray(tasks).forEach((task) => {
    const employee = employeeByUid.get(String(task.employeeUid || ''))
    const department = getEmployeeDepartmentLabel(employee) || 'Unassigned'
    totals.set(department, (totals.get(department) || 0) + Number(task.hourWork || 0))
  })

  return Array.from(totals.entries())
    .map(([name, hours]) => ({ name, hours }))
    .sort((left, right) => right.hours - left.hours)
    .slice(0, 6)
}

function buildTaskStatusSplit(tasks = []) {
  return [
    { name: 'Completed', value: ensureArray(tasks).reduce((total, task) => total + Number(task.taskCompleted || 0), 0) },
    { name: 'Approved', value: ensureArray(tasks).reduce((total, task) => total + Number(task.taskApproved || 0), 0) },
    { name: 'Reviewed', value: ensureArray(tasks).reduce((total, task) => total + Number(task.taskReviewed || 0), 0) },
    { name: 'In Progress', value: ensureArray(tasks).reduce((total, task) => total + Number(task.taskInprogress || 0), 0) },
    { name: 'Rework', value: ensureArray(tasks).reduce((total, task) => total + Number(task.taskRework || 0), 0) },
    { name: 'Rejected', value: ensureArray(tasks).reduce((total, task) => total + Number(task.taskRejected || 0), 0) }
  ].filter((entry) => entry.value > 0)
}

function buildAssignedProjectWidgets(assignments = [], projects = []) {
  const projectByUid = new Map(ensureArray(projects).map((project) => [String(project.uid || ''), project]))

  return ensureArray(assignments)
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

function createBaseSources(sources = {}) {
  return {
    employees: ensureArray(sources.employees),
    attendance: ensureArray(sources.attendance),
    leaveRequests: ensureArray(sources.leaveRequests),
    leaveCancellationRequests: ensureArray(sources.leaveCancellationRequests),
    holidays: ensureArray(sources.holidays),
    projects: ensureArray(sources.projects),
    assignments: ensureArray(sources.assignments),
    tasks: ensureArray(sources.tasks),
    roles: ensureArray(sources.roles),
    currentEmployee: sources.currentEmployee || null
  }
}

function filterDashboardSources(rawSources = {}, filterState = {}, referenceDate = new Date()) {
  const sources = createBaseSources(rawSources)
  const range = resolveFilterRange(filterState, referenceDate)
  const employeeUid = String(filterState.employeeUid || '').trim()
  const projectUid = String(filterState.projectUid || '').trim()
  const department = normalizeText(filterState.department)
  const position = normalizeText(filterState.position)
  const projectStatus = normalizeText(filterState.projectStatus)
  const assignmentStatus = normalizeText(filterState.assignmentStatus)
  const hasEmployeeFilter = Boolean(employeeUid || department || position)
  const hasProjectFilter = Boolean(projectUid || projectStatus)
  const hasAssignmentStatusFilter = Boolean(assignmentStatus)

  const matchingEmployees = sources.employees.filter((employee) => {
    if (employeeUid && getSelectableEmployeeUid(employee) !== employeeUid) return false
    if (department && normalizeText(getEmployeeDepartmentLabel(employee)) !== department) return false
    if (position && normalizeText(getEmployeePositionLabel(employee)) !== position) return false
    return true
  })

  const matchingProjects = sources.projects.filter((project) => {
    if (projectUid && String(project.uid || '').trim() !== projectUid) return false
    if (projectStatus && normalizeText(getProjectStatusLabel(project)) !== projectStatus) return false
    return true
  })

  const employeeUidSet = new Set(matchingEmployees.map((employee) => getSelectableEmployeeUid(employee)).filter(Boolean))
  const projectUidSet = new Set(matchingProjects.map((project) => String(project.uid || '').trim()).filter(Boolean))

  const filteredAssignments = sources.assignments.filter((assignment) => {
    if (hasEmployeeFilter && !employeeUidSet.has(String(assignment.employeeUid || '').trim())) return false
    if (hasProjectFilter && !projectUidSet.has(String(assignment.projectUid || '').trim())) return false
    if (assignmentStatus && normalizeText(getAssignmentStatusLabel(assignment)) !== assignmentStatus) return false
    if (!doesRangeOverlap(assignment.assignedFrom, assignment.assignedTo, range)) return false
    return true
  })

  const filteredAssignmentUidSet = new Set(filteredAssignments.map((assignment) => String(assignment.uid || '').trim()).filter(Boolean))

  const filteredTasks = sources.tasks.filter((task) => {
    if (hasEmployeeFilter && !employeeUidSet.has(String(task.employeeUid || '').trim())) return false
    if (hasProjectFilter && !projectUidSet.has(String(task.projectUid || '').trim())) return false
    if (hasAssignmentStatusFilter) {
      const assignmentUid = String(task.projectAssignmentUid || '').trim()
      const hasMatchingAssignment = assignmentUid
        ? filteredAssignmentUidSet.has(assignmentUid)
        : filteredAssignments.some((assignment) => (
          String(assignment.employeeUid || '').trim() === String(task.employeeUid || '').trim()
          && String(assignment.projectUid || '').trim() === String(task.projectUid || '').trim()
        ))

      if (!hasMatchingAssignment) return false
    }
    if (!isDateWithinRange(task.taskDate, range)) return false
    return true
  })

  const filteredAttendance = sources.attendance.filter((attendance) => {
    if (hasEmployeeFilter && !employeeUidSet.has(String(attendance.employeeUid || '').trim())) return false
    return isDateWithinRange(attendance.attendanceDate, range)
  })

  const filteredLeaveRequests = sources.leaveRequests.filter((request) => {
    if (hasEmployeeFilter && !employeeUidSet.has(String(request.employeeUid || '').trim())) return false
    return doesRangeOverlap(request.startDate, request.endDate, range)
  })

  const filteredLeaveCancellationRequests = sources.leaveCancellationRequests.filter((request) => {
    if (hasEmployeeFilter && !employeeUidSet.has(String(request.employeeUid || '').trim())) return false
    return doesRangeOverlap(request.startDate, request.endDate, range)
  })

  const filteredHolidays = sources.holidays.filter((holiday) => isDateWithinRange(holiday.holidayDate, range))

  const relatedEmployeeUids = new Set([
    ...filteredAssignments.map((assignment) => String(assignment.employeeUid || '').trim()),
    ...filteredTasks.map((task) => String(task.employeeUid || '').trim()),
    ...filteredAttendance.map((attendance) => String(attendance.employeeUid || '').trim()),
    ...filteredLeaveRequests.map((request) => String(request.employeeUid || '').trim()),
    ...filteredLeaveCancellationRequests.map((request) => String(request.employeeUid || '').trim())
  ].filter(Boolean))

  const relatedProjectUids = new Set([
    ...filteredAssignments.map((assignment) => String(assignment.projectUid || '').trim()),
    ...filteredTasks.map((task) => String(task.projectUid || '').trim())
  ].filter(Boolean))

  const shouldNarrowEmployeesByActivity = hasProjectFilter || hasAssignmentStatusFilter || range.hasDateFilter
  const shouldNarrowProjectsByActivity = hasEmployeeFilter || hasAssignmentStatusFilter || range.hasDateFilter

  const visibleEmployees = shouldNarrowEmployeesByActivity
    ? matchingEmployees.filter((employee) => relatedEmployeeUids.has(getSelectableEmployeeUid(employee)))
    : matchingEmployees

  const visibleProjects = shouldNarrowProjectsByActivity
    ? matchingProjects.filter((project) => relatedProjectUids.has(String(project.uid || '').trim()))
    : matchingProjects

  return {
    ...sources,
    employees: visibleEmployees,
    attendance: filteredAttendance,
    leaveRequests: filteredLeaveRequests,
    leaveCancellationRequests: filteredLeaveCancellationRequests,
    holidays: filteredHolidays,
    projects: visibleProjects,
    assignments: filteredAssignments,
    tasks: filteredTasks,
    range
  }
}

function buildAdminKpis(filteredSources = {}) {
  const pendingLeaveCount = filteredSources.leaveRequests.length + filteredSources.leaveCancellationRequests.length
  const activeAssignments = filteredSources.assignments.filter((assignment) => ['assigned', 'active'].includes(normalizeText(assignment.status))).length
  const taskVolume = sumTaskStatusVolume(filteredSources.tasks)

  return [
    { label: 'Attendance Records', value: filteredSources.attendance.length, helper: 'Attendance entries in the current view.', tone: 'blue' },
    { label: 'Pending Leave Reviews', value: pendingLeaveCount, helper: 'Leave approvals that still need action.', tone: 'purple' },
    { label: 'Active Assignments', value: activeAssignments, helper: 'Employee-to-project mappings in scope.', tone: 'orange' },
    { label: 'Task Activity', value: taskVolume, helper: 'Task status updates in the selected period.', tone: 'teal' }
  ]
}

function buildEmployeeKpis(filteredSources = {}) {
  const assignedProjects = new Set(filteredSources.assignments.map((assignment) => String(assignment.projectUid || '').trim()).filter(Boolean)).size

  return [
    { label: 'Attendance Records', value: filteredSources.attendance.length, helper: 'Attendance records in the current view.', tone: 'green' },
    { label: 'Leave Requests', value: filteredSources.leaveRequests.length, helper: 'Leave requests that match the selected filters.', tone: 'orange' },
    { label: 'Assigned Projects', value: assignedProjects, helper: 'Projects currently visible to you.', tone: 'blue' },
    { label: 'Task Activity', value: sumTaskStatusVolume(filteredSources.tasks), helper: 'Task status changes in the selected period.', tone: 'teal' }
  ]
}

export function getTodayIsoDate() {
  return toIsoDateValue(new Date())
}

export function sumTaskStatusVolume(tasks = []) {
  return ensureArray(tasks).reduce((total, task) => (
    total
    + Number(task.taskCompleted || 0)
    + Number(task.taskInprogress || 0)
    + Number(task.taskRework || 0)
    + Number(task.taskApproved || 0)
    + Number(task.taskRejected || 0)
    + Number(task.taskReviewed || 0)
  ), 0)
}

export function buildDashboardFilterOptions(rawSources = {}) {
  const sources = createBaseSources(rawSources)

  const employeeOptions = buildSimpleSelectOptions(
    sources.employees
      .filter((employee) => getSelectableEmployeeUid(employee))
      .map((employee) => ({
        value: getSelectableEmployeeUid(employee),
        label: employee.fullName || employee.employeeCode || 'Employee',
        description: [employee.employeeCode, getEmployeePositionLabel(employee), getEmployeeDepartmentLabel(employee)].filter(Boolean).join(' • ')
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    { allLabel: 'All employees' }
  )

  const projectOptions = buildSimpleSelectOptions(
    sources.projects
      .filter((project) => String(project.uid || '').trim())
      .map((project) => ({
        value: String(project.uid || '').trim(),
        label: project.projectName || project.projectCode || 'Project',
        description: [project.projectCode, getProjectStatusLabel(project)].filter(Boolean).join(' • ')
      }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    { allLabel: 'All projects' }
  )

  return {
    employees: employeeOptions,
    projects: projectOptions,
    departments: buildUniqueValueOptions(sources.employees.map((employee) => getEmployeeDepartmentLabel(employee)), { allLabel: 'All departments' }),
    positions: buildUniqueValueOptions(sources.employees.map((employee) => getEmployeePositionLabel(employee)), { allLabel: 'All positions' }),
    projectStatuses: buildUniqueValueOptions(sources.projects.map((project) => getProjectStatusLabel(project)), { allLabel: 'All project statuses' }),
    assignmentStatuses: buildUniqueValueOptions(sources.assignments.map((assignment) => getAssignmentStatusLabel(assignment)), { allLabel: 'All assignment statuses' })
  }
}

export function buildAdminDashboardSnapshot(rawSources = {}, filterState = {}) {
  const filteredSources = filterDashboardSources(rawSources, filterState)
  const pendingLeaveCount = filteredSources.leaveRequests.length + filteredSources.leaveCancellationRequests.length
  const activeAssignments = filteredSources.assignments.filter((assignment) => ['assigned', 'active'].includes(normalizeText(assignment.status))).length
  const taskVolume = sumTaskStatusVolume(filteredSources.tasks)

  return {
    variant: 'admin',
    kpis: buildAdminKpis(filteredSources),
    charts: {
      attendanceTrend: buildLastSevenDaySeries(filteredSources.attendance, (record) => record.attendanceDate, (items) => ({
        present: items.filter((record) => ['present', 'remote'].includes(normalizeText(record.status))).length,
        absent: items.filter((record) => normalizeText(record.status) === 'absent').length
      })),
      taskHoursTrend: buildHoursTrendSeries(filteredSources.tasks, filterState),
      projectStatusSplit: buildProjectStatusSplit(filteredSources.projects),
      projectTaskVolume: buildProjectTaskVolume(filteredSources.tasks, filteredSources.projects),
      projectHours: buildProjectHours(filteredSources.tasks, filteredSources.projects),
      attendanceStatusSplit: buildAttendanceStatusSplit(filteredSources.attendance),
      employeeStatusSplit: buildEmployeeStatusSplit(filteredSources.employees),
      workLocationSplit: buildWorkLocationSplit(filteredSources.employees),
      assignmentStatusSplit: buildAssignmentStatusSplit(filteredSources.assignments),
      roleUserSplit: buildRoleUserSplit(filteredSources.employees, filteredSources.roles),
      leaveReviewSplit: buildLeaveReviewSplit(filteredSources.leaveRequests, filteredSources.leaveCancellationRequests),
      departmentHours: buildDepartmentHours(filteredSources.tasks, filteredSources.employees),
      taskStatusSplit: buildTaskStatusSplit(filteredSources.tasks)
    },
    widgets: {
      upcomingEvents: buildUpcomingHolidayWidgets(filteredSources.holidays).slice(0, 3),
      holidayCalendar: buildUpcomingHolidayWidgets(filteredSources.holidays),
      recentlyJoined: buildRecentJoiners(filteredSources.employees),
      updates: [
        `${pendingLeaveCount} leave review item${pendingLeaveCount === 1 ? '' : 's'} pending.`,
        `${activeAssignments} active assignment${activeAssignments === 1 ? '' : 's'} in the current view.`,
        `${taskVolume} task status update${taskVolume === 1 ? '' : 's'} recorded.`
      ],
      spotlightProjects: filteredSources.projects
        .slice()
        .sort((left, right) => String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || '')))
        .slice(0, 5)
        .map((project) => ({
          title: project.projectName,
          date: getProjectStatusLabel(project),
          meta: `${project.projectCode} • ${formatShortDate(project.updatedAt || project.createdAt)}`
        }))
    }
  }
}

export function buildEmployeeDashboardSnapshot(rawSources = {}, filterState = {}) {
  const filteredSources = filterDashboardSources(rawSources, filterState)
  const assignedProjectCount = new Set(filteredSources.assignments.map((assignment) => String(assignment.projectUid || '').trim()).filter(Boolean)).size
  const taskVolume = sumTaskStatusVolume(filteredSources.tasks)

  return {
    variant: 'employee',
    kpis: buildEmployeeKpis(filteredSources),
    charts: {
      hoursTrend: buildHoursTrendSeries(filteredSources.tasks, filterState),
      attendanceTrend: buildLastSevenDaySeries(filteredSources.attendance, (record) => record.attendanceDate, (items) => ({
        present: items.filter((record) => ['present', 'remote'].includes(normalizeText(record.status))).length,
        leave: items.filter((record) => ['leave', 'on leave'].includes(normalizeText(record.status))).length
      })),
      projectTaskVolume: buildProjectTaskVolume(filteredSources.tasks, filteredSources.projects),
      projectHours: buildProjectHours(filteredSources.tasks, filteredSources.projects),
      attendanceStatusSplit: buildAttendanceStatusSplit(filteredSources.attendance),
      assignmentStatusSplit: buildAssignmentStatusSplit(filteredSources.assignments),
      leaveStatusSplit: buildLeaveStatusSplit(filteredSources.leaveRequests),
      taskStatusSplit: buildTaskStatusSplit(filteredSources.tasks),
      projectStatusSplit: buildProjectStatusSplit(filteredSources.projects)
    },
    widgets: {
      upcomingEvents: buildUpcomingHolidayWidgets(filteredSources.holidays).slice(0, 3),
      holidayCalendar: buildUpcomingHolidayWidgets(filteredSources.holidays),
      recentlyJoined: filteredSources.currentEmployee
        ? [{ name: filteredSources.currentEmployee.fullName || filteredSources.currentEmployee.employeeCode || 'You', dept: getEmployeeDepartmentLabel(filteredSources.currentEmployee) || 'Unassigned' }]
        : [],
      updates: [
        `${filteredSources.leaveRequests.length} leave request${filteredSources.leaveRequests.length === 1 ? '' : 's'} in the current view.`,
        `${assignedProjectCount} project${assignedProjectCount === 1 ? '' : 's'} currently assigned.`,
        `${taskVolume} task status update${taskVolume === 1 ? '' : 's'} recorded.`
      ],
      assignedProjects: buildAssignedProjectWidgets(filteredSources.assignments, filteredSources.projects)
    }
  }
}
