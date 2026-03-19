import React from 'react'
import { ChevronDownIcon, ChevronUpIcon } from './AppIcons.jsx'

export default function SortableHeader({
  label,
  columnKey,
  sortConfig,
  onSort,
  className = ''
}) {
  const isActive = sortConfig?.key === columnKey
  const direction = isActive ? sortConfig?.direction : null

  return (
    <button
      type="button"
      className={`sortable-header ${isActive ? 'active' : ''} ${className}`.trim()}
      onClick={() => onSort(columnKey)}
      aria-label={`Sort by ${label}${direction ? `, currently ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
    >
      <span>{label}</span>
      <span className="sortable-header-icons" aria-hidden="true">
        <ChevronUpIcon className={direction === 'asc' ? 'active' : ''} />
        <ChevronDownIcon className={direction === 'desc' ? 'active' : ''} />
      </span>
    </button>
  )
}
