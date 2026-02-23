"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Clock } from "lucide-react"
import { format, parse } from "date-fns"
import { cn } from "@/lib/utils"

interface EditAttendanceFormProps {
  attendance: any
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function EditAttendanceForm({ attendance, onSubmit, onCancel }: EditAttendanceFormProps) {
  const [formData, setFormData] = useState({ ...attendance })
  const [calendarOpen, setCalendarOpen] = useState(false)

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    attendance.date ? new Date(attendance.date) : new Date(),
  )

  useEffect(() => {
    setFormData({ ...attendance })

    // Try to parse the date
    try {
      if (attendance.date) {
        // Try different date formats
        let parsedDate: Date | undefined
        try {
          parsedDate = parse(attendance.date, "MMMM d, yyyy", new Date())
        } catch {
          try {
            parsedDate = parse(attendance.date, "yyyy-MM-dd", new Date())
          } catch {
            try {
              parsedDate = new Date(attendance.date)
            } catch {
              parsedDate = new Date()
            }
          }
        }
        setSelectedDate(parsedDate)
      }
    } catch (error) {
      console.error("Error parsing date:", error)
    }
  }, [attendance])

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

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) {
      setFormData((prev) => ({ ...prev, date: format(date, "MMMM d, yyyy") }))
      setCalendarOpen(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
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
              <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeName">Employee</Label>
          <Input id="employeeName" value={formData.employeeName} readOnly className="bg-gray-50" />
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
          Save Changes
        </Button>
      </div>
    </form>
  )
}
