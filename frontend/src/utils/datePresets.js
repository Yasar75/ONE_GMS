export function toStartOfDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) return new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function toEndOfDay(value = new Date()) {
  const date = toStartOfDay(value)
  date.setHours(23, 59, 59, 999)
  return date
}

export function toIsoDateValue(value = new Date()) {
  const date = toStartOfDay(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getPresetDateRange(preset = 'today', referenceDate = new Date()) {
  const today = toStartOfDay(referenceDate)

  if (preset === 'overall') {
    return { start: null, end: null }
  }

  if (preset === 'today') {
    return { start: today, end: toEndOfDay(today) }
  }

  if (preset === 'week') {
    const start = new Date(today)
    const dayIndex = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - dayIndex)
    return { start, end: toEndOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)) }
  }

  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const end = toEndOfDay(new Date(today.getFullYear(), today.getMonth() + 1, 0))
    return { start, end }
  }

  return { start: today, end: toEndOfDay(today) }
}

export function isDateWithinPreset(dateValue, preset = 'today', referenceDate = new Date()) {
  if (!dateValue) return preset === 'overall'

  const date = toStartOfDay(dateValue)
  if (Number.isNaN(date.getTime())) return false

  const range = getPresetDateRange(preset, referenceDate)
  if (!range.start || !range.end) return true

  return date >= toStartOfDay(range.start) && date <= toEndOfDay(range.end)
}
