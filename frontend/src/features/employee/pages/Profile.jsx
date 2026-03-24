import React, { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { DownloadIcon, EyeIcon, EyeOffIcon } from '../../../components/common/AppIcons.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { employeeService } from '../../../api/services/employee.service.js'
import { authService } from '../../../api/services/auth.service.js'
import { useEmployeeMetadataQuery, useRoleDirectoryQuery } from '../../../hooks/employees/useEmployeeMetadataQuery.js'
import { storage } from '../../../utils/storage.js'
import { AUTH_STORAGE_KEYS, DEFAULT_EMPLOYEE_PASSWORD } from '../../../utils/auth.js'
import { ROLES } from '../../../utils/role.js'
import {
  EMPLOYEE_BLOOD_GROUP_OPTIONS,
  EMPLOYEE_GENDER_OPTIONS,
  EMPLOYEE_STATUS_OPTIONS,
  EMPLOYEE_TYPE_OPTIONS,
  EMPLOYEE_WORK_LOCATION_OPTIONS,
  PHONE_COUNTRY_OPTIONS,
  buildPhoneValue,
  formatDate,
  formatEmployeeAge,
  getDefaultPhoneCountryOption,
  parseStoredPhoneValue
} from '../../../utils/employee.js'

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'OTHER', label: 'Other' }
]

const PROFILE_PICTURE_PERMISSION_MODULES = ['Profile', 'Profile Picture', 'Profile Image', 'Profile Photo']

function mergeSelectValues(seed = [], dynamic = []) {
  return Array.from(new Set([...seed, ...dynamic.map((entry) => String(entry || '').trim()).filter(Boolean)]))
}

function toFormOptions(values = []) {
  return values.map((value) => ({ value, label: value }))
}

function normalizeSkills(values = []) {
  const normalized = []
  const seen = new Set()

  ;(Array.isArray(values) ? values : []).forEach((value) => {
    const skill = String(value || '').trim()
    if (!skill) return
    const key = skill.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    normalized.push(skill)
  })

  return normalized
}

function parseSkillsInput(value) {
  return normalizeSkills(String(value || '').split(/[,\n]/g))
}

function skillSignature(values = []) {
  return normalizeSkills(values).map((entry) => entry.toLowerCase()).sort().join('|')
}

function toNullableString(value) {
  const trimmed = String(value || '').trim()
  return trimmed || null
}

function toInputDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function formatTenure(joinDate) {
  if (!joinDate) return '—'
  const start = new Date(joinDate)
  if (Number.isNaN(start.getTime())) return '—'

  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()

  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years <= 0 && months <= 0) return 'Less than a month'
  if (years <= 0) return `${months} mo`
  if (months <= 0) return `${years} yr`
  return `${years} yr ${months} mo`
}

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDateOfBirthBounds() {
  const today = new Date()
  const minDate = new Date(today)
  const maxDate = new Date(today)
  minDate.setFullYear(today.getFullYear() - 65)
  maxDate.setFullYear(today.getFullYear() - 21)
  return {
    min: toDateInputValue(minDate),
    max: toDateInputValue(maxDate)
  }
}

