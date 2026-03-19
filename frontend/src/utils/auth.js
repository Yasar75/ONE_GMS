import { ROLES } from './role.js'

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000

export const AUTH_STORAGE_KEYS = {
  user: 'lms.auth.user',
  accessToken: 'lms.auth.token',
  refreshToken: 'lms.auth.refreshToken',
  lastActivityAt: 'lms.auth.lastActivityAt',
  rememberedLogin: 'lms.auth.rememberedLogin'
}

export function normalizeRole(roleName) {
  const raw = String(roleName ?? '').trim().toLowerCase()

  if (['admin', 'hr', 'superadmin', 'super_admin'].includes(raw)) {
    return ROLES.ADMIN
  }

  return ROLES.EMPLOYEE
}

export function normalizeUserProfile(profile) {
  const rawUser = profile?.user ?? profile ?? {}
  const roleName = profile?.role_name ?? rawUser?.role_name ?? ''
  const firstName = rawUser.first_name ?? rawUser.firstName ?? rawUser.username ?? 'User'
  const lastName = rawUser.last_name ?? rawUser.lastName ?? ''

  return {
    id: rawUser.uid ?? rawUser.id ?? '',
    uid: rawUser.uid ?? rawUser.id ?? '',
    email: rawUser.email ?? '',
    username: rawUser.username ?? '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    role: normalizeRole(roleName),
    roleName: roleName || 'Employee',
    isVerified: Boolean(rawUser.is_verified ?? rawUser.isVerified),
    permissions: profile?.permissions ?? rawUser?.permissions ?? {},
    avatarUrl: rawUser.avatarUrl ?? ''
  }
}

function humanizeErrorField(value) {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim()
}

function formatStructuredError(payload) {
  if (payload == null) return ''

  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed || ''
  }

  if (typeof payload === 'number' || typeof payload === 'boolean') {
    return String(payload)
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item) => formatStructuredError(item))
      .filter(Boolean)
      .join(' • ')
  }

  if (typeof payload === 'object') {
    const location = Array.isArray(payload.loc)
      ? payload.loc.filter((segment) => !['body', 'query', 'path'].includes(String(segment))).join(' → ')
      : ''

    if (typeof payload.msg === 'string' && payload.msg.trim()) {
      return location ? `${humanizeErrorField(location)}: ${payload.msg.trim()}` : payload.msg.trim()
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }

    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail.trim()
    }

    if (payload.detail != null) {
      return formatStructuredError(payload.detail)
    }

    if (payload.errors != null) {
      const fieldErrors = Array.isArray(payload.errors)
        ? payload.errors.map((item) => formatStructuredError(item)).filter(Boolean)
        : Object.entries(payload.errors)
          .map(([field, value]) => {
            const message = formatStructuredError(value)
            return message ? `${humanizeErrorField(field)}: ${message}` : ''
          })
          .filter(Boolean)

      return fieldErrors.join(' • ')
    }

    const flattened = Object.entries(payload)
      .map(([key, value]) => {
        if (['type', 'input', 'ctx'].includes(key)) return ''
        const message = formatStructuredError(value)
        return message ? `${humanizeErrorField(key)}: ${message}` : ''
      })
      .filter(Boolean)

    if (flattened.length) return flattened.join(' • ')

    try {
      return JSON.stringify(payload)
    } catch {
      return ''
    }
  }

  return ''
}

export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const candidates = [
    error?.response?.data?.message,
    error?.response?.data?.detail,
    error?.response?.data?.errors,
    error?.response?.data,
    error?.message,
    error
  ]

  for (const candidate of candidates) {
    const message = formatStructuredError(candidate)
    if (message) return message
  }

  return fallback
}
