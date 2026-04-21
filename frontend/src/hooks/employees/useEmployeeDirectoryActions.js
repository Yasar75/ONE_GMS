import { useQueryClient } from '@tanstack/react-query'
import { employeeService } from '../../api/services/employee.service.js'

const EMPLOYEE_DIRECTORY_QUERY_KEY = ['employees', 'directory']
const EMPLOYEE_LOOKUP_QUERY_KEY = ['employees', 'lookup-directory']
const EMPLOYEE_PROFILE_REQUESTS_QUERY_KEY = ['employees', 'profile-requests']

export function useEmployeeDirectoryActions() {
  const queryClient = useQueryClient()

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

    async deleteEmployee(employeeUid) {
      await employeeService.deleteEmployee(employeeUid)
      return refreshDirectory()
    }
  }
}
