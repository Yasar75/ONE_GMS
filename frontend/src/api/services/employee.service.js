import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import { storage } from '../../utils/storage.js'
import { readCachedQuery } from '../../utils/queryCache.js'
import {
  formatDate,
  normalizeEmployee,
  sortEmployees,
  toEmployeeApiPayload
} from '../../utils/employee.js'
import { authService } from './auth.service.js'

const EMPLOYEE_DIRECTORY_CACHE_KEY = 'one_gms.employee.directory.cache'

function normalizeEmployeeDocumentRecord(document) {
  return {
    uid: document?.uid || '',
    employeeUid: document?.employee_uid || document?.employeeUid || '',
    documentType: document?.document_type || document?.documentType || '',
    name: document?.name || '',
    fileUrl: document?.file_url || document?.fileUrl || '',
    uploadDate: document?.upload_date || document?.uploadDate || '',
    fileFormat: document?.file_format || document?.fileFormat || '',
    fileSize: Number(document?.file_size || document?.fileSize || 0) || 0,
    createdAt: document?.created_at || document?.createdAt || null,
    updatedAt: document?.updated_at || document?.updatedAt || null,
    uploadDateLabel: formatDate(document?.upload_date || document?.uploadDate)
  }
}

function normalizeEmployeeSkillRecord(skill) {
  return {
    uid: skill?.uid || '',
    userUid: skill?.user_uid || skill?.userUid || '',
    employeeUid: skill?.employee_uid || skill?.employeeUid || '',
    skill: String(skill?.skill || '').trim(),
    createdAt: skill?.created_at || skill?.createdAt || null,
    updatedAt: skill?.updated_at || skill?.updatedAt || null
  }
}

function normalizeEmployeeFamilyDetailRecord(detail) {
  return {
    uid: detail?.uid || '',
    userUid: detail?.user_uid || detail?.userUid || '',
    employeeUid: detail?.employee_uid || detail?.employeeUid || '',
    relation: String(detail?.relation || '').trim(),
    fullName: String(detail?.full_name || detail?.fullName || '').trim(),
    dateOfBirth: detail?.date_of_birth || detail?.dateOfBirth || '',
    phone: detail?.phone || '',
    occupation: detail?.occupation || '',
    isDependent: Boolean(detail?.is_dependent ?? detail?.isDependent),
    address: detail?.address || '',
    remarks: detail?.remarks || '',
    createdAt: detail?.created_at || detail?.createdAt || null,
    updatedAt: detail?.updated_at || detail?.updatedAt || null
  }
}

function deriveFirstLoginDeadline(record) {
  const firstLoginAt = record?.first_login_at || record?.firstLoginAt
  const createdAt = record?.created_at || record?.createdAt
  if (firstLoginAt || !createdAt) return null

  const createdDate = new Date(createdAt)
  if (Number.isNaN(createdDate.getTime())) return null

  return new Date(createdDate.getTime() + (48 * 60 * 60 * 1000)).toISOString()
}

