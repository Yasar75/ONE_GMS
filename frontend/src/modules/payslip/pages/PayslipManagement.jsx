import React, { useDeferredValue, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import PageHeader from '../../../components/common/PageHeader.jsx'
import ModalFrame from '../../../components/common/ModalFrame.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import KpiCard from '../../../components/common/KpiCard.jsx'
import { ChevronLeftIcon, DownloadIcon, FilterIcon, PlusIcon, RotateCcwIcon, TrashIcon, ViewIcon } from '../../../components/common/AppIcons.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'

import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { useEmployeeLookupQuery } from '../../../hooks/employees/useEmployeeLookupQuery.js'
import { PAYSLIPS_QUERY_KEY, usePayslipsQuery } from '../../../hooks/payslip/usePayslipsQuery.js'
import { payslipService } from '../../../api/services/payslip.service.js'
import { useModal } from '../../../app/providers/ModalProvider.jsx'
import { useAuth } from '../../../app/providers/AuthProvider.jsx'
import { normalizeApiError } from '../../../utils/apiError.js'
import { formatDate } from '../../../utils/employee.js'
import { filterCollectionByQuery } from '../../../utils/search.js'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  hasModulePermission,
  hasModuleVisibility
} from '../../../utils/permissions.js'
import {
  PAYSLIP_MONTH_OPTIONS,
  buildPayslipYearOptions,
  formatPayslipPeriod,
  getCurrentPayslipMonth,
  getCurrentPayslipYear,
  toPayslipFileName
} from '../utils/payslip.js'

const MAX_PAYSLIP_FILE_SIZE = 5 * 1024 * 1024

function StateCard({ title, message, actionLabel = '', onAction = null }) {
  return (
    <div className="card border-0 shadow-sm">
      <div className="card-body d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div>
          <div className="fw-semibold mb-1">{title}</div>
          <div className="text-muted small">{message}</div>
        </div>
        {actionLabel && onAction ? (
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onAction}>{actionLabel}</button>
        ) : null}
      </div>
    </div>
  )
}

function compactUid(value) {
  const normalizedValue = String(value || '').trim()
  if (!normalizedValue) return '—'
  return normalizedValue.length > 8 ? `${normalizedValue.slice(0, 8)}...` : normalizedValue
}

function createUploadDraft(employeeUid = '') {
  return {
    employeeUid,
    month: String(getCurrentPayslipMonth()),
    year: String(getCurrentPayslipYear()),
    file: null
  }
}

function getPayslipPeriodIdentity(payslip = {}) {
  const employeeUid = String(payslip.employeeUid || '').trim()
  const salaryMonth = Number(payslip.salaryMonth ?? payslip.month)
  const salaryYear = Number(payslip.salaryYear ?? payslip.year)

  if (!employeeUid || !Number.isInteger(salaryMonth) || !Number.isInteger(salaryYear)) return ''
  if (salaryMonth < 1 || salaryMonth > 12 || salaryYear < 2000 || salaryYear > 2100) return ''
  return `${employeeUid}::${salaryYear}::${salaryMonth}`
}

function findDuplicatePayslipPeriod(payslips = [], draft = {}) {
  const draftIdentity = getPayslipPeriodIdentity(draft)
  if (!draftIdentity) return null

  return (Array.isArray(payslips) ? payslips : []).find((payslip) => getPayslipPeriodIdentity(payslip) === draftIdentity) || null
}

function buildUploadMonthOptions(payslips = [], draft = {}) {
  const employeeUid = String(draft.employeeUid || '').trim()
  const salaryYear = Number(draft.year)

  if (!employeeUid || !Number.isInteger(salaryYear)) return PAYSLIP_MONTH_OPTIONS

  const uploadedMonths = new Set((Array.isArray(payslips) ? payslips : [])
    .filter((payslip) => (
      String(payslip.employeeUid || '').trim() === employeeUid
        && Number(payslip.salaryYear) === salaryYear
    ))
    .map((payslip) => Number(payslip.salaryMonth))
    .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))

  return PAYSLIP_MONTH_OPTIONS.map((option) => {
    const month = Number(option.value)
    const isUploaded = uploadedMonths.has(month)
    return {
      ...option,
      description: isUploaded ? `${option.description} • Already uploaded` : option.description,
      disabled: isUploaded
    }
  })
}

