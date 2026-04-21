import React, { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PageContentLoader from '../../../components/common/PageContentLoader.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { BriefcaseIcon, DownloadIcon, EyeIcon, EyeOffIcon, PencilIcon, PlusIcon } from '../../../components/common/AppIcons.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useToast } from '../../../app/providers/ToastProvider.jsx'
import { employeeService } from '../../../api/services/employee.service.js'
import { authService } from '../../../api/services/auth.service.js'
import { useEmployeeMetadataQuery, useRoleDirectoryQuery } from '../../../hooks/employees/useEmployeeMetadataQuery.js'
import { usePhoneCountryOptionsQuery } from '../../../hooks/employees/usePhoneCountryOptionsQuery.js'
import { storage } from '../../../utils/storage.js'
import { AUTH_STORAGE_KEYS, DEFAULT_EMPLOYEE_PASSWORD, isProfileSetupRequired } from '../../../utils/auth.js'
import {
  buildDepartmentScopedPositionOptions,
  buildEmployeeMetadataCatalog,
  buildMetadataOptions,
  buildPhoneCountrySelectOptions,
  buildPhoneValue,
  formatPhoneLengthRule,
  formatDate,
  formatEmployeeAge,
  getDefaultPhoneCountryOption,
  getPhoneCountryLengthRule,
  isPositionMappedToDepartment,
  parseStoredPhoneValue
} from '../../../utils/employee.js'
import {
  buildPasswordValidation,
  getDateValidationMessage,
  getEmailValidationMessage,
  getInternationalPhoneValidationMessage,
  getPhoneValidationMessage,
  getRequiredFieldMessage,
  hasValidationErrors,
  markFieldsTouched
} from '../../../utils/validation.js'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  hasAnyModulePermission,
  hasModulePermission,
  isAdminBypassUser
} from '../../../utils/permissions.js'

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'OTHER', label: 'Other' }
]

const WORK_EXPERIENCE_EMPLOYMENT_TYPE_OPTIONS = [
  'Full-time',
  'Part-time',
  'Contract',
  'Freelance',
  'Internship',
  'Apprenticeship',
  'Seasonal',
  'Self-employed'
]

const NEW_DOCUMENT_UID = '__new_document__'
const NEW_FAMILY_DETAIL_UID = '__new_family_detail__'
const NEW_WORK_EXPERIENCE_UID = '__new_work_experience__'
const SETUP_WRITE_PERMISSION_ACTIONS = ['c', 'u', 'd']

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

