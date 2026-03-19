import React, { useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { DownloadIcon, EyeIcon, EyeOffIcon } from '../../../components/common/AppIcons.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { employeeService } from '../../../api/services/employee.service.js'
import { authService } from '../../../api/services/auth.service.js'
import { useEmployeeMetadataQuery } from '../../../hooks/employees/useEmployeeMetadataQuery.js'
import {
  EMPLOYEE_BLOOD_GROUP_OPTIONS,
  EMPLOYEE_GENDER_OPTIONS,
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
    first_name: '',
    last_name: '',
    email: '',
    phone_country_code: defaultPhoneCountry.dialCode,
    phone_local: '',
    position: '',
    skills_input: '',
    department: '',
    join_date: '',
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
    first_name: employee.firstName || '',
    last_name: employee.lastName || '',
    email: employee.email || '',
    phone_country_code: phone.countryDialCode || getDefaultPhoneCountryOption().dialCode,
    phone_local: phone.localNumber || '',
    position: employee.position || '',
    skills_input: normalizeSkills((profile?.skills || []).map((entry) => entry?.skill || '')).join(', '),
    department: employee.department || '',
    join_date: toInputDate(employee.joinDate),
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
    first_name: toNullableString(draft.first_name),
    last_name: toNullableString(draft.last_name),
    email: toNullableString(draft.email),
    phone: toNullableString(buildPhoneValue(draft.phone_country_code, draft.phone_local)),
    position: toNullableString(draft.position),
    skills: parseSkillsInput(draft.skills_input),
    department: toNullableString(draft.department),
    join_date: toNullableString(draft.join_date),
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
      if (skillSignature(value) !== skillSignature(baseline.skills)) changed.skills = value
      return
    }
    if (String(value || '').trim() !== String(baseline[key] || '').trim()) changed[key] = value
  })
  return changed
}

