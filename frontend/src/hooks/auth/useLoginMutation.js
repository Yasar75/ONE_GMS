import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authService } from '../../api/services/auth.service.js'
import { storage } from '../../utils/storage.js'
import { AUTH_STORAGE_KEYS, getErrorMessage } from '../../utils/auth.js'

export function useLoginMutation({ onSuccess } = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ email, password }) => {
      const loginResult = await authService.login({ email, password })

      storage.set(AUTH_STORAGE_KEYS.accessToken, loginResult.access_token)
      storage.set(AUTH_STORAGE_KEYS.refreshToken, loginResult.refresh_token)

      const user = await authService.getCurrentUser()
      return { ...loginResult, user }
    },
    onSuccess: async (result, variables) => {
      storage.set(AUTH_STORAGE_KEYS.user, result.user)
      queryClient.setQueryData(['auth', 'me'], result.user)
      await onSuccess?.(result, variables, queryClient)
    },
    onError: () => {
      storage.remove(AUTH_STORAGE_KEYS.accessToken)
      storage.remove(AUTH_STORAGE_KEYS.refreshToken)
    },
    meta: {
      errorMessage: getErrorMessage
    }
  })
}
