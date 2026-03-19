import { http } from '../http.js'
import { endpoints } from '../endpoints.js'
import { normalizeUserProfile } from '../../utils/auth.js'

export const authService = {
  async login({ email, password }) {
    const response = await http.post(endpoints.auth.login, { email, password })
    return response.data
  },

  async getCurrentUser() {
    const response = await http.get(endpoints.auth.me)
    return normalizeUserProfile(response.data)
  }
}
