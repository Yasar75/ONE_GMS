import { useQuery } from '@tanstack/react-query'
import { attendanceService } from '../../api/services/attendance.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

const queryKey = ['attendance', 'admin', 'directory']

export function useAdminAttendanceQuery(enabled = true) {
  return useQuery({
    queryKey,
    queryFn: () => withPersistentCache(queryKey, () => attendanceService.getAllAttendance()),
    enabled,
    initialData: () => readCachedQuery(queryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(queryKey),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
