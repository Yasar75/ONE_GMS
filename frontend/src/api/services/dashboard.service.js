import { dashboardMock } from '../../mocks/dashboard.mock.js'

export const dashboardService = {
  async getAdminDashboard() { return dashboardMock.getAdmin() },
  async getEmployeeDashboard() { return dashboardMock.getEmployee() }
}
