import React, { useEffect, useMemo, useState } from 'react'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { DownloadIcon } from '../../../components/common/AppIcons.jsx'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { employeeService } from '../../../api/services/employee.service.js'
import { formatDate } from '../../../utils/employee.js'

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'AADHAAR', label: 'Aadhaar' },
  { value: 'PAN', label: 'PAN' },
  { value: 'OTHER', label: 'Other' }
]

const NEW_DOCUMENT_UID = '__new_document__'
const NEW_FAMILY_DETAIL_UID = '__new_family_detail__'
const NEW_WORK_EXPERIENCE_UID = '__new_work_experience__'

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

function getDocumentDefaultName(documentType) {
  if (documentType === 'AADHAAR') return 'Aadhaar Card'
  if (documentType === 'PAN') return 'PAN Card'
  return ''
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0)
  if (!value) return '--'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
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
    date_of_birth: detail.dateOfBirth || detail.date_of_birth || '',
    phone: detail.phone || '',
    occupation: detail.occupation || '',
    is_dependent: Boolean(detail.isDependent ?? detail.is_dependent),
    address: detail.address || '',
    remarks: detail.remarks || ''
  }
}

function buildFamilyDetailPayload(draft) {
  return {
    relation: String(draft.relation || '').trim(),
    fullName: String(draft.full_name || '').trim(),
    dateOfBirth: String(draft.date_of_birth || '').trim(),
    phone: String(draft.phone || '').trim(),
    occupation: String(draft.occupation || '').trim(),
    isDependent: Boolean(draft.is_dependent),
    address: String(draft.address || '').trim(),
    remarks: String(draft.remarks || '').trim()
  }
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
    start_date: experience.startDate || '',
    end_date: experience.endDate || '',
    is_current: Boolean(experience.isCurrent),
    responsibilities: experience.responsibilities || '',
    last_salary: experience.lastSalary == null ? '' : String(experience.lastSalary),
    reason_for_leaving: experience.reasonForLeaving || '',
    remarks: experience.remarks || ''
  }
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

function buildWorkExperiencePayload(draft) {
  const totalMonths = calculateExperienceMonths(draft.start_date, draft.end_date, draft.is_current)

  return {
    companyName: String(draft.company_name || '').trim(),
    jobTitle: String(draft.job_title || '').trim(),
    employmentType: String(draft.employment_type || '').trim(),
    location: String(draft.location || '').trim(),
    startDate: String(draft.start_date || '').trim(),
    endDate: draft.is_current ? '' : String(draft.end_date || '').trim(),
    isCurrent: Boolean(draft.is_current),
    responsibilities: String(draft.responsibilities || '').trim(),
    yearsOfExperience: totalMonths ? Number((totalMonths / 12).toFixed(2)) : null,
    lastSalary: String(draft.last_salary || '').trim(),
    reasonForLeaving: draft.is_current ? '' : String(draft.reason_for_leaving || '').trim(),
    remarks: String(draft.remarks || '').trim()
  }
}

