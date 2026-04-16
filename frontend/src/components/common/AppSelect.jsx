import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from './AppIcons.jsx'

function normalizeSearchValue(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeOptions(options) {
  return (options || []).map((option, index) => {
    if (typeof option === 'string' || typeof option === 'number') {
      const stringValue = String(option)
      return {
        value: option,
        label: stringValue,
        optionKey: `primitive-${stringValue}-${index}`,
        searchText: normalizeSearchValue(stringValue)
      }
    }

    const value = option?.value ?? ''
    const label = option?.label ?? String(value)
    const description = option?.description || ''
    const keywords = option?.keywords || option?.searchKeywords || option?.searchText || ''

    return {
      value,
      label,
      description,
      disabled: Boolean(option?.disabled),
      tone: option?.tone || '',
      optionKey: String(option?.key || option?.id || `${value}-${label}-${description}-${index}`),
      searchText: normalizeSearchValue([label, description, value, keywords].filter(Boolean).join(' '))
    }
  })
}

export default function AppSelect({
  value,
  onChange,
  onBlur,
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
  closeOnSelect,
  searchable = true,
  searchPlaceholder = 'Search options'
}) {
  const rootRef = useRef(null)
  const buttonRef = useRef(null)
  const searchInputRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [menuPlacement, setMenuPlacement] = useState('bottom')

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options])
  const filteredOptions = useMemo(() => {
    const query = normalizeSearchValue(searchTerm)
    if (!query) return normalizedOptions

    const queryTokens = query.split(/\s+/).filter(Boolean)
    return normalizedOptions.filter((option) => queryTokens.every((token) => option.searchText.includes(token)))
  }, [normalizedOptions, searchTerm])
  const selectedValues = useMemo(() => {
    if (!multiple) return [String(value ?? '')]
    return Array.isArray(value) ? value.map((item) => String(item)) : []
  }, [multiple, value])
  const selectedOptions = useMemo(() => normalizedOptions.filter((option) => selectedValues.includes(String(option.value))), [normalizedOptions, selectedValues])
  const selectedOption = !multiple ? normalizedOptions.find((option) => String(option.value) === String(value ?? '')) : null
  const shouldCloseOnSelect = closeOnSelect ?? !multiple

  const emitBlur = () => {
    if (typeof onBlur !== 'function') return

    const nextValue = multiple ? selectedValues : value
    if (name) {
      onBlur({
        target: {
          name,
          value: nextValue
        }
      })
      return
    }

    onBlur(nextValue)
  }

  useEffect(() => {
    if (!isOpen) return undefined

    setSearchTerm('')
    if (searchable) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0)
    }

    const syncMenuPlacement = () => {
      const triggerRect = buttonRef.current?.getBoundingClientRect()
      if (!triggerRect) return

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
      const spaceBelow = viewportHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top
      const estimatedMenuHeight = Math.min(searchable && normalizedOptions.length ? 360 : 280, Math.max(normalizedOptions.length * 48, 160))

      setMenuPlacement(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow ? 'top' : 'bottom')
    }

    syncMenuPlacement()
    window.setTimeout(syncMenuPlacement, 0)

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

    window.addEventListener('resize', syncMenuPlacement)
    window.addEventListener('scroll', syncMenuPlacement, true)
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('resize', syncMenuPlacement)
      window.removeEventListener('scroll', syncMenuPlacement, true)
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, normalizedOptions.length, searchable])

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
    <div
      ref={rootRef}
      className={`app-select ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''} ${invalid ? 'is-invalid' : ''} ${multiple ? 'is-multiple' : ''} ${className}`.trim()}
      onBlurCapture={(event) => {
        if (rootRef.current?.contains(event.relatedTarget)) return
        emitBlur()
      }}
    >
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
        <div className={`app-select-menu app-select-menu-${align} app-select-menu-placement-${menuPlacement} ${menuClassName}`.trim()} role="listbox" aria-multiselectable={multiple}>
          {searchable && normalizedOptions.length ? (
            <div className="app-select-search-shell" onMouseDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <input
                ref={searchInputRef}
                type="text"
                className="form-control app-select-search-input"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={searchPlaceholder}
                autoComplete="off"
                spellCheck={false}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Escape') {
                    setIsOpen(false)
                    buttonRef.current?.focus()
                  }
                }}
              />
            </div>
          ) : null}
          {filteredOptions.length ? filteredOptions.map((option) => {
            const isSelected = multiple
              ? selectedValues.includes(String(option.value))
              : String(option.value) === String(value ?? '')

            return (
              <button
                key={`${name || 'select'}-${option.optionKey}`}
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
