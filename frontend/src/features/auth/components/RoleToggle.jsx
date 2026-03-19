import React from 'react'
import { ROLES } from '../../../utils/role.js'
import { BriefcaseIcon, ShieldUserIcon } from '../../../components/common/AppIcons.jsx'

const ROLE_OPTIONS = [
  {
    value: ROLES.ADMIN,
    label: 'Admin',
    hint: 'Control workspace',
    icon: ShieldUserIcon
  },
  {
    value: ROLES.EMPLOYEE,
    label: 'Employee',
    hint: 'Personal workspace',
    icon: BriefcaseIcon
  }
]

export default function RoleToggle({ value, onChange }) {
  return (
    <div className="role-toggle" role="tablist" aria-label="Role toggle">
      {ROLE_OPTIONS.map((option) => {
        const Icon = option.icon
        const active = value === option.value

        return (
          <button
            key={option.value}
            type="button"
            className={`role-toggle-option ${active ? 'active' : ''}`}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
          >
            <span className="role-toggle-icon">
              <Icon />
            </span>
            <span className="role-toggle-copy">
              <span className="role-toggle-label">{option.label}</span>
              <span className="role-toggle-hint">{option.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
