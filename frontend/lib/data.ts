import { mockEmployees } from "./mock-data"

export function getEmployeeById(id: string) {
  return mockEmployees.find((employee) => employee.id === id)
}
