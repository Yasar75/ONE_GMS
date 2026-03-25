import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from './AppIcons.jsx'

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100]

function normalizeRowsPerPageOptions(options = DEFAULT_ROWS_PER_PAGE_OPTIONS) {
  const normalized = [...new Set((options || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))]
  return normalized.length ? normalized : DEFAULT_ROWS_PER_PAGE_OPTIONS
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(page, 1), totalPages)
}

export default function PaginatedTable({
  rows = [],
  children,
  className = '',
  scrollClassName = '',
  footerClassName = '',
  defaultRowsPerPage = 5,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
  maxHeight = '25rem'
}) {
  const normalizedRowsPerPageOptions = useMemo(() => normalizeRowsPerPageOptions(rowsPerPageOptions), [rowsPerPageOptions])
  const resolvedDefaultRowsPerPage = normalizedRowsPerPageOptions.includes(defaultRowsPerPage)
    ? defaultRowsPerPage
    : normalizedRowsPerPageOptions[0]

  const rowsMenuRef = useRef(null)
  const [rowsPerPage, setRowsPerPage] = useState(resolvedDefaultRowsPerPage)
  const [currentPage, setCurrentPage] = useState(1)
  const [isRowsMenuOpen, setIsRowsMenuOpen] = useState(false)

  useEffect(() => {
    setRowsPerPage((current) => (normalizedRowsPerPageOptions.includes(current) ? current : resolvedDefaultRowsPerPage))
  }, [normalizedRowsPerPageOptions, resolvedDefaultRowsPerPage])

  const totalRows = rows.length
  const totalPages = Math.max(Math.ceil(totalRows / rowsPerPage), 1)

  useEffect(() => {
    setCurrentPage((current) => clampPage(current, totalPages))
  }, [totalPages])

  useEffect(() => {
    if (!isRowsMenuOpen) return undefined

    function handlePointerDown(event) {
      if (!rowsMenuRef.current?.contains(event.target)) {
        setIsRowsMenuOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsRowsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isRowsMenuOpen])

  const paginatedRows = useMemo(() => {
    if (!totalRows) return []
    const startIndex = (currentPage - 1) * rowsPerPage
    return rows.slice(startIndex, startIndex + rowsPerPage)
  }, [currentPage, rows, rowsPerPage, totalRows])

  const startRow = totalRows ? ((currentPage - 1) * rowsPerPage) + 1 : 0
  const endRow = totalRows ? Math.min(currentPage * rowsPerPage, totalRows) : 0
  const resolvedMaxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight

  return (
    <div className={`employee-table-wrap employee-table-wrap--paginated ${className}`.trim()}>
      <div className={`employee-table-scroll table-responsive ${scrollClassName}`.trim()} style={{ '--table-scroll-max-height': resolvedMaxHeight }}>
        {children({
          rows: paginatedRows,
          currentPage,
          rowsPerPage,
          totalPages,
          totalRows,
          startRow,
          endRow
        })}
      </div>

      <div className={`table-pagination-bar ${footerClassName}`.trim()}>
        <div className="table-pagination-limit">
          <span className="table-pagination-limit-label">Rows per page:</span>
          <div ref={rowsMenuRef} className={`table-pagination-select-shell ${isRowsMenuOpen ? 'is-open' : ''}`.trim()}>
            <button
              type="button"
              className="table-pagination-select-trigger"
              onClick={() => setIsRowsMenuOpen((current) => !current)}
              aria-haspopup="listbox"
              aria-expanded={isRowsMenuOpen}
            >
              <span>{rowsPerPage}</span>
              <ChevronDownIcon />
            </button>

            {isRowsMenuOpen ? (
              <div className="table-pagination-select-menu" role="listbox" aria-label="Rows per page">
                {normalizedRowsPerPageOptions.map((option) => {
                  const isSelected = option === rowsPerPage
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`table-pagination-select-option ${isSelected ? 'is-selected' : ''}`.trim()}
                      onClick={() => {
                        setRowsPerPage(option)
                        setCurrentPage(1)
                        setIsRowsMenuOpen(false)
                      }}
                      role="option"
                      aria-selected={isSelected}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="table-pagination-status">
          Showing {startRow} to {endRow} of {totalRows} entries
        </div>

        <div className="table-pagination-nav">
          <button
            type="button"
            className="table-pagination-nav-btn"
            onClick={() => setCurrentPage((current) => clampPage(current - 1, totalPages))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </button>
          <span className="table-pagination-page-indicator">{currentPage}</span>
          <button
            type="button"
            className="table-pagination-nav-btn"
            onClick={() => setCurrentPage((current) => clampPage(current + 1, totalPages))}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