function buildEmployeeOptions(employees = [], withAll = false) {
  const options = (Array.isArray(employees) ? employees : [])
    .filter((employee) => String(employee.uid || '').trim())
    .map((employee) => ({
      value: employee.uid,
      label: employee.fullName || employee.employeeCode || `Employee ${compactUid(employee.uid)}`,
      description: [employee.employeeCode, employee.department].filter(Boolean).join(' • ') || 'Employee record'
    }))

  return withAll
    ? [{ value: 'All', label: 'All employees', description: 'No employee filter applied' }, ...options]
    : options
}

function buildUploadErrors(draft = {}, duplicatePeriodMessage = '') {
  const errors = {}
  if (!String(draft.employeeUid || '').trim()) errors.employeeUid = 'Employee is required.'
  if (!Number.isInteger(Number(draft.month)) || Number(draft.month) < 1 || Number(draft.month) > 12) errors.month = 'Salary month is required.'
  if (!Number.isInteger(Number(draft.year)) || Number(draft.year) < 2000 || Number(draft.year) > 2100) errors.year = 'Salary year must be between 2000 and 2100.'
  if (!errors.month && duplicatePeriodMessage) errors.month = duplicatePeriodMessage
  if (!draft.file) {
    errors.file = 'Payslip PDF file is required.'
  } else {
    const fileName = String(draft.file.name || '').toLowerCase()
    const fileType = String(draft.file.type || '').toLowerCase()
    if (!fileName.endsWith('.pdf') || (fileType && !['application/pdf', 'application/x-pdf'].includes(fileType))) {
      errors.file = 'Only PDF payslip files are allowed.'
    } else if (Number(draft.file.size || 0) > MAX_PAYSLIP_FILE_SIZE) {
      errors.file = 'Payslip file size must not exceed 5 MB.'
    }
  }
  return errors
}

function revokeObjectUrl(url) {
  window.setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
}

function downloadPayslipBlob(blob, payslip) {
  const pdfBlob = blob instanceof Blob && blob.type === 'application/pdf'
    ? blob
    : new Blob([blob], { type: 'application/pdf' })
  const url = URL.createObjectURL(pdfBlob)
  const link = document.createElement('a')
  link.href = url
  link.download = toPayslipFileName(payslip)
  document.body.appendChild(link)
  link.click()
  link.remove()
  revokeObjectUrl(url)
}

