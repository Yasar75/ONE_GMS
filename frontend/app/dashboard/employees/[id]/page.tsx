import { EmployeeProfile } from "@/components/employees/employee-profile"
import { getEmployeeById } from "@/lib/data"
import { notFound } from "next/navigation"

export default function EmployeeProfilePage({ params }: { params: { id: string } }) {
  const employee = getEmployeeById(params.id)

  if (!employee) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Employee Profile</h1>
      <EmployeeProfile employee={employee} />
    </div>
  )
}
