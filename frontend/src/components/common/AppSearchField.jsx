import React from 'react'
import { SearchIcon } from './AppIcons.jsx'

export default function AppSearchField({
  label = 'Search',
  value = '',
  onChange,
  placeholder = 'Search',
  className = '',
  inputClassName = '',
  disabled = false,
  type = 'search',
  name = ''
}) {
  return (
    <div className={`employee-search-field ${className}`.trim()}>
      {label ? <label className="form-label small text-muted mb-1">{label}</label> : null}
      <div className="input-group employee-search-group">
        <span className="input-group-text"><SearchIcon /></span>
        <input
          className={`form-control ${inputClassName}`.trim()}
          type={type}
          name={name}
          value={value}
          onChange={(event) => onChange?.(event)}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
