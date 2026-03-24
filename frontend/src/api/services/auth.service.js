import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import { normalizeUserProfile } from '../../utils/auth.js'

function deriveFirstLoginDeadline(record) {
  const firstLoginAt = record?.first_login_at || record?.firstLoginAt
  const createdAt = record?.created_at || record?.createdAt
  if (firstLoginAt || !createdAt) return null

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return null

  return new Date(createdDate.getTime() + (48 * 60 * 60 * 1000)).toISOString()
}

function normalizeLockStatusRecord(record) {
  return {
    uid: record?.uid || '',
    username: record?.username || '',
    email: record?.email || '',
    firstName: record?.first_name || record?.firstName || '',
    lastName: record?.last_name || record?.lastName || '',
    roleId: record?.role_id || record?.roleId || '',
    isVerified: Boolean(record?.is_verified ?? record?.isVerified),
    isLocked: Boolean(record?.is_locked ?? record?.isLocked),
    lockedAt: record?.locked_at || record?.lockedAt || null,
    lockedReason: record?.locked_reason || record?.lockedReason || '',
    firstLoginAt: record?.first_login_at || record?.firstLoginAt || null,
    unlockedAt: record?.unlocked_at || record?.unlockedAt || null,
    createdAt: record?.created_at || record?.createdAt || null,
    updatedAt: record?.updated_at || record?.updatedAt || null,
    firstLoginDeadlineAt: deriveFirstLoginDeadline(record)
  }
}

export const authService = {
  async login({ email, password }) {
    const response = await http.post(endpoints.auth.login, { email, password })
    return response.data
  },

  async getCurrentUser() {
    const response = await http.get(endpoints.auth.me)
    return normalizeUserProfile(response.data)
  },

  async changePassword(payload) {
    const response = await http.post(endpoints.auth.changePassword, payload)
    return response.data
  },

  async unlockUser(email) {
    const response = await http.post(endpoints.auth.unlockUser, { email })
    return response.data
  },

  async getLockedUsers() {
    const response = await http.get(endpoints.auth.lockedUsers)
    return (Array.isArray(response.data) ? response.data : []).map(normalizeLockStatusRecord)
  },

  async getUnlockedUsers() {
    const response = await http.get(endpoints.auth.unlockedUsers)
    return (Array.isArray(response.data) ? response.data : []).map(normalizeLockStatusRecord)
  }
}
