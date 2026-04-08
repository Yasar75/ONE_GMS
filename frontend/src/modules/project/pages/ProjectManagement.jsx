import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import { FilterIcon, PencilIcon, PlusIcon, TrashIcon, ViewIcon, XIcon } from '../../../components/common/AppIcons.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'
import { AttendanceTabs } from '../../attendance/components/AttendanceShared.jsx'
import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { useProjectsQuery, PROJECTS_QUERY_KEY } from '../../../hooks/project/useProjectsQuery.js'
import { projectService } from '../../../api/services/project.service.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  filterAccessibleTabs,
  hasModulePermission,
  hasModuleVisibility,
  resolveAccessibleTab
} from '../../../utils/permissions.js'
import { filterCollectionByQuery } from '../../../utils/search.js'
import { getDateRangeValidationMessage, getRequiredFieldMessage, hasValidationErrors, markFieldsTouched } from '../../../utils/validation.js'

const TAB_ITEMS = [
  { key: 'create', label: 'Create Project', helper: 'Project API based entry and management' },
  { key: 'mapping', label: 'Project Mapping', helper: 'Select project and add manual mapping fields' }
]

const PROJECT_STATUS_OPTIONS = ['Draft', 'Planned', 'Active', 'On Hold', 'Completed', 'Terminated']
const PROJECT_FORM_REQUIRED_FIELDS = ['projectCode', 'projectName']
const PROJECT_MANUAL_MAPPING_STORAGE_PREFIX = 'one_gms.project.manual-mapping.v1'

function formatDate(value) {
  if (!value) return '—'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return String(value)
  return parsedDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

function formatDateTime(value) {
  if (!value) return '—'
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) return String(value)
  return parsedDate.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function toProjectStatusTone(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'active') return 'green'
  if (normalized === 'planned' || normalized === 'draft') return 'blue'
  if (normalized === 'on hold') return 'amber'
  if (normalized === 'completed') return 'teal'
  if (normalized === 'terminated') return 'red'
  return 'gray'
}

function getManualMappingStorageKey(user) {
  const scope = String(user?.uid || user?.email || 'global').trim().toLowerCase()
  return `${PROJECT_MANUAL_MAPPING_STORAGE_PREFIX}.${scope}`
}

function readManualMappings(storageKey) {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(storageKey)
    const parsedValue = rawValue ? JSON.parse(rawValue) : {}
    if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) return {}

    return Object.entries(parsedValue).reduce((accumulator, [projectUid, mapping]) => {
      if (!projectUid || !mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return accumulator

      accumulator[projectUid] = {
        manager: String(mapping.manager || '').trim(),
        podLead: String(mapping.podLead || '').trim()
      }
      return accumulator
    }, {})
  } catch {
    return {}
  }
}

function writeManualMappings(storageKey, mappings) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(mappings || {}))
  } catch {
    // Best-effort local mapping persistence.
  }
}

function createProjectDraft(project = null) {
  return {
    projectCode: project?.projectCode || '',
    projectName: project?.projectName || '',
    description: project?.description || '',
    startDate: project?.startDate || '',
    endDate: project?.endDate || '',
    status: project?.status || ''
  }
}

function createMappingDraft(project = null) {
  return {
    projectUid: project?.uid || '',
    manager: project?.manager || '',
    podLead: project?.podLead || ''
  }
}

function buildProjectErrors(draft) {
  return {
    projectCode: getRequiredFieldMessage(draft.projectCode, 'Project code'),
    projectName: getRequiredFieldMessage(draft.projectName, 'Project name'),
    endDate: getDateRangeValidationMessage(draft.startDate, draft.endDate, {
      startLabel: 'Start date',
      endLabel: 'End date'
    })
  }
}

function buildMappingErrors(draft) {
  return {
    projectUid: getRequiredFieldMessage(draft.projectUid, 'Project')
  }
}

function buildStatusFilterOptions(projects = []) {
  const discoveredStatuses = Array.from(new Set([
    ...PROJECT_STATUS_OPTIONS,
    ...projects.map((project) => String(project.status || '').trim()).filter(Boolean)
  ]))

  return [
    { value: 'All', label: 'All statuses', description: 'No filter applied' },
    ...discoveredStatuses.map((value) => ({ value, label: value, description: `${value} projects` }))
  ]
}

function buildProjectOptions(projects = [], allLabel = 'All projects', allDescription = 'No filter applied') {
  const uniqueProjects = Array.from(new Map(
    (Array.isArray(projects) ? projects : []).map((project) => [String(project.uid), project])
  ).values())

  return [
    { value: 'All', label: allLabel, description: allDescription },
    ...uniqueProjects.map((project) => ({
      value: project.uid,
      label: `${project.projectName} (${project.projectCode})`,
      description: project.status || 'Status not set'
    }))
  ]
}

