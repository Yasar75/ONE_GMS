import { useQuery } from '@tanstack/react-query'
import { fetchPhoneCountryOptions, getPhoneCountryOptions } from '../../utils/employee.js'
import { readCachedQuery, readCachedQueryUpdatedAt, withPersistentCache } from '../../utils/queryCache.js'

export const PHONE_COUNTRY_OPTIONS_QUERY_KEY = ['employees', 'phone-country-options', 'v1']

export function usePhoneCountryOptionsQuery(enabled = true) {
  return useQuery({
    queryKey: PHONE_COUNTRY_OPTIONS_QUERY_KEY,
    queryFn: () => withPersistentCache(PHONE_COUNTRY_OPTIONS_QUERY_KEY, fetchPhoneCountryOptions),
    enabled,
    initialData: () => readCachedQuery(PHONE_COUNTRY_OPTIONS_QUERY_KEY, getPhoneCountryOptions()),
    initialDataUpdatedAt: () => readCachedQueryUpdatedAt(PHONE_COUNTRY_OPTIONS_QUERY_KEY),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false
  })
}
