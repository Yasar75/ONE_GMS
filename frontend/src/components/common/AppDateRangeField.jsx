import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarIcon } from './AppIcons.jsx'

function formatRangeLabel(start, end) {
  if (!start && !end) return '[Select range]'

  const formatter = new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const formatValue = (value) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : formatter.format(date)
  }

  return `${formatValue(start)} — ${formatValue(end)}`
}

export default function AppDateRangeField({
  value,
  onChange,
  className = '',
  placeholder = '[Select range]'
}) {
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)

  const start = value?.start || ''
  const end = value?.end || ''

  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const label = useMemo(() => {
    const computed = formatRangeLabel(start, end)
    return computed === '[Select range]' ? placeholder : computed
  }, [end, placeholder, start])

  return (
    <div ref={rootRef} className={`app-select app-date-range ${isOpen ? 'is-open' : ''} ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="app-select-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="app-select-trigger-main">
          <span className="app-select-trigger-icon"><CalendarIcon /></span>
          <span className="app-select-trigger-copy">
            <span className={`app-select-trigger-value ${!start && !end ? 'is-placeholder' : ''}`.trim()}>{label}</span>
          </span>
        </span>
      </button>

      {isOpen ? (
        <div className="app-select-menu app-select-menu-start app-date-range-menu">
          <div className="app-date-range-grid">
            <label className="app-date-range-field">
              <span>From</span>
              <input
                type="date"
                className="form-control"
                value={start}
                max={end || undefined}
                onChange={(event) => onChange?.({ start: event.target.value, end })}
              />
            </label>

            <label className="app-date-range-field">
              <span>To</span>
              <input
                type="date"
                className="form-control"
                value={end}
                min={start || undefined}
                onChange={(event) => {
                  onChange?.({ start, end: event.target.value })
                  setIsOpen(false)
                }}
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  )
}
