import * as XLSX from 'xlsx'

export const TASK_IMPORT_HEADERS = [
  'Employee Code',
  'Project Code',
  'Task Date',
  'Hours Worked',
  'Overtime',
  'Tasks Completed',
  'Tasks In Progress',
  'Tasks In Rework',
  'Tasks Approved',
  'Tasks Rejected',
  'Tasks Reviewed',
  'Remarks'
]

export const TASK_IMPORT_TEMPLATE_SAMPLE_ROWS = [
  ['EMP-2001', 'PRJ-1001', '2026-04-10', '8', 'No', '12', '3', '1', '10', '1', '2', 'Daily production updates'],
  ['EMP-2002', 'PRJ-1002', '10/04/2026', '10', 'Yes', '7', '4', '2', '5', '1', '3', 'Handled review backlog and overtime support']
]

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function serializeRowsToCsv(rows = []) {
  return rows
    .map((row) => (Array.isArray(row) ? row : [])
      .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
      .join(','))
    .join('\n')
}

export function downloadTasksAsCsv(records = []) {
  const headers = [
    'Task Date',
    'Employee Code',
    'Employee Name',
    'Project Code',
    'Project Name',
    'Hours Worked',
    'Tasks Completed',
    'Tasks In Progress',
    'Tasks In Rework',
    'Tasks Approved',
    'Tasks Rejected',
    'Tasks Reviewed',
    'Remarks'
  ]

  const rows = (Array.isArray(records) ? records : []).map((task) => ([
    task.taskDate || '',
    task.employeeCode || '',
    task.employeeName || '',
    task.projectCode || '',
    task.projectName || '',
    task.hourWork ?? 0,
    task.taskCompleted ?? 0,
    task.taskInprogress ?? 0,
    task.taskRework ?? 0,
    task.taskApproved ?? 0,
    task.taskRejected ?? 0,
    task.taskReviewed ?? 0,
    task.remarks || ''
  ]))

  const csvContent = serializeRowsToCsv([headers, ...rows])
  const blob = new Blob([`${csvContent}\n`], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `task-directory-${Date.now()}.csv`)
}

export function downloadTasksAsExcel(records = []) {
  const headers = [
    'Task Date',
    'Employee Code',
    'Employee Name',
    'Project Code',
    'Project Name',
    'Hours Worked',
    'Tasks Completed',
    'Tasks In Progress',
    'Tasks In Rework',
    'Tasks Approved',
    'Tasks Rejected',
    'Tasks Reviewed',
    'Remarks'
  ]

  const rows = (Array.isArray(records) ? records : []).map((task) => ([
    task.taskDate || '',
    task.employeeCode || '',
    task.employeeName || '',
    task.projectCode || '',
    task.projectName || '',
    task.hourWork ?? 0,
    task.taskCompleted ?? 0,
    task.taskInprogress ?? 0,
    task.taskRework ?? 0,
    task.taskApproved ?? 0,
    task.taskRejected ?? 0,
    task.taskReviewed ?? 0,
    task.remarks || ''
  ]))

  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks')
  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, `task-directory-${Date.now()}.xlsx`)
}

export function downloadTaskImportTemplateCsv() {
  const csvContent = serializeRowsToCsv([TASK_IMPORT_HEADERS, ...TASK_IMPORT_TEMPLATE_SAMPLE_ROWS])
  const blob = new Blob([`${csvContent}\n`], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, 'task-import-template.csv')
}

export function downloadTaskImportTemplateExcel() {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([TASK_IMPORT_HEADERS, ...TASK_IMPORT_TEMPLATE_SAMPLE_ROWS])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Task Import')
  const workbookBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([workbookBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  downloadBlob(blob, 'task-import-template.xlsx')
}

function parseCsvLine(line = '') {
  const values = []
  let current = ''
  let isQuoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        current += '"'
        index += 1
      } else {
        isQuoted = !isQuoted
      }
      continue
    }

    if (char === ',' && !isQuoted) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

export function normalizeImportHeader(header = '') {
  return String(header || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function parseBulkCsv(content = '') {
  const lines = String(content || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())

  if (lines.length <= 1) {
    return { headers: [], rows: [] }
  }

  const headers = parseCsvLine(lines[0]).map(normalizeImportHeader)
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const mappedRow = headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] ?? ''
      return accumulator
    }, {})
    return Object.values(mappedRow).some((value) => String(value || '').trim()) ? mappedRow : null
  }).filter(Boolean)

  return { headers, rows }
}

async function parseBulkXlsx(file) {
  const workbookBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(workbookBuffer, { type: 'array', raw: true, cellDates: false })
  const [firstSheetName] = workbook.SheetNames
  if (!firstSheetName) return { headers: [], rows: [] }

  const firstSheet = workbook.Sheets[firstSheetName]
  const sheetRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: true, defval: '' })
  if (!Array.isArray(sheetRows) || sheetRows.length <= 1) return { headers: [], rows: [] }

  const headers = (Array.isArray(sheetRows[0]) ? sheetRows[0] : []).map(normalizeImportHeader)
  const rows = sheetRows.slice(1).map((sheetRow) => {
    const values = Array.isArray(sheetRow) ? sheetRow : []
    const mappedRow = headers.reduce((accumulator, header, index) => {
      accumulator[header] = values[index] ?? ''
      return accumulator
    }, {})
    return Object.values(mappedRow).some((value) => String(value || '').trim()) ? mappedRow : null
  }).filter(Boolean)

  return { headers, rows }
}

function getImportFileExtension(fileName = '') {
  const segments = String(fileName || '').toLowerCase().trim().split('.')
  return segments.length > 1 ? segments.pop() : ''
}

export async function parseProjectManagementImportFile(file) {
  const extension = getImportFileExtension(file?.name || '')

  if (extension === 'csv') {
    const content = await file.text()
    return parseBulkCsv(content)
  }

  if (extension === 'xls') {
    throw new Error('Legacy Excel .xls is not supported. Please upload an .xlsx file.')
  }

  if (extension === 'xlsx') {
    return parseBulkXlsx(file)
  }

  throw new Error('Unsupported file format. Upload CSV or Excel (.xlsx).')
}

export function pickImportValue(row, aliases = []) {
  const selectedValue = (Array.isArray(aliases) ? aliases : []).reduce((selected, alias) => {
    if (String(selected ?? '').trim()) return selected
    return row?.[normalizeImportHeader(alias)] ?? ''
  }, '')

  return String(selectedValue ?? '')
}
