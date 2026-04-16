import { getPresetDateRange, isDateWithinPreset, toIsoDateValue, toStartOfDay } from '../../../utils/datePresets.js'

export const TASK_STATUS_CHART_CONFIG = [
  { key: 'taskCompletedValue', rawKey: 'taskCompleted', label: 'Completed', color: '#22c55e', tone: 'green' },
  { key: 'taskApprovedValue', rawKey: 'taskApproved', label: 'Approved', color: '#14b8a6', tone: 'teal' },
  { key: 'taskReviewedValue', rawKey: 'taskReviewed', label: 'Reviewed', color: '#8b5cf6', tone: 'purple' },
  { key: 'taskInprogressValue', rawKey: 'taskInprogress', label: 'In Progress', color: '#3b82f6', tone: 'blue' },
  { key: 'taskReworkValue', rawKey: 'taskRework', label: 'Rework', color: '#f59e0b', tone: 'orange' },
  { key: 'taskRejectedValue', rawKey: 'taskRejected', label: 'Rejected', color: '#ef4444', tone: 'red' }
]

function getTaskNumber(task = {}, key = '', rawKey = '') {
  const value = Number(task?.[key] ?? task?.[rawKey] ?? 0)
  return Number.isFinite(value) ? value : 0
}

export function filterTasksByDatePreset(tasks = [], preset = 'today', referenceDate = new Date()) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => isDateWithinPreset(task?.taskDate, preset, referenceDate))
}

export function buildTaskStatusChartData(tasks = []) {
  return TASK_STATUS_CHART_CONFIG.map((entry) => ({
    name: entry.label,
    value: tasks.reduce((total, task) => total + getTaskNumber(task, entry.key, entry.rawKey), 0),
    color: entry.color,
    tone: entry.tone
  })).filter((entry) => entry.value > 0)
}

function formatDayLabel(value) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(value)
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(value)
}

function formatMonthLabel(value) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(value)
}

function sumHoursForIsoDate(tasks = [], isoDate = '') {
  return tasks.reduce((total, task) => (
    String(task?.taskDate || '') === isoDate
      ? total + getTaskNumber(task, 'hourWork', 'hourWork')
      : total
  ), 0)
}

export function buildTaskHoursChart(tasks = [], preset = 'today', referenceDate = new Date()) {
  const scopedTasks = filterTasksByDatePreset(tasks, preset, referenceDate)
  const today = toStartOfDay(referenceDate)

  if (preset === 'today') {
    const isoDate = toIsoDateValue(today)
    return {
      yAxisStep: 1,
      data: [{
        key: isoDate,
        label: formatDayLabel(today),
        secondaryLabel: formatShortDate(today),
        hours: sumHoursForIsoDate(scopedTasks, isoDate)
      }]
    }
  }

  if (preset === 'week') {
    const { start } = getPresetDateRange('week', referenceDate)
    const data = Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start)
      current.setDate(start.getDate() + index)
      const isoDate = toIsoDateValue(current)
      return {
        key: isoDate,
        label: formatDayLabel(current),
        secondaryLabel: formatShortDate(current),
        hours: sumHoursForIsoDate(scopedTasks, isoDate)
      }
    })

    return { yAxisStep: 1, data }
  }

  if (preset === 'month') {
    const { start, end } = getPresetDateRange('month', referenceDate)
    const totalDays = end.getDate()
    const weekCount = Math.ceil(totalDays / 7)
    const data = Array.from({ length: weekCount }, (_, index) => {
      const weekNumber = index + 1
      const weekHours = scopedTasks.reduce((total, task) => {
        const taskDate = toStartOfDay(task?.taskDate)
        if (Number.isNaN(taskDate.getTime())) return total
        const taskWeek = Math.floor((taskDate.getDate() - 1) / 7) + 1
        return taskWeek === weekNumber ? total + getTaskNumber(task, 'hourWork', 'hourWork') : total
      }, 0)

      return {
        key: `week-${weekNumber}`,
        label: `Week ${weekNumber}`,
        secondaryLabel: `${formatShortDate(new Date(start.getFullYear(), start.getMonth(), (index * 7) + 1))}`,
        hours: weekHours
      }
    })

    return { yAxisStep: 10, data }
  }

  const data = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1)
    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`
    const monthHours = scopedTasks.reduce((total, task) => {
      const taskDate = toStartOfDay(task?.taskDate)
      if (Number.isNaN(taskDate.getTime())) return total
      const taskKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}`
      return taskKey === monthKey ? total + getTaskNumber(task, 'hourWork', 'hourWork') : total
    }, 0)

    return {
      key: monthKey,
      label: formatMonthLabel(monthDate),
      secondaryLabel: String(monthDate.getFullYear()),
      hours: monthHours
    }
  })

  return { yAxisStep: 40, data }
}