export default function ProfilePage() {
  const { user, syncCurrentUser } = useAuth()
  const { showStatus, runWithLoader } = useModal()
  const { data: metadataEntries = [] } = useEmployeeMetadataQuery()

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

  const mustChangePassword = Boolean(user?.mustChangePassword)
  const mustCompleteProfile = Boolean(user?.mustCompleteProfile)
  const forceActionOpen = mustChangePassword || mustCompleteProfile
  const canEditDetails = Boolean(profile?.canEditProfileDetails)
  const hasLinkedEmployee = Boolean(profile?.employee?.uid)
  const documentItems = profile?.documents || []
  const setupTarget = mustChangePassword ? 'password' : 'profile'
  const ageLabel = formatEmployeeAge(profileDraft.birth_date)

  useEffect(() => {
    if (!forceActionOpen) setSetupPromptDismissed(false)
  }, [forceActionOpen])

  useEffect(() => {
    let isMounted = true
    async function loadProfile() {
      setLoading(true)
      try {
        const nextProfile = await employeeService.getMyProfile()
        if (!isMounted) return
        setProfile(nextProfile)
        setProfileDraft(buildDraftFromProfile(nextProfile))
        setProfileUnavailable(false)
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

  const avatarUrl = useMemo(() => photoPreviewUrl || profile?.profileImageUrl || user?.avatarUrl || '', [photoPreviewUrl, profile?.profileImageUrl, user?.avatarUrl])

  function updateUserFromProfile(nextProfile, overrides = {}) {
    const hasEmployeeLink = Boolean(nextProfile?.employee?.uid)
    const fallbackFirstName = nextProfile?.employee?.firstName || user?.firstName || 'User'
    syncCurrentUser({
      ...user,
      nickname: nextProfile?.nickname ?? user?.nickname ?? '',
      displayName: nextProfile?.nickname || fallbackFirstName,
      avatarUrl: nextProfile?.profileImageUrl || user?.avatarUrl || '',
      profileImageUrl: nextProfile?.profileImageUrl || user?.profileImageUrl || '',
      canEditProfileDetails: nextProfile?.canEditProfileDetails ?? user?.canEditProfileDetails ?? true,
      mustCompleteProfile: hasEmployeeLink ? !nextProfile?.profileCompletedAt : false,
      mustChangePassword: nextProfile?.mustChangePassword ?? user?.mustChangePassword ?? false,
      ...overrides
    })
  }

  function handleProfileFieldChange(event) {
    const { name } = event.target
    let { value } = event.target
    if (name === 'phone_local' || name === 'emergency_contact_local') value = String(value).replace(/\D/g, '').slice(0, 15)
    setProfileDraft((current) => ({ ...current, [name]: value }))
  }

  async function handleProfileSave() {
    if (profileUnavailable) return
    const changedFields = pickChangedFields(profileDraft, profile)
    const hasDetailsChange = Object.keys(changedFields).some((field) => field !== 'nickname')
    if (!Object.keys(changedFields).length) {
      showStatus({ type: 'error', title: 'No changes detected', message: 'Update at least one profile field before saving.' })
      return
    }
    if (hasDetailsChange && !canEditDetails) {
      showStatus({ type: 'error', title: 'Profile details locked', message: 'Only nickname, profile photo, and password can be changed right now.' })
      return
    }
    try {
      const nextProfile = await runWithLoader(() => employeeService.updateMyProfile(changedFields), {
        title: 'Saving profile',
        message: 'Updating your profile details.',
        minVisibleMs: 500
      })
      setProfile(nextProfile)
      setProfileDraft(buildDraftFromProfile(nextProfile))
      updateUserFromProfile(nextProfile, { mustCompleteProfile: Boolean(!nextProfile.profileCompletedAt) })
      showStatus({ type: 'success', title: 'Profile updated', message: 'Your profile information has been saved.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Profile update failed', message: error?.response?.data?.detail || error?.message || 'Profile update request failed.' })
    }
  }

  async function handlePhotoUpload() {
    if (!photoFile) {
      showStatus({ type: 'error', title: 'No file selected', message: 'Select an image before uploading.' })
      return
    }
    try {
      const nextProfile = await runWithLoader(() => employeeService.uploadMyProfilePhoto(photoFile), {
        title: 'Uploading photo',
        message: 'Updating your profile image.',
        minVisibleMs: 550
      })
      setPhotoFile(null)
      setProfile(nextProfile)
      updateUserFromProfile(nextProfile)
      showStatus({ type: 'success', title: 'Profile photo updated', message: 'Your profile picture has been updated.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Photo upload failed', message: error?.response?.data?.detail || error?.message || 'Could not upload profile image.' })
    }
  }

  async function handleDocumentUpload() {
    if (!hasLinkedEmployee) {
      showStatus({ type: 'error', title: 'Employee profile missing', message: 'No employee record is linked to this account.' })
      return
    }
    if (!canEditDetails) {
      showStatus({ type: 'error', title: 'Profile details locked', message: 'Document uploads are locked. Contact admin to unlock profile editing.' })
      return
    }
    if (!documentDraft.file) {
      showStatus({ type: 'error', title: 'File required', message: 'Choose a document file before uploading.' })
      return
    }
    const normalizedName = documentDraft.name.trim() || (documentDraft.documentType === 'AADHAAR' ? 'Aadhaar Card' : (documentDraft.documentType === 'PAN' ? 'PAN Card' : ''))
    if (!normalizedName) {
      showStatus({ type: 'error', title: 'Document name required', message: 'Enter a name for the uploaded document.' })
      return
    }
    try {
      const nextProfile = await runWithLoader(() => employeeService.uploadEmployeeDocument({
        documentType: documentDraft.documentType,
        name: normalizedName,
        file: documentDraft.file
      }), {
        title: 'Uploading document',
        message: 'Saving your document securely.',
        minVisibleMs: 550
      })
      setProfile(nextProfile)
      setDocumentDraft({ documentType: 'OTHER', name: '', file: null })
      setDocumentFileInputKey((current) => current + 1)
      updateUserFromProfile(nextProfile)
      showStatus({ type: 'success', title: 'Document uploaded', message: 'Your document is now available in the Documents section.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Document upload failed', message: error?.response?.data?.detail || error?.message || 'Could not upload this document.' })
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
    const payload = { new_password: passwordDraft.new_password, confirm_new_password: passwordDraft.confirm_new_password }
    if (passwordDraft.current_password) payload.current_password = passwordDraft.current_password
    try {
      await runWithLoader(() => authService.changePassword(payload), {
        title: 'Changing password',
        message: 'Securing your account with the updated password.',
        minVisibleMs: 600
      })
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
        <PageHeader title="My Profile" tagline="Manage your account details, profile identity, and password." />
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
      <PageHeader title="My Profile" tagline="Manage your account details, profile identity, and password." />

      <div className="profile-hero card border-0 shadow-sm">
        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <div className="profile-hero-eyebrow">Account Workspace</div>
            <div className="profile-hero-title">{profileDraft.nickname || profileDraft.first_name || user?.firstName || 'User'}</div>
            <div className="text-muted small">Keep your identity, details, and security settings up to date.</div>
          </div>
          <div className="d-flex flex-column align-items-lg-end gap-2">
            <span className={`profile-pill ${canEditDetails ? 'editable' : 'locked'}`}>{canEditDetails ? 'Profile editing enabled' : 'Profile editing locked'}</span>
            {profile?.profileCompletedAt ? <span className="text-muted small">Completed on {formatDate(profile.profileCompletedAt)}</span> : null}
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm profile-panel profile-identity-panel h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div className="profile-section-heading">Profile Identity</div>
              <div className="profile-photo-preview profile-photo-modern">
                {avatarUrl ? <img src={avatarUrl} alt="Profile avatar" /> : <span>{String(user?.displayName || user?.firstName || 'U').charAt(0).toUpperCase()}</span>}
              </div>
              <div>
                <label className="form-label">Nickname</label>
                <input className="form-control" name="nickname" value={profileDraft.nickname} onChange={handleProfileFieldChange} maxLength="120" placeholder="Set your nickname" />
                <div className="form-text">Header will display nickname. Fallback is first name.</div>
              </div>
              <div>
                <label className="form-label">Profile Image</label>
                <input className="form-control" type="file" accept="image/*" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
              </div>
              <button type="button" className="btn btn-primary profile-action-btn" onClick={handlePhotoUpload}>Upload Photo</button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div id="profile-details-section" className={`card border-0 shadow-sm profile-panel h-100${activeSetupTarget === 'profile' ? ' setup-target-active' : ''}`}>
            <div className="card-body d-flex flex-column gap-3">
              <div>
                <div className="profile-section-heading">Basic Details</div>
                <div className="text-muted small">Structure matches employee entries, including dropdown masters and phone formatting.</div>
              </div>
              {profileUnavailable ? (
                <div className="text-muted small">No employee profile is linked with this account yet. You can still update nickname, photo, and password.</div>
              ) : (
                <div className="row g-3">
                  <div className="col-12 col-md-6"><label className="form-label">First Name</label><input className="form-control" name="first_name" value={profileDraft.first_name} onChange={handleProfileFieldChange} disabled={!canEditDetails} maxLength="120" /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Last Name</label><input className="form-control" name="last_name" value={profileDraft.last_name} onChange={handleProfileFieldChange} disabled={!canEditDetails} maxLength="120" /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Email</label><input className="form-control" type="email" name="email" value={profileDraft.email} onChange={handleProfileFieldChange} disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Mobile Number</label>
                    <div className="phone-input-shell">
                      <AppSelect name="phone_country_code" value={profileDraft.phone_country_code} onChange={handleProfileFieldChange} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" disabled={!canEditDetails} />
                      <input className="form-control" name="phone_local" value={profileDraft.phone_local} onChange={handleProfileFieldChange} inputMode="numeric" placeholder="Enter mobile number" minLength="6" maxLength="15" pattern="[0-9]{6,15}" disabled={!canEditDetails} />
                    </div>
                  </div>
                  <div className="col-12 col-md-6"><label className="form-label">Position</label><AppSelect name="position" value={profileDraft.position} onChange={handleProfileFieldChange} options={positionOptions} placeholder="Select position" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Skills (Manual Entry)</label>
                    <input className="form-control" name="skills_input" value={profileDraft.skills_input} onChange={handleProfileFieldChange} placeholder="React, Python, Figma" disabled={!canEditDetails} />
                    <div className="form-text">Use comma-separated values. This is saved with your profile details.</div>
                  </div>
                  <div className="col-12 col-md-6"><label className="form-label">Department</label><AppSelect name="department" value={profileDraft.department} onChange={handleProfileFieldChange} options={departmentOptions} placeholder="Select department" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Join Date</label><input className="form-control" type="date" name="join_date" value={profileDraft.join_date} onChange={handleProfileFieldChange} disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Date of Birth</label><input className="form-control" type="date" name="birth_date" value={profileDraft.birth_date} onChange={handleProfileFieldChange} disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Age</label><input className="form-control" disabled value={ageLabel} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Gender</label><AppSelect name="gender" value={profileDraft.gender} onChange={handleProfileFieldChange} options={genderOptions} placeholder="Select gender" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Caste</label><input className="form-control" name="caste" value={profileDraft.caste} onChange={handleProfileFieldChange} maxLength="120" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Employee Type</label><AppSelect name="employee_type" value={profileDraft.employee_type} onChange={handleProfileFieldChange} options={employeeTypeOptions} placeholder="Select type" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Work Location</label><AppSelect name="work_location" value={profileDraft.work_location} onChange={handleProfileFieldChange} options={workLocationOptions} placeholder="Select work location" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6"><label className="form-label">Blood Group</label><AppSelect name="blood_group" value={profileDraft.blood_group} onChange={handleProfileFieldChange} options={bloodGroupOptions} placeholder="Select blood group" disabled={!canEditDetails} /></div>
                  <div className="col-12 col-md-6">
                    <label className="form-label">Emergency Contact</label>
                    <div className="phone-input-shell">
                      <AppSelect name="emergency_contact_country_code" value={profileDraft.emergency_contact_country_code} onChange={handleProfileFieldChange} options={phoneCountryOptions} placeholder="Code" className="phone-country-select" disabled={!canEditDetails} />
                      <input className="form-control" name="emergency_contact_local" value={profileDraft.emergency_contact_local} onChange={handleProfileFieldChange} inputMode="numeric" placeholder="Enter emergency contact number" maxLength="15" pattern="[0-9]{0,15}" disabled={!canEditDetails} />
                    </div>
                  </div>
                  <div className="col-12"><label className="form-label">Address</label><textarea className="form-control" rows="3" name="address" value={profileDraft.address} onChange={handleProfileFieldChange} disabled={!canEditDetails} /></div>
                </div>
              )}
              {!canEditDetails ? <div className="text-muted small">Profile detail edits are locked after submission. Admin can unlock from Employee Requests when updates are required.</div> : null}
              <button type="button" className="btn btn-primary profile-action-btn align-self-start" onClick={handleProfileSave}>Save Profile</button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div id="profile-password-section" className={`card border-0 shadow-sm profile-panel h-100${activeSetupTarget === 'password' ? ' setup-target-active' : ''}`}>
            <div className="card-body d-flex flex-column gap-3">
              <div>
                <div className="profile-section-heading">Change Password</div>
                <div className="text-muted small">{mustChangePassword ? 'Default password detected. Set a new password to continue.' : 'Enter old password and set a new one.'}</div>
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
              <div>
                <label className="form-label">Confirm New Password</label>
                <div className="input-group">
                  <input className="form-control" type={passwordVisibility.confirm_new_password ? 'text' : 'password'} value={passwordDraft.confirm_new_password} onChange={(event) => setPasswordDraft((current) => ({ ...current, confirm_new_password: event.target.value }))} />
                  <button type="button" className="btn btn-outline-secondary" onClick={() => togglePasswordVisibility('confirm_new_password')}>{passwordVisibility.confirm_new_password ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
              </div>
              <button type="button" className="btn btn-primary profile-action-btn align-self-start" onClick={handlePasswordChange}>Update Password</button>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm profile-panel h-100">
            <div className="card-body d-flex flex-column gap-3">
              <div>
                <div className="profile-section-heading">Employee Documents</div>
                <div className="text-muted small">Upload and download your profile documents.</div>
              </div>
              <div className="profile-document-form row g-2">
                <div className="col-12 col-md-4">
                  <label className="form-label">Type</label>
                  <AppSelect value={documentDraft.documentType} onChange={(event) => setDocumentDraft((current) => ({ ...current, documentType: event.target.value }))} options={DOCUMENT_TYPE_OPTIONS} placeholder="Type" disabled={!canEditDetails || !hasLinkedEmployee} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Name</label>
                  <input className="form-control" value={documentDraft.name} onChange={(event) => setDocumentDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Document name" disabled={!canEditDetails || !hasLinkedEmployee} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">File</label>
                  <input key={documentFileInputKey} className="form-control" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocumentDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))} disabled={!canEditDetails || !hasLinkedEmployee} />
                </div>
              </div>
              <button type="button" className="btn btn-primary profile-action-btn align-self-start" onClick={handleDocumentUpload} disabled={!canEditDetails || !hasLinkedEmployee}>Upload Document</button>
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
            </div>
          </div>
        </div>
      </div>

      <ModalFrame
        open={forceActionOpen && !setupPromptDismissed}
        title="Action Required"
        onClose={() => {}}
        dismissible={false}
        hideCloseButton
        closeOnBackdrop={false}
        footer={<button type="button" className="btn btn-primary" onClick={handleCompleteNow}>Complete Now</button>}
      >
        <div className="d-flex flex-column gap-2">
          <div className="fw-semibold">First-time setup is mandatory.</div>
          {mustChangePassword ? <div className="text-muted small">1. Set a new password because the default password is not allowed.</div> : null}
          {mustCompleteProfile ? <div className="text-muted small">2. Submit your profile details to complete onboarding.</div> : null}
          <div className="text-muted small">Profile and password completion is required before continuing regular work.</div>
        </div>
      </ModalFrame>
    </div>
  )
}