function PayslipUploadModal({
  open,
  draft,
  errors,
  touched,
  employeeOptions,
  employeeLocked = false,
  monthOptions = PAYSLIP_MONTH_OPTIONS,
  yearOptions,
  duplicatePeriodMessage = '',
  onChange,
  onFileChange,
  onBlur,
  onClose,
  onSubmit
}) {
  const hasDuplicatePeriod = Boolean(duplicatePeriodMessage)
  return (
    <ModalFrame
      open={open}
      title="Upload Payslip"
      onClose={onClose}
      size="lg"
      footer={(
        <>
          <button type="button" className="btn btn-light px-4" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary px-4" onClick={onSubmit} disabled={hasDuplicatePeriod}>Upload Payslip</button>
        </>
      )}
    >
      <div className="row g-3 payslip-upload-modal-shell">
        <div className="col-12">
          <label className="form-label">Employee</label>
          <AppSelect
            name="employeeUid"
            value={draft.employeeUid}
            onChange={onChange}
            onBlur={onBlur}
            options={employeeOptions}
            placeholder="Select employee"
            invalid={Boolean(touched.employeeUid && errors.employeeUid)}
            disabled={employeeLocked}
          />
          {touched.employeeUid && errors.employeeUid ? <div className="invalid-feedback d-block">{errors.employeeUid}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Salary Month</label>
          <AppSelect
            name="month"
            value={draft.month}
            onChange={onChange}
            onBlur={onBlur}
            options={monthOptions}
            placeholder="Select month"
            invalid={Boolean((touched.month || hasDuplicatePeriod) && errors.month)}
          />
          {(touched.month || hasDuplicatePeriod) && errors.month ? <div className="invalid-feedback d-block">{errors.month}</div> : null}
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label">Salary Year</label>
          <AppSelect
            name="year"
            value={draft.year}
            onChange={onChange}
            onBlur={onBlur}
            options={yearOptions}
            placeholder="Select year"
            invalid={Boolean(touched.year && errors.year)}
          />
          {touched.year && errors.year ? <div className="invalid-feedback d-block">{errors.year}</div> : null}
        </div>
        <div className="col-12">
          <label className="form-label">Payslip PDF</label>
          <input
            type="file"
            name="file"
            className={`form-control${touched.file && errors.file ? ' is-invalid' : ''}`}
            accept=".pdf,application/pdf,application/x-pdf"
            onChange={onFileChange}
            onBlur={onBlur}
          />
          <div className="form-text">Accepted format: PDF. Maximum file size: 5 MB.</div>
          {draft.file ? <div className="employee-import-file-chip mt-2"><span className="fw-semibold">Selected file:</span> {draft.file.name}</div> : null}
          {touched.file && errors.file ? <div className="invalid-feedback d-block">{errors.file}</div> : null}
        </div>
      </div>
    </ModalFrame>
  )
}

export default function PayslipManagement({ mode = 'management' }) {
  const navigate = useNavigate()
  const { employeeUid: routeEmployeeUid = '' } = useParams()
  const queryClient = useQueryClient()
  const { showStatus, showConfirm, runWithLoader } = useModal()
  const { user } = useAuth()
  const isEmployeeView = mode === 'employee' || Boolean(routeEmployeeUid)

  const canViewPayslips = hasModuleVisibility(user, PERMISSION_MODULES.payslip)
  const canDownloadPayslips = hasModulePermission(user, PERMISSION_MODULES.payslip, PERMISSION_ACTIONS.read)
  const canUploadPayslips = hasModulePermission(user, PERMISSION_MODULES.payslip, PERMISSION_ACTIONS.create)
  const canDeletePayslips = hasModulePermission(user, PERMISSION_MODULES.payslip, PERMISSION_ACTIONS.delete)

  const payslipsQuery = usePayslipsQuery(canViewPayslips)
  const employeesQuery = useEmployeeLookupQuery(canViewPayslips)

  const payslips = useMemo(() => (Array.isArray(payslipsQuery.data?.items) ? payslipsQuery.data.items : []), [payslipsQuery.data?.items])
  const employees = useMemo(() => (Array.isArray(employeesQuery.data) ? employeesQuery.data : []), [employeesQuery.data])
  const employeeByUid = useMemo(() => new Map(employees.map((employee) => [String(employee.uid || ''), employee])), [employees])

  const [search, setSearch] = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('All')
  const [monthFilter, setMonthFilter] = useState('All')
  const [yearFilter, setYearFilter] = useState('All')
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadDraft, setUploadDraft] = useState(() => createUploadDraft(routeEmployeeUid))
  const [uploadTouched, setUploadTouched] = useState({})

  const deferredSearch = useDeferredValue(search)
  const employeeOptions = useMemo(() => buildEmployeeOptions(employees, false), [employees])
  const yearOptions = useMemo(() => buildPayslipYearOptions(payslips), [payslips])
  const yearFilterOptions = useMemo(() => [{ value: 'All', label: 'All years', description: 'No year filter applied' }, ...yearOptions], [yearOptions])
  const monthFilterOptions = useMemo(() => [{ value: 'All', label: 'All months', description: 'No month filter applied' }, ...PAYSLIP_MONTH_OPTIONS], [])
  const uploadMonthOptions = useMemo(() => buildUploadMonthOptions(payslips, uploadDraft), [payslips, uploadDraft.employeeUid, uploadDraft.year])
  const duplicatePayslipPeriod = useMemo(() => (
    findDuplicatePayslipPeriod(payslips, uploadDraft)
  ), [payslips, uploadDraft.employeeUid, uploadDraft.month, uploadDraft.year])
  const duplicatePayslipPeriodMessage = duplicatePayslipPeriod ? 'A payslip already exists for this employee and salary period.' : ''
  const uploadErrors = useMemo(() => buildUploadErrors(uploadDraft, duplicatePayslipPeriodMessage), [duplicatePayslipPeriodMessage, uploadDraft])

  const selectedEmployee = useMemo(() => employeeByUid.get(String(routeEmployeeUid || '')) || null, [employeeByUid, routeEmployeeUid])

  const payslipsByEmployeeUid = useMemo(() => {
    const lookup = new Map()
    payslips.forEach((payslip) => {
      const employeeUid = String(payslip.employeeUid || '').trim()
      if (!employeeUid) return
      const bucket = lookup.get(employeeUid) || []
      bucket.push(payslip)
      lookup.set(employeeUid, bucket)
    })

    lookup.forEach((bucket) => {
      bucket.sort((left, right) => {
        const leftPeriod = Number(left.salaryYear || 0) * 100 + Number(left.salaryMonth || 0)
        const rightPeriod = Number(right.salaryYear || 0) * 100 + Number(right.salaryMonth || 0)
        if (leftPeriod !== rightPeriod) return rightPeriod - leftPeriod
        return (Date.parse(right.createdAt || right.updatedAt || '') || 0) - (Date.parse(left.createdAt || left.updatedAt || '') || 0)
      })
    })

    return lookup
  }, [payslips])

  const employeesWithPayslipRecords = useMemo(() => {
    if (!payslipsByEmployeeUid.size) return []

    if (!employees.length) {
      return Array.from(payslipsByEmployeeUid.keys()).map((employeeUid) => ({ uid: employeeUid }))
    }

    return employees.filter((employee) => payslipsByEmployeeUid.has(String(employee.uid || '').trim()))
  }, [employees, payslipsByEmployeeUid])

  const employeeFilterOptions = useMemo(() => buildEmployeeOptions(employeesWithPayslipRecords, true), [employeesWithPayslipRecords])

  const employeeSummaryRows = useMemo(() => {
    return employeesWithPayslipRecords
      .filter((employee) => String(employee.uid || '').trim())
      .map((employee) => {
        const employeePayslips = payslipsByEmployeeUid.get(String(employee.uid || '')) || []
        const periodPayslips = employeePayslips.filter((payslip) => {
          const monthMatch = monthFilter === 'All' || String(payslip.salaryMonth || '') === String(monthFilter)
          const yearMatch = yearFilter === 'All' || String(payslip.salaryYear || '') === String(yearFilter)
          return monthMatch && yearMatch
        })
        const latestPayslip = employeePayslips[0] || null
        const periodPayslip = periodPayslips[0] || null

        return {
          rowType: 'employee',
          employeeUid: String(employee.uid || ''),
          employeeName: employee.fullName || `Employee ${compactUid(employee.uid)}`,
          employeeCode: employee.employeeCode || compactUid(employee.uid),
          department: employee.department || '—',
          payslipCount: employeePayslips.length,
          periodPayslipCount: periodPayslips.length,
          latestPayslip,
          latestPeriod: latestPayslip ? formatPayslipPeriod(latestPayslip.salaryMonth, latestPayslip.salaryYear) : '—',
          latestPeriodSort: latestPayslip ? Number(latestPayslip.salaryYear || 0) * 100 + Number(latestPayslip.salaryMonth || 0) : 0,
          lastUploadedAt: latestPayslip?.createdAt || latestPayslip?.updatedAt || null,
          selectedPeriodStatus: periodPayslip ? 'Uploaded' : (monthFilter !== 'All' || yearFilter !== 'All' ? 'Pending' : '—')
        }
      })
  }, [employeesWithPayslipRecords, monthFilter, payslipsByEmployeeUid, yearFilter])

  const detailRows = useMemo(() => (payslipsByEmployeeUid.get(String(routeEmployeeUid || '')) || []).map((payslip) => ({
    ...payslip,
    rowType: 'payslip',
    employeeName: selectedEmployee?.fullName || `Employee ${compactUid(payslip.employeeUid)}`,
    employeeCode: selectedEmployee?.employeeCode || compactUid(payslip.employeeUid),
    department: selectedEmployee?.department || '—',
    period: formatPayslipPeriod(payslip.salaryMonth, payslip.salaryYear)
  })), [payslipsByEmployeeUid, routeEmployeeUid, selectedEmployee?.department, selectedEmployee?.employeeCode, selectedEmployee?.fullName])

  const filteredRows = useMemo(() => {
    if (isEmployeeView) {
      return filterCollectionByQuery(detailRows, deferredSearch, ['period', 'originalFilename', 'fileFormat'])
        .filter((payslip) => {
          const monthMatch = monthFilter === 'All' || String(payslip.salaryMonth || '') === String(monthFilter)
          const yearMatch = yearFilter === 'All' || String(payslip.salaryYear || '') === String(yearFilter)
          return monthMatch && yearMatch
        })
    }

    return filterCollectionByQuery(employeeSummaryRows, deferredSearch, ['employeeName', 'employeeCode', 'department', 'latestPeriod', 'selectedPeriodStatus'])
      .filter((row) => employeeFilter === 'All' || String(row.employeeUid || '') === String(employeeFilter))
  }, [deferredSearch, detailRows, employeeFilter, employeeSummaryRows, isEmployeeView, monthFilter, yearFilter])

  const { items: sortedRows, sortConfig, requestSort } = useSortableData(filteredRows, {
    initialKey: isEmployeeView ? 'period' : 'lastUploaded',
    initialDirection: 'desc',
    accessors: {
      employee: (row) => `${row.employeeName || ''} ${row.employeeCode || ''}`,
      payslipCount: (row) => Number(row.payslipCount || 0),
      latestPeriod: (row) => Number(row.latestPeriodSort || 0),
      lastUploaded: (row) => row.lastUploadedAt || row.createdAt || row.updatedAt || '',
      periodStatus: (row) => row.selectedPeriodStatus || '',
      period: (row) => Number(row.salaryYear || 0) * 100 + Number(row.salaryMonth || 0),
      file: (row) => row.originalFilename || '',
      uploaded: (row) => row.createdAt || row.updatedAt || ''
    }
  })

  const metrics = useMemo(() => {
    if (isEmployeeView) {
      const yearsCovered = new Set(detailRows.map((payslip) => Number(payslip.salaryYear || 0)).filter(Boolean)).size
      const latestPayslip = detailRows[0] || null
      const lastUploadedAt = detailRows
        .map((payslip) => payslip.createdAt || payslip.updatedAt || null)
        .filter(Boolean)
        .sort()
        .at(-1)

      return {
        total: detailRows.length,
        employeeCount: yearsCovered,
        latestPeriod: latestPayslip ? latestPayslip.period : '—',
        fourthLabel: 'Last Uploaded',
        fourthValue: lastUploadedAt ? formatDate(lastUploadedAt) : '—'
      }
    }

    const latest = payslips
      .map((payslip) => Number(payslip.salaryYear || 0) * 100 + Number(payslip.salaryMonth || 0))
      .filter(Boolean)
      .sort((left, right) => right - left)[0]
    const currentMonth = getCurrentPayslipMonth()
    const currentYear = getCurrentPayslipYear()
    const employeeSourceCount = employeesWithPayslipRecords.length || payslipsByEmployeeUid.size
    const pendingCurrentPeriod = employeeSourceCount
      ? employeesWithPayslipRecords.filter((employee) => !(payslipsByEmployeeUid.get(String(employee.uid || '')) || [])
        .some((payslip) => Number(payslip.salaryMonth) === currentMonth && Number(payslip.salaryYear) === currentYear)).length
      : 0

    return {
      total: employeeSourceCount,
      employeeCount: payslips.length,
      latestPeriod: latest ? formatPayslipPeriod(latest % 100, Math.floor(latest / 100)) : '—',
      fourthLabel: 'Pending This Month',
      fourthValue: pendingCurrentPeriod
    }
  }, [detailRows, employeesWithPayslipRecords, isEmployeeView, payslips, payslipsByEmployeeUid])

  function openUploadModal(employeeUid = '') {
    if (!canUploadPayslips) {
      showStatus({ type: 'error', title: 'Payslip access blocked', message: 'Your role does not have permission to upload payslips.' })
      return
    }
    setUploadDraft(createUploadDraft(employeeUid || routeEmployeeUid))
    setUploadTouched({})
    setIsUploadOpen(true)
  }

  function handleUploadDraftChange(event) {
    const { name, value } = event.target
    setUploadDraft((current) => ({ ...current, [name]: value }))
  }

  function handleUploadBlur(event) {
    const { name } = event.target
    setUploadTouched((current) => ({ ...current, [name]: true }))
  }

  function handleUploadFileChange(event) {
    setUploadDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))
    setUploadTouched((current) => ({ ...current, file: true }))
  }

  async function handleUploadSubmit() {
    if (!canUploadPayslips) {
      showStatus({ type: 'error', title: 'Payslip access blocked', message: 'Your role does not have permission to upload payslips.' })
      return
    }

    setUploadTouched({ employeeUid: true, month: true, year: true, file: true })
    if (duplicatePayslipPeriodMessage) {
      showStatus({ type: 'error', title: 'Payslip already uploaded', message: duplicatePayslipPeriodMessage })
      return
    }

    if (Object.values(uploadErrors).some(Boolean)) {
      showStatus({ type: 'error', title: 'Payslip upload is incomplete', message: 'Select an employee, salary period, and a valid PDF before uploading.' })
      return
    }

    try {
      await runWithLoader(async () => {
        await payslipService.uploadPayslip(uploadDraft)
        await queryClient.invalidateQueries({ queryKey: PAYSLIPS_QUERY_KEY })
      }, {
        title: 'Uploading payslip',
        message: 'Uploading the payslip PDF.'
      })

      setIsUploadOpen(false)
      setUploadDraft(createUploadDraft(routeEmployeeUid))
      setUploadTouched({})
      showStatus({ type: 'success', title: 'Payslip uploaded', message: 'Payslip has been uploaded successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Payslip upload failed', message: normalizeApiError(error, 'The payslip could not be uploaded.') })
    }
  }

  async function handleDeletePayslip(payslip) {
    if (!canDeletePayslips) {
      showStatus({ type: 'error', title: 'Payslip access blocked', message: 'Your role does not have permission to delete payslips.' })
      return
    }

    const accepted = await showConfirm({
      modalTitle: 'Delete Payslip',
      title: `Delete ${payslip.period}?`,
      message: `This payslip for ${payslip.employeeName} will be removed from the employee's records.`,
      confirmLabel: 'Delete'
    })
    if (!accepted) return

    try {
      await runWithLoader(async () => {
        await payslipService.deletePayslip(payslip.uid)
        await queryClient.invalidateQueries({ queryKey: PAYSLIPS_QUERY_KEY })
      }, {
        title: 'Deleting payslip',
        message: 'Removing the payslip and refreshing the table.'
      })

      showStatus({ type: 'success', title: 'Payslip deleted', message: 'Payslip has been removed successfully.' })
    } catch (error) {
      showStatus({ type: 'error', title: 'Payslip deletion failed', message: normalizeApiError(error, 'The payslip could not be removed.') })
    }
  }

  function resetFilters() {
    setSearch('')
    setEmployeeFilter('All')
    setMonthFilter('All')
    setYearFilter('All')
  }

  async function handleDownloadPayslip(payslip) {
    if (!canDownloadPayslips) {
      showStatus({ type: 'error', title: 'Payslip access blocked', message: 'Your role does not have permission to download payslips.' })
      return
    }

    try {
      await runWithLoader(async () => {
        const blob = await payslipService.downloadPayslip(payslip.uid)
        downloadPayslipBlob(blob, payslip)
      }, {
        title: 'Downloading payslip',
        message: 'Preparing the payslip PDF.'
      })
    } catch (error) {
      showStatus({ type: 'error', title: 'Payslip file unavailable', message: normalizeApiError(error, 'The payslip PDF could not be downloaded.') })
    }
  }
  const pageHeaderTagline = canUploadPayslips || canDeletePayslips
    ? 'Upload, review, and maintain employee payslips.'
    : 'Review employee payslip records.'

  if (!canViewPayslips) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Payslip Management" tagline={pageHeaderTagline} />
        <StateCard title="Payslip module is not available for this account." message="Your role currently does not have access to payslip management permissions." />
      </div>
    )
  }

  if (payslipsQuery.isLoading || employeesQuery.isLoading) {
    return <div className="text-muted">Loading payslip management...</div>
  }

  if (payslipsQuery.isError) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Payslip Management" tagline={pageHeaderTagline} />
        <StateCard title="Payslip module could not be loaded" message={normalizeApiError(payslipsQuery.error, 'Payslip records could not be loaded.')} actionLabel="Retry" onAction={payslipsQuery.refetch} />
      </div>
    )
  }

  if (isEmployeeView && !selectedEmployee && !employeesQuery.isFetching) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Payslip Management" tagline={pageHeaderTagline} />
        <StateCard title="Employee not found" message="The selected employee could not be matched from the current directory data." actionLabel="Back" onAction={() => navigate('/admin/payslip-management')} />
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
      {isEmployeeView ? (
        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
          <div className="d-flex align-items-start gap-3">
            <button
              type="button"
              className="employee-action-btn employee-action-btn-view"
              aria-label="Back"
              onClick={() => navigate('/admin/payslip-management')}
              style={{ '--action-label-chars': 4 }}
            >
              <span className="employee-action-btn__icon" aria-hidden="true"><ChevronLeftIcon /></span>
              <span className="employee-action-btn__label" aria-hidden="true">Back</span>
            </button>
            <div>
              <h1 className="fw-bold mb-1">Employee's Payslip Overview</h1>
              <div className="text-muted small">
                {selectedEmployee?.fullName || selectedEmployee?.employeeCode || 'Employee'} • {selectedEmployee?.employeeCode || 'No code'} • {selectedEmployee?.department || 'No department'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <PageHeader title="Payslip Management" tagline={pageHeaderTagline} />
      )}

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label={isEmployeeView ? 'Payslips' : 'Employees'} value={metrics.total} tone="blue" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label={isEmployeeView ? 'Years Covered' : 'Uploaded Payslips'} value={metrics.employeeCount} tone="green" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Latest Period" value={metrics.latestPeriod} tone="teal" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label={metrics.fourthLabel} value={metrics.fourthValue} tone="orange" /></div>
      </div>

      <div className="card border-0 shadow-sm glass employee-directory-shell">
        <div className="card-body d-flex flex-column gap-3">
          {employeesQuery.isError ? <div className="alert alert-warning py-2 mb-0">Employee lookup unavailable. {normalizeApiError(employeesQuery.error, 'Labels may show raw IDs.')}</div> : null}

          <div className="employee-toolbar employee-toolbar-top">
            <AppSearchField className="employee-toolbar-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isEmployeeView ? 'Search by salary period or file name' : 'Search by employee, department, or payroll status'} />
            <div className="employee-toolbar-actions">
              {canUploadPayslips ? (
                <button type="button" className="btn btn-primary btn-icon-inline employee-toolbar-btn" onClick={() => openUploadModal(routeEmployeeUid)}>
                  <PlusIcon />
                  <span>Upload Payslip</span>
                </button>
              ) : null}
            </div>
          </div>

          <div className="employee-toolbar employee-toolbar-filters">
            {!isEmployeeView ? (
              <div className="employee-filter-field">
                <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Employee</label>
                <AppSelect value={employeeFilter} onChange={setEmployeeFilter} options={employeeFilterOptions} placeholder="All employees" />
              </div>
            ) : null}
            <div className="employee-filter-field">
              <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Month</label>
              <AppSelect value={monthFilter} onChange={setMonthFilter} options={monthFilterOptions} placeholder="All months" />
            </div>
            <div className="employee-filter-field">
              <label className="form-label small text-muted d-flex align-items-center gap-2"><FilterIcon /> Year</label>
              <AppSelect value={yearFilter} onChange={setYearFilter} options={yearFilterOptions} placeholder="All years" />
            </div>
            <div className="employee-filter-actions">
              <button type="button" className="btn btn-outline-secondary btn-sm btn-icon-inline employee-filter-reset-btn employee-toolbar-btn" onClick={resetFilters}>
                <RotateCcwIcon />
                <span>Reset</span>
              </button>
            </div>
          </div>

          <PaginatedTable rows={sortedRows}>
            {({ rows: paginatedRows }) => (
              <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table payslip-management-table">
                {isEmployeeView ? (
                  <colgroup>
                    <col className="payslip-col-period" />
                    <col className="payslip-col-file" />
                    <col className="payslip-col-uploaded" />
                    <col className="payslip-col-actions" />
                  </colgroup>
                ) : (
                  <colgroup>
                    <col className="payslip-col-employee" />
                    <col className="payslip-col-count" />
                    <col className="payslip-col-period" />
                    <col className="payslip-col-uploaded" />
                    <col className="payslip-col-status" />
                    <col className="payslip-col-actions" />
                  </colgroup>
                )}
                <thead>
                  {isEmployeeView ? (
                    <tr>
                      <th><SortableHeader label="Salary Period" sortKey="period" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="File" sortKey="file" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Uploaded" sortKey="uploaded" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th className="text-center">Actions</th>
                    </tr>
                  ) : (
                    <tr>
                      <th><SortableHeader label="Employee" sortKey="employee" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Payslips" sortKey="payslipCount" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Latest Period" sortKey="latestPeriod" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Last Uploaded" sortKey="lastUploaded" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th><SortableHeader label="Selected Period" sortKey="periodStatus" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                      <th className="text-center">Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {paginatedRows.length ? paginatedRows.map((row) => (
                    isEmployeeView ? (
                      <tr key={row.uid}>
                        <td className="employee-cell-wrap"><TableCellStack title={row.period} subtitle={`${String(row.salaryMonth || '').padStart(2, '0')}/${row.salaryYear || '—'}`} /></td>
                        <td className="employee-cell-wrap"><TableCellStack title={row.originalFilename || 'Payslip PDF'} subtitle={row.fileFormat?.toUpperCase() || 'PDF'} highlightQuery={deferredSearch} /></td>
                        <td className="employee-cell-wrap"><TableCellStack title={formatDate(row.createdAt)} subtitle={row.createdAt ? 'Uploaded' : '—'} /></td>
                        <td className="employee-actions-cell">
                          <TableActionCluster className="justify-content-center mx-auto">
                            {canDownloadPayslips ? <TableActionButton icon={<DownloadIcon />} label="Download" variant="view" onClick={() => handleDownloadPayslip(row)} /> : null}
                            {canDeletePayslips ? <TableActionButton icon={<TrashIcon />} label="Delete" variant="delete" onClick={() => handleDeletePayslip(row)} /> : null}
                          </TableActionCluster>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.employeeUid}>
                        <td className="employee-cell-wrap"><TableCellStack title={row.employeeName} subtitle={row.employeeCode} meta={row.department} highlightQuery={deferredSearch} /></td>
                        <td className="employee-cell-wrap"><TableBadge value={String(row.payslipCount || 0)} tone={row.payslipCount ? 'green' : 'gray'} /></td>
                        <td className="employee-cell-wrap"><TableCellStack title={row.latestPeriod} subtitle={row.latestPayslip ? 'Latest uploaded' : 'No payslip yet'} /></td>
                        <td className="employee-cell-wrap"><TableCellStack title={formatDate(row.lastUploadedAt)} subtitle={row.lastUploadedAt ? 'Last upload' : '—'} /></td>
                        <td className="employee-cell-wrap"><TableBadge value={row.selectedPeriodStatus} tone={row.selectedPeriodStatus === 'Uploaded' ? 'green' : (row.selectedPeriodStatus === 'Pending' ? 'orange' : 'gray')} /></td>
                        <td className="employee-actions-cell">
                          <TableActionCluster className="justify-content-center mx-auto">
                            <TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => navigate(`/admin/payslip-management/employees/${row.employeeUid}`)} />
                            {canDeletePayslips && row.latestPayslip ? (
                              <TableActionButton
                                icon={<TrashIcon />}
                                label="Delete"
                                variant="delete"
                                onClick={() => handleDeletePayslip({
                                  ...row.latestPayslip,
                                  period: row.latestPeriod,
                                  employeeName: row.employeeName
                                })}
                              />
                            ) : null}
                          </TableActionCluster>
                        </td>
                      </tr>
                    )
                  )) : (
                    <tr>
                      <td colSpan={isEmployeeView ? 4 : 6}>
                        <div className="employee-empty-state text-center py-4">
                          <div className="fw-semibold mb-1">No payslips matched the current filters.</div>
                          <div className="text-muted small">Reset filters or upload a new payslip to get started.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </PaginatedTable>
          {payslipsQuery.isFetching ? <div className="text-muted small">Refreshing payslip records...</div> : null}
        </div>
      </div>

      <PayslipUploadModal
        open={isUploadOpen}
        draft={uploadDraft}
        errors={uploadErrors}
        touched={uploadTouched}
        employeeOptions={employeeOptions}
        employeeLocked={isEmployeeView}
        monthOptions={uploadMonthOptions}
        yearOptions={yearOptions}
        duplicatePeriodMessage={duplicatePayslipPeriodMessage}
        onChange={handleUploadDraftChange}
        onFileChange={handleUploadFileChange}
        onBlur={handleUploadBlur}
        onClose={() => {
          setIsUploadOpen(false)
          setUploadDraft(createUploadDraft(routeEmployeeUid))
          setUploadTouched({})
        }}
        onSubmit={handleUploadSubmit}
      />
    </div>
  )
}