function getTimelineState(project) {
  const hasStartDate = Boolean(project?.startDate)
  const hasEndDate = Boolean(project?.endDate)

  if (hasStartDate && hasEndDate) return 'Complete'
  if (!hasStartDate && !hasEndDate) return 'Missing Both'
  if (!hasStartDate) return 'Missing Start'
  if (!hasEndDate) return 'Missing End'
  return 'Complete'
}

function getMappingState(project) {
  const hasManager = Boolean(String(project?.manager || '').trim())
  const hasPodLead = Boolean(String(project?.podLead || '').trim())

  if (hasManager && hasPodLead) return 'Fully Mapped'
  if (hasManager) return 'Manager Only'
  if (hasPodLead) return 'Pod Lead Only'
  return 'Unmapped'
}

function ProjectMetricCard({ title, value, helper, tone = 'blue' }) {
  return (
    <div className="card border-0 shadow-sm employee-metric-card h-100">
      <div className={`employee-metric-accent tone-${tone}`} />
      <div className="card-body">
        <div className="text-muted small mb-2">{title}</div>
        <div className="fs-4 fw-bold mb-1">{value}</div>
        <div className="small text-muted">{helper}</div>
      </div>
    </div>
  )
}

function ProjectFormModal({
  open,
  mode,
  draft,
  errors,
  touched,
  onChange,
  onBlur,
  onClose,
  onSubmit
}) {
  const statusOptions = [
    { value: '', label: 'Not set', description: 'No status selected' },
    ...PROJECT_STATUS_OPTIONS.map((value) => ({ value, label: value }))
  ]

  return (
    <ModalFrame
      open={open}
      title={mode === 'create' ? 'Create Project' : 'Edit Project'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>
            {mode === 'create' ? 'Create Project' : 'Save Changes'}
          </button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <label className="form-label">Project Code</label>
          <input
            type="text"
            name="projectCode"
            className={`form-control${touched.projectCode && errors.projectCode ? ' is-invalid' : ''}`}
            value={draft.projectCode}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Enter project code"
          />
          {touched.projectCode && errors.projectCode ? <div className="invalid-feedback d-block">{errors.projectCode}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Project Name</label>
          <input
            type="text"
            name="projectName"
            className={`form-control${touched.projectName && errors.projectName ? ' is-invalid' : ''}`}
            value={draft.projectName}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Enter project name"
          />
          {touched.projectName && errors.projectName ? <div className="invalid-feedback d-block">{errors.projectName}</div> : null}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Status</label>
          <AppSelect
            name="status"
            value={draft.status}
            onChange={onChange}
            onBlur={onBlur}
            options={statusOptions}
            placeholder="Select status"
          />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">Start Date</label>
          <input type="date" name="startDate" className="form-control" value={draft.startDate} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label">End Date</label>
          <input
            type="date"
            name="endDate"
            className={`form-control${touched.endDate && errors.endDate ? ' is-invalid' : ''}`}
            value={draft.endDate}
            onChange={onChange}
            onBlur={onBlur}
          />
          {touched.endDate && errors.endDate ? <div className="invalid-feedback d-block">{errors.endDate}</div> : null}
        </div>
        <div className="col-12">
          <label className="form-label">Description</label>
          <textarea
            rows="4"
            name="description"
            className="form-control"
            value={draft.description}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Add project notes or scope details."
          />
        </div>
      </div>
    </ModalFrame>
  )
}

function ProjectMappingModal({
  open,
  mode,
  draft,
  errors,
  touched,
  projectOptions,
  onChange,
  onBlur,
  onClose,
  onSubmit
}) {
  return (
    <ModalFrame
      open={open}
      title={mode === 'edit' ? 'Edit Project Mapping' : 'Add Project Mapping'}
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={onSubmit}>Save Mapping</button>
        </>
      )}
    >
      <div className="row g-3">
        <div className="col-12 col-lg-4">
          <label className="form-label">Project</label>
          <AppSelect
            name="projectUid"
            value={draft.projectUid}
            onChange={onChange}
            onBlur={onBlur}
            options={projectOptions.filter((option) => option.value !== 'All')}
            placeholder="Select project"
            invalid={Boolean(touched.projectUid && errors.projectUid)}
          />
          {touched.projectUid && errors.projectUid ? <div className="invalid-feedback d-block">{errors.projectUid}</div> : null}
        </div>
        <div className="col-12 col-md-6 col-lg-4">
          <label className="form-label">Manager (Manual)</label>
          <input
            type="text"
            name="manager"
            className="form-control"
            value={draft.manager}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Enter manager"
          />
        </div>
        <div className="col-12 col-md-6 col-lg-4">
          <label className="form-label">Pod Lead (Manual)</label>
          <input
            type="text"
            name="podLead"
            className="form-control"
            value={draft.podLead}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="Enter pod lead"
          />
        </div>
      </div>
    </ModalFrame>
  )
}

