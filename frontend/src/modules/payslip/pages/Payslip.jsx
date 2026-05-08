import React, { useDeferredValue, useMemo, useState } from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import PaginatedTable from '../../../components/common/PaginatedTable.jsx'
import SortableHeader from '../../../components/common/SortableHeader.jsx'
import AppSearchField from '../../../components/common/AppSearchField.jsx'
import AppSelect from '../../../components/common/AppSelect.jsx'
import KpiCard from '../../../components/common/KpiCard.jsx'
import { DownloadIcon, FilterIcon, RotateCcwIcon, ViewIcon } from '../../../components/common/AppIcons.jsx'
import { TableActionButton, TableActionCluster, TableBadge, TableCellStack } from '../../../components/common/TablePrimitives.jsx'

import { useSortableData } from '../../../hooks/common/useSortableData.js'
import { useMyPayslipsQuery } from '../../../hooks/payslip/usePayslipsQuery.js'
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
  toPayslipFileName
} from '../utils/payslip.js'

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

function revokeObjectUrl(url) {
  window.setTimeout(() => URL.revokeObjectURL(url), 60 * 1000)
}

function openBlobInNewTab(blob, payslip) {
  const pdfBlob = blob instanceof Blob && blob.type === 'application/pdf'
    ? blob
    : new Blob([blob], { type: 'application/pdf' })
  const url = URL.createObjectURL(pdfBlob)
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    const link = document.createElement('a')
    link.href = url
    link.download = toPayslipFileName(payslip)
    document.body.appendChild(link)
    link.click()
    link.remove()
  }
  revokeObjectUrl(url)
}

