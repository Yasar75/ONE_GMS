import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, DoubleChevronLeftIcon, DoubleChevronRightIcon } from './AppIcons.jsx'

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [5, 10, 25, 50, 100]

function normalizeRowsPerPageOptions(options = DEFAULT_ROWS_PER_PAGE_OPTIONS) {
  const normalized = [...new Set((options || []).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))]
  return normalized.length ? normalized : DEFAULT_ROWS_PER_PAGE_OPTIONS
}

function clampPage(page, totalPages) {
  return Math.min(Math.max(page, 1), totalPages)
}

function buildPaginationTokens(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }).map((_, index) => index + 1)
  }

  const windowPages = currentPage <= 3
    ? [2, 3]
    : currentPage >= totalPages - 2
      ? [totalPages - 2, totalPages - 1]
      : [currentPage - 1, currentPage, currentPage + 1]

  const pages = [1, ...windowPages.filter((page) => page > 1 && page < totalPages), totalPages]
  const uniquePages = [...new Set(pages)].sort((left, right) => left - right)
  const tokens = []

  uniquePages.forEach((page, index) => {
    const previousPage = uniquePages[index - 1]
    if (previousPage && page - previousPage > 1) {
      tokens.push(`ellipsis-${previousPage}-${page}`)
    }
    tokens.push(page)
  })

  return tokens
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
  const [rowsMenuPlacement, setRowsMenuPlacement] = useState('top')
  const [rowsMenuMaxHeight, setRowsMenuMaxHeight] = useState(220)

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

    function syncRowsMenuPlacement() {
      const triggerRect = rowsMenuRef.current?.getBoundingClientRect()
      if (!triggerRect) return

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const spaceBelow = Math.max(viewportHeight - triggerRect.bottom - 16, 120)
      const spaceAbove = Math.max(triggerRect.top - 16, 120)
      const prefersBottom = spaceBelow >= 184 || spaceBelow >= spaceAbove

      setRowsMenuPlacement(prefersBottom ? 'bottom' : 'top')
      setRowsMenuMaxHeight(Math.max(Math.min(prefersBottom ? spaceBelow : spaceAbove, 220), 120))
    }

    syncRowsMenuPlacement()
    window.setTimeout(syncRowsMenuPlacement, 0)

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

    window.addEventListener('resize', syncRowsMenuPlacement)
    window.addEventListener('scroll', syncRowsMenuPlacement, true)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', syncRowsMenuPlacement)
      window.removeEventListener('scroll', syncRowsMenuPlacement, true)
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
  const paginationTokens = useMemo(() => buildPaginationTokens(currentPage, totalPages), [currentPage, totalPages])

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
              <div className={`table-pagination-select-menu table-pagination-select-menu-${rowsMenuPlacement}`.trim()} role="listbox" aria-label="Rows per page" style={{ maxHeight: `${rowsMenuMaxHeight}px` }}>
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
            onClick={() => setCurrentPage(1)}
            disabled={currentPage <= 1}
            aria-label="First page"
            title="First page"
          >
            <DoubleChevronLeftIcon />
          </button>
          <button
            type="button"
            className="table-pagination-nav-btn"
            onClick={() => setCurrentPage((current) => clampPage(current - 1, totalPages))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </button>
          <div className="table-pagination-pages" role="navigation" aria-label="Pagination pages">
            {paginationTokens.map((token) => (
              typeof token === 'number'
                ? (
                  <button
                    key={token}
                    type="button"
                    className={`table-pagination-page-btn ${token === currentPage ? 'is-active' : ''}`.trim()}
                    onClick={() => setCurrentPage(token)}
                    aria-current={token === currentPage ? 'page' : undefined}
                    aria-label={`Page ${token}`}
                  >
                    {token}
                  </button>
                  )
                : <span key={token} className="table-pagination-ellipsis" aria-hidden="true">...</span>
            ))}
          </div>
          <button
            type="button"
            className="table-pagination-nav-btn"
            onClick={() => setCurrentPage((current) => clampPage(current + 1, totalPages))}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </button>
          <button
            type="button"
            className="table-pagination-nav-btn"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage >= totalPages}
            aria-label="Last page"
            title="Last page"
          >
            <DoubleChevronRightIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
