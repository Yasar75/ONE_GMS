"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Phone, Building, Calendar, Eye, Pencil, Trash2 } from "lucide-react"
import { useLayout } from "@/components/layout/layout-provider"
import { mockEmployees } from "@/lib/mock-data"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ViewEmployeeDetails } from "@/components/employees/view-employee-details"
import { EditEmployeeForm } from "@/components/employees/edit-employee-form"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function EmployeeCards() {
  const { employees, updateEmployee, deleteEmployee } = useLayout()
  const { toast } = useToast()

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)

  // Use employees from context if available, otherwise use mock data
  const employeeData = employees.length > 0 ? employees : mockEmployees

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
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "Marketing":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      case "Human Resources":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      case "Finance":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "Sales":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "Operations":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "On Leave":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "Remote":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const handleEditEmployee = (employee: any) => {
    updateEmployee(employee)
    setEditDialogOpen(false)

    toast({
      title: "Employee Updated",
      description: `${employee.name}'s information has been updated.`,
    })
  }

  const handleDeleteEmployee = () => {
    if (selectedEmployee) {
      deleteEmployee(selectedEmployee.id)
      setDeleteDialogOpen(false)

      toast({
        title: "Employee Deleted",
        description: `${selectedEmployee.name} has been removed from the directory.`,
        variant: "destructive",
      })
    }
  }

  const openViewDialog = (employee: any) => {
    setSelectedEmployee(employee)
    setViewDialogOpen(true)
  }

  const openEditDialog = (employee: any) => {
    setSelectedEmployee(employee)
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (employee: any) => {
    setSelectedEmployee(employee)
    setDeleteDialogOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employeeData.map((employee) => (
          <Card key={employee.id} className="overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-sky-600 to-indigo-600"></div>
            <CardContent className="p-0">
              <div className="relative px-6 pb-6">
                <div className="absolute -top-10 left-6">
                  <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                    <AvatarImage src={getReliableAvatarUrl(employee) || "/placeholder.svg"} alt={employee.name} />
                    <AvatarFallback className="text-2xl">{employee.name.charAt(0) || "A"}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="pt-12">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{employee.name}</h3>
                      <p className="text-sm text-muted-foreground">{employee.position}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Badge variant="outline" className={getDepartmentColor(employee.department)}>
                        {employee.department}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(employee.status)}>
                        {employee.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center text-sm">
                      <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                    {employee.phone && (
                      <div className="flex items-center text-sm">
                        <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{employee.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center text-sm">
                      <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>ID: {employee.employeeId}</span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Joined: {employee.joinDate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t p-3 flex justify-between bg-slate-50 dark:bg-slate-900/20">
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={() => openViewDialog(employee)}
              >
                <Eye className="h-4 w-4 mr-1" /> View
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => openEditDialog(employee)}
              >
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => openDeleteDialog(employee)}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* View Employee Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && <ViewEmployeeDetails employee={selectedEmployee} />}
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <EditEmployeeForm
              employee={selectedEmployee}
              onSubmit={handleEditEmployee}
              onCancel={() => setEditDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedEmployee?.name}'s record and remove
              their data from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEmployee} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
