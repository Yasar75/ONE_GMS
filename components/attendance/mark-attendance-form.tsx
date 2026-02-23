"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useLayout } from "@/components/layout/layout-provider"
import { mockEmployees } from "@/lib/mock-data"

interface MarkAttendanceFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
  selectedDate: Date
  onDateChange: (date: Date) => void
}

export function MarkAttendanceForm({ onSubmit, onCancel, selectedDate, onDateChange }: MarkAttendanceFormProps) {
  const { employees } = useLayout()
  const [calendarOpen, setCalendarOpen] = useState(false)

  // Use employees from context if available, otherwise use mock data
  const employeeData = employees.length > 0 ? employees : mockEmployees

  const [formData, setFormData] = useState({
    employeeId: "",
    employeeName: "",
    checkIn: "",
    checkOut: "",
    checkInStatus: "on-time",
    checkOutStatus: "on-time",
    workingHours: "0",
    status: "Present",
  })

  const handleEmployeeChange = (employeeId: string) => {
    const employee = employeeData.find((emp) => emp.id === employeeId || emp.employeeId === employeeId)
    if (employee) {
      setFormData({
        ...formData,
        employeeId: employee.employeeId || employee.id,
        employeeName: employee.name,
      })
    }
  }

  const handleTimeChange = (field: string, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value }

      // Calculate working hours if both check-in and check-out are provided
      if (newData.checkIn && newData.checkOut) {
        try {
          const checkIn = new Date(`2000-01-01 ${newData.checkIn}`)
          const checkOut = new Date(`2000-01-01 ${newData.checkOut}`)

          // If check-out is earlier than check-in, assume it's the next day
          let diff = checkOut.getTime() - checkIn.getTime()
          if (diff < 0) {
            diff += 24 * 60 * 60 * 1000 // Add 24 hours
          }

          const hours = Math.round((diff / (1000 * 60 * 60)) * 100) / 100
          newData.workingHours = hours.toString()

          // Set status based on working hours
          if (hours === 0) {
            newData.status = "Absent"
          } else if (hours < 4) {
            newData.status = "Half Day"
          } else {
            newData.status = "Present"
          }

          // Set check-in status
          const checkInHour = checkIn.getHours()
          const checkInMinute = checkIn.getMinutes()
          if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
            newData.checkInStatus = "late"
          } else {
            newData.checkInStatus = "on-time"
          }

          // Set check-out status
          const checkOutHour = checkOut.getHours()
          const checkOutMinute = checkOut.getMinutes()
          if (checkOutHour < 17 || (checkOutHour === 17 && checkOutMinute < 0)) {
            newData.checkOutStatus = "early"
          } else {
            newData.checkOutStatus = "on-time"
          }
        } catch (error) {
          console.error("Error calculating working hours:", error)
        }
      }

      return newData
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      date: format(selectedDate, "MMMM d, yyyy"),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="date">
            Date <span className="text-red-500">*</span>
          </Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  if (date) {
                    onDateChange(date)
                    setCalendarOpen(false)
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employee">
            Employee <span className="text-red-500">*</span>
          </Label>
          <Select value={formData.employeeId} onValueChange={handleEmployeeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employeeData.map((employee) => (
                <SelectItem key={employee.id} value={employee.employeeId || employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="checkIn">
              Check In Time <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                id="checkIn"
                type="time"
                value={formData.checkIn}
                onChange={(e) => handleTimeChange("checkIn", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkOut">
              Check Out Time <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                id="checkOut"
                type="time"
                value={formData.checkOut}
                onChange={(e) => handleTimeChange("checkOut", e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workingHours">Working Hours</Label>
            <Input id="workingHours" type="text" value={formData.workingHours} readOnly className="bg-gray-50" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Present">Present</SelectItem>
                <SelectItem value="Absent">Absent</SelectItem>
                <SelectItem value="Half Day">Half Day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
          Mark Attendance
        </Button>
      </div>
    </form>
  )
}
