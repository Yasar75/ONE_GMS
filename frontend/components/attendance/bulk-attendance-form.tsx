"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock, CheckSquare } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useLayout } from "@/components/layout/layout-provider"
import { mockEmployees } from "@/lib/mock-data"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface BulkAttendanceFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function BulkAttendanceForm({ onSubmit, onCancel }: BulkAttendanceFormProps) {
  const { employees } = useLayout()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [date, setDate] = useState<Date>(new Date())
  const [selectAll, setSelectAll] = useState(false)

 
  const employeeData = employees.length > 0 ? employees : mockEmployees

   console.log("employeData",employeeData)

  const [formData, setFormData] = useState({
    selectedEmployees: [] as string[],
    checkIn: "09:00",
    checkOut: "17:00",
    status: "Present",
  })

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate)
      setCalendarOpen(false)
    }
  }

  const handleTimeChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSelectAllEmployees = (checked: boolean) => {
    setSelectAll(checked)
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        selectedEmployees: employeeData.map((emp) => emp.id),
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedEmployees: [],
      }))
    }
  }

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        selectedEmployees: [...prev.selectedEmployees, employeeId],
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        selectedEmployees: prev.selectedEmployees.filter((id) => id !== employeeId),
      }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      date,
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
                className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
            </PopoverContent>
          </Popover>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="employees">
              Select Employees <span className="text-red-500">*</span>
            </Label>
            <div className="flex items-center space-x-2">
              <Checkbox id="selectAll" checked={selectAll} onCheckedChange={handleSelectAllEmployees} />
              <Label htmlFor="selectAll" className="text-sm font-medium">
                Select All
              </Label>
            </div>
          </div>

          <Card>
            <CardContent className="p-4">
              <ScrollArea className="h-[200px] pr-4">
                <div className="space-y-2">
                  {employeeData.map((employee) => (
                    <div key={employee.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`employee-${employee.id}`}
                        checked={formData.selectedEmployees.includes(employee.id)}
                        onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked === true)}
                      />
                      <Label htmlFor={`employee-${employee.id}`} className="flex-1">
                        {employee.name} - {employee.position}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="text-sm text-muted-foreground">{formData.selectedEmployees.length} employees selected</div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-sky-600 hover:bg-sky-700"
          disabled={formData.selectedEmployees.length === 0}
        >
          <CheckSquare className="h-4 w-4 mr-2" />
          Mark Attendance
        </Button>
      </div>
    </form>
  )
}
