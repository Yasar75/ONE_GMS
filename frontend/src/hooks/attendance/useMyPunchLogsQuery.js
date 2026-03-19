import { useQuery } from '@tanstack/react-query'
import { attendanceService } from '../../api/services/attendance.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

export function useMyPunchLogsQuery(attendanceDate) {
  const queryKey = ['attendance', 'employee', 'my-logs', attendanceDate]

  return useQuery({
    queryKey,
    queryFn: () => withPersistentCache(queryKey, () => attendanceService.getMyPunchLogs(attendanceDate)),
    enabled: Boolean(attendanceDate),
    initialData: () => readCachedQuery(queryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(queryKey),
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}