function ProjectViewModal({ project, onClose }) {
  return (
    <ModalFrame
      open={Boolean(project)}
      title="Project Mapping Details"
      onClose={onClose}
      size="lg"
      footer={<button type="button" className="btn btn-outline-secondary" onClick={onClose}>Close</button>}
    >
      {project ? (
        <div className="row g-3">
          {[
            ['Project Code', project.projectCode],
            ['Project Name', project.projectName],
            ['Status', project.status || '—'],
            ['Manager (Manual)', project.manager || '—'],
            ['Pod Lead (Manual)', project.podLead || '—'],
            ['Start Date', formatDate(project.startDate)],
            ['End Date', formatDate(project.endDate)],
            ['Created At', formatDateTime(project.createdAt)],
            ['Updated At', formatDateTime(project.updatedAt)]
          ].map(([label, value]) => (
            <div className="col-12 col-md-6" key={label}>
              <div className="attendance-detail-label">{label}</div>
              <div className="attendance-detail-value">{value || '—'}</div>
            </div>
          ))}
          <div className="col-12">
            <div className="attendance-detail-label">Description</div>
            <div className="attendance-detail-value">{project.description || '—'}</div>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

export default function ProjectManagement() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const { user } = useAuth()

  const canViewProjects = hasModuleVisibility(user, PERMISSION_MODULES.project)
  const canCreateProjects = hasModulePermission(user, PERMISSION_MODULES.project, PERMISSION_ACTIONS.create)
  const canUpdateProjects = hasModulePermission(user, PERMISSION_MODULES.project, PERMISSION_ACTIONS.update)
  const canDeleteProjects = hasModulePermission(user, PERMISSION_MODULES.project, PERMISSION_ACTIONS.delete)

  const requestedTab = searchParams.get('tab')
  const defaultTab = 'create'
  const [activeTab, setActiveTab] = useState(() => requestedTab || defaultTab)
  const [projectSearch, setProjectSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [timelineFilter, setTimelineFilter] = useState('All')
  const [projectFilter, setProjectFilter] = useState('All')
  const [mappingSearch, setMappingSearch] = useState('')
  const [mappingStatusFilter, setMappingStatusFilter] = useState('All')
  const [mappingProjectFilter, setMappingProjectFilter] = useState('All')
  const [mappingStateFilter, setMappingStateFilter] = useState('All')

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectDraft, setProjectDraft] = useState(() => createProjectDraft())
  const [projectTouched, setProjectTouched] = useState({})
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false)
  const [mappingMode, setMappingMode] = useState('create')
  const [mappingDraft, setMappingDraft] = useState(() => createMappingDraft())
  const [mappingTouched, setMappingTouched] = useState({})
  const [viewProject, setViewProject] = useState(null)

  const manualMappingStorageKey = useMemo(() => getManualMappingStorageKey(user), [user])
  const [manualMappings, setManualMappings] = useState(() => readManualMappings(manualMappingStorageKey))

  const {
    data: projectsResponse = { items: [], total: 0 },
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useProjectsQuery(canViewProjects)

  const availableTabs = useMemo(() => filterAccessibleTabs(TAB_ITEMS, (tabKey) => {
    if (tabKey === 'create') return canViewProjects
    if (tabKey === 'mapping') return canViewProjects
    return false
  }), [canViewProjects])

  const updateTabSearchParam = useCallback((nextTab) => {
    setSearchParams((current) => {
      const nextParams = new URLSearchParams(current)
      if (nextTab) nextParams.set('tab', nextTab)
      else nextParams.delete('tab')
      return nextParams
    }, { replace: true })
  }, [setSearchParams])

  const handleTabChange = useCallback((nextTab) => {
    setActiveTab(nextTab)
    updateTabSearchParam(nextTab)
  }, [updateTabSearchParam])

  const projects = useMemo(() => {
    const backendItems = Array.isArray(projectsResponse?.items) ? projectsResponse.items : []
    return backendItems.map((project) => {
      const manualFields = manualMappings[String(project.uid || '')] || {}
      return {
        ...project,
        manager: String(manualFields.manager || '').trim(),
        podLead: String(manualFields.podLead || '').trim()
      }
    })
  }, [manualMappings, projectsResponse?.items])

  const statusFilterOptions = useMemo(() => buildStatusFilterOptions(projects), [projects])
  const projectOptions = useMemo(() => buildProjectOptions(projects, 'All projects', 'No filter applied'), [projects])
  const timelineFilterOptions = useMemo(() => ([
    { value: 'All', label: 'All timelines', description: 'No filter applied' },
    { value: 'Complete', label: 'Complete', description: 'Both start and end date are present' },
    { value: 'Missing Start', label: 'Missing start date', description: 'Start date is not available' },
    { value: 'Missing End', label: 'Missing end date', description: 'End date is not available' },
    { value: 'Missing Both', label: 'Missing both dates', description: 'Both dates are missing' }
  ]), [])
  const mappingStateFilterOptions = useMemo(() => ([
    { value: 'All', label: 'All mappings', description: 'No filter applied' },
    { value: 'Fully Mapped', label: 'Fully mapped', description: 'Manager and pod lead are set' },
    { value: 'Manager Only', label: 'Manager only', description: 'Only manager is set' },
    { value: 'Pod Lead Only', label: 'Pod lead only', description: 'Only pod lead is set' },
    { value: 'Unmapped', label: 'Unmapped', description: 'No manager or pod lead set' }
  ]), [])
  const deferredProjectSearch = useDeferredValue(projectSearch)
  const deferredMappingSearch = useDeferredValue(mappingSearch)
  const projectErrors = useMemo(() => buildProjectErrors(projectDraft), [projectDraft])
  const mappingErrors = useMemo(() => buildMappingErrors(mappingDraft), [mappingDraft])

  const filteredProjects = useMemo(() => filterCollectionByQuery(projects, deferredProjectSearch, [
    'projectCode',
    'projectName',
    'description',
    'status'
  ]).filter((project) => {
    const matchesStatus = statusFilter === 'All' || String(project.status || '') === String(statusFilter)
    const timelineState = getTimelineState(project)
    const matchesTimeline = timelineFilter === 'All' || timelineState === timelineFilter
    const matchesProject = projectFilter === 'All' || String(project.uid || '') === String(projectFilter)
    return matchesStatus && matchesTimeline && matchesProject
  }), [deferredProjectSearch, projectFilter, projects, statusFilter, timelineFilter])

  const mappingRows = useMemo(() => filterCollectionByQuery(projects, deferredMappingSearch, [
    'projectCode',
    'projectName',
    'status',
    'manager',
    'podLead'
  ]).filter((project) => {
    const matchesStatus = mappingStatusFilter === 'All' || String(project.status || '') === String(mappingStatusFilter)
    const matchesProject = mappingProjectFilter === 'All' || String(project.uid || '') === String(mappingProjectFilter)
    const matchesMappingState = mappingStateFilter === 'All' || getMappingState(project) === mappingStateFilter
    return matchesStatus && matchesProject && matchesMappingState
  }), [deferredMappingSearch, mappingProjectFilter, mappingStateFilter, mappingStatusFilter, projects])

  const { items: sortedProjects, sortConfig, requestSort } = useSortableData(filteredProjects, {
    initialKey: 'project',
    initialDirection: 'asc',
    accessors: {
      project: (project) => `${project.projectName || ''} ${project.projectCode || ''}`.trim(),
      status: (project) => project.status || '',
      timeline: (project) => `${project.startDate || ''} ${project.endDate || ''}`.trim(),
      updated: (project) => project.updatedAt || project.createdAt || ''
    }
  })
  const {
    items: sortedMappingRows,
    sortConfig: mappingSortConfig,
    requestSort: requestMappingSort
  } = useSortableData(mappingRows, {
    initialKey: 'project',
    initialDirection: 'asc',
    accessors: {
      project: (project) => `${project.projectName || ''} ${project.projectCode || ''}`.trim(),
      status: (project) => project.status || '',
      mapping: (project) => `${project.manager || ''} ${project.podLead || ''}`.trim(),
      updated: (project) => project.updatedAt || project.createdAt || ''
    }
  })

  const metrics = useMemo(() => {
    const active = projects.filter((project) => String(project.status || '').trim().toLowerCase() === 'active').length
    const planned = projects.filter((project) => ['planned', 'draft'].includes(String(project.status || '').trim().toLowerCase())).length
    const mapped = projects.filter((project) => project.manager || project.podLead).length
    const unscheduled = projects.filter((project) => !project.startDate || !project.endDate).length

    return { active, planned, mapped, unscheduled }
  }, [projects])

  useEffect(() => {
    setManualMappings(readManualMappings(manualMappingStorageKey))
  }, [manualMappingStorageKey])

  useEffect(() => {
    writeManualMappings(manualMappingStorageKey, manualMappings)
  }, [manualMappingStorageKey, manualMappings])

  useEffect(() => {
    if (requestedTab && requestedTab !== activeTab) {
      setActiveTab(requestedTab)
    }
  }, [activeTab, requestedTab])

  useEffect(() => {
    const nextTab = resolveAccessibleTab(availableTabs, activeTab, (tabKey) => {
      if (tabKey === 'create') return canViewProjects
      if (tabKey === 'mapping') return canViewProjects
      return false
    }, defaultTab)

    if (!nextTab) return
    if (nextTab !== activeTab) setActiveTab(nextTab)
    if (requestedTab !== nextTab) updateTabSearchParam(nextTab)
  }, [activeTab, availableTabs, canViewProjects, requestedTab, updateTabSearchParam])

  function resetFilters() {
    setProjectSearch('')
    setStatusFilter('All')
    setTimelineFilter('All')
    setProjectFilter('All')
  }

  function resetMappingFilters() {
    setMappingSearch('')
    setMappingStatusFilter('All')
    setMappingProjectFilter('All')
    setMappingStateFilter('All')
  }

  function resetMappingComposer() {
    setMappingDraft(createMappingDraft())
    setMappingTouched({})
  }

  function openCreateMappingModal() {
    if (!canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project mapping blocked', message: 'Your role does not have permission to update project mappings.' })
      return
    }

    setMappingMode('create')
    resetMappingComposer()
    setIsMappingModalOpen(true)
  }

  function openEditMappingModal(project) {
    if (!canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project mapping blocked', message: 'Your role does not have permission to update project mappings.' })
      return
    }

    setMappingMode('edit')
    setMappingDraft(createMappingDraft(project))
    setMappingTouched({})
    setIsMappingModalOpen(true)
  }

  function openCreateProject() {
    if (!canCreateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to create projects.' })
      return
    }

    setFormMode('create')
    setSelectedProject(null)
    setProjectDraft(createProjectDraft())
    setProjectTouched({})
    setIsFormOpen(true)
  }

  function openEditProject(project) {
    if (!canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to update projects.' })
      return
    }

    setFormMode('edit')
    setSelectedProject(project)
    setProjectDraft(createProjectDraft(project))
    setProjectTouched({})
    setIsFormOpen(true)
  }

  function handleDraftChange(event) {
    const { name, value } = event.target
    setProjectDraft((current) => ({ ...current, [name]: value }))
  }

  function handleDraftBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setProjectTouched((current) => ({ ...current, [fieldName]: true }))
  }

  async function handleSaveProject() {
    const requiredAction = formMode === 'create' ? canCreateProjects : canUpdateProjects
    if (!requiredAction) {
      showStatus({
        type: 'error',
        title: 'Project access blocked',
        message: formMode === 'create'
          ? 'Your role does not have permission to create projects.'
          : 'Your role does not have permission to update projects.'
      })
      return
    }

    const validationFields = [...PROJECT_FORM_REQUIRED_FIELDS, 'endDate']
    setProjectTouched((current) => ({ ...current, ...markFieldsTouched(validationFields) }))

    if (hasValidationErrors(projectErrors, validationFields)) {
      const firstError = validationFields.map((field) => projectErrors[field]).find(Boolean)
      showStatus({ type: 'error', title: 'Form has validation errors', message: firstError || 'Resolve the highlighted fields before continuing.' })
      return
    }

    const payload = {
      projectCode: projectDraft.projectCode,
      projectName: projectDraft.projectName,
      description: projectDraft.description,
      startDate: projectDraft.startDate,
      endDate: projectDraft.endDate,
      status: projectDraft.status
    }

    try {
      await runWithLoader(async () => {
        if (formMode === 'create') {
          await projectService.createProject(payload)
        } else {
          await projectService.updateProject(selectedProject.uid, payload)
        }

        await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
      }, {
        title: formMode === 'create' ? 'Creating project' : 'Updating project',
        message: formMode === 'create'
          ? 'Saving project details through the backend Project API.'
          : `Applying project updates for ${selectedProject?.projectName || selectedProject?.projectCode || 'selected project'}.`
      })

      showStatus({
        type: 'success',
        title: formMode === 'create' ? 'Project created' : 'Project updated',
        message: `${payload.projectName} has been saved successfully.`
      })

      setIsFormOpen(false)
      setSelectedProject(null)
      setProjectDraft(createProjectDraft())
      setProjectTouched({})
    } catch (actionError) {
      showStatus({
        type: 'error',
        title: formMode === 'create' ? 'Project creation failed' : 'Project update failed',
        message: actionError?.response?.data?.detail || actionError?.message || 'The project request could not be completed.'
      })
    }
  }

  function handleMappingDraftChange(event) {
    const { name, value } = event.target
    setMappingDraft((current) => {
      if (name === 'projectUid') {
        const selected = projects.find((project) => String(project.uid) === String(value))
        return createMappingDraft(selected || null)
      }
      return { ...current, [name]: value }
    })
  }

  function handleMappingDraftBlur(event) {
    const fieldName = event?.target?.name
    if (!fieldName) return
    setMappingTouched((current) => ({ ...current, [fieldName]: true }))
  }

  async function handleSaveMapping() {
    if (!canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project mapping blocked', message: 'Your role does not have permission to update project mappings.' })
      return
    }

    setMappingTouched((current) => ({ ...current, ...markFieldsTouched(['projectUid']) }))
    if (hasValidationErrors(mappingErrors, ['projectUid'])) {
      showStatus({ type: 'error', title: 'Project not selected', message: mappingErrors.projectUid || 'Select a project before saving mapping.' })
      return
    }

    const projectUid = String(mappingDraft.projectUid || '').trim()
    if (!projectUid) return

    const nextMapping = {
      manager: String(mappingDraft.manager || '').trim(),
      podLead: String(mappingDraft.podLead || '').trim()
    }

    setManualMappings((current) => {
      const next = { ...current }
      if (nextMapping.manager || nextMapping.podLead) {
        next[projectUid] = nextMapping
      } else {
        delete next[projectUid]
      }
      return next
    })

    const targetProject = projects.find((project) => String(project.uid) === projectUid)
    showStatus({
      type: 'success',
      title: 'Project mapping saved',
      message: `${targetProject?.projectName || 'Selected project'} mapping has been updated.`
    })
    setIsMappingModalOpen(false)
    resetMappingComposer()
  }

  async function handleClearMapping(project) {
    if (!canUpdateProjects) {
      showStatus({ type: 'error', title: 'Project mapping blocked', message: 'Your role does not have permission to update project mappings.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Clear Project Mapping',
      title: `Clear manual mapping for ${project.projectName}?`,
      message: 'Manager and Pod Lead manual fields will be removed for this project.'
    })
    if (!accepted) return

    setManualMappings((current) => {
      const next = { ...current }
      delete next[String(project.uid || '')]
      return next
    })

    if (String(mappingDraft.projectUid || '') === String(project.uid || '')) {
      resetMappingComposer()
    }

    showStatus({ type: 'success', title: 'Mapping cleared', message: `${project.projectName} mapping has been cleared.` })
  }

  async function handleDeleteProject(project) {
    if (!canDeleteProjects) {
      showStatus({ type: 'error', title: 'Project access blocked', message: 'Your role does not have permission to delete projects.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Project',
      title: `Delete ${project.projectName}?`,
      message: 'This project record will be removed from the backend Project API.'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        await projectService.deleteProject(project.uid)
        await queryClient.invalidateQueries({ queryKey: PROJECTS_QUERY_KEY })
      }, {
        title: 'Deleting project',
        message: `Removing ${project.projectName} from project records.`
      })

      setManualMappings((current) => {
        const next = { ...current }
        delete next[String(project.uid || '')]
        return next
      })

      if (String(mappingDraft.projectUid || '') === String(project.uid || '')) {
        resetMappingComposer()
      }

      showStatus({ type: 'success', title: 'Project deleted', message: `${project.projectName} has been removed successfully.` })
    } catch (actionError) {
      showStatus({
        type: 'error',
        title: 'Project deletion failed',
        message: actionError?.response?.data?.detail || actionError?.message || 'The project could not be removed.'
      })
    }
  }

  if (!canViewProjects) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Project Management" tagline="Manage project mappings from a dedicated workspace." />
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="fw-semibold mb-2">Project management is not available for this account.</div>
            <div className="text-muted small">Your role currently does not have access to the backend Project module.</div>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Project Management" tagline="Manage project mappings from a dedicated workspace." />
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="global-loader-spinner mb-3"><span /><span /></div>
            <div className="fw-semibold mb-2">Loading project management</div>
            <div className="text-muted small">Pulling project records from the backend module.</div>
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Project Management" tagline="Manage project mappings from a dedicated workspace." />
        <div className="card border-0 shadow-sm glass employee-directory-shell">
          <div className="card-body py-5 text-center">
            <div className="fw-semibold mb-2">Project management could not be loaded.</div>
            <div className="text-muted small mb-3">{error?.response?.data?.detail || error?.message || 'The backend request failed.'}</div>
            <button type="button" className="btn btn-primary" onClick={() => refetch()}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
      <PageHeader title="Project Management" tagline="Manage project mappings in a separate module while keeping manager and pod lead as manual fields." />

      <AttendanceTabs activeTab={activeTab} onChange={handleTabChange} tabs={availableTabs} />

      {activeTab === 'create' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Total Projects" value={projects.length} helper="Projects synced from backend records." tone="blue" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Active Projects" value={metrics.active} helper="Projects currently marked active." tone="green" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Planned / Draft" value={metrics.planned} helper="Projects still in planning stages." tone="teal" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Pending Dates" value={metrics.unscheduled} helper="Projects missing start or end date." tone="orange" />
            </div>
          </div>

          <div className="card border-0 shadow-sm glass employee-directory-shell">
            <div className="card-body d-flex flex-column gap-3">
              <div className="employee-toolbar employee-toolbar-top">
                <AppSearchField
                  className="employee-toolbar-search"
                  value={projectSearch}
                  onChange={(event) => setProjectSearch(event.target.value)}
                  placeholder="Search by code, project, status, or description"
                />

                <div className="employee-toolbar-actions">
                  {canCreateProjects ? (
                    <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateProject}>
                      <PlusIcon />
                      <span>Add Project</span>
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="employee-toolbar employee-toolbar-filters project-toolbar-filters">
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Status</label>
                  <AppSelect value={statusFilter} onChange={setStatusFilter} options={statusFilterOptions} placeholder="All statuses" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Timeline</label>
                  <AppSelect value={timelineFilter} onChange={setTimelineFilter} options={timelineFilterOptions} placeholder="All timelines" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Project</label>
                  <AppSelect value={projectFilter} onChange={setProjectFilter} options={projectOptions} placeholder="All projects" />
                </div>
                <div className="employee-filter-actions">
                  <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetFilters}>
                    <XIcon />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <PaginatedTable rows={sortedProjects}>
                {({ rows: paginatedRows }) => (
                  <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                    <thead>
                      <tr>
                        <th><SortableHeader label="Project (Code)" sortKey="project" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Timeline" sortKey="timeline" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Last Updated" sortKey="updated" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? paginatedRows.map((project) => (
                        <tr key={project.uid}>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={project.projectName} subtitle={project.projectCode} />
                          </td>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={<TableBadge value={project.status || 'Not set'} tone={toProjectStatusTone(project.status)} />} />
                          </td>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={`${formatDate(project.startDate)} - ${formatDate(project.endDate)}`} subtitle={project.startDate && project.endDate ? 'Scheduled window' : 'Schedule incomplete'} />
                          </td>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={formatDateTime(project.updatedAt)} subtitle={formatDateTime(project.createdAt)} meta="Created / Updated" />
                          </td>
                          <td className="employee-actions-cell">
                            <TableActionCluster>
                              <TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => setViewProject(project)} />
                              {canUpdateProjects ? <TableActionButton icon={<PencilIcon />} label="Edit" variant="edit" onClick={() => openEditProject(project)} /> : null}
                              {canDeleteProjects ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeleteProject(project)} /> : null}
                            </TableActionCluster>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5">
                            <div className="employee-empty-state text-center py-4">
                              <div className="fw-semibold mb-1">No projects matched the current filters.</div>
                              <div className="text-muted small">Reset status filters or broaden your search query.</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </PaginatedTable>
              {isFetching ? <div className="text-muted small">Refreshing project records…</div> : null}
            </div>
          </div>
        </>
      ) : null}

      {activeTab === 'mapping' ? (
        <>
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Total Projects" value={projects.length} helper="Available projects for mapping." tone="blue" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Mapped Projects" value={metrics.mapped} helper="Projects with manager or pod lead entered." tone="green" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Unmapped Projects" value={Math.max(projects.length - metrics.mapped, 0)} helper="Projects without manual mapping values." tone="teal" />
            </div>
            <div className="col-12 col-sm-6 col-xl-3">
              <ProjectMetricCard title="Editable Fields" value="2" helper="Manager and Pod Lead are manual text fields." tone="orange" />
            </div>
          </div>

          <div className="card border-0 shadow-sm glass employee-directory-shell">
            <div className="card-body d-flex flex-column gap-3">
              <div className="employee-toolbar employee-toolbar-top">
                <div className="d-flex flex-column gap-1">
                  <div className="fw-semibold">Project Mapping</div>
                  <div className="text-muted small">Use the mapping modal to select project and add manual manager and pod lead fields.</div>
                </div>
              </div>

              <div className="employee-toolbar employee-toolbar-top">
                <AppSearchField
                  className="employee-toolbar-search"
                  value={mappingSearch}
                  onChange={(event) => setMappingSearch(event.target.value)}
                  placeholder="Search mapping by project, manager, or pod lead"
                />

                <div className="employee-toolbar-actions">
                  <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={openCreateMappingModal} disabled={!canUpdateProjects}>
                    <PlusIcon />
                    <span>Add Mapping</span>
                  </button>
                </div>
              </div>

              <div className="employee-toolbar employee-toolbar-filters project-toolbar-filters">
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Status</label>
                  <AppSelect value={mappingStatusFilter} onChange={setMappingStatusFilter} options={statusFilterOptions} placeholder="All statuses" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Mapping State</label>
                  <AppSelect value={mappingStateFilter} onChange={setMappingStateFilter} options={mappingStateFilterOptions} placeholder="All mappings" />
                </div>
                <div className="employee-filter-field">
                  <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Project</label>
                  <AppSelect value={mappingProjectFilter} onChange={setMappingProjectFilter} options={projectOptions} placeholder="All projects" />
                </div>
                <div className="employee-filter-actions">
                  <button type="button" className="btn btn-outline-secondary btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetMappingFilters}>
                    <XIcon />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              <PaginatedTable rows={sortedMappingRows}>
                {({ rows: paginatedRows }) => (
                  <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table">
                    <thead>
                      <tr>
                        <th><SortableHeader label="Project (Code)" sortKey="project" sortConfig={mappingSortConfig} onSort={requestMappingSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Status" sortKey="status" sortConfig={mappingSortConfig} onSort={requestMappingSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Manager / Pod Lead" sortKey="mapping" sortConfig={mappingSortConfig} onSort={requestMappingSort} className="employee-header-wrap" /></th>
                        <th><SortableHeader label="Last Updated" sortKey="updated" sortConfig={mappingSortConfig} onSort={requestMappingSort} className="employee-header-wrap" /></th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRows.length ? paginatedRows.map((project) => (
                        <tr key={`mapping-${project.uid}`}>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={project.projectName} subtitle={project.projectCode} />
                          </td>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={<TableBadge value={project.status || 'Not set'} tone={toProjectStatusTone(project.status)} />} />
                          </td>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={project.manager || 'Manager not set'} subtitle={project.podLead ? `Pod Lead: ${project.podLead}` : 'Pod Lead: not set'} />
                          </td>
                          <td className="employee-cell-wrap">
                            <TableCellStack title={formatDateTime(project.updatedAt)} subtitle={formatDateTime(project.createdAt)} meta="Created / Updated" />
                          </td>
                          <td className="employee-actions-cell">
                            <TableActionCluster>
                              <TableActionButton
                                icon={<PencilIcon />}
                                label="Edit"
                                variant="edit"
                                onClick={() => openEditMappingModal(project)}
                                disabled={!canUpdateProjects}
                              />
                              <TableActionButton
                                icon={<TrashIcon />}
                                label="Clear"
                                variant="delete"
                                onClick={() => handleClearMapping(project)}
                                disabled={!canUpdateProjects || (!project.manager && !project.podLead)}
                              />
                            </TableActionCluster>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="5">
                            <div className="employee-empty-state text-center py-4">
                              <div className="fw-semibold mb-1">No project mappings found.</div>
                              <div className="text-muted small">Select a project and save manual mapping fields to get started.</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </PaginatedTable>
            </div>
          </div>
        </>
      ) : null}

      <ProjectFormModal
        open={isFormOpen}
        mode={formMode}
        draft={projectDraft}
        errors={projectErrors}
        touched={projectTouched}
        onChange={handleDraftChange}
        onBlur={handleDraftBlur}
        onClose={() => {
          setIsFormOpen(false)
          setSelectedProject(null)
          setProjectTouched({})
          setProjectDraft(createProjectDraft())
        }}
        onSubmit={handleSaveProject}
      />

      <ProjectMappingModal
        open={isMappingModalOpen}
        mode={mappingMode}
        draft={mappingDraft}
        errors={mappingErrors}
        touched={mappingTouched}
        projectOptions={projectOptions}
        onChange={handleMappingDraftChange}
        onBlur={handleMappingDraftBlur}
        onClose={() => {
          setIsMappingModalOpen(false)
          setMappingMode('create')
          resetMappingComposer()
        }}
        onSubmit={handleSaveMapping}
      />

      <ProjectViewModal
        project={viewProject}
        onClose={() => setViewProject(null)}
      />
    </div>
  )
}
