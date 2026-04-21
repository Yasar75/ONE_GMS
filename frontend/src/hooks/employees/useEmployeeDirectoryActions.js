import { useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../../api/services/employee.service.js'
import { normalizeEmployee, sortEmployees } from '../../utils/employee.js'

const EMPLOYEE_DIRECTORY_QUERY_KEY = ['employees', 'directory']
const EMPLOYEE_LOOKUP_QUERY_KEY = ['employees', 'lookup-directory']
const EMPLOYEE_PROFILE_REQUESTS_QUERY_KEY = ['employees', 'profile-requests']
const EMPLOYEE_OPTIMISTIC_QUERY_KEYS = [EMPLOYEE_DIRECTORY_QUERY_KEY, EMPLOYEE_LOOKUP_QUERY_KEY]

function createOptimisticUid(prefix = 'employee') {
  return `optimistic-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getEmployeeIdentity(record = {}) {
  const uid = String(record.uid || '').trim()
  if (uid) return `uid:${uid}`

  const userUid = String(record.userUid || '').trim()
  if (userUid) return `user:${userUid}`

  const email = String(record.email || '').trim().toLowerCase()
  if (email) return `email:${email}`

  const code = String(record.employeeCode || record.id || '').trim().toLowerCase()
  return code ? `code:${code}` : ''
}

function matchesEmployeeIdentity(record = {}, identity = '') {
  if (!identity) return false
  return getEmployeeIdentity(record) === identity
}

function mergeEmployeeRecord(existing = null, next = null) {
  if (!existing) return next
  if (!next) return existing
  return normalizeEmployee({
    ...existing,
    ...next,
    uid: next.uid || existing.uid,
    employeeCode: next.employeeCode || existing.employeeCode,
    id: next.employeeCode || next.id || existing.employeeCode || existing.id,
    createdAt: existing.createdAt || next.createdAt,
    updatedAt: next.updatedAt || new Date().toISOString()
  })
}

export function useEmployeeDirectoryActions() {
  const queryClient = useQueryClient()

  function snapshotEmployeeCaches() {
    return EMPLOYEE_OPTIMISTIC_QUERY_KEYS.map((queryKey) => ({
      queryKey,
      data: queryClient.getQueryData(queryKey)
    }))
  }

  function restoreEmployeeCaches(snapshots = []) {
    snapshots.forEach(({ queryKey, data }) => {
      queryClient.setQueryData(queryKey, data)
    })
  }

  function setEmployeeCacheData(updater) {
    EMPLOYEE_OPTIMISTIC_QUERY_KEYS.forEach((queryKey) => {
      queryClient.setQueryData(queryKey, (current) => {
        const currentRows = Array.isArray(current) ? current : []
        return sortEmployees(updater(currentRows).map((entry) => normalizeEmployee(entry)).filter(Boolean))
      })
    })
  }

  function findCachedEmployee(employeeUid) {
    const targetUid = String(employeeUid || '').trim()
    if (!targetUid) return null

    for (const queryKey of EMPLOYEE_OPTIMISTIC_QUERY_KEYS) {
      const rows = queryClient.getQueryData(queryKey)
      const found = Array.isArray(rows)
        ? rows.find((entry) => String(entry.uid || '') === targetUid)
        : null
      if (found) return found
    }

    return null
  }

  function replaceOptimisticEmployee(identity, nextRecord) {
    const normalizedNextRecord = normalizeEmployee(nextRecord)
    if (!normalizedNextRecord) return

    setEmployeeCacheData((rows) => {
      const withoutPrevious = rows.filter((entry) => !matchesEmployeeIdentity(entry, identity))
      return [...withoutPrevious, normalizedNextRecord]
    })
  }

  async function refreshDirectory() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_DIRECTORY_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_LOOKUP_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_PROFILE_REQUESTS_QUERY_KEY })
    ])

    await Promise.all([
      queryClient.fetchQuery({ queryKey: EMPLOYEE_DIRECTORY_QUERY_KEY, queryFn: employeeService.getDirectory }),
      queryClient.fetchQuery({ queryKey: EMPLOYEE_LOOKUP_QUERY_KEY, queryFn: employeeService.getLookupDirectory }),
      queryClient.fetchQuery({ queryKey: EMPLOYEE_PROFILE_REQUESTS_QUERY_KEY, queryFn: employeeService.getProfileRequests }).catch(() => [])
    ])
  }

  return {
    async addEmployee(payload) {
      await employeeService.createEmployee(payload)
      return refreshDirectory()
    },

    addEmployeeOptimistic(payload) {
      const snapshots = snapshotEmployeeCaches()
      const optimisticEmployee = normalizeEmployee({
        ...payload,
        uid: payload?.uid || createOptimisticUid('create'),
        createdAt: payload?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        __optimistic: true
      })
      const optimisticIdentity = getEmployeeIdentity(optimisticEmployee)

      setEmployeeCacheData((rows) => [...rows.filter((entry) => !matchesEmployeeIdentity(entry, optimisticIdentity)), optimisticEmployee])

      const request = employeeService.createEmployee(payload)
        .then(async (savedEmployee) => {
          replaceOptimisticEmployee(optimisticIdentity, savedEmployee || optimisticEmployee)
          await refreshDirectory()
          return savedEmployee
        })
        .catch((error) => {
          restoreEmployeeCaches(snapshots)
          throw error
        })

      return { optimisticEmployee, request }
    },

    async bulkAddEmployees(payloads = []) {
      for (const payload of payloads) {
        await employeeService.createEmployee(payload)
      }
      return refreshDirectory()
    },

    async updateEmployee(employeeUid, payload) {
      await employeeService.updateEmployee(employeeUid, payload)
      return refreshDirectory()
    },

    updateEmployeeOptimistic(employeeUid, payload) {
      const snapshots = snapshotEmployeeCaches()
      const existingEmployee = findCachedEmployee(employeeUid)
      const optimisticEmployee = mergeEmployeeRecord(existingEmployee, {
        ...payload,
        uid: employeeUid,
        __optimistic: true
      })
      const optimisticIdentity = getEmployeeIdentity(optimisticEmployee || { uid: employeeUid })

      if (optimisticEmployee) {
        setEmployeeCacheData((rows) => {
          const wasPresent = rows.some((entry) => matchesEmployeeIdentity(entry, optimisticIdentity) || String(entry.uid || '') === String(employeeUid || ''))
          const nextRows = rows.map((entry) => (
            matchesEmployeeIdentity(entry, optimisticIdentity) || String(entry.uid || '') === String(employeeUid || '')
              ? optimisticEmployee
              : entry
          ))
          return wasPresent ? nextRows : [...nextRows, optimisticEmployee]
        })
      }

      const request = employeeService.updateEmployee(employeeUid, payload)
        .then(async (savedEmployee) => {
          replaceOptimisticEmployee(optimisticIdentity, savedEmployee || optimisticEmployee)
          await refreshDirectory()
          return savedEmployee
        })
        .catch((error) => {
          restoreEmployeeCaches(snapshots)
          throw error
        })

      return { optimisticEmployee, request }
    },

    async deleteEmployee(employeeUid) {
      await employeeService.deleteEmployee(employeeUid)
      return refreshDirectory()
    },

    deleteEmployeeOptimistic(employeeUid) {
      const snapshots = snapshotEmployeeCaches()
      const targetUid = String(employeeUid || '').trim()

      setEmployeeCacheData((rows) => rows.filter((entry) => String(entry.uid || '') !== targetUid))

      const request = employeeService.deleteEmployee(employeeUid)
        .then(async (deletedUid) => {
          await refreshDirectory()
          return deletedUid
        })
        .catch((error) => {
          restoreEmployeeCaches(snapshots)
          throw error
        })

      return { request }
    }
  }
}
