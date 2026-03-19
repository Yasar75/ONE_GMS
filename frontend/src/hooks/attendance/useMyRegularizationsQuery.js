import { useQuery } from '@tanstack/react-query'
import { attendanceService } from '../../api/services/attendance.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

const queryKey = ['attendance', 'employee', 'regularizations', 'mine']

export function useMyRegularizationsQuery() {
  return useQuery({
    queryKey,
    queryFn: () => withPersistentCache(queryKey, attendanceService.getMyRegularizations),
    initialData: () => readCachedQuery(queryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(queryKey),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}
