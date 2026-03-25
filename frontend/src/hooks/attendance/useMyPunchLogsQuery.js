import { useQuery } from '@tanstack/react-query'
import { attendanceService } from '../../api/services/attendance.service.js'

export function useMyPunchLogsQuery(attendanceDate, enabled = true) {
  const queryKey = ['attendance', 'employee', 'my-logs', attendanceDate]

  return useQuery({
    queryKey,
    queryFn: () => attendanceService.getMyPunchLogs(attendanceDate),
    enabled: Boolean(attendanceDate) && enabled,
    staleTime: 5 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true
  })
}
