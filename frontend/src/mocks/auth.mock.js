import { ROLES } from '../utils/role.js'

function sleep(ms){ return new Promise((r) => setTimeout(r, ms)) }

export const authMock = {
  async login({ role, email, password }) {
    await sleep(450)
    const safeRole = role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.EMPLOYEE
    const firstName = safeRole === ROLES.ADMIN ? 'Admin' : 'Employee'
    return {
      token: 'mock-token',
      user: {
        id: safeRole === ROLES.ADMIN ? 'u-admin-1' : 'u-emp-1',
        firstName,
        role: safeRole,
        email: email || (safeRole === ROLES.ADMIN ? 'admin@one_gms.local' : 'employee@one_gms.local'),
        avatarUrl: ''
      }
    }
  }
}
