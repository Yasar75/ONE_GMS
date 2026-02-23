import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { EmployeeActivity } from "@/components/dashboard/employee-activity"
import { RecentEmployees } from "@/components/dashboard/recent-employees"
import { UpcomingEvents } from "@/components/dashboard/upcoming-events"
import { DepartmentDistribution } from "@/components/dashboard/department-distribution"

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <DashboardStats />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <EmployeeActivity />
        <DepartmentDistribution />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RecentEmployees />
        <UpcomingEvents />
      </div>
    </div>
  )
}
