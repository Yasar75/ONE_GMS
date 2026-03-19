export const ROLES = { ADMIN: 'ADMIN', EMPLOYEE: 'EMPLOYEE' }

export function roleLabel(role) {
  return role === ROLES.ADMIN ? 'Admin' : 'Employee'
}

export function roleInitial(role) {
  return role === ROLES.ADMIN ? 'A' : 'E'
}
