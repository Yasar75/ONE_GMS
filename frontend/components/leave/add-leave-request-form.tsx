"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddLeaveRequestFormProps {
  onSubmit: (data: any) => void
}

export function AddLeaveRequestForm({ onSubmit }: AddLeaveRequestFormProps) {
  const [formData, setFormData] = useState({
    employeeName: "Sarah Johnson", // Default value
    leaveType: "Vacation",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    days: "1",
    reason: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      days: Number.parseInt(formData.days),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="employeeName">Employee Name</Label>
          <Select value={formData.employeeName} onValueChange={(value) => handleSelectChange("employeeName", value)}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Sarah Johnson">Sarah Johnson</SelectItem>
              <SelectItem value="Michael Brown">Michael Brown</SelectItem>
              <SelectItem value="Emily Davis">Emily Davis</SelectItem>
              <SelectItem value="David Wilson">David Wilson</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="leaveType">Leave Type</Label>
          <Select value={formData.leaveType} onValueChange={(value) => handleSelectChange("leaveType", value)}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select leave type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Vacation">Vacation</SelectItem>
              <SelectItem value="Sick Leave">Sick Leave</SelectItem>
              <SelectItem value="Personal">Personal</SelectItem>
              <SelectItem value="Unpaid Leave">Unpaid Leave</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            type="date"
            id="startDate"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            type="date"
            id="endDate"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            className="mt-2"
          />
        </div>

        <div>
          <Label htmlFor="days">Number of Days</Label>
          <Input
            type="number"
            id="days"
            name="days"
            value={formData.days}
            onChange={handleChange}
            className="mt-2"
            min="1"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="reason">Reason for Leave</Label>
        <Input
          id="reason"
          name="reason"
          value={formData.reason}
          onChange={handleChange}
          className="mt-2"
          placeholder="Enter reason for leave"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
          Submit Request
        </Button>
      </div>
    </form>
  )
}
