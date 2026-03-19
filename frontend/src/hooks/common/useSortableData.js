import { useMemo, useState } from 'react'

function normalizeValue(value) {
  if (value == null) return ''

  if (value instanceof Date) return value.getTime()

  if (typeof value === 'number') return value

  if (typeof value === 'string') {
    const asDate = Date.parse(value)
    if (!Number.isNaN(asDate) && /\d{4}-\d{2}-\d{2}|\w{3,}/.test(value)) {
      return asDate
    }

    const numeric = Number(value)
    if (!Number.isNaN(numeric) && value.trim() !== '') return numeric

    return value.toLowerCase()
  }

  return String(value).toLowerCase()
}

export function useSortableData(items = [], options = {}) {
  const { initialKey = null, initialDirection = 'asc', accessors = {} } = options
  const [sortConfig, setSortConfig] = useState(() => ({
    key: initialKey,
    direction: initialDirection
  }))

  const sortedItems = useMemo(() => {
    if (!sortConfig?.key) return [...items]

    const accessor = accessors[sortConfig.key] ?? ((item) => item?.[sortConfig.key])
    const directionFactor = sortConfig.direction === 'desc' ? -1 : 1

    return [...items].sort((left, right) => {
      const leftValue = normalizeValue(accessor(left))
      const rightValue = normalizeValue(accessor(right))

      if (leftValue < rightValue) return -1 * directionFactor
      if (leftValue > rightValue) return 1 * directionFactor
      return 0
    })
  }, [accessors, items, sortConfig])

  const requestSort = (key) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        }
      }

      return { key, direction: 'asc' }
    })
  }

  return {
    items: sortedItems,
    sortConfig,
    requestSort,
    setSortConfig
  }
}