function isDateOfBirthWithinAllowedRange(dateOfBirth) {
  if (!dateOfBirth) return true
  const { min, max } = getDateOfBirthBounds()
  return dateOfBirth >= min && dateOfBirth <= max
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0)
  if (!value) return '--'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function normalizePermissionModuleKey(moduleName) {
  return String(moduleName || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizePermissionAction(action) {
  return String(action || '').trim().toLowerCase()
}

function buildPermissionLookup(permissions = {}) {
  const lookup = new Map()
  if (!permissions || typeof permissions !== 'object') return lookup
  Object.entries(permissions).forEach(([moduleName, actions]) => {
    const key = normalizePermissionModuleKey(moduleName)
    if (!key) return
    const normalizedActions = new Set((Array.isArray(actions) ? actions : []).map((action) => normalizePermissionAction(action)).filter(Boolean))
    lookup.set(key, normalizedActions)
  })
  return lookup
}

function hasModulePermission(lookup, modules = [], requiredAction = 'u') {
  if (!lookup?.size) return false
  const normalizedAction = normalizePermissionAction(requiredAction)
  return modules.some((moduleName) => {
    const actions = lookup.get(normalizePermissionModuleKey(moduleName))
    if (!actions) return false
    return actions.has(normalizedAction) || actions.has('*') || actions.has('all')
  })
}

function emptyProfileDraft() {
  const defaultPhoneCountry = getDefaultPhoneCountryOption()
  return {
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_country_code: defaultPhoneCountry.dialCode,
    phone_local: '',
    role_type: '',
    position: '',
    skills_input: '',
    department: '',
    join_date: '',
    status: '',
    birth_date: '',
    gender: '',
    caste: '',
    employee_type: '',
    work_location: '',
    blood_group: '',
    emergency_contact_country_code: defaultPhoneCountry.dialCode,
    emergency_contact_local: '',
    address: '',
    nickname: ''
  }
}

function buildDraftFromProfile(profile) {
  const employee = profile?.employee || {}
  const phone = parseStoredPhoneValue(employee.phone)
  const emergencyContact = parseStoredPhoneValue(employee.emergencyContact)

  return {
    employee_code: employee.employeeCode || '',
    first_name: employee.firstName || '',
    last_name: employee.lastName || '',
    email: employee.email || '',
    phone_country_code: phone.countryDialCode || getDefaultPhoneCountryOption().dialCode,
    phone_local: phone.localNumber || '',
    role_type: employee.roleType || '',
    position: employee.position || '',
    skills_input: normalizeSkills((profile?.skills || []).map((entry) => entry?.skill || '')).join(', '),
    department: employee.department || '',
    join_date: toInputDate(employee.joinDate),
    status: employee.status || '',
    birth_date: toInputDate(employee.dateOfBirth),
    gender: employee.gender || '',
    caste: employee.caste || '',
    employee_type: employee.employeeType || '',
    work_location: employee.workLocation || '',
    blood_group: employee.bloodGroup || '',
    emergency_contact_country_code: emergencyContact.countryDialCode || getDefaultPhoneCountryOption().dialCode,
    emergency_contact_local: emergencyContact.localNumber || '',
    address: employee.address || '',
    nickname: profile?.nickname || ''
  }
}

function buildProfilePayloadFromDraft(draft) {
  return {
    employee_code: toNullableString(draft.employee_code),
    first_name: toNullableString(draft.first_name),
    last_name: toNullableString(draft.last_name),
    email: toNullableString(draft.email),
    phone: toNullableString(buildPhoneValue(draft.phone_country_code, draft.phone_local)),
    role_type: toNullableString(draft.role_type),
    position: toNullableString(draft.position),
    skills: parseSkillsInput(draft.skills_input),
    department: toNullableString(draft.department),
    join_date: toNullableString(draft.join_date),
    status: toNullableString(draft.status),
    birth_date: toNullableString(draft.birth_date),
    gender: toNullableString(draft.gender),
    caste: toNullableString(draft.caste),
    employee_type: toNullableString(draft.employee_type),
    work_location: toNullableString(draft.work_location),
    blood_group: toNullableString(draft.blood_group),
    emergency_contact: toNullableString(buildPhoneValue(draft.emergency_contact_country_code, draft.emergency_contact_local)),
    address: toNullableString(draft.address),
    nickname: toNullableString(draft.nickname)
  }
}

function pickChangedFields(draft, profile) {
  const baseline = buildProfilePayloadFromDraft(buildDraftFromProfile(profile))
  const next = buildProfilePayloadFromDraft(draft)
  const changed = {}

  Object.entries(next).forEach(([key, value]) => {
    if (key === 'skills') {
      if (skillSignature(value) !== skillSignature(baseline.skills)) {
        changed.skills = value
      }
      return
    }

    if (String(value || '').trim() !== String(baseline[key] || '').trim()) {
      changed[key] = value
    }
  })

  return changed
}

function getDocumentDefaultName(documentType) {
  if (documentType === 'AADHAAR') return 'Aadhaar Card'
  if (documentType === 'PAN') return 'PAN Card'
  return ''
}

function hasRepeatedDigitPattern(value) {
  return /(\d)\1{2,}/.test(String(value || ''))
}

function hasSequentialDigitPattern(value) {
  const digitGroups = String(value || '').match(/\d+/g) || []

  return digitGroups.some((group) => {
    let ascendingRun = 1
    let descendingRun = 1

    for (let index = 1; index < group.length; index += 1) {
      const previous = Number(group[index - 1])
      const current = Number(group[index])

      ascendingRun = current === previous + 1 ? ascendingRun + 1 : 1
      descendingRun = current === previous - 1 ? descendingRun + 1 : 1

      if (ascendingRun >= 3 || descendingRun >= 3) {
        return true
      }
    }

    return false
  })
}

function buildPasswordValidation(password, confirmPassword) {
  const normalizedPassword = String(password || '')
  const normalizedConfirmPassword = String(confirmPassword || '')
  const checks = [
    { key: 'length', label: 'Minimum 8 characters', passed: normalizedPassword.length >= 8 },
    { key: 'uppercase', label: 'At least one uppercase letter (A-Z)', passed: /[A-Z]/.test(normalizedPassword) },
    { key: 'lowercase', label: 'At least one lowercase letter (a-z)', passed: /[a-z]/.test(normalizedPassword) },
    { key: 'number', label: 'At least one number', passed: /\d/.test(normalizedPassword) },
    { key: 'special', label: 'At least one special character', passed: /[^A-Za-z0-9]/.test(normalizedPassword) },
    { key: 'repeatDigits', label: 'No repeated digits like 111', passed: normalizedPassword ? !hasRepeatedDigitPattern(normalizedPassword) : false },
    { key: 'serialDigits', label: 'No serial digits like 123 or 321', passed: normalizedPassword ? !hasSequentialDigitPattern(normalizedPassword) : false }
  ]

  const passedCount = checks.filter((entry) => entry.passed).length
  const score = !normalizedPassword ? 0 : (passedCount <= 2 ? 1 : (passedCount <= 4 ? 2 : (passedCount <= 6 ? 3 : 4)))
  const labels = ['Not set', 'Weak', 'Fair', 'Good', 'Strong']

  return {
    checks,
    score,
    label: labels[score],
    isValid: checks.every((entry) => entry.passed),
    confirmMatches: Boolean(normalizedConfirmPassword) && normalizedPassword === normalizedConfirmPassword
  }
}

function emptyFamilyDetailDraft() {
  return {
    relation: '',
    full_name: '',
    date_of_birth: '',
    phone: '',
    occupation: '',
    is_dependent: false,
    address: '',
    remarks: ''
  }
}

function normalizeFamilyText(value) {
  const trimmed = String(value || '').trim()
  return trimmed || ''
}

function hasFamilyDetailDraftValue(draft) {
  if (!draft) return false
  return Boolean(
    normalizeFamilyText(draft.relation)
    || normalizeFamilyText(draft.full_name)
    || normalizeFamilyText(draft.date_of_birth)
    || normalizeFamilyText(draft.phone)
    || normalizeFamilyText(draft.occupation)
    || normalizeFamilyText(draft.address)
    || normalizeFamilyText(draft.remarks)
    || draft.is_dependent
  )
}

function buildFamilyDetailPayload(draft) {
  return {
    relation: normalizeFamilyText(draft.relation),
    fullName: normalizeFamilyText(draft.full_name),
    dateOfBirth: normalizeFamilyText(draft.date_of_birth),
    phone: normalizeFamilyText(draft.phone),
    occupation: normalizeFamilyText(draft.occupation),
    isDependent: Boolean(draft.is_dependent),
    address: normalizeFamilyText(draft.address),
    remarks: normalizeFamilyText(draft.remarks)
  }
}

export default function ProfilePage() {
  const { user, syncCurrentUser } = useAuth()
  const { showStatus, runWithLoader } = useModal()
  const { data: metadataEntries = [] } = useEmployeeMetadataQuery()
  const { data: roles = [] } = useRoleDirectoryQuery()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft())
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [profileUnavailable, setProfileUnavailable] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [activeSetupTarget, setActiveSetupTarget] = useState('')
  const [setupPromptDismissed, setSetupPromptDismissed] = useState(false)
  const [documentDraft, setDocumentDraft] = useState({ documentType: 'OTHER', name: '', file: null })
  const [documentFileInputKey, setDocumentFileInputKey] = useState(0)
  const [familyDetailDraft, setFamilyDetailDraft] = useState(emptyFamilyDetailDraft())
  const [passwordDraft, setPasswordDraft] = useState({ current_password: '', new_password: '', confirm_new_password: '' })
  const [passwordVisibility, setPasswordVisibility] = useState({ current_password: false, new_password: false, confirm_new_password: false })

  const metadataByCategory = useMemo(() => metadataEntries.reduce((accumulator, entry) => {
    if (!entry?.category) return accumulator
    if (!accumulator[entry.category]) accumulator[entry.category] = []
    accumulator[entry.category].push(entry)
    return accumulator
  }, {}), [metadataEntries])

  const positionOptions = useMemo(() => toFormOptions(mergeSelectValues([], [
    ...(metadataByCategory.position || []).filter((entry) => entry.isActive).map((entry) => entry.value),
    profileDraft.position
  ])), [metadataByCategory.position, profileDraft.position])
  const departmentOptions = useMemo(() => toFormOptions(mergeSelectValues([], [
    ...(metadataByCategory.department || []).filter((entry) => entry.isActive).map((entry) => entry.value),
    profileDraft.department
  ])), [metadataByCategory.department, profileDraft.department])
  const genderOptions = useMemo(() => toFormOptions(mergeSelectValues(EMPLOYEE_GENDER_OPTIONS, [
    ...(metadataByCategory.gender || []).filter((entry) => entry.isActive).map((entry) => entry.value),
    profileDraft.gender
  ])), [metadataByCategory.gender, profileDraft.gender])
  const employeeTypeOptions = useMemo(() => toFormOptions(mergeSelectValues(EMPLOYEE_TYPE_OPTIONS, [
    ...(metadataByCategory.employee_type || []).filter((entry) => entry.isActive).map((entry) => entry.value),
    profileDraft.employee_type
  ])), [metadataByCategory.employee_type, profileDraft.employee_type])
  const workLocationOptions = useMemo(() => toFormOptions(mergeSelectValues(EMPLOYEE_WORK_LOCATION_OPTIONS, [
    ...(metadataByCategory.work_location || []).filter((entry) => entry.isActive).map((entry) => entry.value),
    profileDraft.work_location
  ])), [metadataByCategory.work_location, profileDraft.work_location])
  const bloodGroupOptions = useMemo(() => toFormOptions(mergeSelectValues(EMPLOYEE_BLOOD_GROUP_OPTIONS, [
    ...(metadataByCategory.blood_group || []).filter((entry) => entry.isActive).map((entry) => entry.value),
    profileDraft.blood_group
  ])), [metadataByCategory.blood_group, profileDraft.blood_group])
  const phoneCountryOptions = useMemo(() => PHONE_COUNTRY_OPTIONS.map((option) => ({
    value: option.dialCode,
    label: option.dialCode,
    description: option.label
  })), [])
  const roleOptions = useMemo(() => roles.map((role) => ({
    value: role.uid,
    label: role.roleName,
    description: role.description || ''
  })), [roles])
  const statusOptions = useMemo(() => toFormOptions(mergeSelectValues(EMPLOYEE_STATUS_OPTIONS, [profileDraft.status])), [profileDraft.status])

  const isAdminUser = user?.role === ROLES.ADMIN
  const mustChangePassword = Boolean(user?.mustChangePassword)
  const hasLinkedEmployee = Boolean(profile?.employee?.uid)
  const hasEmployeeDetails = Boolean(profile?.employee)
  const permissionLookup = useMemo(() => buildPermissionLookup(user?.permissions), [user?.permissions])
  const hasPermissionMatrix = permissionLookup.size > 0
  const documentItems = profile?.documents || []
  const familyDetailItems = profile?.familyDetails || []
  const parsedSkillValues = useMemo(() => parseSkillsInput(profileDraft.skills_input), [profileDraft.skills_input])
  const skillCount = parsedSkillValues.length
  const hasPendingFamilyDetail = useMemo(() => hasFamilyDetailDraftValue(familyDetailDraft), [familyDetailDraft])
  const mustCompleteProfile = hasLinkedEmployee && !profile?.profileCompletedAt
  const canEditBasicDetails = isAdminUser && hasLinkedEmployee
  const hasProfilePicturePermission = isAdminUser
    || Boolean(profile?.canEditProfilePicture ?? (!hasPermissionMatrix || hasModulePermission(permissionLookup, PROFILE_PICTURE_PERMISSION_MODULES, 'u')))
  const canEditSetupFields = hasLinkedEmployee && (isAdminUser || !profile?.profileCompletedAt)
  const canEditSkills = canEditSetupFields
  const canUploadDocuments = canEditSetupFields
  const canUpdateProfileFields = canEditSetupFields
  const canManageFamilyDetails = canEditSetupFields
  const canEditProfilePhoto = hasLinkedEmployee && (isAdminUser || hasProfilePicturePermission)
  const firstLoginCompleted = Boolean(profile?.firstLoginAt || user?.firstLoginAt)
  const firstLoginDeadlineRaw = profile?.firstLoginDeadlineAt || user?.firstLoginDeadlineAt || ''
  const firstLoginDeadlineLabel = firstLoginDeadlineRaw ? formatDate(firstLoginDeadlineRaw) : ''
  const setupTarget = mustChangePassword ? 'password' : 'profile'
  const ageLabel = formatEmployeeAge(profileDraft.birth_date)
  const tenureLabel = profileDraft.join_date ? formatTenure(profileDraft.join_date) : '—'
  const dobBounds = useMemo(() => getDateOfBirthBounds(), [])
  const changedFields = useMemo(() => pickChangedFields(profileDraft, profile), [profileDraft, profile])
  const profileChangedFields = useMemo(() => {
    const nextFields = { ...changedFields }
    delete nextFields.nickname
    return nextFields
  }, [changedFields])
  const hasPendingDocumentSelection = Boolean(documentDraft.file)
  const identityHasChanges = Boolean(photoFile) || String(profileDraft.nickname || '').trim() !== String(profile?.nickname || '').trim()
  const hasEditableProfileChanges = isAdminUser
    ? Boolean(Object.keys(profileChangedFields).length || hasPendingDocumentSelection || hasPendingFamilyDetail)
    : Boolean(profileChangedFields.skills !== undefined || hasPendingDocumentSelection || hasPendingFamilyDetail)
  const employeeProfileRequirementsMet = isAdminUser || (parsedSkillValues.length > 0 && (documentItems.length > 0 || hasPendingDocumentSelection))
  const canSubmitProfileUpdate = Boolean(canUpdateProfileFields && hasEditableProfileChanges && employeeProfileRequirementsMet)
  const passwordValidation = useMemo(() => buildPasswordValidation(passwordDraft.new_password, passwordDraft.confirm_new_password), [passwordDraft.new_password, passwordDraft.confirm_new_password])
  const avatarUrl = useMemo(() => photoPreviewUrl || profile?.profileImageUrl || user?.avatarUrl || '', [photoPreviewUrl, profile?.profileImageUrl, user?.avatarUrl])
  const profileStatusTone = isAdminUser || !profile?.profileCompletedAt ? 'editable' : 'locked'
  const profileStatusLabel = isAdminUser
    ? 'Admin access'
    : (profile?.profileCompletedAt ? 'Setup completed' : 'Setup in progress')
  const firstLoginSetupRequired = !firstLoginCompleted && Boolean(firstLoginDeadlineRaw || mustChangePassword || mustCompleteProfile)

  useEffect(() => {
    if (!firstLoginSetupRequired) setSetupPromptDismissed(false)
  }, [firstLoginSetupRequired])

  useEffect(() => {
    let isMounted = true
    async function loadProfile() {
      setLoading(true)
      try {
        const nextProfile = await employeeService.getMyProfile()
        if (!isMounted) return
        setProfile(nextProfile)
        setProfileDraft(buildDraftFromProfile(nextProfile))
        setProfileUnavailable(!nextProfile?.employee)
      } catch (error) {
        if (!isMounted) return
        if (error?.response?.status === 404) {
          setProfileUnavailable(true)
        } else {
          showStatus({
            type: 'error',
            title: 'Profile load failed',
            message: error?.response?.data?.detail || error?.message || 'Could not load profile details.'
          })
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    loadProfile()
    return () => { isMounted = false }
  }, [refreshTick, showStatus])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [photoFile])

  function updateUserFromProfile(nextProfile, overrides = {}) {
    const hasEmployeeLink = Boolean(nextProfile?.employee?.uid)
    const fallbackFirstName = nextProfile?.employee?.firstName || user?.firstName || 'User'
    const mustFinishProfile = hasEmployeeLink && !nextProfile?.profileCompletedAt
    const resolvedMustChangePassword = overrides.mustChangePassword ?? user?.mustChangePassword ?? false
    const resolvedMustCompleteProfile = overrides.mustCompleteProfile ?? mustFinishProfile
    const resolvedFirstLoginAt = nextProfile?.firstLoginAt
      || overrides.firstLoginAt
      || user?.firstLoginAt
      || (!resolvedMustChangePassword && !resolvedMustCompleteProfile ? new Date().toISOString() : null)
    syncCurrentUser({
      ...user,
      nickname: nextProfile?.nickname ?? user?.nickname ?? '',
      displayName: nextProfile?.nickname || fallbackFirstName,
      avatarUrl: nextProfile?.profileImageUrl || user?.avatarUrl || '',
      profileImageUrl: nextProfile?.profileImageUrl || user?.profileImageUrl || '',
      canEditProfileDetails: isAdminUser ? true : mustFinishProfile,
      canEditProfilePicture: nextProfile?.canEditProfilePicture ?? user?.canEditProfilePicture ?? null,
      mustCompleteProfile: resolvedMustCompleteProfile,
      mustChangePassword: resolvedMustChangePassword,
      profileCompletedAt: nextProfile?.profileCompletedAt ?? user?.profileCompletedAt ?? null,
      firstLoginAt: resolvedFirstLoginAt,
      firstLoginDeadlineAt: nextProfile?.firstLoginDeadlineAt ?? user?.firstLoginDeadlineAt ?? null,
      ...overrides
    })
  }

  function handleProfileFieldChange(event) {
    const { name } = event.target
    let { value } = event.target
    if (name === 'phone_local' || name === 'emergency_contact_local') value = String(value).replace(/\D/g, '').slice(0, 15)
    setProfileDraft((current) => ({ ...current, [name]: value }))
  }

  function handleFamilyDetailFieldChange(event) {
    const { name, type, checked } = event.target
    let { value } = event.target
    if (name === 'phone') value = String(value).replace(/[^\d+]/g, '').slice(0, 20)
    setFamilyDetailDraft((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  async function handleIdentitySave() {
    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!identityHasChanges) {
      showStatus({ type: 'error', title: 'No changes detected', message: 'Update nickname or choose a profile image before saving.' })
      return
    }
    if (photoFile && !canEditProfilePhoto) {
      showStatus({
        type: 'error',
        title: 'Profile photo access blocked',
        message: hasProfilePicturePermission
          ? 'Profile photo updates are currently unavailable for this account.'
          : 'Your role does not have permission to update the profile picture.'
      })
      return
    }
    try {
      const nextProfile = await runWithLoader(async () => {
        if (String(profileDraft.nickname || '').trim() !== String(profile?.nickname || '').trim()) {
          await employeeService.updateEmployeeNickname(profile.employee.uid, profileDraft.nickname)
        }
        if (photoFile) {
          await employeeService.uploadEmployeeProfilePhoto(profile.employee.uid, photoFile)
        }
        return employeeService.getMyProfile()
      }, {
        title: 'Saving identity',
        message: 'Updating nickname and profile image.',
        minVisibleMs: 450
      })
      setPhotoFile(null)
      setProfile(nextProfile)
      setProfileDraft(buildDraftFromProfile(nextProfile))
      updateUserFromProfile(nextProfile)
      showStatus({ type: 'success', title: 'Identity updated', message: 'Your profile identity has been saved.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Identity update failed', message: error?.response?.data?.detail || error?.message || 'Could not update profile identity.' })
    }
  }

  async function handleProfileUpdate() {
    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canUpdateProfileFields) {
      showStatus({
        type: 'error',
        title: 'Profile update locked',
        message: isAdminUser
          ? 'This profile does not allow those changes right now.'
          : 'Skills, documents, and family details are read-only after setup is completed.'
      })
      return
    }
    if (isAdminUser && !isDateOfBirthWithinAllowedRange(profileDraft.birth_date)) {
      showStatus({
        type: 'error',
        title: 'Invalid date of birth',
        message: 'The selected date of birth must keep the employee age between 21 and 65 years.'
      })
      return
    }
    if (isAdminUser) {
      const phone = buildPhoneValue(profileDraft.phone_country_code, profileDraft.phone_local)
      const emergencyContact = buildPhoneValue(profileDraft.emergency_contact_country_code, profileDraft.emergency_contact_local)
      if (phone && emergencyContact && phone === emergencyContact) {
        showStatus({
          type: 'error',
          title: 'Invalid emergency contact',
          message: 'Mobile number and emergency contact cannot be the same.'
        })
        return
      }
    }
    if (!isAdminUser && !parsedSkillValues.length) {
      showStatus({ type: 'error', title: 'Skills required', message: 'Add at least one skill before updating your profile.' })
      return
    }
    if (!isAdminUser && !documentItems.length && !hasPendingDocumentSelection) {
      showStatus({ type: 'error', title: 'Document required', message: 'Upload at least one document before submitting your profile.' })
      return
    }
    const normalizedFamilyPayload = buildFamilyDetailPayload(familyDetailDraft)
    if (hasPendingFamilyDetail && (!normalizedFamilyPayload.relation || !normalizedFamilyPayload.fullName)) {
      showStatus({
        type: 'error',
        title: 'Family details incomplete',
        message: 'Relation and full name are required when adding family details.'
      })
      return
    }
    const normalizedDocumentName = hasPendingDocumentSelection
      ? (String(documentDraft.name || '').trim() || getDocumentDefaultName(documentDraft.documentType))
      : ''
    if (hasPendingDocumentSelection && !normalizedDocumentName) {
      showStatus({ type: 'error', title: 'Document name required', message: 'Enter a document name for the uploaded file.' })
      return
    }
    const blockedFields = !isAdminUser
      ? Object.keys(profileChangedFields).filter((fieldName) => fieldName !== 'skills')
      : []
    if (blockedFields.length) {
      showStatus({
        type: 'error',
        title: 'Basic details locked',
        message: 'Only setup fields such as skills, documents, and family details can be updated from the employee profile.'
      })
      return
    }
    if (!hasEditableProfileChanges) {
      showStatus({ type: 'error', title: 'No changes detected', message: 'Update at least one editable field before submitting your profile.' })
      return
    }
    try {
      const nextProfile = await runWithLoader(async () => {
        if (profileChangedFields.skills !== undefined) {
          await employeeService.syncEmployeeSkills(profile.employee.uid, parsedSkillValues, profile.skills)
        }
        if (isAdminUser) {
          const { skills, ...employeePayload } = profileChangedFields
          if (Object.keys(employeePayload).length) {
            await employeeService.updateEmployee(profile.employee.uid, {
              ...profile.employee,
              employeeCode: employeePayload.employee_code ?? profile.employee.employeeCode,
              firstName: employeePayload.first_name ?? profile.employee.firstName,
              lastName: employeePayload.last_name ?? profile.employee.lastName,
              email: employeePayload.email ?? profile.employee.email,
              phone: employeePayload.phone ?? profile.employee.phone,
              roleType: employeePayload.role_type ?? profile.employee.roleType,
              position: employeePayload.position ?? profile.employee.position,
              department: employeePayload.department ?? profile.employee.department,
              joinDate: employeePayload.join_date ?? profile.employee.joinDate,
              status: employeePayload.status ?? profile.employee.status,
              dateOfBirth: employeePayload.birth_date ?? profile.employee.dateOfBirth,
              gender: employeePayload.gender ?? profile.employee.gender,
              caste: employeePayload.caste ?? profile.employee.caste,
              employeeType: employeePayload.employee_type ?? profile.employee.employeeType,
              workLocation: employeePayload.work_location ?? profile.employee.workLocation,
              bloodGroup: employeePayload.blood_group ?? profile.employee.bloodGroup,
              emergencyContact: employeePayload.emergency_contact ?? profile.employee.emergencyContact,
              address: employeePayload.address ?? profile.employee.address
            })
          }
        }
        if (hasPendingDocumentSelection) {
          await employeeService.uploadEmployeeDocument({
            employeeUid: profile.employee.uid,
            documentType: documentDraft.documentType,
            name: normalizedDocumentName,
            file: documentDraft.file
          })
        }
        if (hasPendingFamilyDetail) {
          await employeeService.createEmployeeFamilyDetail({
            employeeUid: profile.employee.uid,
            ...normalizedFamilyPayload
          })
        }
        return employeeService.getMyProfile()
      }, {
        title: 'Updating profile',
        message: 'Saving profile details, skills, documents, and family details.',
        minVisibleMs: 550
      })
      setProfile(nextProfile)
      setProfileDraft(buildDraftFromProfile(nextProfile))
      setDocumentDraft({ documentType: 'OTHER', name: '', file: null })
      setDocumentFileInputKey((current) => current + 1)
      setFamilyDetailDraft(emptyFamilyDetailDraft())
      updateUserFromProfile(nextProfile)
      showStatus({
        type: 'success',
        title: 'Profile updated',
        message: isAdminUser
          ? 'The profile information has been saved.'
          : 'Your profile has been updated successfully.'
      })
    } catch (error) {
      showStatus({ type: 'error', title: 'Profile update failed', message: error?.response?.data?.detail || error?.message || 'Profile update request failed.' })
    }
  }

  async function handlePasswordChange() {
    if (!passwordDraft.new_password || !passwordDraft.confirm_new_password) {
      showStatus({ type: 'error', title: 'Missing password', message: 'Enter new password and confirmation.' })
      return
    }
    if (!mustChangePassword && !passwordDraft.current_password) {
      showStatus({ type: 'error', title: 'Current password required', message: 'Enter your current password before changing it.' })
      return
    }
    if (!passwordValidation.isValid) {
      const failedRule = passwordValidation.checks.find((entry) => !entry.passed)
      showStatus({ type: 'error', title: 'Weak password', message: failedRule?.label || 'Enter a stronger password that satisfies all requirements.' })
      return
    }
    if (!passwordValidation.confirmMatches) {
      showStatus({ type: 'error', title: 'Password mismatch', message: 'New password and confirm password must match exactly.' })
      return
    }
    if (mustChangePassword && passwordDraft.new_password === DEFAULT_EMPLOYEE_PASSWORD) {
      showStatus({ type: 'error', title: 'Choose a different password', message: 'The default password cannot be reused.' })
      return
    }
    if (!mustChangePassword && passwordDraft.current_password === passwordDraft.new_password) {
      showStatus({ type: 'error', title: 'Choose a different password', message: 'New password must be different from your current password.' })
      return
    }
    const currentPassword = mustChangePassword ? DEFAULT_EMPLOYEE_PASSWORD : passwordDraft.current_password
    const payload = {
      current_password: currentPassword,
      new_password: passwordDraft.new_password,
      confirm_new_password: passwordDraft.confirm_new_password
    }
    try {
      await runWithLoader(() => authService.changePassword(payload), {
        title: 'Changing password',
        message: 'Securing your account with the updated password.',
        minVisibleMs: 600
      })
      storage.remove(AUTH_STORAGE_KEYS.passwordSetupEmail)
      setPasswordDraft({ current_password: '', new_password: '', confirm_new_password: '' })
      updateUserFromProfile(profile || {}, { mustChangePassword: false })
      showStatus({ type: 'success', title: 'Password changed', message: 'Your password has been updated successfully.' })
      setRefreshTick((current) => current + 1)
    } catch (error) {
      showStatus({ type: 'error', title: 'Password change failed', message: error?.response?.data?.detail || error?.message || 'Could not update your password.' })
    }
  }

  function togglePasswordVisibility(field) {
    setPasswordVisibility((current) => ({ ...current, [field]: !current[field] }))
  }

  function handleCompleteNow() {
    const targetId = setupTarget === 'password' ? 'profile-password-section' : 'profile-details-section'
    const targetNode = document.getElementById(targetId)
    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setActiveSetupTarget(setupTarget)
    setSetupPromptDismissed(true)
    window.setTimeout(() => setActiveSetupTarget(''), 1400)
  }

  if (loading) {
    return (
      <div className="d-flex flex-column gap-3">
        <PageHeader title="My Profile" tagline="Manage profile identity, onboarding, and account security." />
        <div className="card border-0 shadow-sm glass profile-modern-loader">
          <div className="card-body py-5 text-center">
            <div className="global-loader-spinner mb-3"><span /><span /></div>
            <div className="fw-semibold">Loading profile...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3 employee-module-page profile-page profile-modern-page">
      <PageHeader title="My Profile" tagline="Manage profile identity, onboarding, and account security." />

      <div className="profile-hero card border-0 shadow-sm">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="profile-hero-eyebrow">{isAdminUser ? 'Admin Workspace' : 'Employee Workspace'}</div>
            <div className="profile-hero-title">{profileDraft.nickname || profileDraft.first_name || user?.firstName || 'User'}</div>
            <div className="text-muted small">
              {isAdminUser
                ? 'Admin accounts can manage basic details, skills, documents, and password from one workspace.'
                : 'Basic details are loaded from the employee directory. Skills, documents, and family details stay editable until setup is completed.'}
            </div>
            {firstLoginSetupRequired && firstLoginDeadlineLabel ? (
              <div className="text-muted small mt-1">Complete first-login setup by {firstLoginDeadlineLabel} to avoid automatic account disable.</div>
            ) : null}
          </div>
          <div className="d-flex flex-column align-items-lg-end gap-2">
            <span className={`profile-pill ${profileStatusTone}`}>{profileStatusLabel}</span>
            {!isAdminUser ? <span className="text-muted small">Skills: {skillCount} • Documents: {documentItems.length} • Family records: {familyDetailItems.length}</span> : null}
            {profile?.profileCompletedAt ? <span className="text-muted small">Completed on {formatDate(profile.profileCompletedAt)}</span> : null}
          </div>
        </div>
      </div>

      <div className="row g-3 align-items-start">
        <div className="col-12 col-xl-4">
          <div className="d-flex flex-column gap-3 profile-sidebar-column">
            <div className="card border-0 shadow-sm profile-panel profile-identity-panel">
              <div className="card-body profile-identity-body">
                <div className="profile-section-heading text-center">Profile Identity</div>
                <div className="profile-photo-preview profile-photo-modern profile-photo-modern-large profile-photo-centered">
                  {avatarUrl ? <img src={avatarUrl} alt="Profile avatar" /> : <span>{String(user?.displayName || user?.firstName || 'U').charAt(0).toUpperCase()}</span>}
                </div>
                <div className="profile-identity-fields d-flex flex-column gap-3">
                  <div>
                    <label className="form-label">Nickname</label>
                    <input className="form-control" name="nickname" value={profileDraft.nickname} onChange={handleProfileFieldChange} maxLength="120" placeholder="Set your nickname" />
                    <div className="form-text">Header will display nickname. Fallback is first name.</div>
                  </div>
                  <div>
                    <label className="form-label">Profile Image</label>
                    <input className="form-control" type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} disabled={!canEditProfilePhoto} />
                    {!hasProfilePicturePermission ? <div className="form-text">Role access for profile picture is disabled. Ask admin to grant the Administrative / Profile permission.</div> : null}
                  </div>
                  <button type="button" className="btn btn-primary profile-action-btn" onClick={handleIdentitySave} disabled={!hasLinkedEmployee || !identityHasChanges || (Boolean(photoFile) && !canEditProfilePhoto)}>
                    Save Identity
                  </button>
                </div>
              </div>
            </div>

            <div id="profile-password-section" className={`card border-0 shadow-sm profile-panel${activeSetupTarget === 'password' ? ' setup-target-active' : ''}`}>
              <div className="card-body d-flex flex-column gap-3">
                <div>
                  <div className="profile-section-heading">Change Password</div>
                  <div className="text-muted small">{mustChangePassword ? 'Default password detected. Set a new password to continue. The current password will be applied automatically.' : 'Enter your old password and set a stronger new one.'}</div>
                </div>
                {!mustChangePassword ? (
                  <div>
                    <label className="form-label">Current Password</label>
                    <div className="input-group">
                      <input className="form-control" type={passwordVisibility.current_password ? 'text' : 'password'} value={passwordDraft.current_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, current_password: event.target.value }))} />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('current_password')}>{passwordVisibility.current_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <label className="form-label">New Password</label>
                  <div className="input-group">
                    <input className="form-control" type={passwordVisibility.new_password ? 'text' : 'password'} value={passwordDraft.new_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, new_password: event.target.value }))} />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('new_password')}>{passwordVisibility.new_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                  </div>
                </div>
                <div className="password-strength-shell">
                  <div className="password-strength-header">
                    <span>Password Strength</span>
                    <strong>{passwordValidation.label}</strong>
                  </div>
                  <div className={`password-strength-bar score-${passwordValidation.score}`.trim()}>
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="password-checklist">
                    {passwordValidation.checks.map((entry) => (
                      <div key={entry.key} className={`password-check-item ${entry.passed ? 'is-met' : 'is-unmet'}`.trim()}>
                        {entry.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="form-label">Confirm New Password</label>
                  <div className="input-group">
                    <input className="form-control" type={passwordVisibility.confirm_new_password ? 'text' : 'password'} value={passwordDraft.confirm_new_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, confirm_new_password: event.target.value }))} />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('confirm_new_password')}>{passwordVisibility.confirm_new_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                  </div>
                </div>
                <div className={`password-match-indicator ${!passwordDraft.confirm_new_password ? 'is-pending' : (passwordValidation.confirmMatches ? 'is-match' : 'is-mismatch')}`.trim()}>
                  {!passwordDraft.confirm_new_password
                    ? 'Confirm the new password to verify the match.'
                    : (passwordValidation.confirmMatches ? 'New password and confirm password match.' : 'New password and confirm password do not match.')}
                </div>
                <button
                  type="button"
                  className="btn btn-primary profile-action-btn"
                  onClick={handlePasswordChange}
                  disabled={!passwordDraft.new_password || !passwordDraft.confirm_new_password || (!mustChangePassword && !passwordDraft.current_password)}
                >
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div id="profile-details-section" className={`card border-0 shadow-sm profile-panel h-100${activeSetupTarget === 'profile' ? ' setup-target-active' : ''}`}>
            <div className="card-body d-flex flex-column gap-4">
              <div className="profile-form-section">
                <div>
                  <div className="profile-section-heading">Basic Details</div>
                  <div className="text-muted small">Structure matches employee entries, including dropdown masters and phone formatting.</div>
                </div>
                {!hasEmployeeDetails || profileUnavailable ? (
                  <div className="text-muted small">No employee profile is linked with this account yet. You can still update nickname, photo, and password.</div>
                ) : (
                  <div className="row g-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label">Employee Code</label>
                      <input className="form-control" name="employee_code" value={profileDraft.employee_code} onChange={handleProfileFieldChange} disabled maxLength="20" />
                      <div className="form-text">Employee code is locked after creation and cannot be modified.</div>
                    </div>
                    <div className="col-12 col-md-6"><label className="form-label">Email</label><input className="form-control" type="email" name="email" value={profileDraft.email} onChange={handleProfileFieldChange} disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">First Name</label><input className="form-control" name="first_name" value={profileDraft.first_name} onChange={handleProfileFieldChange} disabled={!canEditBasicDetails} maxLength="120" /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Last Name</label><input className="form-control" name="last_name" value={profileDraft.last_name} onChange={handleProfileFieldChange} disabled={!canEditBasicDetails} maxLength="120" /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Role</label><AppSelect name="role_type" value={profileDraft.role_type} onChange={handleProfileFieldChange} options={roleOptions} placeholder="Select role" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Position</label><AppSelect name="position" value={profileDraft.position} onChange={handleProfileFieldChange} options={positionOptions} placeholder="Select position" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Department</label><AppSelect name="department" value={profileDraft.department} onChange={handleProfileFieldChange} options={departmentOptions} placeholder="Select department" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Mobile Number</label>
                      <div className="phone-input-shell">
                        <AppSelect name="phone_country_code" value={profileDraft.phone_country_code} onChange={handleProfileFieldChange} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" disabled={!canEditBasicDetails} />
                        <input className="form-control" name="phone_local" value={profileDraft.phone_local} onChange={handleProfileFieldChange} inputMode="numeric" placeholder="Enter mobile number" minLength="6" maxLength="15" pattern="[0-9]{6,15}" disabled={!canEditBasicDetails} />
                      </div>
                    </div>
                    <div className="col-12 col-md-6"><label className="form-label">Join Date</label><input className="form-control" type="date" name="join_date" value={profileDraft.join_date} onChange={handleProfileFieldChange} disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Status</label><AppSelect name="status" value={profileDraft.status} onChange={handleProfileFieldChange} options={statusOptions} placeholder="Select status" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Date of Birth</label>
                      <input className="form-control" type="date" name="birth_date" value={profileDraft.birth_date} onChange={handleProfileFieldChange} disabled={!canEditBasicDetails} min={dobBounds.min} max={dobBounds.max} />
                      <div className="form-text">Allowed age band: 21 to 65 years.</div>
                    </div>
                    <div className="col-12 col-md-3"><label className="form-label">Age</label><input className="form-control" disabled value={ageLabel} /></div>
                    <div className="col-12 col-md-3"><label className="form-label">Tenure in Organization</label><input className="form-control" disabled value={tenureLabel} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Gender</label><AppSelect name="gender" value={profileDraft.gender} onChange={handleProfileFieldChange} options={genderOptions} placeholder="Select gender" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Caste</label><input className="form-control" name="caste" value={profileDraft.caste} onChange={handleProfileFieldChange} maxLength="120" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Employee Type</label><AppSelect name="employee_type" value={profileDraft.employee_type} onChange={handleProfileFieldChange} options={employeeTypeOptions} placeholder="Select type" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Work Location</label><AppSelect name="work_location" value={profileDraft.work_location} onChange={handleProfileFieldChange} options={workLocationOptions} placeholder="Select work location" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Blood Group</label><AppSelect name="blood_group" value={profileDraft.blood_group} onChange={handleProfileFieldChange} options={bloodGroupOptions} placeholder="Select blood group" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Emergency Contact</label>
                      <div className="phone-input-shell">
                        <AppSelect name="emergency_contact_country_code" value={profileDraft.emergency_contact_country_code} onChange={handleProfileFieldChange} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" disabled={!canEditBasicDetails} />
                        <input className="form-control" name="emergency_contact_local" value={profileDraft.emergency_contact_local} onChange={handleProfileFieldChange} inputMode="numeric" placeholder="Enter emergency contact number" maxLength="15" pattern="[0-9]{0,15}" disabled={!canEditBasicDetails} />
                      </div>
                      <div className="form-text">Emergency contact must differ from the employee mobile number.</div>
                    </div>
                    <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="3" name="address" value={profileDraft.address} onChange={handleProfileFieldChange} disabled={!canEditBasicDetails} /></div>
                  </div>
                )}
              </div>

              <div className="profile-form-divider" />

              <div className="profile-form-section">
                <div>
                  <div className="profile-section-heading">Skills, Family Details, And Document Uploaded</div>
                  <div className="text-muted small">
                    {isAdminUser
                      ? 'Admin can update skills, add family details, upload documents, and save any basic-detail changes together.'
                      : 'Employee users can update setup fields only until onboarding is completed.'}
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Skills</label>
                    <input className="form-control" name="skills_input" value={profileDraft.skills_input} onChange={handleProfileFieldChange} placeholder="React, Python, Figma" disabled={!canEditSkills} />
                    <div className="form-text">
                      {!hasLinkedEmployee
                        ? 'Employee profile must be linked before skills can be managed.'
                        : (!canEditSkills && !isAdminUser ? 'Skills become read-only after setup is completed.' : 'Use comma-separated values and save once.')}
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="profile-form-divider" />
                  </div>
                  <div className="col-12">
                    <div className="profile-section-heading">Family Details</div>
                    <div className="text-muted small">Add one family record at a time. Relation and full name are required for each entry.</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Relation</label>
                    <input className="form-control" name="relation" value={familyDetailDraft.relation} onChange={handleFamilyDetailFieldChange} placeholder="Spouse, Father, Mother" maxLength="100" disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Full Name</label>
                    <input className="form-control" name="full_name" value={familyDetailDraft.full_name} onChange={handleFamilyDetailFieldChange} placeholder="Family member name" maxLength="150" disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Date of Birth</label>
                    <input className="form-control" type="date" name="date_of_birth" value={familyDetailDraft.date_of_birth} onChange={handleFamilyDetailFieldChange} disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Phone</label>
                    <input className="form-control" name="phone" value={familyDetailDraft.phone} onChange={handleFamilyDetailFieldChange} placeholder="+919999999999" maxLength="20" disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Occupation</label>
                    <input className="form-control" name="occupation" value={familyDetailDraft.occupation} onChange={handleFamilyDetailFieldChange} placeholder="Occupation" maxLength="120" disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12 col-md-4 d-flex align-items-end">
                    <div className="form-check mb-2">
                      <input className="form-check-input" type="checkbox" id="family-dependent" name="is_dependent" checked={familyDetailDraft.is_dependent} onChange={handleFamilyDetailFieldChange} disabled={!canManageFamilyDetails} />
                      <label className="form-check-label" htmlFor="family-dependent">Dependent family member</label>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Address</label>
                    <textarea className="form-control" rows="2" name="address" value={familyDetailDraft.address} onChange={handleFamilyDetailFieldChange} placeholder="Family member address" disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Remarks</label>
                    <textarea className="form-control" rows="2" name="remarks" value={familyDetailDraft.remarks} onChange={handleFamilyDetailFieldChange} placeholder="Optional remarks" disabled={!canManageFamilyDetails} />
                  </div>
                  <div className="col-12">
                    {familyDetailItems.length ? (
                      <div className="d-flex flex-column gap-2">
                        {familyDetailItems.map((detail) => (
                          <div key={detail.uid} className="profile-doc-item">
                            <span className="profile-doc-item-title">{[detail.relation, detail.fullName].filter(Boolean).join(': ') || 'Family detail'}</span>
                            <span className="text-muted small">
                              {[
                                detail.phone || '',
                                detail.occupation || '',
                                detail.isDependent ? 'Dependent' : '',
                                detail.dateOfBirth ? formatDate(detail.dateOfBirth) : ''
                              ].filter(Boolean).join(' • ') || 'No extra details'}
                            </span>
                            {detail.address || detail.remarks ? (
                              <span className="text-muted small">
                                {[detail.address || '', detail.remarks || ''].filter(Boolean).join(' • ')}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">No family details added yet.</div>
                    )}
                  </div>
                  <div className="col-12">
                    <div className="profile-form-divider" />
                  </div>
                  <div className="col-12">
                    <div className="profile-section-heading">Document Uploaded</div>
                    <div className="text-muted small">Upload the required profile documents after completing skills and family details.</div>
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Document Type</label>
                    <AppSelect value={documentDraft.documentType} onChange={(value) => setDocumentDraft((current) => ({ ...current, documentType: value }))} options={DOCUMENT_TYPE_OPTIONS} placeholder="Type" disabled={!canUploadDocuments} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">Document Name</label>
                    <input className="form-control" value={documentDraft.name} onChange={(event) => setDocumentDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Document name" disabled={!canUploadDocuments} />
                  </div>
                  <div className="col-12 col-md-4">
                    <label className="form-label">File</label>
                    <input key={documentFileInputKey} className="form-control" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocumentDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))} disabled={!canUploadDocuments} />
                  </div>
                </div>
                {!employeeProfileRequirementsMet && !isAdminUser ? (
                  <div className="text-muted small">Add at least one skill and upload at least one document before submitting your profile.</div>
                ) : null}
                {!canUploadDocuments && hasLinkedEmployee && !isAdminUser ? (
                  <div className="text-muted small">Skills, documents, and family details are currently read-only because setup is already completed.</div>
                ) : null}
                {documentItems.length ? (
                  <div className="d-flex flex-column gap-2">
                    {documentItems.map((document) => (
                      <a key={document.uid} href={document.fileUrl || '#'} target="_blank" rel="noreferrer" download={document.name || 'employee-document'} className="profile-doc-item profile-doc-item-modern">
                        <span className="profile-doc-item-title">{document.name || 'Document'}</span>
                        <span className="text-muted small">{document.documentType || 'OTHER'} - {document.uploadDateLabel || '--'} - {formatFileSize(document.fileSize)}</span>
                        <span className="profile-doc-item-action"><DownloadIcon /></span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted small">No documents uploaded yet.</div>
                )}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="text-muted small">
                    {isAdminUser
                      ? 'Save applies all editable changes in this card.'
                      : 'Saving finalizes your onboarding fields. Skills and documents become read-only once setup is completed.'}
                  </div>
                  <button type="button" className="btn btn-primary profile-action-btn" onClick={handleProfileUpdate} disabled={!canSubmitProfileUpdate}>
                    Update Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalFrame
        open={firstLoginSetupRequired && !setupPromptDismissed}
        title="Complete Account Setup"
        onClose={() => {}}
        dismissible={false}
        hideCloseButton
        closeOnBackdrop={false}
        footer={<button type="button" className="btn btn-primary" onClick={handleCompleteNow}>Complete Now</button>}
      >
        <div className="d-flex flex-column gap-2">
          <div className="fw-semibold">Account setup is mandatory on first login.</div>
          {mustChangePassword ? <div className="text-muted small">1. Set a new password because the default password is not allowed.</div> : null}
          {mustCompleteProfile ? <div className="text-muted small">2. Add your skills, upload required documents, and complete any family details needed. Basic details are loaded from the employee directory and stay read-only.</div> : null}
          {firstLoginDeadlineLabel
            ? <div className="text-muted small">3. Complete setup by {firstLoginDeadlineLabel} to avoid automatic account disable.</div>
            : <div className="text-muted small">3. Accounts not completed within 48 hours can be disabled automatically.</div>}
        </div>
      </ModalFrame>
    </div>
  )
}