function getTodayInputValue() {
  return toDateInputValue(new Date())
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

function emptyDocumentDraft() {
  return {
    documentType: 'OTHER',
    name: '',
    file: null
  }
}

function buildDocumentDraft(document = null) {
  if (!document) return emptyDocumentDraft()

  return {
    documentType: document.documentType || 'OTHER',
    name: document.name || '',
    file: null
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

function buildFamilyDetailDraft(detail = null) {
  if (!detail) return emptyFamilyDetailDraft()

  return {
    relation: detail.relation || '',
    full_name: detail.fullName || detail.full_name || '',
    date_of_birth: toInputDate(detail.dateOfBirth || detail.date_of_birth || ''),
    phone: detail.phone || '',
    occupation: detail.occupation || '',
    is_dependent: Boolean(detail.isDependent ?? detail.is_dependent),
    address: detail.address || '',
    remarks: detail.remarks || ''
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

function buildComparableFamilyDetail(detail) {
  if (!detail) return null
  return buildFamilyDetailPayload(buildFamilyDetailDraft(detail))
}

function areFamilyDetailsEqual(left, right) {
  if (!left || !right) return false

  return (
    left.relation === right.relation
    && left.fullName === right.fullName
    && left.dateOfBirth === right.dateOfBirth
    && left.phone === right.phone
    && left.occupation === right.occupation
    && left.isDependent === right.isDependent
    && left.address === right.address
    && left.remarks === right.remarks
  )
}

function emptyWorkExperienceDraft() {
  return {
    company_name: '',
    job_title: '',
    employment_type: '',
    location: '',
    start_date: '',
    end_date: '',
    is_current: false,
    responsibilities: '',
    last_salary: '',
    reason_for_leaving: '',
    remarks: ''
  }
}

function buildWorkExperienceDraft(experience = null) {
  if (!experience) return emptyWorkExperienceDraft()

  return {
    company_name: experience.companyName || '',
    job_title: experience.jobTitle || '',
    employment_type: experience.employmentType || '',
    location: experience.location || '',
    start_date: toInputDate(experience.startDate),
    end_date: toInputDate(experience.endDate),
    is_current: Boolean(experience.isCurrent),
    responsibilities: experience.responsibilities || '',
    last_salary: experience.lastSalary == null ? '' : String(experience.lastSalary),
    reason_for_leaving: experience.reasonForLeaving || '',
    remarks: experience.remarks || ''
  }
}

function normalizeWorkExperienceText(value) {
  const trimmed = String(value || '').trim()
  return trimmed
}

function normalizeWorkExperienceCurrency(value) {
  const trimmed = String(value || '').trim()
  return trimmed
}

function hasWorkExperienceDraftValue(draft) {
  if (!draft) return false
  return Boolean(
    normalizeWorkExperienceText(draft.company_name)
    || normalizeWorkExperienceText(draft.job_title)
    || normalizeWorkExperienceText(draft.employment_type)
    || normalizeWorkExperienceText(draft.location)
    || normalizeWorkExperienceText(draft.start_date)
    || normalizeWorkExperienceText(draft.end_date)
    || normalizeWorkExperienceText(draft.responsibilities)
    || normalizeWorkExperienceCurrency(draft.last_salary)
    || normalizeWorkExperienceText(draft.reason_for_leaving)
    || normalizeWorkExperienceText(draft.remarks)
    || draft.is_current
  )
}

function calculateExperienceMonths(startDate, endDate = '', isCurrent = false) {
  const start = startDate ? new Date(startDate) : null
  const end = isCurrent || !endDate ? new Date() : new Date(endDate)
  if (!start || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() >= start.getDate()) months += 1
  return Math.max(months, 1)
}

function formatExperienceDuration(startDate, endDate = '', isCurrent = false) {
  const totalMonths = calculateExperienceMonths(startDate, endDate, isCurrent)
  if (!totalMonths) return '—'

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (!years) return `${months} mo`
  if (!months) return `${years} yr`
  return `${years} yr ${months} mo`
}

function formatExperienceMonthYear(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric'
  }).format(date)
}

function formatExperiencePeriod(startDate, endDate = '', isCurrent = false) {
  const startLabel = formatExperienceMonthYear(startDate)
  const endLabel = isCurrent ? 'Present' : formatExperienceMonthYear(endDate)
  const durationLabel = formatExperienceDuration(startDate, endDate, isCurrent)

  return [startLabel && endLabel ? `${startLabel} - ${endLabel}` : (startLabel || endLabel), durationLabel && durationLabel !== '—' ? durationLabel : '']
    .filter(Boolean)
    .join(' · ')
}

function getCompanyInitials(companyName) {
  const tokens = String(companyName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!tokens.length) return 'CO'
  return tokens.slice(0, 2).map((token) => token.charAt(0).toUpperCase()).join('')
}

function buildWorkExperienceSignature(experience = {}) {
  return [
    String(experience.companyName || '').trim().toLowerCase(),
    String(experience.jobTitle || '').trim().toLowerCase(),
    String(experience.employmentType || '').trim().toLowerCase(),
    String(experience.location || '').trim().toLowerCase(),
    String(experience.startDate || '').trim(),
    String(experience.endDate || '').trim(),
    experience.isCurrent ? 'current' : 'past',
    String(experience.responsibilities || '').trim().toLowerCase(),
    String(experience.reasonForLeaving || '').trim().toLowerCase(),
    String(experience.remarks || '').trim().toLowerCase()
  ].join('|')
}

function dedupeWorkExperienceRecords(items = []) {
  const seenUids = new Set()
  const seenSignatures = new Set()

  return sortWorkExperienceRecords(items).filter((experience) => {
    const uid = String(experience?.uid || '').trim()
    if (uid) {
      if (seenUids.has(uid)) return false
      seenUids.add(uid)
    }

    const signature = buildWorkExperienceSignature(experience)
    if (signature && seenSignatures.has(signature)) return false
    if (signature) seenSignatures.add(signature)
    return true
  })
}

const COMPANY_LOGO_SERVICE_BASE_URL = 'https://img.logo.dev/name/'
const COMPANY_LOGO_PUBLIC_KEY = String(import.meta.env.VITE_LOGO_DEV_PUBLIC_KEY || '').trim()

function getCompanyLogoUrl(companyName) {
  const normalizedName = String(companyName || '').trim()
  if (!normalizedName) return ''

  const searchParams = new URLSearchParams({
    size: '128',
    format: 'png',
    theme: 'auto',
    fallback: 'monogram'
  })

  if (COMPANY_LOGO_PUBLIC_KEY) {
    searchParams.set('token', COMPANY_LOGO_PUBLIC_KEY)
  }

  return `${COMPANY_LOGO_SERVICE_BASE_URL}${encodeURIComponent(normalizedName)}?${searchParams.toString()}`
}

function CompanyLogoBadge({ companyName }) {
  const initials = getCompanyInitials(companyName)
  const logoUrl = getCompanyLogoUrl(companyName)

  return (
    <div className="profile-experience-company-badge">
      {logoUrl ? (
        <>
          <img
            src={logoUrl}
            alt={`${companyName || 'Company'} logo`}
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={(event) => {
              event.currentTarget.style.display = 'none'
              const fallback = event.currentTarget.nextElementSibling
              if (fallback) fallback.style.display = 'flex'
            }}
          />
          <span
            aria-hidden="true"
            style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
          >
            {initials}
          </span>
        </>
      ) : initials}
    </div>
  )
}

function calculateExperienceYears(startDate, endDate = '', isCurrent = false) {
  const totalMonths = calculateExperienceMonths(startDate, endDate, isCurrent)
  if (!totalMonths) return null
  return Number((totalMonths / 12).toFixed(2))
}

function buildWorkExperiencePayload(draft) {
  return {
    companyName: normalizeWorkExperienceText(draft.company_name),
    jobTitle: normalizeWorkExperienceText(draft.job_title),
    employmentType: normalizeWorkExperienceText(draft.employment_type),
    location: normalizeWorkExperienceText(draft.location),
    startDate: normalizeWorkExperienceText(draft.start_date),
    endDate: draft.is_current ? '' : normalizeWorkExperienceText(draft.end_date),
    isCurrent: Boolean(draft.is_current),
    responsibilities: normalizeWorkExperienceText(draft.responsibilities),
    yearsOfExperience: calculateExperienceYears(draft.start_date, draft.end_date, draft.is_current),
    lastSalary: normalizeWorkExperienceCurrency(draft.last_salary),
    reasonForLeaving: normalizeWorkExperienceText(draft.reason_for_leaving),
    remarks: normalizeWorkExperienceText(draft.remarks)
  }
}

function buildComparableWorkExperience(experience) {
  if (!experience) return null
  return buildWorkExperiencePayload(buildWorkExperienceDraft(experience))
}

function areWorkExperiencesEqual(left, right) {
  if (!left || !right) return false

  return (
    left.companyName === right.companyName
    && left.jobTitle === right.jobTitle
    && left.employmentType === right.employmentType
    && left.location === right.location
    && left.startDate === right.startDate
    && left.endDate === right.endDate
    && left.isCurrent === right.isCurrent
    && left.responsibilities === right.responsibilities
    && String(left.lastSalary || '') === String(right.lastSalary || '')
    && left.reasonForLeaving === right.reasonForLeaving
    && left.remarks === right.remarks
  )
}

const PROFILE_BASIC_REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'role_type', 'position', 'department', 'phone_local', 'join_date', 'status']

function buildProfileBasicErrors(draft, canEditBasicDetails, dobBounds) {
  if (!canEditBasicDetails) return {}

  const phone = buildPhoneValue(draft.phone_country_code, draft.phone_local)
  const emergencyContact = buildPhoneValue(draft.emergency_contact_country_code, draft.emergency_contact_local)
  const mobileRule = getPhoneCountryLengthRule(draft.phone_country_code)
  const emergencyContactRule = getPhoneCountryLengthRule(draft.emergency_contact_country_code)

  return {
    email: getEmailValidationMessage(draft.email, { required: true }),
    first_name: getRequiredFieldMessage(draft.first_name, 'First name'),
    last_name: getRequiredFieldMessage(draft.last_name, 'Last name'),
    role_type: getRequiredFieldMessage(draft.role_type, 'Role'),
    position: getRequiredFieldMessage(draft.position, 'Position'),
    department: getRequiredFieldMessage(draft.department, 'Department'),
    phone_local: getPhoneValidationMessage(draft.phone_local, {
      required: true,
      label: 'Mobile number',
      min: mobileRule.minLength,
      max: mobileRule.maxLength,
      countryLabel: mobileRule.label,
      countryDialCode: mobileRule.dialCode
    }),
    join_date: getDateValidationMessage(draft.join_date, { required: true, label: 'Join date' }),
    status: getRequiredFieldMessage(draft.status, 'Status'),
    birth_date: draft.birth_date
      ? getDateValidationMessage(draft.birth_date, { label: 'Date of birth', min: dobBounds.min, max: dobBounds.max }) || (!isDateOfBirthWithinAllowedRange(draft.birth_date) ? 'The selected date of birth must keep the employee age between 21 and 65 years.' : '')
      : '',
    emergency_contact_local: (() => {
      const phoneError = getPhoneValidationMessage(draft.emergency_contact_local, {
        label: 'Emergency contact',
        min: emergencyContactRule.minLength,
        max: emergencyContactRule.maxLength,
        countryLabel: emergencyContactRule.label,
        countryDialCode: emergencyContactRule.dialCode
      })
      if (phoneError) return phoneError
      if (phone && emergencyContact && phone === emergencyContact) {
        return 'Mobile number and emergency contact cannot be the same.'
      }
      return ''
    })()
  }
}

function buildFamilyDetailErrors(draft) {
  const hasValues = hasFamilyDetailDraftValue(draft)
  if (!hasValues) {
    return {
      relation: '',
      full_name: '',
      phone: ''
    }
  }

  return {
    relation: getRequiredFieldMessage(draft.relation, 'Relation'),
    full_name: getRequiredFieldMessage(draft.full_name, 'Full name'),
    phone: getInternationalPhoneValidationMessage(draft.phone, { label: 'Phone' })
  }
}

function buildWorkExperienceErrors(draft) {
  const hasValues = hasWorkExperienceDraftValue(draft)
  if (!hasValues) {
    return {
      company_name: '',
      job_title: '',
      start_date: '',
      end_date: ''
    }
  }

  const today = getTodayInputValue()
  const startDateError = getDateValidationMessage(draft.start_date, { required: true, label: 'Start date', max: today })
  const endDateError = draft.is_current
    ? ''
    : (draft.end_date
      ? getDateValidationMessage(draft.end_date, { label: 'End date', max: today })
      : '')

  let rangeError = ''
  if (!startDateError && !draft.is_current && draft.end_date && draft.start_date && draft.end_date < draft.start_date) {
    rangeError = 'End date cannot be earlier than the start date.'
  }

  return {
    company_name: getRequiredFieldMessage(draft.company_name, 'Company name'),
    job_title: getRequiredFieldMessage(draft.job_title, 'Job title'),
    start_date: startDateError,
    end_date: endDateError || rangeError
  }
}

function buildPasswordErrors(draft, mustChangePassword, passwordValidation) {
  const failedRule = passwordValidation.checks.find((entry) => !entry.passed)

  return {
    current_password: mustChangePassword ? '' : getRequiredFieldMessage(draft.current_password, 'Current password'),
    new_password: !draft.new_password
      ? getRequiredFieldMessage(draft.new_password, 'New password')
      : (mustChangePassword && draft.new_password === DEFAULT_EMPLOYEE_PASSWORD
        ? 'The default password cannot be reused.'
        : (!mustChangePassword && draft.current_password && draft.current_password === draft.new_password
          ? 'New password must be different from your current password.'
          : (passwordValidation.isValid ? '' : (failedRule?.label || 'Enter a stronger password.')))),
    confirm_new_password: !draft.confirm_new_password
      ? getRequiredFieldMessage(draft.confirm_new_password, 'Confirm new password')
      : (passwordValidation.confirmMatches ? '' : 'New password and confirm password must match.')
  }
}

function sortWorkExperienceRecords(items = []) {
  return [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const leftDate = new Date(left?.startDate || left?.createdAt || 0).getTime()
    const rightDate = new Date(right?.startDate || right?.createdAt || 0).getTime()
    return rightDate - leftDate
  })
}

function groupWorkExperiencesByCompany(items = []) {
  const groups = new Map()

  sortWorkExperienceRecords(items).forEach((experience) => {
    const companyName = String(experience?.companyName || 'Company').trim() || 'Company'
    const groupKey = companyName.toLowerCase()
    const existingGroup = groups.get(groupKey)

    if (existingGroup) {
      existingGroup.items.push(experience)
      return
    }

    groups.set(groupKey, {
      key: groupKey,
      companyName,
      location: String(experience?.location || '').trim(),
      employmentType: String(experience?.employmentType || '').trim(),
      items: [experience]
    })
  })

  return Array.from(groups.values())
}

export default function ProfilePage() {
  const { user, syncCurrentUser } = useAuth()
  const { showStatus, runWithLoader } = useModal()
  const { showToast } = useToast()
  const isAdminUser = isAdminBypassUser(user)
  const canLoadMetadata = hasModulePermission(user, PERMISSION_MODULES.employeeMetadata, PERMISSION_ACTIONS.read)
  const canLoadRoles = hasModulePermission(user, PERMISSION_MODULES.roles, PERMISSION_ACTIONS.read)
  const canEditDirectoryProfile = hasModulePermission(user, PERMISSION_MODULES.employeeDirectory, PERMISSION_ACTIONS.update)
  const { data: metadataEntries = [] } = useEmployeeMetadataQuery(canLoadMetadata)
  const { data: roles = [] } = useRoleDirectoryQuery(canLoadRoles)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileDraft, setProfileDraft] = useState(emptyProfileDraft())
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [profileUnavailable, setProfileUnavailable] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [activeSetupTarget, setActiveSetupTarget] = useState('')
  const [setupPromptDismissed, setSetupPromptDismissed] = useState(false)
  const [documentDraft, setDocumentDraft] = useState(emptyDocumentDraft())
  const [documentFileInputKey, setDocumentFileInputKey] = useState(0)
  const [selectedDocumentUid, setSelectedDocumentUid] = useState('')
  const [familyDetailDraft, setFamilyDetailDraft] = useState(emptyFamilyDetailDraft())
  const [selectedFamilyDetailUid, setSelectedFamilyDetailUid] = useState('')
  const [isFamilyDetailEditorOpen, setIsFamilyDetailEditorOpen] = useState(false)
  const [workExperienceDraft, setWorkExperienceDraft] = useState(emptyWorkExperienceDraft())
  const [selectedWorkExperienceUid, setSelectedWorkExperienceUid] = useState('')
  const [isWorkExperienceEditorOpen, setIsWorkExperienceEditorOpen] = useState(false)
  const [basicDetailsTouched, setBasicDetailsTouched] = useState({})
  const [familyDetailTouched, setFamilyDetailTouched] = useState({})
  const [workExperienceTouched, setWorkExperienceTouched] = useState({})
  const [passwordDraft, setPasswordDraft] = useState({ current_password: '', new_password: '', confirm_new_password: '' })
  const [passwordTouched, setPasswordTouched] = useState({})
  const [passwordVisibility, setPasswordVisibility] = useState({ current_password: false, new_password: false, confirm_new_password: false })

  const metadataCatalog = useMemo(() => buildEmployeeMetadataCatalog(metadataEntries), [metadataEntries])
  const { data: phoneCountryOptionsData = [] } = usePhoneCountryOptionsQuery(Boolean(profile))

  const positionOptions = useMemo(
    () => buildDepartmentScopedPositionOptions(metadataCatalog, profileDraft.department, profileDraft.position),
    [metadataCatalog, profileDraft.department, profileDraft.position]
  )
  const departmentOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.departmentEntries, profileDraft.department),
    [metadataCatalog.departmentEntries, profileDraft.department]
  )
  const employeeTypeOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.byCategory.employee_type || [], profileDraft.employee_type),
    [metadataCatalog.byCategory.employee_type, profileDraft.employee_type]
  )
  const workLocationOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.byCategory.work_location || [], profileDraft.work_location),
    [metadataCatalog.byCategory.work_location, profileDraft.work_location]
  )
  const bloodGroupOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.byCategory.blood_group || [], profileDraft.blood_group),
    [metadataCatalog.byCategory.blood_group, profileDraft.blood_group]
  )
  const phoneCountryOptions = useMemo(() => buildPhoneCountrySelectOptions(phoneCountryOptionsData), [phoneCountryOptionsData])
  const roleOptions = useMemo(() => {
    const options = roles.map((role) => ({
      value: role.uid,
      label: role.roleName,
      description: role.description || ''
    }))

    const currentRoleValue = String(profileDraft.role_type || profile?.employee?.roleType || user?.roleId || '').trim()
    const currentRoleLabel = String(profile?.employee?.roleName || user?.roleName || currentRoleValue).trim()

    if (currentRoleValue && !options.some((option) => String(option.value) === currentRoleValue)) {
      options.unshift({
        value: currentRoleValue,
        label: currentRoleLabel || currentRoleValue,
        description: 'Current assigned role'
      })
    }

    return options
  }, [profile?.employee?.roleName, profile?.employee?.roleType, profileDraft.role_type, roles, user?.roleId, user?.roleName])
  const statusOptions = useMemo(
    () => buildMetadataOptions(metadataCatalog.byCategory.status || [], profileDraft.status),
    [metadataCatalog.byCategory.status, profileDraft.status]
  )

  const mustChangePassword = Boolean(user?.mustChangePassword)
  const hasLinkedEmployee = Boolean(profile?.employee?.uid)
  const basicDetailsDraft = useMemo(() => ({
    ...profileDraft,
    first_name: profileDraft.first_name || user?.firstName || user?.username || '',
    last_name: profileDraft.last_name || user?.lastName || '',
    email: profileDraft.email || user?.email || '',
    role_type: profileDraft.role_type || profile?.employee?.roleType || user?.roleId || '',
    position: profileDraft.position || profile?.employee?.position || '',
    department: profileDraft.department || profile?.employee?.department || '',
    status: profileDraft.status || profile?.employee?.status || '',
    employee_type: profileDraft.employee_type || profile?.employee?.employeeType || '',
    work_location: profileDraft.work_location || profile?.employee?.workLocation || '',
    blood_group: profileDraft.blood_group || profile?.employee?.bloodGroup || '',
    gender: profileDraft.gender || profile?.employee?.gender || '',
    caste: profileDraft.caste || profile?.employee?.caste || '',
    address: profileDraft.address || profile?.employee?.address || ''
  }), [
    profile?.employee?.address,
    profile?.employee?.bloodGroup,
    profile?.employee?.department,
    profile?.employee?.employeeType,
    profile?.employee?.gender,
    profile?.employee?.position,
    profile?.employee?.roleType,
    profile?.employee?.status,
    profile?.employee?.workLocation,
    profileDraft,
    user?.email,
    user?.firstName,
    user?.lastName,
    user?.roleId,
    user?.username
  ])
  const hasVisibleBasicDetails = Boolean(
    basicDetailsDraft.employee_code
    || basicDetailsDraft.first_name
    || basicDetailsDraft.last_name
    || basicDetailsDraft.email
    || basicDetailsDraft.role_type
    || basicDetailsDraft.position
    || basicDetailsDraft.department
  )
  const hasSkillWritePermission = hasAnyModulePermission(user, PERMISSION_MODULES.mySkills, SETUP_WRITE_PERMISSION_ACTIONS)
  const hasDocumentWritePermission = hasAnyModulePermission(user, PERMISSION_MODULES.myDocuments, SETUP_WRITE_PERMISSION_ACTIONS)
  const hasFamilyDetailWritePermission = hasAnyModulePermission(user, PERMISSION_MODULES.myFamilyDetails, [PERMISSION_ACTIONS.create, PERMISSION_ACTIONS.update])
  const hasFamilyDetailDeletePermission = hasModulePermission(user, PERMISSION_MODULES.myFamilyDetails, PERMISSION_ACTIONS.delete)
  const hasWorkExperienceWritePermission = hasAnyModulePermission(user, PERMISSION_MODULES.myWorkExperience, [PERMISSION_ACTIONS.create, PERMISSION_ACTIONS.update])
  const hasWorkExperienceDeletePermission = hasModulePermission(user, PERMISSION_MODULES.myWorkExperience, PERMISSION_ACTIONS.delete)
  const documentItems = profile?.documents || []
  const selectedDocument = useMemo(() => documentItems.find((document) => String(document.uid) === String(selectedDocumentUid)) || null, [documentItems, selectedDocumentUid])
  const familyDetailItems = profile?.familyDetails || []
  const selectedFamilyDetail = useMemo(() => familyDetailItems.find((detail) => String(detail.uid) === String(selectedFamilyDetailUid)) || null, [familyDetailItems, selectedFamilyDetailUid])
  const workExperienceItems = useMemo(() => dedupeWorkExperienceRecords(profile?.workExperiences || []), [profile?.workExperiences])
  const workExperienceGroups = useMemo(() => groupWorkExperiencesByCompany(workExperienceItems), [workExperienceItems])
  const selectedWorkExperience = useMemo(() => workExperienceItems.find((experience) => String(experience.uid) === String(selectedWorkExperienceUid)) || null, [selectedWorkExperienceUid, workExperienceItems])
  const workExperienceEmploymentTypeOptions = useMemo(() => toFormOptions(mergeSelectValues(WORK_EXPERIENCE_EMPLOYMENT_TYPE_OPTIONS, [
    ...workExperienceItems.map((entry) => entry.employmentType).filter(Boolean),
    workExperienceDraft.employment_type
  ])), [workExperienceDraft.employment_type, workExperienceItems])
  const parsedSkillValues = useMemo(() => parseSkillsInput(profileDraft.skills_input), [profileDraft.skills_input])
  const skillCount = parsedSkillValues.length
  const documentDraftName = String(documentDraft.name || '').trim()
  const documentMetadataHasChanges = useMemo(() => {
    if (!selectedDocument) return false

    return (
      String(selectedDocument.documentType || 'OTHER') !== String(documentDraft.documentType || 'OTHER')
      || String(selectedDocument.name || '').trim() !== documentDraftName
    )
  }, [documentDraft.documentType, documentDraftName, selectedDocument])
  const hasPendingNewDocument = Boolean(!selectedDocument && documentDraft.file)
  const hasPendingDocumentChanges = Boolean(
    selectedDocument
      ? (documentMetadataHasChanges || documentDraft.file)
      : hasPendingNewDocument
  )
  const hasPendingFamilyDetail = useMemo(() => {
    if (!isFamilyDetailEditorOpen) return false
    if (!hasFamilyDetailDraftValue(familyDetailDraft)) return false
    if (!selectedFamilyDetail) return true
    return !areFamilyDetailsEqual(buildFamilyDetailPayload(familyDetailDraft), buildComparableFamilyDetail(selectedFamilyDetail))
  }, [familyDetailDraft, isFamilyDetailEditorOpen, selectedFamilyDetail])
  const hasPendingWorkExperience = useMemo(() => {
    if (!isWorkExperienceEditorOpen) return false
    if (!hasWorkExperienceDraftValue(workExperienceDraft)) return false
    if (!selectedWorkExperience) return true
    return !areWorkExperiencesEqual(buildWorkExperiencePayload(workExperienceDraft), buildComparableWorkExperience(selectedWorkExperience))
  }, [isWorkExperienceEditorOpen, selectedWorkExperience, workExperienceDraft])
  const mustCompleteProfile = hasLinkedEmployee && !profile?.profileCompletedAt
  const canEditBasicDetails = hasLinkedEmployee && canEditDirectoryProfile
  const canEditSkills = hasLinkedEmployee && hasSkillWritePermission
  const canManageDocuments = hasLinkedEmployee && hasDocumentWritePermission
  const canUploadDocuments = canManageDocuments
  const canManageFamilyDetails = hasLinkedEmployee && hasFamilyDetailWritePermission
  const canManageWorkExperience = hasLinkedEmployee && hasWorkExperienceWritePermission
  const canEditProfilePhoto = hasLinkedEmployee
  const firstLoginDeadlineRaw = profile?.firstLoginDeadlineAt || user?.firstLoginDeadlineAt || ''
  const firstLoginDeadlineLabel = firstLoginDeadlineRaw ? formatDate(firstLoginDeadlineRaw) : ''
  const setupTarget = mustChangePassword ? 'password' : 'profile'
  const ageLabel = formatEmployeeAge(profileDraft.birth_date)
  const tenureLabel = profileDraft.join_date ? formatTenure(profileDraft.join_date) : '—'
  const dobBounds = useMemo(() => getDateOfBirthBounds(), [])
  const mobilePhoneRule = getPhoneCountryLengthRule(basicDetailsDraft.phone_country_code)
  const emergencyContactRule = getPhoneCountryLengthRule(basicDetailsDraft.emergency_contact_country_code)
  const changedFields = useMemo(() => pickChangedFields(profileDraft, profile), [profileDraft, profile])
  const profileChangedFields = useMemo(() => {
    const nextFields = { ...changedFields }
    delete nextFields.nickname
    return nextFields
  }, [changedFields])
  const hasSkillChanges = profileChangedFields.skills !== undefined
  const basicDetailChanges = useMemo(() => {
    const { skills, ...employeeFields } = profileChangedFields
    return employeeFields
  }, [profileChangedFields])
  const hasBasicDetailChanges = Object.keys(basicDetailChanges).length > 0
  const identityHasChanges = Boolean(photoFile) || String(profileDraft.nickname || '').trim() !== String(profile?.nickname || '').trim()
  const hasSavedSkills = (profile?.skills || []).length > 0
  const hasSavedFamilyDetails = familyDetailItems.length > 0
  const hasSavedDocuments = documentItems.length > 0
  const skillSetupRequired = mustCompleteProfile && !hasSavedSkills
  const familySetupRequired = mustCompleteProfile && !hasSavedFamilyDetails
  const documentSetupRequired = mustCompleteProfile && !hasSavedDocuments
  const employeeProfileRequirementsMet = canEditDirectoryProfile || Boolean(profile?.profileCompletedAt)
  const passwordValidation = useMemo(() => buildPasswordValidation(passwordDraft.new_password, passwordDraft.confirm_new_password), [passwordDraft.new_password, passwordDraft.confirm_new_password])
  const basicDetailErrors = useMemo(() => buildProfileBasicErrors(profileDraft, canEditBasicDetails, dobBounds), [canEditBasicDetails, dobBounds, profileDraft])
  const familyDetailErrors = useMemo(() => buildFamilyDetailErrors(familyDetailDraft), [familyDetailDraft])
  const workExperienceErrors = useMemo(() => buildWorkExperienceErrors(workExperienceDraft), [workExperienceDraft])
  const passwordErrors = useMemo(() => buildPasswordErrors(passwordDraft, mustChangePassword, passwordValidation), [mustChangePassword, passwordDraft, passwordValidation])
  const avatarUrl = useMemo(() => photoPreviewUrl || profile?.profileImageUrl || user?.avatarUrl || '', [photoPreviewUrl, profile?.profileImageUrl, user?.avatarUrl])
  const workExperienceTotalMonths = useMemo(
    () => workExperienceItems.reduce((total, entry) => total + calculateExperienceMonths(entry.startDate, entry.endDate, entry.isCurrent), 0),
    [workExperienceItems]
  )
  const totalWorkExperienceLabel = useMemo(() => {
    if (!workExperienceTotalMonths) return '0 mo'
    const years = Math.floor(workExperienceTotalMonths / 12)
    const months = workExperienceTotalMonths % 12
    if (!years) return `${months} mo`
    if (!months) return `${years} yr`
    return `${years} yr ${months} mo`
  }, [workExperienceTotalMonths])
  const profileStatusTone = 'editable'
  const profileStatusLabel = `${String(user?.roleName || (isAdminUser ? 'Admin' : 'Employee')).trim() || 'User'} access`
  const firstLoginSetupRequired = isProfileSetupRequired({ mustChangePassword, mustCompleteProfile })

  const fetchProfileBundle = useCallback(async (seedEmployee = null) => {
    const resolvedEmployee = await employeeService.getCurrentEmployee({ allowMissing: true }).catch(() => null)
    const employeeUid = String(resolvedEmployee?.uid || seedEmployee?.uid || '').trim()

    if (!employeeUid) {
      return employeeService.getMyProfile({ seedEmployee: resolvedEmployee || seedEmployee || null })
    }

    try {
      return await employeeService.getEmployeeProfile(employeeUid)
    } catch (error) {
      const status = Number(error?.response?.status || 0)
      if (![401, 403, 404].includes(status)) throw error
      return employeeService.getMyProfile({ seedEmployee: resolvedEmployee || seedEmployee || null })
    }
  }, [])

  useEffect(() => {
    if (!firstLoginSetupRequired) setSetupPromptDismissed(false)
  }, [firstLoginSetupRequired])

  useEffect(() => {
    let isMounted = true
    async function loadProfile() {
      setLoading(true)
      try {
        const nextProfile = await fetchProfileBundle()
        if (!isMounted) return
        setProfile(nextProfile)
        setProfileDraft(buildDraftFromProfile(nextProfile))
        setBasicDetailsTouched({})
        setFamilyDetailTouched({})
        setWorkExperienceTouched({})
        setPasswordTouched({})
        setProfileUnavailable(!nextProfile?.employee?.uid)
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
  }, [fetchProfileBundle, refreshTick, showStatus])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('')
      return undefined
    }
    const previewUrl = URL.createObjectURL(photoFile)
    setPhotoPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [photoFile])

  useEffect(() => {
    if (!documentItems.length) {
      setSelectedDocumentUid('')
      setDocumentDraft(emptyDocumentDraft())
      return
    }

    if (selectedDocumentUid === NEW_DOCUMENT_UID) {
      return
    }

    const selectedItem = documentItems.find((document) => String(document.uid) === String(selectedDocumentUid))
    if (selectedItem) {
      setDocumentDraft(buildDocumentDraft(selectedItem))
      return
    }

    setSelectedDocumentUid(String(documentItems[0].uid))
    setDocumentDraft(buildDocumentDraft(documentItems[0]))
  }, [documentItems, selectedDocumentUid])

  useEffect(() => {
    if (!familyDetailItems.length) {
      if (selectedFamilyDetailUid === NEW_FAMILY_DETAIL_UID && isFamilyDetailEditorOpen) {
        return
      }
      setSelectedFamilyDetailUid('')
      setFamilyDetailDraft(emptyFamilyDetailDraft())
      setFamilyDetailTouched({})
      setIsFamilyDetailEditorOpen(false)
      return
    }

    if (!isFamilyDetailEditorOpen) {
      return
    }

    if (selectedFamilyDetailUid === NEW_FAMILY_DETAIL_UID) {
      return
    }

    const selectedDetail = familyDetailItems.find((detail) => String(detail.uid) === String(selectedFamilyDetailUid))
    if (selectedDetail) {
      setFamilyDetailDraft(buildFamilyDetailDraft(selectedDetail))
      return
    }

    setSelectedFamilyDetailUid('')
    setFamilyDetailDraft(emptyFamilyDetailDraft())
    setFamilyDetailTouched({})
    setIsFamilyDetailEditorOpen(false)
  }, [familyDetailItems, isFamilyDetailEditorOpen, selectedFamilyDetailUid])

  useEffect(() => {
    if (!workExperienceItems.length) {
      if (selectedWorkExperienceUid === NEW_WORK_EXPERIENCE_UID && isWorkExperienceEditorOpen) {
        return
      }
      setSelectedWorkExperienceUid('')
      setWorkExperienceDraft(emptyWorkExperienceDraft())
      setWorkExperienceTouched({})
      setIsWorkExperienceEditorOpen(false)
      return
    }

    if (!isWorkExperienceEditorOpen) {
      return
    }

    if (selectedWorkExperienceUid === NEW_WORK_EXPERIENCE_UID) {
      return
    }

    const selectedEntry = workExperienceItems.find((entry) => String(entry.uid) === String(selectedWorkExperienceUid))
    if (selectedEntry) {
      setWorkExperienceDraft(buildWorkExperienceDraft(selectedEntry))
      return
    }

    setSelectedWorkExperienceUid('')
    setWorkExperienceDraft(emptyWorkExperienceDraft())
    setWorkExperienceTouched({})
    setIsWorkExperienceEditorOpen(false)
  }, [isWorkExperienceEditorOpen, selectedWorkExperienceUid, workExperienceItems])

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
      canEditProfileDetails: canEditBasicDetails || mustFinishProfile,
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

    setProfileDraft((current) => {
      if (name === 'phone_local') {
        const { maxLength } = getPhoneCountryLengthRule(current.phone_country_code)
        value = String(value).replace(/\D/g, '').slice(0, maxLength)
      }

      if (name === 'emergency_contact_local') {
        const { maxLength } = getPhoneCountryLengthRule(current.emergency_contact_country_code)
        value = String(value).replace(/\D/g, '').slice(0, maxLength)
      }

      const nextDraft = { ...current, [name]: value }
      if (name === 'department' && !isPositionMappedToDepartment(metadataCatalog, nextDraft.position, value)) {
        nextDraft.position = ''
      }

      return nextDraft
    })
  }

  function handleProfileFieldBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setBasicDetailsTouched((current) => ({ ...current, [fieldName]: true }))
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

  function handleFamilyDetailFieldBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setFamilyDetailTouched((current) => ({ ...current, [fieldName]: true }))
  }

  function handleWorkExperienceFieldChange(event) {
    const { name, type, checked } = event.target
    let { value } = event.target

    if (name === 'last_salary') {
      value = String(value).replace(/[^\d.]/g, '')
      const [whole = '', fraction = ''] = value.split('.')
      value = fraction ? `${whole}.${fraction.slice(0, 2)}` : whole
    }

    setWorkExperienceDraft((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'is_current' && checked ? { end_date: '', reason_for_leaving: '' } : {})
    }))
  }

  function handleWorkExperienceFieldBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setWorkExperienceTouched((current) => ({ ...current, [fieldName]: true }))
  }

  function closeFamilyDetailEditor() {
    setSelectedFamilyDetailUid('')
    setFamilyDetailDraft(emptyFamilyDetailDraft())
    setFamilyDetailTouched({})
    setIsFamilyDetailEditorOpen(false)
  }

  function handleCreateNewFamilyDetail() {
    setSelectedFamilyDetailUid(NEW_FAMILY_DETAIL_UID)
    setFamilyDetailDraft(emptyFamilyDetailDraft())
    setFamilyDetailTouched({})
    setIsFamilyDetailEditorOpen(true)
  }

  function closeWorkExperienceEditor() {
    setSelectedWorkExperienceUid('')
    setWorkExperienceDraft(emptyWorkExperienceDraft())
    setWorkExperienceTouched({})
    setIsWorkExperienceEditorOpen(false)
  }

  function handleCreateNewWorkExperience() {
    setSelectedWorkExperienceUid(NEW_WORK_EXPERIENCE_UID)
    setWorkExperienceDraft(emptyWorkExperienceDraft())
    setWorkExperienceTouched({})
    setIsWorkExperienceEditorOpen(true)
  }

  function handleCreateNewDocument() {
    setSelectedDocumentUid(NEW_DOCUMENT_UID)
    setDocumentDraft(emptyDocumentDraft())
    setDocumentFileInputKey((current) => current + 1)
  }

  function handlePasswordFieldBlur(fieldName) {
    setPasswordTouched((current) => ({ ...current, [fieldName]: true }))
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
    try {
      const nextProfile = await runWithLoader(async () => {
        const savedIdentity = {}
        if (String(profileDraft.nickname || '').trim() !== String(profile?.nickname || '').trim()) {
          Object.assign(savedIdentity, await employeeService.updateEmployeeNickname(profile.employee.uid, profileDraft.nickname))
        }
        if (photoFile) {
          Object.assign(savedIdentity, await employeeService.uploadEmployeeProfilePhoto(profile.employee.uid, photoFile))
        }
        const refreshedProfile = await fetchProfileBundle(profile.employee)
        return {
          ...refreshedProfile,
          nickname: refreshedProfile?.nickname || savedIdentity?.nickname || savedIdentity?.nick_name || String(profileDraft.nickname || '').trim(),
          profileImageUrl: refreshedProfile?.profileImageUrl || savedIdentity?.profile_image_url || savedIdentity?.profile_image || ''
        }
      }, {
        title: 'Saving identity',
        message: 'Updating nickname and profile image.',
        minVisibleMs: 450
      })
      setPhotoFile(null)
      setProfile(nextProfile)
      setProfileDraft((current) => ({ ...current, nickname: buildDraftFromProfile(nextProfile).nickname }))
      updateUserFromProfile(nextProfile)
      showStatus({ type: 'success', title: 'Identity updated', message: 'Your profile identity has been saved.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Identity update failed', message: error?.response?.data?.detail || error?.message || 'Could not update profile identity.' })
    }
  }

  async function handleBasicDetailsSave() {
    const basicValidationFields = [...PROFILE_BASIC_REQUIRED_FIELDS, 'birth_date', 'emergency_contact_local']

    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canEditBasicDetails) {
      showStatus({
        type: 'error',
        title: 'Basic details access blocked',
        message: 'Your role does not have permission to update the employee directory fields from this workspace.'
      })
      return
    }
    if (!hasBasicDetailChanges) {
      showStatus({ type: 'error', title: 'No basic detail changes detected', message: 'Update the basic details section before saving.' })
      return
    }

    setBasicDetailsTouched((current) => ({ ...current, ...markFieldsTouched(basicValidationFields) }))
    if (hasValidationErrors(basicDetailErrors, basicValidationFields)) {
      const firstError = basicValidationFields.map((fieldName) => basicDetailErrors[fieldName]).find(Boolean)
      showStatus({
        type: 'error',
        title: 'Basic details have validation errors',
        message: firstError || 'Resolve the highlighted profile fields before continuing.'
      })
      return
    }

    try {
      await runWithLoader(() => employeeService.updateEmployee(profile.employee.uid, {
        ...profile.employee,
        employeeCode: basicDetailChanges.employee_code ?? profile.employee.employeeCode,
        firstName: basicDetailChanges.first_name ?? profile.employee.firstName,
        lastName: basicDetailChanges.last_name ?? profile.employee.lastName,
        email: basicDetailChanges.email ?? profile.employee.email,
        phone: basicDetailChanges.phone ?? profile.employee.phone,
        roleType: basicDetailChanges.role_type ?? profile.employee.roleType,
        position: basicDetailChanges.position ?? profile.employee.position,
        department: basicDetailChanges.department ?? profile.employee.department,
        joinDate: basicDetailChanges.join_date ?? profile.employee.joinDate,
        status: basicDetailChanges.status ?? profile.employee.status,
        dateOfBirth: basicDetailChanges.birth_date ?? profile.employee.dateOfBirth,
        gender: basicDetailChanges.gender ?? profile.employee.gender,
        caste: basicDetailChanges.caste ?? profile.employee.caste,
        employeeType: basicDetailChanges.employee_type ?? profile.employee.employeeType,
        workLocation: basicDetailChanges.work_location ?? profile.employee.workLocation,
        bloodGroup: basicDetailChanges.blood_group ?? profile.employee.bloodGroup,
        emergencyContact: basicDetailChanges.emergency_contact ?? profile.employee.emergencyContact,
        address: basicDetailChanges.address ?? profile.employee.address
      }), {
        title: 'Saving basic details',
        message: 'Updating your employee directory details.',
        minVisibleMs: 450
      })

      const nextProfile = await fetchProfileBundle(profile.employee)
      setProfile(nextProfile)
      const nextDraft = buildDraftFromProfile(nextProfile)
      setProfileDraft((current) => ({
        ...current,
        employee_code: nextDraft.employee_code,
        first_name: nextDraft.first_name,
        last_name: nextDraft.last_name,
        email: nextDraft.email,
        phone_country_code: nextDraft.phone_country_code,
        phone_local: nextDraft.phone_local,
        role_type: nextDraft.role_type,
        position: nextDraft.position,
        department: nextDraft.department,
        join_date: nextDraft.join_date,
        status: nextDraft.status,
        birth_date: nextDraft.birth_date,
        gender: nextDraft.gender,
        caste: nextDraft.caste,
        employee_type: nextDraft.employee_type,
        work_location: nextDraft.work_location,
        blood_group: nextDraft.blood_group,
        emergency_contact_country_code: nextDraft.emergency_contact_country_code,
        emergency_contact_local: nextDraft.emergency_contact_local,
        address: nextDraft.address
      }))
      setBasicDetailsTouched({})
      updateUserFromProfile(nextProfile)
      showStatus({ type: 'success', title: 'Basic details updated', message: 'Your employee profile details have been saved.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Basic detail update failed', message: error?.response?.data?.detail || error?.message || 'Could not save the basic details.' })
    }
  }

  async function handleSkillsSave() {
    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canEditSkills) {
      showStatus({ type: 'error', title: 'Skills access blocked', message: 'Your role does not have permission to update your skills.' })
      return
    }
    if (!hasSkillChanges) {
      showStatus({ type: 'error', title: 'No skill changes detected', message: 'Update the skills field before saving.' })
      return
    }

    try {
      await runWithLoader(async () => {
        await employeeService.syncEmployeeSkills(profile.employee.uid, parsedSkillValues, profile.skills)
        const refreshedProfile = await fetchProfileBundle(profile.employee)

        setProfile(refreshedProfile)
        setProfileDraft((current) => ({ ...current, skills_input: normalizeSkills((refreshedProfile?.skills || []).map((entry) => entry?.skill || '')).join(', ') }))
        updateUserFromProfile(refreshedProfile)
      }, {
        title: 'Saving skills',
        message: parsedSkillValues.length ? 'Updating employee skills.' : 'Removing employee skills.',
        minVisibleMs: 450
      })

      showToast({ tone: 'success', title: 'Skills updated', message: 'Employee skills have been saved.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Skill update failed', message: error?.response?.data?.detail || error?.message || 'Could not save employee skills.' })
    }
  }

  async function handleFamilyDetailSave() {
    const validationFields = ['relation', 'full_name', 'phone']

    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canManageFamilyDetails) {
      showStatus({ type: 'error', title: 'Family details access blocked', message: 'Your role does not have permission to update your family details.' })
      return
    }
    if (!hasPendingFamilyDetail) {
      showStatus({ type: 'error', title: 'No family detail changes detected', message: 'Update the family detail form before saving.' })
      return
    }

    setFamilyDetailTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))
    if (hasValidationErrors(familyDetailErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => familyDetailErrors[fieldName]).find(Boolean)
      showStatus({
        type: 'error',
        title: 'Family details have validation errors',
        message: firstError || 'Resolve the highlighted family detail fields before continuing.'
      })
      return
    }

    const normalizedFamilyPayload = buildFamilyDetailPayload(familyDetailDraft)

    try {
      await runWithLoader(() => (
        selectedFamilyDetail
          ? employeeService.updateEmployeeFamilyDetail(selectedFamilyDetail.uid, normalizedFamilyPayload)
          : employeeService.createEmployeeFamilyDetail({
            employeeUid: profile.employee.uid,
            ...normalizedFamilyPayload
          })
      ), {
        title: selectedFamilyDetail ? 'Updating family detail' : 'Saving family detail',
        message: selectedFamilyDetail ? 'Updating the selected family record.' : 'Creating a new family record.',
        minVisibleMs: 450
      })

      const refreshedProfile = await fetchProfileBundle(profile.employee)
      setProfile(refreshedProfile)
      closeFamilyDetailEditor()
      updateUserFromProfile(refreshedProfile)
      showToast({ tone: 'success', title: selectedFamilyDetail ? 'Family details updated' : 'Family detail added', message: selectedFamilyDetail ? 'The family record has been updated.' : 'The family record has been added.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Family detail update failed', message: error?.response?.data?.detail || error?.message || 'Could not save the family detail.' })
    }
  }

  async function handleFamilyDetailDelete(detail = selectedFamilyDetail) {
    if (!detail) {
      showStatus({ type: 'error', title: 'No family record selected', message: 'Select a saved family record before deleting it.' })
      return
    }
    if (!hasFamilyDetailDeletePermission) {
      showStatus({ type: 'error', title: 'Delete not available', message: 'Your role does not have permission to delete your family detail records.' })
      return
    }
    if (!window.confirm(`Delete the family detail for ${detail.fullName || detail.relation || 'this record'}?`)) {
      return
    }

    try {
      await runWithLoader(() => employeeService.deleteEmployeeFamilyDetail(detail.uid), {
        title: 'Deleting family detail',
        message: 'Removing the selected family record.',
        minVisibleMs: 450
      })

      const refreshedProfile = await fetchProfileBundle(profile.employee)
      setProfile(refreshedProfile)
      closeFamilyDetailEditor()
      updateUserFromProfile(refreshedProfile)
      showToast({ tone: 'success', title: 'Family detail deleted', message: 'The family record has been removed.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Family detail delete failed', message: error?.response?.data?.detail || error?.message || 'Could not delete the family detail.' })
    }
  }

  async function handleWorkExperienceSave() {
    const validationFields = ['company_name', 'job_title', 'start_date', 'end_date']

    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canManageWorkExperience) {
      showStatus({ type: 'error', title: 'Work experience access blocked', message: 'Your role does not have permission to update your work experience.' })
      return
    }
    if (!hasPendingWorkExperience) {
      showStatus({ type: 'error', title: 'No work experience changes detected', message: 'Update the work experience form before saving.' })
      return
    }

    setWorkExperienceTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))
    if (hasValidationErrors(workExperienceErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => workExperienceErrors[fieldName]).find(Boolean)
      showStatus({
        type: 'error',
        title: 'Work experience has validation errors',
        message: firstError || 'Resolve the highlighted work experience fields before continuing.'
      })
      return
    }

    const payload = buildWorkExperiencePayload(workExperienceDraft)

    try {
      await runWithLoader(() => (
        selectedWorkExperience
          ? employeeService.updateEmployeeWorkExperience(selectedWorkExperience.uid, payload)
          : employeeService.createEmployeeWorkExperience({
            employeeUid: profile.employee.uid,
            ...payload
          })
      ), {
        title: selectedWorkExperience ? 'Updating work experience' : 'Saving work experience',
        message: selectedWorkExperience ? 'Updating the selected work experience entry.' : 'Creating a new work experience entry.',
        minVisibleMs: 450
      })

      const refreshedProfile = await fetchProfileBundle(profile.employee)
      setProfile(refreshedProfile)
      closeWorkExperienceEditor()
      updateUserFromProfile(refreshedProfile)
      showToast({ tone: 'success', title: selectedWorkExperience ? 'Work experience updated' : 'Work experience added', message: selectedWorkExperience ? 'The work experience entry has been updated.' : 'The work experience entry has been added.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Work experience update failed', message: error?.response?.data?.detail || error?.message || 'Could not save the work experience entry.' })
    }
  }

  async function handleWorkExperienceDelete(experience = selectedWorkExperience) {
    if (!experience) {
      showStatus({ type: 'error', title: 'No work experience selected', message: 'Select a saved work experience entry before deleting it.' })
      return
    }
    if (!hasWorkExperienceDeletePermission) {
      showStatus({ type: 'error', title: 'Delete not available', message: 'Your role does not have permission to delete your work experience records.' })
      return
    }
    if (!window.confirm(`Delete the work experience for ${experience.companyName || experience.jobTitle || 'this record'}?`)) {
      return
    }

    try {
      await runWithLoader(() => employeeService.deleteEmployeeWorkExperience(experience.uid), {
        title: 'Deleting work experience',
        message: 'Removing the selected work experience entry.',
        minVisibleMs: 450
      })

      const refreshedProfile = await fetchProfileBundle(profile.employee)
      setProfile(refreshedProfile)
      closeWorkExperienceEditor()
      updateUserFromProfile(refreshedProfile)
      showToast({ tone: 'success', title: 'Work experience deleted', message: 'The work experience entry has been removed.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Work experience delete failed', message: error?.response?.data?.detail || error?.message || 'Could not delete the work experience entry.' })
    }
  }

  async function handleDocumentSave() {
    if (profileUnavailable || !profile?.employee?.uid) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canUploadDocuments) {
      showStatus({ type: 'error', title: 'Document access blocked', message: 'Your role does not have permission to manage your documents.' })
      return
    }
    if (!hasPendingDocumentChanges) {
      showStatus({ type: 'error', title: 'No document changes detected', message: 'Update the document form before saving.' })
      return
    }

    const nextDocumentName = String(documentDraft.name || '').trim() || getDocumentDefaultName(documentDraft.documentType)
    if (!nextDocumentName) {
      showStatus({ type: 'error', title: 'Document name required', message: 'Enter a document name before saving.' })
      return
    }
    if (!selectedDocument && !documentDraft.file) {
      showStatus({ type: 'error', title: 'File required', message: 'Choose a file before uploading a new document.' })
      return
    }

    try {
      const savedDocument = await runWithLoader(() => {
        if (selectedDocument) {
          if (documentDraft.file) {
            return employeeService.replaceEmployeeDocumentFile(selectedDocument.uid, {
              documentType: documentDraft.documentType,
              name: nextDocumentName,
              file: documentDraft.file
            })
          }

          return employeeService.updateEmployeeDocument(selectedDocument.uid, {
            documentType: documentDraft.documentType,
            name: nextDocumentName
          })
        }

        return employeeService.uploadEmployeeDocument({
          employeeUid: profile.employee.uid,
          documentType: documentDraft.documentType,
          name: nextDocumentName,
          file: documentDraft.file
        })
      }, {
        title: selectedDocument ? 'Updating document' : 'Uploading document',
        message: selectedDocument ? 'Saving document changes.' : 'Uploading the selected document.',
        minVisibleMs: 450
      })

      const refreshedProfile = await fetchProfileBundle(profile.employee)
      setProfile(refreshedProfile)
      setSelectedDocumentUid(String(savedDocument?.uid || ''))
      setDocumentFileInputKey((current) => current + 1)
      updateUserFromProfile(refreshedProfile)
      showToast({ tone: 'success', title: selectedDocument ? 'Document updated' : 'Document uploaded', message: selectedDocument ? 'The document has been updated.' : 'The document has been uploaded.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Document save failed', message: error?.response?.data?.detail || error?.message || 'Could not save the document.' })
    }
  }

  async function handleDocumentDelete(document = selectedDocument) {
    if (!document) {
      showStatus({ type: 'error', title: 'No document selected', message: 'Select a saved document before deleting it.' })
      return
    }
    if (!canManageDocuments) {
      showStatus({ type: 'error', title: 'Document access blocked', message: 'Your role does not have permission to delete your documents.' })
      return
    }
    if (!window.confirm(`Delete the document "${document.name || 'Document'}"?`)) {
      return
    }

    try {
      await runWithLoader(() => employeeService.deleteEmployeeDocument(document.uid), {
        title: 'Deleting document',
        message: 'Removing the selected document.',
        minVisibleMs: 450
      })

      const refreshedProfile = await fetchProfileBundle(profile.employee)
      setProfile(refreshedProfile)
      setSelectedDocumentUid('')
      setDocumentDraft(emptyDocumentDraft())
      setDocumentFileInputKey((current) => current + 1)
      updateUserFromProfile(refreshedProfile)
      showToast({ tone: 'success', title: 'Document deleted', message: 'The document has been removed.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Document delete failed', message: error?.response?.data?.detail || error?.message || 'Could not delete the document.' })
    }
  }

  async function handlePasswordChange() {
    const validationFields = mustChangePassword
      ? ['new_password', 'confirm_new_password']
      : ['current_password', 'new_password', 'confirm_new_password']

    setPasswordTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(passwordErrors, validationFields)) {
      const firstError = validationFields.map((fieldName) => passwordErrors[fieldName]).find(Boolean)
      showStatus({ type: 'error', title: 'Password has validation errors', message: firstError || 'Resolve the highlighted password fields before continuing.' })
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
      setPasswordTouched({})
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

  const showBasicError = (fieldName) => canEditBasicDetails && basicDetailsTouched[fieldName] && basicDetailErrors[fieldName]
  const showFamilyError = (fieldName) => familyDetailTouched[fieldName] && familyDetailErrors[fieldName]
  const showWorkExperienceError = (fieldName) => workExperienceTouched[fieldName] && workExperienceErrors[fieldName]
  const showPasswordError = (fieldName) => passwordTouched[fieldName] && passwordErrors[fieldName]

  if (loading) {
    return (
      <div className="d-flex flex-column gap-3">
        <PageHeader title="My Profile" tagline="Manage profile identity, onboarding, and account security." />
        <PageContentLoader cards={3} />
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3 employee-module-page profile-page profile-modern-page">
      <PageHeader title="My Profile" tagline="Manage profile identity, onboarding, and account security." />

      <div className="profile-hero card border-0 shadow-sm">
        <div className="card-body profile-hero-body">
          <div className="profile-hero-content">
            <div className="profile-hero-eyebrow">{isAdminUser ? 'Admin Workspace' : 'Employee Workspace'}</div>
            <div className="profile-hero-title">{profileDraft.nickname || profileDraft.first_name || user?.firstName || 'User'}</div>
            <div className="text-muted small profile-hero-summary">
              {isAdminUser
                ? 'Admin accounts can manage basic details, skills, family details, documents, and password from one workspace.'
                : 'Basic details are loaded from the employee directory, and each profile section can now be saved separately. During first login, only the required onboarding sections stay highlighted until they are completed.'}
            </div>
            {firstLoginSetupRequired && firstLoginDeadlineLabel ? (
              <div className="text-muted small mt-1 profile-hero-summary">Complete first-login setup by {firstLoginDeadlineLabel} to avoid automatic account disable.</div>
            ) : null}
          </div>
          <div className="d-flex flex-column gap-2 profile-hero-meta">
            <span className={`profile-pill ${profileStatusTone}`}>{profileStatusLabel}</span>
            {!isAdminUser ? <span className="text-muted small">Skills: {skillCount} • Documents: {documentItems.length} • Family records: {familyDetailItems.length} • Experience: {workExperienceItems.length}</span> : null}
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
                      <div className="form-text">
                        {hasLinkedEmployee
                          ? 'Upload a clear profile image to refresh your header and account avatar.'
                          : 'Employee profile must be linked before a profile image can be uploaded.'}
                      </div>
                    </div>
                    <button type="button" className="btn btn-primary profile-action-btn" onClick={handleIdentitySave} disabled={!hasLinkedEmployee || !identityHasChanges}>
                      Save Identity
                    </button>
                    <div className="text-muted small">
                      Nickname and profile image are optional during first login. You can update them later.
                    </div>
                  </div>
              </div>
            </div>

            <div id="profile-password-section" className={`card border-0 shadow-sm profile-panel${activeSetupTarget === 'password' ? ' setup-target-active' : ''}`}>
              <div className="card-body d-flex flex-column gap-3">
                <div>
                  <div className="profile-section-heading">Change Password</div>
                  <div className="text-muted small">{mustChangePassword ? 'Default password detected. Set a new password to continue. The current password will be applied automatically.' : 'Enter your old password and set a stronger new one.'}</div>
                </div>
                {mustChangePassword ? <div className="alert alert-warning mb-0 small">This section is mandatory on first login. Update the default password before the rest of the application is unlocked.</div> : null}
                {!mustChangePassword ? (
                  <div>
                    <label className="form-label">Current Password</label>
                    <div className="input-group">
                      <input className={`form-control${showPasswordError('current_password') ? ' is-invalid' : ''}`} type={passwordVisibility.current_password ? 'text' : 'password'} value={passwordDraft.current_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, current_password: event.target.value }))} onBlur={() => handlePasswordFieldBlur('current_password')} />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('current_password')}>{passwordVisibility.current_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                    </div>
                    {showPasswordError('current_password') ? <div className="invalid-feedback d-block">{passwordErrors.current_password}</div> : null}
                  </div>
                ) : null}
                <div>
                  <label className="form-label">New Password</label>
                  <div className="input-group">
                    <input className={`form-control${showPasswordError('new_password') ? ' is-invalid' : ''}`} type={passwordVisibility.new_password ? 'text' : 'password'} value={passwordDraft.new_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, new_password: event.target.value }))} onBlur={() => handlePasswordFieldBlur('new_password')} />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('new_password')}>{passwordVisibility.new_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                  </div>
                  {showPasswordError('new_password') ? <div className="invalid-feedback d-block">{passwordErrors.new_password}</div> : null}
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
                    <input className={`form-control${showPasswordError('confirm_new_password') ? ' is-invalid' : ''}`} type={passwordVisibility.confirm_new_password ? 'text' : 'password'} value={passwordDraft.confirm_new_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, confirm_new_password: event.target.value }))} onBlur={() => handlePasswordFieldBlur('confirm_new_password')} />
                    <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('confirm_new_password')}>{passwordVisibility.confirm_new_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                  </div>
                  {showPasswordError('confirm_new_password') ? <div className="invalid-feedback d-block">{passwordErrors.confirm_new_password}</div> : null}
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

            <div className="card border-0 shadow-sm profile-panel">
              <div className="card-body d-flex flex-column gap-3">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 profile-experience-shell__header">
                  <div>
                    <div className="profile-section-heading">Work Experience</div>
                    <div className="text-muted small">Grouped by company with role timelines, inspired by LinkedIn’s experience layout.</div>
                  </div>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span className="profile-pill editable">{totalWorkExperienceLabel}</span>
                    {canManageWorkExperience ? (
                      <button
                        type="button"
                        className="btn btn-primary profile-experience-add-btn"
                        onClick={handleCreateNewWorkExperience}
                      >
                        <PlusIcon />
                        <span>{workExperienceItems.length ? 'Add Position' : 'Add Experience'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="text-muted small">
                  Work experience is optional during first login. Add it now or come back later.
                </div>
                {!canManageWorkExperience ? <div className="profile-readonly-banner">Role access for My Work Experience is disabled. Ask admin to grant that sub-module to add or update records.</div> : null}

                {workExperienceGroups.length ? (
                  <div className="profile-experience-groups">
                    {workExperienceGroups.map((group) => {
                      const newestRole = group.items[0]
                      const oldestRole = group.items[group.items.length - 1]
                      const isCurrentEmployer = group.items.some((item) => item.isCurrent)
                      const companyDurationLabel = formatExperienceDuration(oldestRole?.startDate, newestRole?.endDate, isCurrentEmployer)
                      const companyMeta = [companyDurationLabel, `${group.items.length} position${group.items.length === 1 ? '' : 's'}`]
                        .filter(Boolean)
                        .join(' · ')

                      return (
                        <div key={group.key} className="profile-experience-group">
                          <div className="profile-experience-company">
                            <CompanyLogoBadge companyName={group.companyName} />
                            <div className="profile-experience-company-body">
                              <div className="profile-experience-company-name">{group.companyName}</div>
                              <div className="profile-experience-company-meta">
                                {companyMeta || 'Experience timeline'}
                              </div>
                            </div>
                          </div>

                          <div className="profile-experience-timeline">
                            {group.items.map((experience) => (
                              <div key={experience.uid} className="profile-experience-role">
                                <div className="profile-experience-role-marker" />
                                <div className="profile-experience-role-card">
                                  <div className="d-flex align-items-start justify-content-between gap-3">
                                    <div className="flex-grow-1">
                                      <div className="profile-experience-role-title">{experience.jobTitle || 'Role title'}</div>
                                      <div className="profile-experience-role-meta">
                                        {[experience.employmentType || '', formatExperiencePeriod(experience.startDate, experience.endDate, experience.isCurrent)].filter(Boolean).join(' · ')}
                                      </div>
                                      {experience.location ? <div className="profile-experience-role-location">{experience.location}</div> : null}
                                    </div>
                                    {canManageWorkExperience ? (
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary profile-experience-edit-btn"
                                        onClick={() => {
                                          setSelectedWorkExperienceUid(String(experience.uid))
                                          setWorkExperienceDraft(buildWorkExperienceDraft(experience))
                                          setWorkExperienceTouched({})
                                          setIsWorkExperienceEditorOpen(true)
                                        }}
                                      >
                                        <PencilIcon />
                                      </button>
                                    ) : null}
                                  </div>

                                  {experience.responsibilities ? <p className="profile-experience-role-summary mb-0">{experience.responsibilities}</p> : null}

                                  {(experience.reasonForLeaving || experience.remarks || experience.lastSalary) ? (
                                    <div className="profile-experience-role-footer">
                                      {experience.reasonForLeaving ? <span>Reason: {experience.reasonForLeaving}</span> : null}
                                      {experience.remarks ? <span>{experience.remarks}</span> : null}
                                      {experience.lastSalary ? <span>Last salary: {experience.lastSalary}</span> : null}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="profile-experience-empty">
                    <div className="profile-experience-empty__icon"><BriefcaseIcon /></div>
                    <div className="fw-semibold">No work experience added yet.</div>
                    <div className="text-muted small">Add your roles company-wise to build a cleaner professional timeline.</div>
                  </div>
                )}
              </div>
            </div>

            <ModalFrame
              open={isWorkExperienceEditorOpen}
              title={selectedWorkExperience ? 'Edit experience' : 'Add experience'}
              onClose={closeWorkExperienceEditor}
              size="lg"
              footer={(
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={closeWorkExperienceEditor}>
                    Cancel
                  </button>
                  {selectedWorkExperience && hasWorkExperienceDeletePermission ? (
                    <button type="button" className="btn btn-outline-danger" onClick={handleWorkExperienceDelete} disabled={!hasWorkExperienceDeletePermission}>
                      Delete
                    </button>
                  ) : null}
                  <button type="button" className="btn btn-primary" onClick={handleWorkExperienceSave} disabled={!canManageWorkExperience || !hasPendingWorkExperience}>
                    {selectedWorkExperience ? 'Update Experience' : 'Save Experience'}
                  </button>
                </>
              )}
            >
              <div className="d-flex flex-column gap-3">
                <div className="profile-experience-modal-note">
                  {selectedWorkExperience
                    ? `Editing ${selectedWorkExperience.companyName || selectedWorkExperience.jobTitle || 'the selected role'}.`
                    : 'Add a role with company, title, employment type, dates, and a concise summary.'}
                </div>

                <div className="row g-3">
                  <div className="col-12 col-md-6">
                    <label className="form-label">Company Name</label>
                    <input className={`form-control${showWorkExperienceError('company_name') ? ' is-invalid' : ''}`} name="company_name" value={workExperienceDraft.company_name} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} maxLength="150" placeholder="Company name" disabled={!canManageWorkExperience} />
                    {showWorkExperienceError('company_name') ? <div className="invalid-feedback d-block">{workExperienceErrors.company_name}</div> : null}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Job Title</label>
                    <input className={`form-control${showWorkExperienceError('job_title') ? ' is-invalid' : ''}`} name="job_title" value={workExperienceDraft.job_title} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} maxLength="120" placeholder="Job title" disabled={!canManageWorkExperience} />
                    {showWorkExperienceError('job_title') ? <div className="invalid-feedback d-block">{workExperienceErrors.job_title}</div> : null}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Employment Type</label>
                    <AppSelect
                      name="employment_type"
                      value={workExperienceDraft.employment_type}
                      onChange={handleWorkExperienceFieldChange}
                      onBlur={handleWorkExperienceFieldBlur}
                      options={workExperienceEmploymentTypeOptions}
                      placeholder="Select employment type"
                      disabled={!canManageWorkExperience}
                    />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Location</label>
                    <input className="form-control" name="location" value={workExperienceDraft.location} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} maxLength="120" placeholder="City or work location" disabled={!canManageWorkExperience} />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="work-experience-current" name="is_current" checked={workExperienceDraft.is_current} onChange={handleWorkExperienceFieldChange} disabled={!canManageWorkExperience} />
                      <label className="form-check-label" htmlFor="work-experience-current">I currently work here</label>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Start Date</label>
                    <input className={`form-control${showWorkExperienceError('start_date') ? ' is-invalid' : ''}`} type="date" name="start_date" value={workExperienceDraft.start_date} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} disabled={!canManageWorkExperience} max={getTodayInputValue()} />
                    {showWorkExperienceError('start_date') ? <div className="invalid-feedback d-block">{workExperienceErrors.start_date}</div> : null}
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">End Date</label>
                    <input className={`form-control${showWorkExperienceError('end_date') ? ' is-invalid' : ''}`} type="date" name="end_date" value={workExperienceDraft.end_date} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} disabled={!canManageWorkExperience || workExperienceDraft.is_current} max={getTodayInputValue()} />
                    {showWorkExperienceError('end_date') ? <div className="invalid-feedback d-block">{workExperienceErrors.end_date}</div> : null}
                  </div>
                  <div className="col-12">
                    <div className="attendance-note-card mb-0">
                      Experience length: <strong>{formatExperienceDuration(workExperienceDraft.start_date, workExperienceDraft.end_date, workExperienceDraft.is_current)}</strong>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Last Salary</label>
                    <input className="form-control" name="last_salary" value={workExperienceDraft.last_salary} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} inputMode="decimal" placeholder="Optional last salary" disabled={!canManageWorkExperience} />
                  </div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Reason for Leaving</label>
                    <input className="form-control" name="reason_for_leaving" value={workExperienceDraft.reason_for_leaving} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} maxLength="200" placeholder="Optional reason" disabled={!canManageWorkExperience || workExperienceDraft.is_current} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Responsibilities</label>
                    <textarea className="form-control" rows="4" name="responsibilities" value={workExperienceDraft.responsibilities} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} placeholder="Describe achievements, scope, tools, or highlights." disabled={!canManageWorkExperience} />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Remarks</label>
                    <textarea className="form-control" rows="2" name="remarks" value={workExperienceDraft.remarks} onChange={handleWorkExperienceFieldChange} onBlur={handleWorkExperienceFieldBlur} placeholder="Optional remarks" disabled={!canManageWorkExperience} />
                  </div>
                </div>
              </div>
            </ModalFrame>
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
                {mustCompleteProfile ? (
                  <div className="alert alert-warning mb-0 small">
                    Review this section during first login so your employee directory details stay accurate for attendance and leave workflows.
                  </div>
                ) : null}
                {!hasVisibleBasicDetails && profileUnavailable ? (
                  <div className="text-muted small">No employee profile details are available for this account yet.</div>
                ) : (
                  <div className="row g-3">
                    {!hasLinkedEmployee ? (
                      <div className="col-12">
                        <div className="text-muted small">Showing the account details currently available from this login. Full basic-profile editing stays locked until an employee record is linked to this user.</div>
                      </div>
                    ) : null}
                    <div className="col-12 col-md-6">
                      <label className="form-label">Employee Code</label>
                      <input className="form-control" name="employee_code" value={basicDetailsDraft.employee_code} onChange={handleProfileFieldChange} disabled maxLength="20" />
                      <div className="form-text">Employee code is locked after creation and cannot be modified.</div>
                    </div>
                    <div className="col-12 col-md-6"><label className="form-label">Email</label><input className={`form-control${showBasicError('email') ? ' is-invalid' : ''}`} type="email" name="email" value={basicDetailsDraft.email} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} disabled={!canEditBasicDetails} />{showBasicError('email') ? <div className="invalid-feedback d-block">{basicDetailErrors.email}</div> : null}</div>
                    <div className="col-12 col-md-6"><label className="form-label">First Name</label><input className={`form-control${showBasicError('first_name') ? ' is-invalid' : ''}`} name="first_name" value={basicDetailsDraft.first_name} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} disabled={!canEditBasicDetails} maxLength="120" />{showBasicError('first_name') ? <div className="invalid-feedback d-block">{basicDetailErrors.first_name}</div> : null}</div>
                    <div className="col-12 col-md-6"><label className="form-label">Last Name</label><input className={`form-control${showBasicError('last_name') ? ' is-invalid' : ''}`} name="last_name" value={basicDetailsDraft.last_name} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} disabled={!canEditBasicDetails} maxLength="120" />{showBasicError('last_name') ? <div className="invalid-feedback d-block">{basicDetailErrors.last_name}</div> : null}</div>
                    <div className="col-12 col-md-6"><label className="form-label">Role</label><AppSelect name="role_type" value={basicDetailsDraft.role_type} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={roleOptions} placeholder="Select role" disabled={!canEditBasicDetails} invalid={Boolean(showBasicError('role_type'))} />{showBasicError('role_type') ? <div className="invalid-feedback d-block">{basicDetailErrors.role_type}</div> : null}</div>
                    <div className="col-12 col-md-6"><label className="form-label">Department</label><AppSelect name="department" value={basicDetailsDraft.department} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={departmentOptions} placeholder="Select department" disabled={!canEditBasicDetails} invalid={Boolean(showBasicError('department'))} />{showBasicError('department') ? <div className="invalid-feedback d-block">{basicDetailErrors.department}</div> : null}</div>
                    <div className="col-12 col-md-6"><label className="form-label">Position</label><AppSelect name="position" value={basicDetailsDraft.position} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={positionOptions} placeholder={basicDetailsDraft.department ? 'Select position' : 'Select department first'} disabled={!canEditBasicDetails || !basicDetailsDraft.department} invalid={Boolean(showBasicError('position'))} />{!basicDetailsDraft.department ? <div className="form-text">Choose a department first to load the mapped positions.</div> : null}{showBasicError('position') ? <div className="invalid-feedback d-block">{basicDetailErrors.position}</div> : null}</div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Mobile Number</label>
                      <div className="phone-input-shell">
                        <AppSelect name="phone_country_code" value={basicDetailsDraft.phone_country_code} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" disabled={!canEditBasicDetails} />
                        <input className={`form-control${showBasicError('phone_local') ? ' is-invalid' : ''}`} name="phone_local" value={basicDetailsDraft.phone_local} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} inputMode="numeric" placeholder="Enter mobile number" minLength={mobilePhoneRule.minLength} maxLength={mobilePhoneRule.maxLength} pattern={`[0-9]{${mobilePhoneRule.minLength},${mobilePhoneRule.maxLength}}`} disabled={!canEditBasicDetails} />
                      </div>
                      <div className="form-text">Expected local length for {mobilePhoneRule.label} ({mobilePhoneRule.dialCode}): {formatPhoneLengthRule(mobilePhoneRule)}.</div>
                      {showBasicError('phone_local') ? <div className="invalid-feedback d-block">{basicDetailErrors.phone_local}</div> : null}
                    </div>
                    <div className="col-12 col-md-6"><label className="form-label">Join Date</label><input className={`form-control${showBasicError('join_date') ? ' is-invalid' : ''}`} type="date" name="join_date" value={basicDetailsDraft.join_date} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} disabled={!canEditBasicDetails} />{showBasicError('join_date') ? <div className="invalid-feedback d-block">{basicDetailErrors.join_date}</div> : null}</div>
                    <div className="col-12 col-md-6"><label className="form-label">Status</label><AppSelect name="status" value={basicDetailsDraft.status} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={statusOptions} placeholder="Select status" disabled={!canEditBasicDetails} invalid={Boolean(showBasicError('status'))} />{showBasicError('status') ? <div className="invalid-feedback d-block">{basicDetailErrors.status}</div> : null}</div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Date of Birth</label>
                      <input className={`form-control${showBasicError('birth_date') ? ' is-invalid' : ''}`} type="date" name="birth_date" value={basicDetailsDraft.birth_date} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} disabled={!canEditBasicDetails} min={dobBounds.min} max={dobBounds.max} />
                      <div className="form-text">Allowed age band: 21 to 65 years.</div>
                      {showBasicError('birth_date') ? <div className="invalid-feedback d-block">{basicDetailErrors.birth_date}</div> : null}
                    </div>
                    <div className="col-12 col-md-3"><label className="form-label">Age</label><input className="form-control" disabled value={ageLabel} /></div>
                    <div className="col-12 col-md-3"><label className="form-label">Tenure in Organization</label><input className="form-control" disabled value={tenureLabel} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Gender</label><input className="form-control" name="gender" value={basicDetailsDraft.gender} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} maxLength="120" placeholder="Enter gender manually" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Caste</label><input className="form-control" name="caste" value={basicDetailsDraft.caste} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} maxLength="120" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Employee Type</label><AppSelect name="employee_type" value={basicDetailsDraft.employee_type} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={employeeTypeOptions} placeholder="Select type" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Work Location</label><AppSelect name="work_location" value={basicDetailsDraft.work_location} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={workLocationOptions} placeholder="Select work location" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6"><label className="form-label">Blood Group</label><AppSelect name="blood_group" value={basicDetailsDraft.blood_group} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={bloodGroupOptions} placeholder="Select blood group" disabled={!canEditBasicDetails} /></div>
                    <div className="col-12 col-md-6">
                      <label className="form-label">Emergency Contact</label>
                      <div className="phone-input-shell">
                        <AppSelect name="emergency_contact_country_code" value={basicDetailsDraft.emergency_contact_country_code} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" disabled={!canEditBasicDetails} />
                        <input className={`form-control${showBasicError('emergency_contact_local') ? ' is-invalid' : ''}`} name="emergency_contact_local" value={basicDetailsDraft.emergency_contact_local} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} inputMode="numeric" placeholder="Enter emergency contact number" maxLength={emergencyContactRule.maxLength} pattern={`([0-9]{${emergencyContactRule.minLength},${emergencyContactRule.maxLength}})?`} disabled={!canEditBasicDetails} />
                      </div>
                      <div className="form-text">Emergency contact must differ from the employee mobile number. Expected local length for {emergencyContactRule.label} ({emergencyContactRule.dialCode}): {formatPhoneLengthRule(emergencyContactRule)}.</div>
                      {showBasicError('emergency_contact_local') ? <div className="invalid-feedback d-block">{basicDetailErrors.emergency_contact_local}</div> : null}
                    </div>
                    <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="3" name="address" value={basicDetailsDraft.address} onChange={handleProfileFieldChange} onBlur={handleProfileFieldBlur} disabled={!canEditBasicDetails} /></div>
                    {canEditBasicDetails ? (
                      <div className="col-12 d-flex justify-content-end">
                        <button type="button" className="btn btn-primary" onClick={handleBasicDetailsSave} disabled={!hasBasicDetailChanges}>
                          Save Basic Details
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="profile-form-divider" />

              <div className="profile-form-section">
                <div>
                  <div className="profile-section-heading">Skills, Family Details, And Documents</div>
                  <div className="text-muted small">Use the section actions below to manage each profile area separately.</div>
                </div>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Skills</label>
                    <input className="form-control" name="skills_input" value={profileDraft.skills_input} onChange={handleProfileFieldChange} placeholder="React, Python, Figma" disabled={!canEditSkills} />
                    <div className="form-text">
                      {!hasLinkedEmployee
                        ? 'Employee profile must be linked before skills can be managed.'
                        : (!canEditSkills
                          ? 'Role access for My Skills is disabled.'
                          : 'Use comma-separated values and save once.')}
                    </div>
                    {skillSetupRequired ? <div className="alert alert-warning mt-3 mb-0 small">This section is mandatory on first login. Add at least one skill and save it to continue onboarding.</div> : null}
                    <div className="d-flex justify-content-end mt-3">
                      <button type="button" className="btn btn-primary" onClick={handleSkillsSave} disabled={!canEditSkills || !hasSkillChanges}>
                        Save Skills
                      </button>
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="profile-form-divider" />
                  </div>
                  <div className="col-12">
                    <div className="profile-section-heading">Family Details</div>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div className="text-muted small">
                        {!canManageFamilyDetails
                          ? 'Role access for My Family Details is disabled. Ask admin to grant that sub-module to edit or add records.'
                          : (isFamilyDetailEditorOpen
                            ? (selectedFamilyDetail
                              ? 'Update the loaded family record and save the changes, or close the form when you are done.'
                              : 'Add one family record at a time. Relation and full name are required for each entry.')
                            : 'Saved family records stay visible below. Open the form only when you want to add or edit an entry.')}
                      </div>
                      {canManageFamilyDetails ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={isFamilyDetailEditorOpen ? closeFamilyDetailEditor : handleCreateNewFamilyDetail}
                        >
                          {isFamilyDetailEditorOpen ? 'Close Form' : (familyDetailItems.length ? 'Add New Record' : 'Add Family Detail')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {familySetupRequired ? <div className="col-12"><div className="alert alert-warning mb-0 small">This section is mandatory on first login. Add at least one family record and save it to continue onboarding.</div></div> : null}
                  {isFamilyDetailEditorOpen ? (
                    <>
                      <div className="col-12">
                        <div className="alert alert-secondary mb-0 small">
                          {selectedFamilyDetail
                            ? `Editing ${selectedFamilyDetail.fullName || selectedFamilyDetail.relation || 'the selected family record'}.`
                            : 'Fill out the form below to add a new family record.'}
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Relation</label>
                        <input className={`form-control${showFamilyError('relation') ? ' is-invalid' : ''}`} name="relation" value={familyDetailDraft.relation} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} placeholder="Spouse, Father, Mother" maxLength="100" disabled={!canManageFamilyDetails} />
                        {showFamilyError('relation') ? <div className="invalid-feedback d-block">{familyDetailErrors.relation}</div> : null}
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Full Name</label>
                        <input className={`form-control${showFamilyError('full_name') ? ' is-invalid' : ''}`} name="full_name" value={familyDetailDraft.full_name} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} placeholder="Family member name" maxLength="150" disabled={!canManageFamilyDetails} />
                        {showFamilyError('full_name') ? <div className="invalid-feedback d-block">{familyDetailErrors.full_name}</div> : null}
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Date of Birth</label>
                        <input className="form-control" type="date" name="date_of_birth" value={familyDetailDraft.date_of_birth} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} disabled={!canManageFamilyDetails} />
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Phone</label>
                        <input className={`form-control${showFamilyError('phone') ? ' is-invalid' : ''}`} name="phone" value={familyDetailDraft.phone} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} placeholder="+919999999999" maxLength="20" disabled={!canManageFamilyDetails} />
                        {showFamilyError('phone') ? <div className="invalid-feedback d-block">{familyDetailErrors.phone}</div> : null}
                      </div>
                      <div className="col-12 col-md-4">
                        <label className="form-label">Occupation</label>
                        <input className="form-control" name="occupation" value={familyDetailDraft.occupation} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} placeholder="Occupation" maxLength="120" disabled={!canManageFamilyDetails} />
                      </div>
                      <div className="col-12 col-md-4 d-flex align-items-end">
                        <div className="form-check mb-2">
                          <input className="form-check-input" type="checkbox" id="family-dependent" name="is_dependent" checked={familyDetailDraft.is_dependent} onChange={handleFamilyDetailFieldChange} disabled={!canManageFamilyDetails} />
                          <label className="form-check-label" htmlFor="family-dependent">Dependent family member</label>
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Address</label>
                        <textarea className="form-control" rows="2" name="address" value={familyDetailDraft.address} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} placeholder="Family member address" disabled={!canManageFamilyDetails} />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label">Remarks</label>
                        <textarea className="form-control" rows="2" name="remarks" value={familyDetailDraft.remarks} onChange={handleFamilyDetailFieldChange} onBlur={handleFamilyDetailFieldBlur} placeholder="Optional remarks" disabled={!canManageFamilyDetails} />
                      </div>
                    </>
                  ) : null}
                  <div className="col-12">
                    {familyDetailItems.length ? (
                      <div className="d-flex flex-column gap-2">
                        {familyDetailItems.map((detail) => (
                          <div key={detail.uid} className="profile-doc-item">
                            <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                              <div className="d-flex flex-column gap-1">
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
                              <div className="d-flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isFamilyDetailEditorOpen && String(detail.uid) === String(selectedFamilyDetailUid) ? 'btn-primary' : 'btn-outline-secondary'}`}
                                  onClick={() => {
                                    setSelectedFamilyDetailUid(String(detail.uid))
                                    setFamilyDetailDraft(buildFamilyDetailDraft(detail))
                                    setFamilyDetailTouched({})
                                    setIsFamilyDetailEditorOpen(true)
                                  }}
                                  disabled={!canManageFamilyDetails}
                                >
                                  {isFamilyDetailEditorOpen && String(detail.uid) === String(selectedFamilyDetailUid) ? 'Editing' : 'Edit'}
                                </button>
                                {hasFamilyDetailDeletePermission ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => handleFamilyDetailDelete(detail)}
                                    disabled={!hasFamilyDetailDeletePermission}
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">{isFamilyDetailEditorOpen ? 'Save the form to create the first family record.' : 'No family details added yet.'}</div>
                    )}
                  </div>
                  {isFamilyDetailEditorOpen ? (
                    <div className="col-12 d-flex flex-wrap justify-content-end gap-2">
                      <button type="button" className="btn btn-outline-secondary" onClick={closeFamilyDetailEditor}>
                        Cancel
                      </button>
                      {selectedFamilyDetail && hasFamilyDetailDeletePermission ? (
                        <button type="button" className="btn btn-outline-danger" onClick={handleFamilyDetailDelete} disabled={!hasFamilyDetailDeletePermission}>
                          Delete Family Detail
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-primary" onClick={handleFamilyDetailSave} disabled={!canManageFamilyDetails || !hasPendingFamilyDetail}>
                        {selectedFamilyDetail ? 'Update Family Detail' : 'Save Family Detail'}
                      </button>
                    </div>
                  ) : null}
                  <div className="col-12">
                    <div className="profile-form-divider" />
                  </div>
                  <div className="col-12">
                    <div className="profile-section-heading">Documents</div>
                    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                      <div className="text-muted small">
                        {!canUploadDocuments
                          ? 'Role access for My Documents is disabled. Ask admin to grant that sub-module to upload files.'
                          : (selectedDocument
                            ? 'Saved document is loaded into the form. Update the metadata, replace the file, or add a new document.'
                            : 'Upload the required profile documents after completing skills and family details.')}
                      </div>
                      {documentItems.length ? (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCreateNewDocument} disabled={!canUploadDocuments}>
                          Add New Document
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {documentSetupRequired ? <div className="col-12"><div className="alert alert-warning mb-0 small">This section is mandatory on first login. Upload at least one document and save it to finish onboarding.</div></div> : null}
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
                  <div className="text-muted small">Complete your profile setup by saving at least one skill, one family detail, and one document. Nickname, profile picture, and work experience can be added later.</div>
                ) : null}
                {documentItems.length ? (
                  <div className="d-flex flex-column gap-2">
                    {documentItems.map((document) => (
                      <div key={document.uid} className="profile-doc-item profile-doc-item-modern">
                        <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                          <div className="d-flex flex-column gap-1">
                            <span className="profile-doc-item-title">{document.name || 'Document'}</span>
                            <span className="text-muted small">{document.documentType || 'OTHER'} - {document.uploadDateLabel || '--'} - {formatFileSize(document.fileSize)}</span>
                          </div>
                          <div className="d-flex flex-wrap gap-2 align-items-center">
                            <a href={document.fileUrl || '#'} target="_blank" rel="noreferrer" download={document.name || 'employee-document'} className="btn btn-sm btn-outline-secondary">
                              <DownloadIcon />
                            </a>
                            <button
                              type="button"
                              className={`btn btn-sm ${String(document.uid) === String(selectedDocumentUid) ? 'btn-primary' : 'btn-outline-secondary'}`}
                              onClick={() => {
                                setSelectedDocumentUid(String(document.uid))
                                setDocumentDraft(buildDocumentDraft(document))
                                setDocumentFileInputKey((current) => current + 1)
                              }}
                              disabled={!canUploadDocuments}
                            >
                              {String(document.uid) === String(selectedDocumentUid) ? 'Loaded' : 'Edit'}
                            </button>
                            {canManageDocuments ? (
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDocumentDelete(document)} disabled={!canManageDocuments}>
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted small">No documents uploaded yet.</div>
                )}
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <div className="text-muted small">
                    Save each section separately. Remove a saved skill from the list and save again to delete it.
                  </div>
                  <button type="button" className="btn btn-primary" onClick={handleDocumentSave} disabled={!canUploadDocuments || !hasPendingDocumentChanges}>
                    {selectedDocument ? 'Update Document' : 'Save Document'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ModalFrame
        open={firstLoginSetupRequired && !setupPromptDismissed}
        title="Complete Profile Setup"
        onClose={() => {}}
        dismissible={false}
        hideCloseButton
        closeOnBackdrop={false}
        footer={<button type="button" className="btn btn-primary" onClick={handleCompleteNow}>Complete Now</button>}
      >
        <div className="d-flex flex-column gap-2">
          <div className="fw-semibold">Profile setup is required before the rest of the application is unlocked.</div>
          {mustChangePassword ? <div className="text-muted small">1. Set a new password because the default password is not allowed.</div> : null}
          {mustCompleteProfile ? <div className="text-muted small">2. Complete profile details by saving at least one skill, one family detail, and one document. Nickname, profile picture, and work experience are optional during first login.</div> : null}
          {firstLoginDeadlineLabel
            ? <div className="text-muted small">3. Complete setup by {firstLoginDeadlineLabel} to avoid automatic account disable.</div>
            : <div className="text-warning mt-2 fw-bold medium">Warning: If setup is not completed within 48 hours, the account will be disabled.</div>}
        </div>
      </ModalFrame>
    </div>
  )
}
