import { useQuery } from '@tanstack/react-query'
import { attendanceService } from '../../api/services/attendance.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

export function useRegularizationLogsQuery(regularizationUid, enabled = true) {
  const queryKey = ['attendance', 'regularization-logs', regularizationUid]

  return useQuery({
    queryKey,
    queryFn: () => withPersistentCache(queryKey, () => attendanceService.getRegularizationLogs(regularizationUid)),
    enabled: enabled && Boolean(regularizationUid),
    initialData: () => readCachedQuery(queryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(queryKey),
    staleTime: 45 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}
