export const PAYSLIP_MONTH_OPTIONS = [
  { value: '1', label: 'January', description: 'Month 01' },
  { value: '2', label: 'February', description: 'Month 02' },
  { value: '3', label: 'March', description: 'Month 03' },
  { value: '4', label: 'April', description: 'Month 04' },
  { value: '5', label: 'May', description: 'Month 05' },
  { value: '6', label: 'June', description: 'Month 06' },
  { value: '7', label: 'July', description: 'Month 07' },
  { value: '8', label: 'August', description: 'Month 08' },
  { value: '9', label: 'September', description: 'Month 09' },
  { value: '10', label: 'October', description: 'Month 10' },
  { value: '11', label: 'November', description: 'Month 11' },
  { value: '12', label: 'December', description: 'Month 12' }
]

export function getCurrentPayslipYear() {
  return new Date().getFullYear()
}

export function getCurrentPayslipMonth() {
  return new Date().getMonth() + 1
}

export function getPayslipMonthName(month) {
  const normalizedMonth = Number(month)
  return PAYSLIP_MONTH_OPTIONS.find((option) => Number(option.value) === normalizedMonth)?.label || '—'
}

export function formatPayslipPeriod(month, year) {
  const monthName = getPayslipMonthName(month)
  return monthName === '—' || !year ? '—' : `${monthName} ${year}`
}

export function formatFileSize(bytes) {
  const value = Number(bytes || 0)
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function buildPayslipYearOptions(payslips = []) {
  const currentYear = getCurrentPayslipYear()
  const years = new Set([currentYear, currentYear - 1])
  ;(Array.isArray(payslips) ? payslips : []).forEach((payslip) => {
    const year = Number(payslip?.salaryYear)
    if (Number.isFinite(year)) years.add(year)
  })

  return Array.from(years)
    .sort((left, right) => right - left)
    .map((year) => ({ value: String(year), label: String(year), description: `${year} salary year` }))
}

export function toPayslipFileName(payslip = {}) {
  const period = formatPayslipPeriod(payslip.salaryMonth, payslip.salaryYear).replace(/\s+/g, '_')
  return `payslip_${period || payslip.uid || 'document'}.pdf`
}