function downloadBlob(blob, payslip) {
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

export default function Payslip() {
  const { user } = useAuth()
  const { showStatus, runWithLoader } = useModal()
  const canViewMyPayslip = hasModuleVisibility(user, PERMISSION_MODULES.myPayslip)
  const canDownloadMyPayslip = hasModulePermission(user, PERMISSION_MODULES.myPayslip, PERMISSION_ACTIONS.read)

  const payslipsQuery = useMyPayslipsQuery(canViewMyPayslip)

  const payslips = useMemo(() => (Array.isArray(payslipsQuery.data?.items) ? payslipsQuery.data.items : []), [payslipsQuery.data?.items])
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('All')
  const [yearFilter, setYearFilter] = useState('All')
  const deferredSearch = useDeferredValue(search)

  const yearOptions = useMemo(() => buildPayslipYearOptions(payslips), [payslips])
  const yearFilterOptions = useMemo(() => [{ value: 'All', label: 'All years', description: 'No year filter applied' }, ...yearOptions], [yearOptions])
  const monthFilterOptions = useMemo(() => [{ value: 'All', label: 'All months', description: 'No month filter applied' }, ...PAYSLIP_MONTH_OPTIONS], [])

  const rows = useMemo(() => payslips.map((payslip) => ({
    ...payslip,
    period: formatPayslipPeriod(payslip.salaryMonth, payslip.salaryYear)
  })), [payslips])

  const filteredRows = useMemo(() => (
    filterCollectionByQuery(rows, deferredSearch, ['period', 'originalFilename', 'fileFormat'])
      .filter((payslip) => {
        const monthMatch = monthFilter === 'All' || String(payslip.salaryMonth || '') === String(monthFilter)
        const yearMatch = yearFilter === 'All' || String(payslip.salaryYear || '') === String(yearFilter)
        return monthMatch && yearMatch
      })
  ), [deferredSearch, monthFilter, rows, yearFilter])

  const { items: sortedRows, sortConfig, requestSort } = useSortableData(filteredRows, {
    initialKey: 'period',
    initialDirection: 'desc',
    accessors: {
      period: (payslip) => Number(payslip.salaryYear || 0) * 100 + Number(payslip.salaryMonth || 0),
      file: (payslip) => payslip.originalFilename || '',
      size: (payslip) => Number(payslip.fileSize || 0),
      uploaded: (payslip) => payslip.createdAt || payslip.updatedAt || ''
    }
  })

  const metrics = useMemo(() => {
    const latest = rows
      .map((payslip) => Number(payslip.salaryYear || 0) * 100 + Number(payslip.salaryMonth || 0))
      .filter(Boolean)
      .sort((left, right) => right - left)[0]
    const yearsCovered = new Set(rows.map((payslip) => Number(payslip.salaryYear || 0)).filter(Boolean)).size
    const lastUploadedAt = rows
      .map((payslip) => payslip.createdAt || payslip.updatedAt || null)
      .filter(Boolean)
      .sort()
      .at(-1)
    return {
      total: rows.length,
      latestPeriod: latest ? formatPayslipPeriod(latest % 100, Math.floor(latest / 100)) : '—',
      yearsCovered,
      lastUploaded: lastUploadedAt ? formatDate(lastUploadedAt) : '—'
    }
  }, [rows])

  async function handlePayslipFile(payslip, mode = 'view') {
    if (!canDownloadMyPayslip) {
      showStatus({ type: 'error', title: 'Payslip access blocked', message: 'Your role does not have permission to view payslip PDFs.' })
      return
    }

    try {
      await runWithLoader(async () => {
        const blob = await payslipService.downloadPayslip(payslip.uid)
        if (mode === 'download') downloadBlob(blob, payslip)
        else openBlobInNewTab(blob, payslip)
      }, {
        title: mode === 'download' ? 'Downloading payslip' : 'Opening payslip',
        message: mode === 'download' ? 'Preparing your payslip download.' : 'Opening your payslip PDF.'
      })
    } catch (error) {
      showStatus({ type: 'error', title: 'Payslip file unavailable', message: normalizeApiError(error, 'The payslip PDF could not be opened.') })
    }
  }

  function resetFilters() {
    setSearch('')
    setMonthFilter('All')
    setYearFilter('All')
  }

  const pageHeaderTagline = canDownloadMyPayslip
    ? 'View and download your salary slips when they are available.'
    : 'Review your payslip records when access is available.'

  if (!canViewMyPayslip) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Payslip" tagline={pageHeaderTagline} />
        <StateCard title="Payslip is not available for this account." message="Your role currently does not have access to My Payslip permissions." />
      </div>
    )
  }

  if (payslipsQuery.isLoading) {
    return <div className="text-muted">Loading your payslips...</div>
  }

  if (payslipsQuery.isError) {
    return (
      <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
        <PageHeader title="Payslip" tagline={pageHeaderTagline} />
        <StateCard title="Payslip could not be loaded" message={normalizeApiError(payslipsQuery.error, 'Your payslip records could not be loaded.')} actionLabel="Retry" onAction={payslipsQuery.refetch} />
      </div>
    )
  }

  return (
    <div className="d-flex flex-column gap-3 employee-directory-page employee-module-page">
      <PageHeader title="Payslip" tagline={pageHeaderTagline} />

      <div className="row g-3">
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Payslips" value={metrics.total} tone="blue" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Latest Period" value={metrics.latestPeriod} tone="green" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Years Covered" value={metrics.yearsCovered} tone="teal" /></div>
        <div className="col-12 col-sm-6 col-xl-3"><KpiCard label="Last Uploaded" value={metrics.lastUploaded} tone="orange" /></div>
      </div>

      <div className="card border-0 shadow-sm glass employee-directory-shell">
        <div className="card-body d-flex flex-column gap-3">
          <div className="employee-toolbar employee-toolbar-top">
            <AppSearchField className="employee-toolbar-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by period or file name" />
          </div>

          <div className="employee-toolbar employee-toolbar-filters">
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
              <table className="table align-middle mb-0 employee-table employee-table-dense mapping-table payslip-management-table payslip-self-table">
                <colgroup>
                  <col className="payslip-col-period" />
                  <col className="payslip-col-file" />
                  <col className="payslip-col-uploaded" />
                  <col className="payslip-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th><SortableHeader label="Salary Period" sortKey="period" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                    <th><SortableHeader label="File" sortKey="file" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                    <th><SortableHeader label="Uploaded" sortKey="uploaded" sortConfig={sortConfig} onSort={requestSort} className="employee-header-wrap" /></th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length ? paginatedRows.map((payslip) => (
                    <tr key={payslip.uid}>
                      <td className="employee-cell-wrap"><TableCellStack title={payslip.period} subtitle={`${String(payslip.salaryMonth || '').padStart(2, '0')}/${payslip.salaryYear || '—'}`} /></td>
                      <td className="employee-cell-wrap"><TableCellStack title={payslip.originalFilename || 'Payslip PDF'} subtitle={payslip.fileFormat?.toUpperCase() || 'PDF'} highlightQuery={deferredSearch} /></td>
                      <td className="employee-cell-wrap"><TableCellStack title={formatDate(payslip.createdAt)} subtitle={payslip.createdAt ? 'Uploaded' : '—'} /></td>
                      <td className="employee-actions-cell">
                        <TableActionCluster className="justify-content-center mx-auto">
                          {canDownloadMyPayslip ? <TableActionButton icon={<ViewIcon />} label="View" variant="view" onClick={() => handlePayslipFile(payslip, 'view')} /> : null}
                          {canDownloadMyPayslip ? <TableActionButton icon={<DownloadIcon />} label="Download" variant="view" onClick={() => handlePayslipFile(payslip, 'download')} /> : null}
                        </TableActionCluster>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="4">
                        <div className="employee-empty-state text-center py-4">
                          <div className="fw-semibold mb-1">No payslips matched the current filters.</div>
                          <div className="text-muted small">Reset filters or check back once payroll uploads your payslip.</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </PaginatedTable>
          {payslipsQuery.isFetching ? <div className="text-muted small">Refreshing your payslips...</div> : null}
        </div>
      </div>
    </div>
  )
}
