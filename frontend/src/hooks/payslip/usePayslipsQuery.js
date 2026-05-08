import { useQuery } from '@tanstack/react-query'
import { payslipService } from '../../api/services/payslip.service.js'

export const PAYSLIPS_QUERY_KEY = ['payslip-management', 'all']
export const MY_PAYSLIPS_QUERY_KEY = ['payslip-management', 'my']

export function usePayslipsQuery(enabled = true) {
  return useQuery({
    queryKey: PAYSLIPS_QUERY_KEY,
    queryFn: () => payslipService.listAllPayslips(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}

export function useMyPayslipsQuery(enabled = true) {
  return useQuery({
    queryKey: MY_PAYSLIPS_QUERY_KEY,
    queryFn: () => payslipService.listMyPayslips(),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always'
  })
}
