import { useQuery } from '@tanstack/react-query'
import { employeeService } from '../../api/services/employee.service.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

const queryKey = ['employees', 'directory']

export function useEmployeesQuery() {
  return useQuery({
    queryKey,
    queryFn: () => withPersistentCache(queryKey, employeeService.getDirectory),
    initialData: () => readCachedQuery(queryKey),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(queryKey),
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}
