"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLayout } from "@/components/layout/layout-provider"
import { mockEmployees } from "@/lib/mock-data"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ViewEmployeeDetails } from "@/components/employees/view-employee-details"
import { Users, ChevronRight } from "lucide-react"

export function TeamMembersShowcase() {
  const { employees } = useLayout()

  // Dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)

  // Use employees from context if available, otherwise use mock data
  const employeeData = employees.length > 0 ? employees : mockEmployees
  // Get only the first 6 employees for showcase
  const showcaseEmployees = employeeData.slice(0, 6)

  // Get a reliable avatar URL based on employee ID
  const getReliableAvatarUrl = (employee: any) => {
    // Extract a number from the employee ID to use as an index
    const idNumber = Number.parseInt(employee.employeeId.replace(/\D/g, "")) || 1
    const gender = idNumber % 2 === 0 ? "women" : "men"
    const imageNumber = (idNumber % 30) + 1 // Limit to 30 images per gender

    return `https://randomuser.me/api/portraits/${gender}/${imageNumber}.jpg`
  }

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case "Engineering":
        return "bg-blue-100 text-blue-800"
      case "Marketing":
        return "bg-orange-100 text-orange-800"
      case "Human Resources":
        return "bg-purple-100 text-purple-800"
      case "Finance":
        return "bg-green-100 text-green-800"
      case "Sales":
        return "bg-red-100 text-red-800"
      case "Operations":
        return "bg-cyan-100 text-cyan-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const openViewDialog = (employee: any) => {
    setSelectedEmployee(employee)
    setViewDialogOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center">
            <Users className="h-4 w-4 mr-2 text-sky-600" />
            Team Members
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-8 text-xs">
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {showcaseEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors cursor-pointer"
                onClick={() => openViewDialog(employee)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-white shadow">
                    <AvatarImage src={getReliableAvatarUrl(employee) || "/placeholder.svg"} alt={employee.name} />
                    <AvatarFallback>{employee.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{employee.name}</p>
                    <p className="text-xs text-muted-foreground">{employee.position}</p>
                  </div>
                </div>
                <Badge variant="outline" className={getDepartmentColor(employee.department)}>
                  {employee.department}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* View Employee Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && <ViewEmployeeDetails employee={selectedEmployee} />}
        </DialogContent>
      </Dialog>
    </>
  )
}
