import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import {
  normalizeEmployee,
  sortEmployees,
  toEmployeeApiPayload
} from '../../utils/employee.js'

export const employeeService = {
  async getLookupDirectory() {
    const response = await http.get(endpoints.employee.list)
    const employeeRecords = Array.isArray(response.data) ? response.data : []
    return sortEmployees(employeeRecords.map(normalizeEmployee).filter(Boolean))
  },

  async getDirectory() {
    const response = await http.get(endpoints.employee.list)
    const employeeRecords = Array.isArray(response.data) ? response.data : []
    return sortEmployees(employeeRecords.map(normalizeEmployee).filter(Boolean))
  },

  async createEmployee(payload) {
    const response = await http.post(endpoints.employee.create, toEmployeeApiPayload(payload))
    return normalizeEmployee(response.data)
  },

  async updateEmployee(employeeUid, payload) {
    const response = await http.put(endpoints.employee.detail(employeeUid), toEmployeeApiPayload(payload))
    return normalizeEmployee(response.data)
  },

  async deleteEmployee(employeeUid) {
    await http.delete(endpoints.employee.detail(employeeUid))
    return employeeUid
  }
}
