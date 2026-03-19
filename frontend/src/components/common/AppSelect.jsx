import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from './AppIcons.jsx'

function normalizeOptions(options) {
  return (options || []).map((option) => {
    if (typeof option === 'string' || typeof option === 'number') {
      return { value: option, label: String(option) }
    }

    return {
      value: option?.value ?? '',
      label: option?.label ?? String(option?.value ?? ''),
      description: option?.description || '',
      disabled: Boolean(option?.disabled),
      tone: option?.tone || ''
    }
  })
}

export default function AppSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  name,
  disabled = false,
  icon = null,
  className = '',
  menuClassName = '',
  triggerClassName = '',
  invalid = false,
  align = 'start',
  multiple = false,
  hideSelectedDescription = false,
  closeOnSelect
}) {
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options])
  const selectedValues = useMemo(() => {
    if (!multiple) return [String(value ?? '')]
    return Array.isArray(value) ? value.map((item) => String(item)) : []
  }, [multiple, value])
  const selectedOptions = useMemo(() => normalizedOptions.filter((option) => selectedValues.includes(String(option.value))), [normalizedOptions, selectedValues])
  const selectedOption = !multiple ? normalizedOptions.find((option) => String(option.value) === String(value ?? '')) : null
  const shouldCloseOnSelect = closeOnSelect ?? !multiple

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

  const emitValue = (nextValue) => {
    if (typeof onChange !== 'function') return

    if (name) {
      onChange({
        target: {
          name,
          value: nextValue
        }
      })
      return
    }

    onChange(nextValue)
  }

  const toggleValue = (nextValue) => {
    if (!multiple) {
      emitValue(nextValue)
      if (shouldCloseOnSelect) setIsOpen(false)
      return
    }

    const nextKey = String(nextValue)
    const nextValues = selectedValues.includes(nextKey)
      ? selectedValues.filter((item) => item !== nextKey)
      : [...selectedValues, nextKey]

    emitValue(nextValues)
    if (shouldCloseOnSelect) setIsOpen(false)
  }

  const triggerLabel = useMemo(() => {
    if (!multiple) return selectedOption?.label || placeholder
    if (!selectedOptions.length) return placeholder
    if (selectedOptions.length <= 2) return selectedOptions.map((option) => option.label).join(', ')
    return `${selectedOptions.length} selected`
  }, [multiple, placeholder, selectedOption, selectedOptions])

  const triggerDescription = useMemo(() => {
    if (hideSelectedDescription) return ''
    if (!multiple) return selectedOption?.description || ''
    if (!selectedOptions.length) return ''
    if (selectedOptions.length === 1) return selectedOptions[0]?.description || ''
    return `${selectedOptions.length} options selected`
  }, [hideSelectedDescription, multiple, selectedOption, selectedOptions])

  return (
    <div ref={rootRef} className={`app-select ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${invalid ? 'is-invalid' : ''} ${multiple ? 'is-multiple' : ''} ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className={`app-select-trigger ${triggerClassName}`.trim()}
        onClick={() => !disabled && setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-multiselectable={multiple}
        disabled={disabled}
      >
        <span className="app-select-trigger-main">
          {icon ? <span className="app-select-trigger-icon">{icon}</span> : null}
          <span className="app-select-trigger-copy">
            <span className={`app-select-trigger-value ${(multiple ? !selectedOptions.length : !selectedOption) ? 'is-placeholder' : ''}`.trim()}>
              {triggerLabel}
            </span>
            {triggerDescription ? <span className="app-select-trigger-description">{triggerDescription}</span> : null}
          </span>
        </span>
        <ChevronDownIcon className="app-select-trigger-chevron" />
      </button>

      {isOpen ? (
        <div className={`app-select-menu app-select-menu-${align} ${menuClassName}`.trim()} role="listbox" aria-multiselectable={multiple}>
          {normalizedOptions.length ? normalizedOptions.map((option) => {
            const isSelected = multiple
              ? selectedValues.includes(String(option.value))
              : String(option.value) === String(value ?? '')

            return (
              <button
                key={`${name || 'select'}-${String(option.value)}`}
                type="button"
                className={`app-select-option ${isSelected ? 'is-selected' : ''} ${option.tone ? `tone-${option.tone}` : ''}`.trim()}
                onClick={() => {
                  if (option.disabled) return
                  toggleValue(option.value)
                }}
                disabled={option.disabled}
                role="option"
                aria-selected={isSelected}
              >
                <span className="app-select-option-copy">
                  <span className="app-select-option-label">{option.label}</span>
                  {option.description ? <span className="app-select-option-description">{option.description}</span> : null}
                </span>
                <span className="app-select-option-check">{isSelected ? <CheckIcon /> : null}</span>
              </button>
            )
          }) : (
            <div className="app-select-empty">No options found.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
