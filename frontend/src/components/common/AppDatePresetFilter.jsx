import React, { useId, useMemo } from 'react'

export const DATE_PRESET_OPTIONS = [
  { value: 'overall', label: 'Overall' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' }
]

export function resolveDatePresetOptions({ includeOverall = true } = {}) {
  return DATE_PRESET_OPTIONS.filter((option) => includeOverall || option.value !== 'overall')
}

export default function AppDatePresetFilter({
  value = 'today',
  onChange,
  includeOverall = true,
  className = '',
  name = 'date-preset-filter'
}) {
  const instanceId = useId()
  const options = useMemo(() => resolveDatePresetOptions({ includeOverall }), [includeOverall])

  return (
    <div className={`date-preset-filter ${className}`.trim()} role="radiogroup" aria-label="Date preset filter">
      {options.map((option) => {
        const inputId = `${name}-${instanceId}-${option.value}`
        const checked = value === option.value

        return (
          <div className="date-preset-filter__item" key={option.value}>
            <input
              id={inputId}
              className="date-preset-filter__input"
              type="radio"
              name={`${name}-${instanceId}`}
              checked={checked}
              onChange={() => onChange?.(option.value)}
            />
            <label className="date-preset-filter__label" htmlFor={inputId}>
              <span className="date-preset-filter__dot" aria-hidden="true" />
              <span>{option.label}</span>
            </label>
          </div>
        )
      })}
    </div>
  )
}
