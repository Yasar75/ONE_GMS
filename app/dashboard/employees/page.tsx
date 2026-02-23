import  EmployeeDirectory  from "@/components/employees/employee-directory"

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Employee Directory</h1>
      </div>
      <EmployeeDirectory />
    </div>
  )
}