function normalizeAccountStatus(record) {
  if (!record) return null

  return {
    uid: record?.uid || '',
    email: record?.email || '',
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

function deriveProfileCompletedAt(skills = [], documents = []) {
  if (!skills.length || !documents.length) return null

  const timestamps = [
    ...skills.map((entry) => entry.updatedAt || entry.createdAt || null),
    ...documents.map((entry) => entry.updatedAt || entry.createdAt || entry.uploadDate || null)
  ]
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))

  if (!timestamps.length) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

function normalizeSkillsInput(values = []) {
  const seen = new Set()
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => {
      const key = value.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function hasMeaningfulValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return true
}

function buildEmployeeCacheKey(record = {}) {
  const uid = String(record.uid || '').trim()
  if (uid) return `uid:${uid}`

  const userUid = String(record.userUid || '').trim()
  if (userUid) return `user:${userUid}`

  const email = String(record.email || '').trim().toLowerCase()
  if (email) return `email:${email}`

  const employeeCode = String(record.employeeCode || record.id || '').trim()
  if (employeeCode) return `code:${employeeCode}`

  return ''
}

function mergeEmployeeRecord(existing = null, candidate = null) {
  if (!candidate) return existing
  if (!existing) return candidate

  const nextRecord = { ...existing }
  Object.entries(candidate).forEach(([key, value]) => {
    if (hasMeaningfulValue(value)) {
      nextRecord[key] = value
    }
  })

  return nextRecord
}

function mergeEmployeeCollections(...collections) {
  const recordsByKey = new Map()

  collections.forEach((entries) => {
    ;(Array.isArray(entries) ? entries : []).forEach((entry) => {
      const normalizedRecord = normalizeEmployee(entry)
      if (!normalizedRecord) return

      const recordKey = buildEmployeeCacheKey(normalizedRecord)
      if (!recordKey) return

      recordsByKey.set(recordKey, mergeEmployeeRecord(recordsByKey.get(recordKey), normalizedRecord))
    })
  })

  return sortEmployees(Array.from(recordsByKey.values()).filter(Boolean))
}

function buildProfileBundle({ employee = null, profileDetails = null, skills = [], documents = [], familyDetails = [], account = null }) {
  const normalizedSkills = skills.map((entry) => normalizeEmployeeSkillRecord(entry)).filter((entry) => entry.skill)
  const normalizedDocuments = documents.map((entry) => normalizeEmployeeDocumentRecord(entry)).filter((entry) => entry.uid)
  const normalizedFamilyDetails = familyDetails.map((entry) => normalizeEmployeeFamilyDetailRecord(entry)).filter((entry) => entry.uid)
  const normalizedStatus = String(employee?.status || '').trim().toLowerCase()
  const isStatusLocked = Boolean(normalizedStatus) && normalizedStatus !== 'active'
  const isBackendLocked = Boolean(account?.isLocked)

  return {
    employee,
    nickname: profileDetails?.nickname || profileDetails?.nick_name || '',
    profileImageUrl: profileDetails?.profile_image_url || profileDetails?.profile_image || '',
    skills: normalizedSkills,
    documents: normalizedDocuments,
    familyDetails: normalizedFamilyDetails,
    profileCompletedAt: deriveProfileCompletedAt(normalizedSkills, normalizedDocuments),
    firstLoginAt: account?.firstLoginAt || null,
    firstLoginDeadlineAt: account?.firstLoginDeadlineAt || null,
    isLocked: isBackendLocked || isStatusLocked,
    isBackendLocked,
    isStatusLocked,
    lockedAt: account?.lockedAt || null,
    lockedReason: account?.lockedReason || '',
    unlockedAt: account?.unlockedAt || null,
    canEditProfilePicture: profileDetails?.can_edit_profile_picture
      ?? profileDetails?.can_edit_profile_photo
      ?? profileDetails?.can_upload_profile_image
      ?? profileDetails?.can_upload_profile_photo
      ?? null,
    mustChangePassword: false
  }
}

function readCachedEmployeeDirectoryRecords() {
  const customCache = storage.get(EMPLOYEE_DIRECTORY_CACHE_KEY, [])
  const directoryCache = readCachedQuery(['employees', 'directory'], [])
  const lookupCache = readCachedQuery(['employees', 'lookup-directory'], [])

  return mergeEmployeeCollections(directoryCache, lookupCache, customCache)
}

function writeCachedEmployeeDirectoryRecords(records = []) {
  storage.set(EMPLOYEE_DIRECTORY_CACHE_KEY, sortEmployees((Array.isArray(records) ? records : [])
    .map((entry) => normalizeEmployee(entry))
    .filter(Boolean)))
}

function upsertCachedEmployeeRecord(record) {
  const normalizedRecord = normalizeEmployee(record)
  if (!normalizedRecord) return null

  const currentRecords = readCachedEmployeeDirectoryRecords()
  const nextRecords = currentRecords.filter((entry) => String(entry.uid || '') !== String(normalizedRecord.uid || ''))
  nextRecords.push(normalizedRecord)
  writeCachedEmployeeDirectoryRecords(nextRecords)
  return normalizedRecord
}

function removeCachedEmployeeRecord(employeeUid) {
  const nextRecords = readCachedEmployeeDirectoryRecords()
    .filter((entry) => String(entry.uid || '') !== String(employeeUid || ''))
  writeCachedEmployeeDirectoryRecords(nextRecords)
}

function findEmployeeForUser(records = [], rawUser = {}) {
  const currentUserUid = String(rawUser.uid || '').trim()
  const currentEmail = String(rawUser.email || '').trim().toLowerCase()

  return (Array.isArray(records) ? records : []).find((entry) => (
    String(entry.userUid || '').trim() === currentUserUid
      || String(entry.email || '').trim().toLowerCase() === currentEmail
  )) || null
}

function buildFallbackEmployeeFromUser(rawUser = {}) {
  const firstName = rawUser?.first_name || rawUser?.firstName || rawUser?.username || ''
  const lastName = rawUser?.last_name || rawUser?.lastName || ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  if (!firstName && !lastName && !rawUser?.email) return null

  return {
    uid: '',
    userUid: rawUser?.uid || '',
    id: '',
    employeeCode: '',
    fullName,
    firstName,
    lastName,
    position: '',
    department: '',
    email: rawUser?.email || '',
    phone: '',
    joinDate: '',
    status: '',
    attendanceStatus: '',
    dateOfBirth: '',
    address: '',
    gender: '',
    caste: '',
    createdAt: rawUser?.created_at || rawUser?.createdAt || null,
    updatedAt: rawUser?.updated_at || rawUser?.updatedAt || null,
    workLocation: '',
    emergencyContact: '',
    bloodGroup: '',
    employeeType: '',
    managerEmployeeUid: '',
    hrEmployeeUid: '',
    teamLeadEmployeeUid: '',
    coordinatorEmployeeUid: '',
    roleType: rawUser?.role_id || rawUser?.roleId || null,
    roleName: rawUser?.role_name || rawUser?.roleName || ''
  }
}

async function getRawCurrentUser() {
  const response = await http.get(endpoints.auth.me)
  return response.data?.user || {}
}

async function getEmployeeDirectoryRecords({ allowCacheFallback = false } = {}) {
  try {
    const response = await http.get(endpoints.employee.list)
    const employeeRecords = sortEmployees((Array.isArray(response.data) ? response.data : []).map(normalizeEmployee).filter(Boolean))
    writeCachedEmployeeDirectoryRecords(employeeRecords)
    return employeeRecords
  } catch (error) {
    if (!allowCacheFallback) throw error

    const cachedRecords = readCachedEmployeeDirectoryRecords()
    if (cachedRecords.length) return cachedRecords

    throw error
  }
}

async function getEmployeeProfileDetails(employeeUid) {
  if (!employeeUid) return {}
  const response = await http.get(endpoints.employee.profile.byEmployee(employeeUid))
  return response.data || {}
}

export const employeeService = {
  async getLookupDirectory() {
    return getEmployeeDirectoryRecords()
  },

  async getDirectory() {
    return getEmployeeDirectoryRecords()
  },

  async createEmployee(payload) {
    const response = await http.post(endpoints.employee.create, toEmployeeApiPayload(payload))
    return upsertCachedEmployeeRecord(response.data)
  },

  async updateEmployee(employeeUid, payload) {
    const response = await http.put(endpoints.employee.detail(employeeUid), toEmployeeApiPayload(payload))
    return upsertCachedEmployeeRecord(response.data)
  },

  async deleteEmployee(employeeUid) {
    await http.delete(endpoints.employee.detail(employeeUid))
    removeCachedEmployeeRecord(employeeUid)
    return employeeUid
  },

  async listEmployeeSkills(employeeUid = null) {
    const response = await http.get(endpoints.employeeSkill.list)
    const items = Array.isArray(response.data) ? response.data : []
    const normalizedItems = items.map((entry) => normalizeEmployeeSkillRecord(entry)).filter((entry) => entry.uid)
    return employeeUid
      ? normalizedItems.filter((entry) => String(entry.employeeUid) === String(employeeUid))
      : normalizedItems
  },

  async syncEmployeeSkills(employeeUid, nextSkills = [], currentSkills = []) {
    const desiredSkills = normalizeSkillsInput(nextSkills)
    const existingSkills = (Array.isArray(currentSkills) ? currentSkills : []).map((entry) => normalizeEmployeeSkillRecord(entry))

    const desiredByKey = new Map(desiredSkills.map((skill) => [skill.toLowerCase(), skill]))
    const existingByKey = new Map(existingSkills.map((entry) => [String(entry.skill || '').toLowerCase(), entry]))

    const skillsToDelete = existingSkills.filter((entry) => entry.uid && !desiredByKey.has(String(entry.skill || '').toLowerCase()))
    const skillsToCreate = desiredSkills.filter((skill) => !existingByKey.has(skill.toLowerCase()))

    for (const entry of skillsToDelete) {
      await http.delete(endpoints.employeeSkill.detail(entry.uid))
    }

    for (const skill of skillsToCreate) {
      await http.post(endpoints.employeeSkill.create, {
        employee_uid: employeeUid,
        skill
      })
    }

    return employeeService.listEmployeeSkills(employeeUid)
  },

  async updateEmployeeNickname(employeeUid, nickname) {
    const response = await http.patch(endpoints.employee.profile.nickname(employeeUid), {
      nick_name: String(nickname || '').trim() || null
    })
    return response.data || {}
  },

  async uploadEmployeeProfilePhoto(employeeUid, file) {
    const formData = new FormData()
    formData.append('file', file)
    await http.post(endpoints.employee.profile.photo(employeeUid), formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    return employeeService.getEmployeeProfile(employeeUid)
  },

  async uploadEmployeeDocument({ employeeUid, documentType, name, file }) {
    const formData = new FormData()
    formData.append('employee_uid', employeeUid)
    formData.append('document_type', documentType)
    formData.append('name', name)
    formData.append('file', file)

    await http.post(endpoints.employeeDocuments.upload, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

    return employeeService.getEmployeeProfile(employeeUid)
  },

  async listEmployeeDocuments(employeeUid) {
    const response = await http.get(endpoints.employeeDocuments.byEmployee(employeeUid))
    const items = Array.isArray(response.data?.items) ? response.data.items : []
    return items.map((item) => normalizeEmployeeDocumentRecord(item))
  },

  async listEmployeeFamilyDetails(employeeUid = null) {
    const response = await http.get(endpoints.employeeFamily.list)
    const items = Array.isArray(response.data?.items)
      ? response.data.items
      : (Array.isArray(response.data) ? response.data : [])
    const normalizedItems = items.map((item) => normalizeEmployeeFamilyDetailRecord(item)).filter((item) => item.uid)
    return employeeUid
      ? normalizedItems.filter((item) => String(item.employeeUid) === String(employeeUid))
      : normalizedItems
  },

  async createEmployeeFamilyDetail(payload) {
    const response = await http.post(endpoints.employeeFamily.create, {
      employee_uid: payload.employeeUid,
      relation: payload.relation,
      full_name: payload.fullName,
      date_of_birth: payload.dateOfBirth || null,
      phone: payload.phone || null,
      occupation: payload.occupation || null,
      is_dependent: Boolean(payload.isDependent),
      address: payload.address || null,
      remarks: payload.remarks || null
    })
    return normalizeEmployeeFamilyDetailRecord(response.data)
  },

  async deleteEmployeeDocument(documentUid) {
    await http.delete(endpoints.employeeDocuments.detail(documentUid))
    return documentUid
  },

  async getMyProfile() {
    const rawUser = await getRawCurrentUser()
    const account = normalizeAccountStatus(rawUser)
    let employee = null

    try {
      const employees = await getEmployeeDirectoryRecords({ allowCacheFallback: true })
      employee = findEmployeeForUser(employees, rawUser)
    } catch (error) {
      const fallbackDirectory = readCachedEmployeeDirectoryRecords()
      employee = findEmployeeForUser(fallbackDirectory, rawUser)

      if (!employee && ![401, 403, 404].includes(Number(error?.response?.status || 0))) {
        throw error
      }
    }

    if (!employee) {
      return buildProfileBundle({
        employee: buildFallbackEmployeeFromUser(rawUser),
        profileDetails: null,
        skills: [],
        documents: [],
        familyDetails: [],
        account
      })
    }

    const [profileResult, skillsResult, documentsResult, familyDetailsResult] = await Promise.allSettled([
      getEmployeeProfileDetails(employee.uid),
      employeeService.listEmployeeSkills(employee.uid),
      employeeService.listEmployeeDocuments(employee.uid),
      employeeService.listEmployeeFamilyDetails(employee.uid)
    ])

    return buildProfileBundle({
      employee,
      profileDetails: profileResult.status === 'fulfilled' ? profileResult.value : null,
      skills: skillsResult.status === 'fulfilled' ? skillsResult.value : [],
      documents: documentsResult.status === 'fulfilled' ? documentsResult.value : [],
      familyDetails: familyDetailsResult.status === 'fulfilled' ? familyDetailsResult.value : [],
      account
    })
  },

  async getEmployeeProfile(employeeUid) {
    const [employeeResponse, profileResult, skillsResult, documentsResult, familyDetailsResult] = await Promise.all([
      http.get(endpoints.employee.detail(employeeUid)),
      getEmployeeProfileDetails(employeeUid).catch(() => null),
      employeeService.listEmployeeSkills(employeeUid).catch(() => []),
      employeeService.listEmployeeDocuments(employeeUid).catch(() => []),
      employeeService.listEmployeeFamilyDetails(employeeUid).catch(() => [])
    ])

    const employee = upsertCachedEmployeeRecord(employeeResponse.data)

    return buildProfileBundle({
      employee,
      profileDetails: profileResult,
      skills: skillsResult,
      documents: documentsResult,
      familyDetails: familyDetailsResult,
      account: null
    })
  },

  async getProfileRequests() {
    const [employees, lockedUsers, unlockedUsers] = await Promise.all([
      employeeService.getDirectory(),
      authService.getLockedUsers(),
      authService.getUnlockedUsers()
    ])

    const users = [...lockedUsers, ...unlockedUsers]
    const employeeByUserUid = new Map()
    const employeeByEmail = new Map()

    employees.forEach((employee) => {
      const userUidKey = String(employee.userUid || '').trim()
      const emailKey = String(employee.email || '').trim().toLowerCase()
      if (userUidKey) employeeByUserUid.set(userUidKey, employee)
      if (emailKey) employeeByEmail.set(emailKey, employee)
    })

    return users.map((account) => {
      const accountEmail = String(account.email || '').trim().toLowerCase()
      const employee = employeeByUserUid.get(String(account.uid || '').trim())
        || employeeByEmail.get(accountEmail)
        || null
      const employeeUid = String(employee?.uid || '').trim()
      const normalizedStatus = String(employee?.status || '').trim().toLowerCase()
      const isStatusLocked = Boolean(normalizedStatus) && normalizedStatus !== 'active'

      return {
        rowKey: String(account.uid || account.email || employeeUid || 'unknown-user'),
        employeeUid,
        userUid: account.uid || employee?.userUid || '',
        username: account.username || '',
        employeeCode: employee?.employeeCode || '',
        fullName: employee?.fullName || [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || account.username || account.email || '—',
        email: employee?.email || account.email || '',
        status: employee?.status || '—',
        profileCompletedAt: null,
        mustChangePassword: false,
        isVerified: Boolean(account.isVerified),
        isLocked: Boolean(account.isLocked),
        isBackendLocked: Boolean(account.isLocked),
        isStatusLocked,
        isAccessBlocked: Boolean(account.isLocked),
        lockedAt: account.lockedAt || null,
        lockedReason: account.lockedReason || '',
        unlockedAt: account.unlockedAt || null,
        firstLoginAt: account.firstLoginAt || null,
        firstLoginDeadlineAt: account.firstLoginDeadlineAt || null,
        skillCount: 0,
        documentCount: 0,
        accountState: account.isLocked ? 'Locked' : 'Unlocked'
      }
    }).sort((left, right) => {
      if (left.isBackendLocked !== right.isBackendLocked) return left.isBackendLocked ? -1 : 1
      const leftPending = !left.firstLoginAt
      const rightPending = !right.firstLoginAt
      if (leftPending !== rightPending) return leftPending ? -1 : 1
      return String(left.fullName || left.email || left.employeeCode).localeCompare(String(right.fullName || right.email || right.employeeCode))
    })
  }
}
