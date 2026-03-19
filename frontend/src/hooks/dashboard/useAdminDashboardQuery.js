import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../../api/services/dashboard.service.js'

export function useAdminDashboardQuery() {
  return useQuery({
    queryKey: ['dashboard', 'admin'],
    queryFn: dashboardService.getAdminDashboard,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  })
}
