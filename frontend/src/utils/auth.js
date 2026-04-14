import { ROLES } from './role.js'

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000
export const DEFAULT_EMPLOYEE_PASSWORD = 'Welcome@123'

export const AUTH_STORAGE_KEYS = {
  user: 'one_gms.auth.user',
  accessToken: 'one_gms.auth.token',
  refreshToken: 'one_gms.auth.refreshToken',
  lastActivityAt: 'one_gms.auth.lastActivityAt',
  rememberedLogin: 'one_gms.auth.rememberedLogin',
  passwordSetupEmail: 'one_gms.auth.passwordSetupEmail'
}

export function isProfileSetupRequired(user) {
  return Boolean(user?.mustChangePassword || user?.mustCompleteProfile)
}

export function normalizeRole(roleName) {
  const raw = String(roleName ?? '').trim().toLowerCase()

  if (raw === 'admin') {
    return ROLES.ADMIN
  }

  return ROLES.EMPLOYEE
}

function deriveFirstLoginDeadline(profile, rawUser) {
  const explicitDeadline = profile?.first_login_deadline_at
    ?? profile?.firstLoginDeadlineAt
    ?? rawUser?.first_login_deadline_at
    ?? rawUser?.firstLoginDeadlineAt

  if (explicitDeadline) return explicitDeadline

  const firstLoginAt = rawUser?.first_login_at ?? rawUser?.firstLoginAt
  const createdAt = rawUser?.created_at ?? rawUser?.createdAt
  if (firstLoginAt || !createdAt) return null

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return null

  return new Date(createdDate.getTime() + (48 * 60 * 60 * 1000)).toISOString()
}

export function normalizeUserProfile(profile) {
  const rawUser = profile?.user ?? profile ?? {}
  const roleName = profile?.role_name ?? rawUser?.role_name ?? ''
  const employeeUid = profile?.employee_uid
    ?? profile?.employeeUid
    ?? rawUser?.employee_uid
    ?? rawUser?.employeeUid
    ?? ''
  const firstName = rawUser.first_name ?? rawUser.firstName ?? rawUser.username ?? 'User'
  const lastName = rawUser.last_name ?? rawUser.lastName ?? ''
  const nickname = rawUser.nickname ?? rawUser.nick_name ?? rawUser.nickName ?? ''
  const displayName = nickname || firstName || rawUser.username || 'User'
  const mustChangePassword = Boolean(profile?.must_change_password ?? rawUser?.must_change_password)
  const mustCompleteProfile = Boolean(profile?.must_complete_profile ?? rawUser?.must_complete_profile)
  const canEditProfileDetails = Boolean(profile?.can_edit_profile_details ?? rawUser?.can_edit_profile_details ?? true)
  const canEditProfilePictureRaw = profile?.can_edit_profile_picture
    ?? profile?.can_edit_profile_photo
    ?? profile?.can_upload_profile_image
    ?? profile?.can_upload_profile_photo
    ?? rawUser?.can_edit_profile_picture
    ?? rawUser?.can_edit_profile_photo
    ?? rawUser?.can_upload_profile_image
    ?? rawUser?.can_upload_profile_photo
  const canEditProfilePicture = canEditProfilePictureRaw == null ? null : Boolean(canEditProfilePictureRaw)
  const firstLoginDeadlineAt = deriveFirstLoginDeadline(profile, rawUser)

  return {
    id: rawUser.uid ?? rawUser.id ?? '',
    uid: rawUser.uid ?? rawUser.id ?? '',
    employeeUid: String(employeeUid || '').trim(),
    email: rawUser.email ?? '',
    username: rawUser.username ?? '',
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(' '),
    nickname,
    displayName,
    role: normalizeRole(roleName),
    roleName: roleName || 'Employee',
    roleId: rawUser.role_id ?? rawUser.roleId ?? '',
    isVerified: Boolean(rawUser.is_verified ?? rawUser.isVerified),
    isLocked: Boolean(rawUser.is_locked ?? rawUser.isLocked),
    lockedAt: rawUser.locked_at ?? rawUser.lockedAt ?? null,
    lockedReason: rawUser.locked_reason ?? rawUser.lockedReason ?? '',
    firstLoginAt: rawUser.first_login_at ?? rawUser.firstLoginAt ?? null,
    unlockedAt: rawUser.unlocked_at ?? rawUser.unlockedAt ?? null,
    createdAt: rawUser.created_at ?? rawUser.createdAt ?? null,
    updatedAt: rawUser.updated_at ?? rawUser.updatedAt ?? null,
    permissions: profile?.permissions ?? rawUser?.permissions ?? {},
    avatarUrl: rawUser.profile_image_url ?? rawUser.profile_image ?? rawUser.avatarUrl ?? '',
    profileImageUrl: rawUser.profile_image_url ?? rawUser.profile_image ?? rawUser.avatarUrl ?? '',
    mustChangePassword,
    mustCompleteProfile,
    canEditProfileDetails,
    canEditProfilePicture,
    profileCompletedAt: rawUser.profile_completed_at ?? rawUser.profileCompletedAt ?? null,
    firstLoginDeadlineAt
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
