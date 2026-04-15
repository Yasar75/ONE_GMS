import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../api/services/dashboard.service.js'

export function useEmployeeDashboardQuery(enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'employee'],
    queryFn: dashboardService.getEmployeeDashboard,
    enabled,
    staleTime: 0,
    gcTime: 15 * 60 * 1000
  })
}