export default function EmployeeAdditionalDetailsEditor({ employee, profile }) {
  const { showStatus, runWithLoader } = useModal()
  const [localProfile, setLocalProfile] = useState(profile || null)
  const [skillsInput, setSkillsInput] = useState('')
  const [documentDraft, setDocumentDraft] = useState(emptyDocumentDraft())
  const [selectedDocumentUid, setSelectedDocumentUid] = useState('')
  const [documentFileInputKey, setDocumentFileInputKey] = useState(0)
  const [familyDetailDraft, setFamilyDetailDraft] = useState(emptyFamilyDetailDraft())
  const [selectedFamilyDetailUid, setSelectedFamilyDetailUid] = useState('')
  const [isFamilyDetailEditorOpen, setIsFamilyDetailEditorOpen] = useState(false)
  const [workExperienceDraft, setWorkExperienceDraft] = useState(emptyWorkExperienceDraft())
  const [selectedWorkExperienceUid, setSelectedWorkExperienceUid] = useState('')
  const [isWorkExperienceEditorOpen, setIsWorkExperienceEditorOpen] = useState(false)

  useEffect(() => {
    setLocalProfile(profile || null)
    setSkillsInput(normalizeSkills((profile?.skills || []).map((entry) => entry?.skill || '')).join(', '))
  }, [profile])

  useEffect(() => {
    setSelectedDocumentUid('')
    setDocumentDraft(emptyDocumentDraft())
    setDocumentFileInputKey((current) => current + 1)
    setSelectedFamilyDetailUid('')
    setFamilyDetailDraft(emptyFamilyDetailDraft())
    setIsFamilyDetailEditorOpen(false)
    setSelectedWorkExperienceUid('')
    setWorkExperienceDraft(emptyWorkExperienceDraft())
    setIsWorkExperienceEditorOpen(false)
  }, [employee?.uid])

  const documents = localProfile?.documents || []
  const skills = localProfile?.skills || []
  const familyDetails = localProfile?.familyDetails || []
  const workExperiences = localProfile?.workExperiences || []
  const selectedDocument = useMemo(() => documents.find((document) => String(document.uid) === String(selectedDocumentUid)) || null, [documents, selectedDocumentUid])
  const selectedFamilyDetail = useMemo(() => familyDetails.find((detail) => String(detail.uid) === String(selectedFamilyDetailUid)) || null, [familyDetails, selectedFamilyDetailUid])
  const selectedWorkExperience = useMemo(() => workExperiences.find((experience) => String(experience.uid) === String(selectedWorkExperienceUid)) || null, [selectedWorkExperienceUid, workExperiences])
  const totalWorkExperienceMonths = useMemo(() => workExperiences.reduce((total, entry) => total + calculateExperienceMonths(entry.startDate, entry.endDate, entry.isCurrent), 0), [workExperiences])
  const totalWorkExperienceLabel = useMemo(() => {
    if (!totalWorkExperienceMonths) return '0 mo'
    const years = Math.floor(totalWorkExperienceMonths / 12)
    const months = totalWorkExperienceMonths % 12
    if (!years) return `${months} mo`
    if (!months) return `${years} yr`
    return `${years} yr ${months} mo`
  }, [totalWorkExperienceMonths])

  async function refreshProfile() {
    if (!employee?.uid) return null
    const nextProfile = await employeeService.getEmployeeProfile(employee.uid)
    setLocalProfile(nextProfile)
    return nextProfile
  }

  async function handleSkillsSave() {
    if (!employee?.uid) return
    const nextSkills = parseSkillsInput(skillsInput)

    try {
      await runWithLoader(async () => {
        await employeeService.syncEmployeeSkills(employee.uid, nextSkills, skills)
        await refreshProfile()
      }, {
        title: 'Saving skills',
        message: nextSkills.length ? 'Updating employee skills.' : 'Removing employee skills.',
        minVisibleMs: 350
      })

      showStatus({ type: 'success', title: 'Skills updated', message: 'Employee skills have been saved.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Skill update failed', message: error?.response?.data?.detail || error?.message || 'Could not save employee skills.' })
    }
  }

  function openNewFamilyDetail() {
    setSelectedFamilyDetailUid(NEW_FAMILY_DETAIL_UID)
    setFamilyDetailDraft(emptyFamilyDetailDraft())
    setIsFamilyDetailEditorOpen(true)
  }

  function closeFamilyDetailEditor() {
    setSelectedFamilyDetailUid('')
    setFamilyDetailDraft(emptyFamilyDetailDraft())
    setIsFamilyDetailEditorOpen(false)
  }

  async function handleFamilyDetailSave() {
    if (!employee?.uid) return
    if (!String(familyDetailDraft.relation || '').trim() || !String(familyDetailDraft.full_name || '').trim()) {
      showStatus({ type: 'error', title: 'Family detail is incomplete', message: 'Relation and full name are required.' })
      return
    }

    try {
      await runWithLoader(() => (
        selectedFamilyDetail
          ? employeeService.updateEmployeeFamilyDetail(selectedFamilyDetail.uid, buildFamilyDetailPayload(familyDetailDraft))
          : employeeService.createEmployeeFamilyDetail({
            employeeUid: employee.uid,
            ...buildFamilyDetailPayload(familyDetailDraft)
          })
      ), {
        title: selectedFamilyDetail ? 'Updating family detail' : 'Saving family detail',
        message: selectedFamilyDetail ? 'Updating the selected family record.' : 'Creating a new family record.',
        minVisibleMs: 350
      })

      await refreshProfile()
      closeFamilyDetailEditor()
      showStatus({ type: 'success', title: 'Family details updated', message: selectedFamilyDetail ? 'The family record has been updated.' : 'The family record has been added.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Family detail update failed', message: error?.response?.data?.detail || error?.message || 'Could not save the family detail.' })
    }
  }

  async function handleFamilyDetailDelete(detail = selectedFamilyDetail) {
    if (!detail?.uid) return
    if (!window.confirm(`Delete the family detail for ${detail.fullName || detail.relation || 'this record'}?`)) return

    try {
      await runWithLoader(() => employeeService.deleteEmployeeFamilyDetail(detail.uid), {
        title: 'Deleting family detail',
        message: 'Removing the selected family record.',
        minVisibleMs: 350
      })

      await refreshProfile()
      if (String(selectedFamilyDetailUid) === String(detail.uid)) closeFamilyDetailEditor()
      showStatus({ type: 'success', title: 'Family detail deleted', message: 'The family record has been removed.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Family detail delete failed', message: error?.response?.data?.detail || error?.message || 'Could not delete the family detail.' })
    }
  }

  function openNewWorkExperience() {
    setSelectedWorkExperienceUid(NEW_WORK_EXPERIENCE_UID)
    setWorkExperienceDraft(emptyWorkExperienceDraft())
    setIsWorkExperienceEditorOpen(true)
  }

  function closeWorkExperienceEditor() {
    setSelectedWorkExperienceUid('')
    setWorkExperienceDraft(emptyWorkExperienceDraft())
    setIsWorkExperienceEditorOpen(false)
  }

  async function handleWorkExperienceSave() {
    if (!employee?.uid) return
    if (!String(workExperienceDraft.company_name || '').trim() || !String(workExperienceDraft.job_title || '').trim() || !String(workExperienceDraft.start_date || '').trim()) {
      showStatus({ type: 'error', title: 'Work experience is incomplete', message: 'Company name, job title, and start date are required.' })
      return
    }
    if (!workExperienceDraft.is_current && workExperienceDraft.end_date && workExperienceDraft.end_date < workExperienceDraft.start_date) {
      showStatus({ type: 'error', title: 'Work experience has invalid dates', message: 'End date cannot be earlier than start date.' })
      return
    }

    try {
      await runWithLoader(() => (
        selectedWorkExperience
          ? employeeService.updateEmployeeWorkExperience(selectedWorkExperience.uid, buildWorkExperiencePayload(workExperienceDraft))
          : employeeService.createEmployeeWorkExperience({
            employeeUid: employee.uid,
            ...buildWorkExperiencePayload(workExperienceDraft)
          })
      ), {
        title: selectedWorkExperience ? 'Updating work experience' : 'Saving work experience',
        message: selectedWorkExperience ? 'Updating the selected work experience entry.' : 'Creating a new work experience entry.',
        minVisibleMs: 350
      })

      await refreshProfile()
      closeWorkExperienceEditor()
      showStatus({ type: 'success', title: 'Work experience updated', message: selectedWorkExperience ? 'The work experience entry has been updated.' : 'The work experience entry has been added.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Work experience update failed', message: error?.response?.data?.detail || error?.message || 'Could not save the work experience entry.' })
    }
  }

  async function handleWorkExperienceDelete(experience = selectedWorkExperience) {
    if (!experience?.uid) return
    if (!window.confirm(`Delete the work experience for ${experience.companyName || experience.jobTitle || 'this record'}?`)) return

    try {
      await runWithLoader(() => employeeService.deleteEmployeeWorkExperience(experience.uid), {
        title: 'Deleting work experience',
        message: 'Removing the selected work experience entry.',
        minVisibleMs: 350
      })

      await refreshProfile()
      if (String(selectedWorkExperienceUid) === String(experience.uid)) closeWorkExperienceEditor()
      showStatus({ type: 'success', title: 'Work experience deleted', message: 'The work experience entry has been removed.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Work experience delete failed', message: error?.response?.data?.detail || error?.message || 'Could not delete the work experience entry.' })
    }
  }

  function handleCreateNewDocument() {
    setSelectedDocumentUid(NEW_DOCUMENT_UID)
    setDocumentDraft(emptyDocumentDraft())
    setDocumentFileInputKey((current) => current + 1)
  }

  async function handleDocumentSave() {
    if (!employee?.uid) return

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
      await runWithLoader(() => {
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
          employeeUid: employee.uid,
          documentType: documentDraft.documentType,
          name: nextDocumentName,
          file: documentDraft.file
        })
      }, {
        title: selectedDocument ? 'Updating document' : 'Uploading document',
        message: selectedDocument ? 'Saving document changes.' : 'Uploading the selected document.',
        minVisibleMs: 350
      })

      await refreshProfile()
      setSelectedDocumentUid('')
      setDocumentDraft(emptyDocumentDraft())
      setDocumentFileInputKey((current) => current + 1)
      showStatus({ type: 'success', title: selectedDocument ? 'Document updated' : 'Document uploaded', message: selectedDocument ? 'The document has been updated.' : 'The document has been uploaded.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Document save failed', message: error?.response?.data?.detail || error?.message || 'Could not save the document.' })
    }
  }

  async function handleDocumentDelete(document = selectedDocument) {
    if (!document?.uid) return
    if (!window.confirm(`Delete the document "${document.name || 'Document'}"?`)) return

    try {
      await runWithLoader(() => employeeService.deleteEmployeeDocument(document.uid), {
        title: 'Deleting document',
        message: 'Removing the selected document.',
        minVisibleMs: 350
      })

      await refreshProfile()
      if (String(selectedDocumentUid) === String(document.uid)) {
        setSelectedDocumentUid('')
        setDocumentDraft(emptyDocumentDraft())
        setDocumentFileInputKey((current) => current + 1)
      }
      showStatus({ type: 'success', title: 'Document deleted', message: 'The document has been removed.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Document delete failed', message: error?.response?.data?.detail || error?.message || 'Could not delete the document.' })
    }
  }

  if (!employee?.uid) {
    return <div className="text-muted small">Additional details are available only after the employee record exists.</div>
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="text-muted small">Admin can update employee-managed sections here without leaving the entries workflow.</div>
        <span className="profile-pill editable">Experience: {totalWorkExperienceLabel}</span>
      </div>

      <div className="profile-form-section">
        <div className="profile-section-heading">Skills</div>
        <input className="form-control" value={skillsInput} onChange={(event) => setSkillsInput(event.target.value)} placeholder="React, Python, Figma" />
        <div className="form-text">Use comma-separated values and save once.</div>
        <div className="d-flex justify-content-end">
          <button type="button" className="btn btn-primary" onClick={handleSkillsSave}>Save Skills</button>
        </div>
      </div>

      <div className="profile-form-section">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="profile-section-heading">Work Experience</div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={isWorkExperienceEditorOpen ? closeWorkExperienceEditor : openNewWorkExperience}>
            {isWorkExperienceEditorOpen ? 'Close Form' : (workExperiences.length ? 'Add New Experience' : 'Add Work Experience')}
          </button>
        </div>

        {isWorkExperienceEditorOpen ? (
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <label className="form-label">Company Name</label>
              <input className="form-control" value={workExperienceDraft.company_name} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, company_name: event.target.value }))} maxLength="150" />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Job Title</label>
              <input className="form-control" value={workExperienceDraft.job_title} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, job_title: event.target.value }))} maxLength="120" />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Employment Type</label>
              <input className="form-control" value={workExperienceDraft.employment_type} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, employment_type: event.target.value }))} maxLength="50" />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Location</label>
              <input className="form-control" value={workExperienceDraft.location} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, location: event.target.value }))} maxLength="120" />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Start Date</label>
              <input className="form-control" type="date" value={workExperienceDraft.start_date} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, start_date: event.target.value }))} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">End Date</label>
              <input className="form-control" type="date" value={workExperienceDraft.end_date} disabled={workExperienceDraft.is_current} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, end_date: event.target.value }))} />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" id="employee-edit-work-experience-current" checked={workExperienceDraft.is_current} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, is_current: event.target.checked, end_date: event.target.checked ? '' : current.end_date, reason_for_leaving: event.target.checked ? '' : current.reason_for_leaving }))} />
                <label className="form-check-label" htmlFor="employee-edit-work-experience-current">Currently working here</label>
              </div>
            </div>
            <div className="col-12">
              <div className="attendance-note-card mb-0">
                Experience length: <strong>{formatExperienceDuration(workExperienceDraft.start_date, workExperienceDraft.end_date, workExperienceDraft.is_current)}</strong>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Last Salary</label>
              <input className="form-control" value={workExperienceDraft.last_salary} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, last_salary: String(event.target.value).replace(/[^\d.]/g, '') }))} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Reason for Leaving</label>
              <input className="form-control" value={workExperienceDraft.reason_for_leaving} disabled={workExperienceDraft.is_current} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, reason_for_leaving: event.target.value }))} />
            </div>
            <div className="col-12">
              <label className="form-label">Responsibilities</label>
              <textarea className="form-control" rows="3" value={workExperienceDraft.responsibilities} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, responsibilities: event.target.value }))} />
            </div>
            <div className="col-12">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows="2" value={workExperienceDraft.remarks} onChange={(event) => setWorkExperienceDraft((current) => ({ ...current, remarks: event.target.value }))} />
            </div>
            <div className="col-12 d-flex flex-wrap justify-content-end gap-2">
              {selectedWorkExperience ? <button type="button" className="btn btn-outline-danger" onClick={() => handleWorkExperienceDelete(selectedWorkExperience)}>Delete</button> : null}
              <button type="button" className="btn btn-primary" onClick={handleWorkExperienceSave}>{selectedWorkExperience ? 'Update Work Experience' : 'Save Work Experience'}</button>
            </div>
          </div>
        ) : null}

        {workExperiences.length ? (
          <div className="d-flex flex-column gap-2 mt-3">
            {workExperiences.map((experience) => (
              <div key={experience.uid} className="profile-doc-item profile-doc-item-modern">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div className="d-flex flex-column gap-1">
                    <span className="profile-doc-item-title">{experience.companyName || 'Company'}</span>
                    <span className="text-muted small">{[experience.jobTitle || '', experience.employmentType || '', experience.location || ''].filter(Boolean).join(' • ') || 'Work experience entry'}</span>
                    <span className="text-muted small">{[`${formatDate(experience.startDate)} - ${experience.isCurrent ? 'Present' : formatDate(experience.endDate)}`, formatExperienceDuration(experience.startDate, experience.endDate, experience.isCurrent)].join(' • ')}</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedWorkExperienceUid(String(experience.uid)); setWorkExperienceDraft(buildWorkExperienceDraft(experience)); setIsWorkExperienceEditorOpen(true) }}>Edit</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleWorkExperienceDelete(experience)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-muted small mt-3">No work experience added yet.</div>}
      </div>

      <div className="profile-form-section">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="profile-section-heading">Family Details</div>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={isFamilyDetailEditorOpen ? closeFamilyDetailEditor : openNewFamilyDetail}>
            {isFamilyDetailEditorOpen ? 'Close Form' : (familyDetails.length ? 'Add New Record' : 'Add Family Detail')}
          </button>
        </div>

        {isFamilyDetailEditorOpen ? (
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label">Relation</label>
              <input className="form-control" value={familyDetailDraft.relation} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, relation: event.target.value }))} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Full Name</label>
              <input className="form-control" value={familyDetailDraft.full_name} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, full_name: event.target.value }))} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Date of Birth</label>
              <input className="form-control" type="date" value={familyDetailDraft.date_of_birth} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, date_of_birth: event.target.value }))} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Phone</label>
              <input className="form-control" value={familyDetailDraft.phone} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, phone: event.target.value }))} />
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label">Occupation</label>
              <input className="form-control" value={familyDetailDraft.occupation} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, occupation: event.target.value }))} />
            </div>
            <div className="col-12 col-md-4 d-flex align-items-end">
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="employee-edit-family-dependent" checked={familyDetailDraft.is_dependent} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, is_dependent: event.target.checked }))} />
                <label className="form-check-label" htmlFor="employee-edit-family-dependent">Dependent family member</label>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Address</label>
              <textarea className="form-control" rows="2" value={familyDetailDraft.address} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, address: event.target.value }))} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Remarks</label>
              <textarea className="form-control" rows="2" value={familyDetailDraft.remarks} onChange={(event) => setFamilyDetailDraft((current) => ({ ...current, remarks: event.target.value }))} />
            </div>
            <div className="col-12 d-flex flex-wrap justify-content-end gap-2">
              {selectedFamilyDetail ? <button type="button" className="btn btn-outline-danger" onClick={() => handleFamilyDetailDelete(selectedFamilyDetail)}>Delete</button> : null}
              <button type="button" className="btn btn-primary" onClick={handleFamilyDetailSave}>{selectedFamilyDetail ? 'Update Family Detail' : 'Save Family Detail'}</button>
            </div>
          </div>
        ) : null}

        {familyDetails.length ? (
          <div className="d-flex flex-column gap-2 mt-3">
            {familyDetails.map((detail) => (
              <div key={detail.uid} className="profile-doc-item">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div className="d-flex flex-column gap-1">
                    <span className="profile-doc-item-title">{[detail.relation, detail.fullName].filter(Boolean).join(': ') || 'Family detail'}</span>
                    <span className="text-muted small">{[detail.phone || '', detail.occupation || '', detail.isDependent ? 'Dependent' : '', detail.dateOfBirth ? formatDate(detail.dateOfBirth) : ''].filter(Boolean).join(' • ') || 'No extra details'}</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedFamilyDetailUid(String(detail.uid)); setFamilyDetailDraft(buildFamilyDetailDraft(detail)); setIsFamilyDetailEditorOpen(true) }}>Edit</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleFamilyDetailDelete(detail)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-muted small mt-3">No family details added yet.</div>}
      </div>

      <div className="profile-form-section">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="profile-section-heading">Documents</div>
          {documents.length ? <button type="button" className="btn btn-sm btn-outline-secondary" onClick={handleCreateNewDocument}>Add New Document</button> : null}
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label">Document Type</label>
            <AppSelect value={documentDraft.documentType} onChange={(value) => setDocumentDraft((current) => ({ ...current, documentType: value }))} options={DOCUMENT_TYPE_OPTIONS} placeholder="Type" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">Document Name</label>
            <input className="form-control" value={documentDraft.name} onChange={(event) => setDocumentDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Document name" />
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label">File</label>
            <input key={documentFileInputKey} className="form-control" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocumentDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
          <div className="text-muted small">Update metadata only or upload a replacement file for an existing document.</div>
          <button type="button" className="btn btn-primary" onClick={handleDocumentSave}>{selectedDocument ? 'Update Document' : 'Save Document'}</button>
        </div>

        {documents.length ? (
          <div className="d-flex flex-column gap-2 mt-3">
            {documents.map((document) => (
              <div key={document.uid} className="profile-doc-item profile-doc-item-modern">
                <div className="d-flex flex-wrap align-items-start justify-content-between gap-2">
                  <div className="d-flex flex-column gap-1">
                    <span className="profile-doc-item-title">{document.name || 'Document'}</span>
                    <span className="text-muted small">{document.documentType || 'OTHER'} • {document.uploadDateLabel || '--'} • {formatFileSize(document.fileSize)}</span>
                  </div>
                  <div className="d-flex flex-wrap gap-2 align-items-center">
                    <a href={document.fileUrl || '#'} target="_blank" rel="noreferrer" download={document.name || 'employee-document'} className="btn btn-sm btn-outline-secondary">
                      <DownloadIcon />
                    </a>
                    <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedDocumentUid(String(document.uid)); setDocumentDraft(buildDocumentDraft(document)); setDocumentFileInputKey((current) => current + 1) }}>Edit</button>
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDocumentDelete(document)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-muted small mt-3">No documents uploaded yet.</div>}
      </div>
    </div>
  )
}
