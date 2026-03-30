import React from 'react'
import { ChevronDownIcon, ChevronUpIcon } from './AppIcons.jsx'

export default function SortableHeader({
  label,
  sortKey,
  columnKey,
  sortConfig,
  onSort,
  className = ''
}) {
  const resolvedSortKey = sortKey ?? columnKey
  const isSortable = Boolean(resolvedSortKey && typeof onSort === 'function')
  const isActive = isSortable && sortConfig?.key === resolvedSortKey
  const direction = isActive ? sortConfig?.direction : null

  return (
    <button
      type="button"
      className={`sortable-header ${isActive ? 'active' : ''} ${className}`.trim()}
      onClick={() => {
        if (isSortable) onSort(resolvedSortKey)
      }}
      aria-label={isSortable
        ? `Sort by ${label}${direction ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`
        : label}
      disabled={!isSortable}
    >
      <span className="sortable-header-label">{label}</span>
      <span className="sortable-header-icons" aria-hidden="true">
        <ChevronUpIcon className={direction === 'asc' ? 'active' : ''} />
        <ChevronDownIcon className={direction === 'desc' ? 'active' : ''} />
      </span>
    </button>
  )
}
