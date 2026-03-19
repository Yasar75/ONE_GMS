import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../api/services/dashboard.service.js'

export function useEmployeeDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: dashboardService.getEmployeeDashboard,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  })
}
