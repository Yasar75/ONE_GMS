// // "use client"

// // import type React from "react"

// // import { useState, useEffect } from "react"
// // import { Button } from "@/components/ui/button"
// // import { Input } from "@/components/ui/input"
// // import { Label } from "@/components/ui/label"
// // import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// // import { Textarea } from "@/components/ui/textarea"
// // import { Calendar } from "@/components/ui/calendar"
// // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
// // import { CalendarIcon } from "lucide-react"
// // import { format, parse } from "date-fns"
// // import { cn } from "@/lib/utils"
// // import { useLayout } from "@/components/layout/layout-provider"
// // import { mockEmployees } from "@/lib/mock-data"
// // import { ScrollArea } from "@/components/ui/scroll-area"
// // import { Checkbox } from "@/components/ui/checkbox"
// // import { Slider } from "@/components/ui/slider"

// // interface EditProjectFormProps {
// //   project: any
// //   onSubmit: (data: any) => void
// //   onCancel: () => void
// // }

// // export function EditProjectForm({ project, onSubmit, onCancel }: EditProjectFormProps) {
// //   const { employees } = useLayout()
// //   const [startDateOpen, setStartDateOpen] = useState(false)
// //   const [deadlineDateOpen, setDeadlineDateOpen] = useState(false)

// //   // Use employees from context if available, otherwise use mock data
// //   const employeeData = employees.length > 0 ? employees : mockEmployees

// //   const [formData, setFormData] = useState({ ...project })

// //   const [startDate, setStartDate] = useState<Date | undefined>(
// //     project.startDate ? parseDate(project.startDate) : new Date(),
// //   )

// //   const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(
// //     project.deadline ? parseDate(project.deadline) : new Date(),
// //   )

// //   function parseDate(dateString: string): Date | undefined {
// //     try {
// //       // Try different date formats
// //       try {
// //         return parse(dateString, "MMMM d, yyyy", new Date())
// //       } catch {
// //         try {
// //           return parse(dateString, "yyyy-MM-dd", new Date())
// //         } catch {
// //           return new Date(dateString)
// //         }
// //       }
// //     } catch (error) {
// //       console.error("Error parsing date:", error)
// //       return new Date()
// //     }
// //   }

// //   useEffect(() => {
// //     setFormData({ ...project })
// //     setStartDate(parseDate(project.startDate))
// //     setDeadlineDate(parseDate(project.deadline))
// //   }, [project])

// //   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
// //     const { name, value } = e.target
// //     setFormData((prev) => ({ ...prev, [name]: value }))
// //   }

// //   const handleStartDateSelect = (date: Date | undefined) => {
// //     if (date) {
// //       setStartDate(date)
// //       setFormData((prev) => ({ ...prev, startDate: format(date, "MMMM d, yyyy") }))
// //       setStartDateOpen(false)
// //     }
// //   }

// //   const handleDeadlineDateSelect = (date: Date | undefined) => {
// //     if (date) {
// //       setDeadlineDate(date)
// //       setFormData((prev) => ({ ...prev, deadline: format(date, "MMMM d, yyyy") }))
// //       setDeadlineDateOpen(false)
// //     }
// //   }

// //   const handleTeamMemberToggle = (employeeName: string, checked: boolean) => {
// //     if (checked) {
// //       setFormData((prev) => ({
// //         ...prev,
// //         team: [...prev.team, employeeName],
// //       }))
// //     } else {
// //       setFormData((prev) => ({
// //         ...prev,
// //         team: prev.team.filter((name: string) => name !== employeeName),
// //       }))
// //     }
// //   }

// //   const handleProgressChange = (value: number[]) => {
// //     setFormData((prev) => ({ ...prev, progress: value[0] }))
// //   }

// //   const handleStatusChange = (value: string) => {
// //     setFormData((prev) => ({ ...prev, status: value }))
// //   }

// //   const handleSubmit = (e: React.FormEvent) => {
// //     e.preventDefault()
// //     onSubmit(formData)
// //   }

// //   return (
// //     <form onSubmit={handleSubmit} className="space-y-6">
// //       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
// //         <div className="space-y-2">
// //           <Label htmlFor="name">
// //             Project Name <span className="text-red-500">*</span>
// //           </Label>
// //           <Input
// //             id="name"
// //             name="name"
// //             value={formData.name}
// //             onChange={handleChange}
// //             placeholder="Enter project name"
// //             required
// //           />
// //         </div>

// //         <div className="space-y-2">
// //           <Label htmlFor="client">
// //             Client <span className="text-red-500">*</span>
// //           </Label>
// //           <Input
// //             id="client"
// //             name="client"
// //             value={formData.client}
// //             onChange={handleChange}
// //             placeholder="Enter client name"
// //             required
// //           />
// //         </div>

// //         <div className="space-y-2">
// //           <Label htmlFor="startDate">
// //             Start Date <span className="text-red-500">*</span>
// //           </Label>
// //           <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
// //             <PopoverTrigger asChild>
// //               <Button
// //                 id="startDate"
// //                 variant="outline"
// //                 className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
// //               >
// //                 <CalendarIcon className="mr-2 h-4 w-4" />
// //                 {startDate ? format(startDate, "PPP") : "Select date"}
// //               </Button>
// //             </PopoverTrigger>
// //             <PopoverContent className="w-auto p-0" align="start">
// //               <Calendar mode="single" selected={startDate} onSelect={handleStartDateSelect} initialFocus />
// //             </PopoverContent>
// //           </Popover>
// //         </div>

// //         <div className="space-y-2">
// //           <Label htmlFor="deadline">
// //             Deadline <span className="text-red-500">*</span>
// //           </Label>
// //           <Popover open={deadlineDateOpen} onOpenChange={setDeadlineDateOpen}>
// //             <PopoverTrigger asChild>
// //               <Button
// //                 id="deadline"
// //                 variant="outline"
// //                 className={cn("w-full justify-start text-left font-normal", !deadlineDate && "text-muted-foreground")}
// //               >
// //                 <CalendarIcon className="mr-2 h-4 w-4" />
// //                 {deadlineDate ? format(deadlineDate, "PPP") : "Select date"}
// //               </Button>
// //             </PopoverTrigger>
// //             <PopoverContent className="w-auto p-0" align="start">
// //               <Calendar mode="single" selected={deadlineDate} onSelect={handleDeadlineDateSelect} initialFocus />
// //             </PopoverContent>
// //           </Popover>
// //         </div>

// //         <div className="space-y-2">
// //           <Label htmlFor="status">Status</Label>
// //           <Select value={formData.status} onValueChange={handleStatusChange}>
// //             <SelectTrigger id="status">
// //               <SelectValue placeholder="Select status" />
// //             </SelectTrigger>
// //             <SelectContent>
// //               <SelectItem value="In Progress">In Progress</SelectItem>
// //               <SelectItem value="Completed">Completed</SelectItem>
// //               <SelectItem value="On Hold">On Hold</SelectItem>
// //             </SelectContent>
// //           </Select>
// //         </div>

// //         <div className="space-y-2">
// //           <div className="flex justify-between">
// //             <Label htmlFor="progress">Progress</Label>
// //             <span className="text-sm">{formData.progress}%</span>
// //           </div>
// //           <Slider
// //             id="progress"
// //             defaultValue={[formData.progress]}
// //             max={100}
// //             step={5}
// //             onValueChange={handleProgressChange}
// //             className="py-2"
// //           />
// //         </div>
// //       </div>

// //       <div className="space-y-2">
// //         <Label htmlFor="team">
// //           Team Members <span className="text-red-500">*</span>
// //         </Label>
// //         <div className="border rounded-md">
// //           <ScrollArea className="h-[200px] p-4">
// //             <div className="space-y-2">
// //               {employeeData.map((employee) => (
// //                 <div key={employee.id} className="flex items-center space-x-2">
// //                   <Checkbox
// //                     id={`team-${employee.id}`}
// //                     checked={formData.team.includes(employee.name)}
// //                     onCheckedChange={(checked) => handleTeamMemberToggle(employee.name, checked === true)}
// //                   />
// //                   <Label htmlFor={`team-${employee.id}`} className="flex-1">
// //                     {employee.name} - {employee.position}
// //                   </Label>
// //                 </div>
// //               ))}
// //             </div>
// //           </ScrollArea>
// //         </div>
// //         <p className="text-sm text-muted-foreground">{formData.team.length} team members selected</p>
// //       </div>

// //       <div className="space-y-2">
// //         <Label htmlFor="description">Project Description</Label>
// //         <Textarea
// //           id="description"
// //           name="description"
// //           value={formData.description || ""}
// //           onChange={handleChange}
// //           placeholder="Enter project description"
// //           rows={4}
// //         />
// //       </div>

// //       <div className="flex justify-end gap-2">
// //         <Button type="button" variant="outline" onClick={onCancel}>
// //           Cancel
// //         </Button>
// //         <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
// //           Save Changes
// //         </Button>
// //       </div>
// //     </form>
// //   )
// // }




// "use client"

// import type React from "react"

// import { useState, useEffect } from "react"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// import { Textarea } from "@/components/ui/textarea"
// import { Calendar } from "@/components/ui/calendar"
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
// import { CalendarIcon } from "lucide-react"
// import { format, parse } from "date-fns"
// import { cn } from "@/lib/utils"
// import { useLayout } from "@/components/layout/layout-provider"
// import { mockEmployees } from "@/lib/mock-data"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Checkbox } from "@/components/ui/checkbox"
// import { Slider } from "@/components/ui/slider"

// interface EditProjectFormProps {
//   project: any
//   onSubmit: (data: any) => void
//   onCancel: () => void
// }

// export function EditProjectForm({ project, onSubmit, onCancel }: EditProjectFormProps) {
//   const { employees } = useLayout()
//   const [startDateOpen, setStartDateOpen] = useState(false)
//   const [deadlineDateOpen, setDeadlineDateOpen] = useState(false)

//   // Use employees from context if available, otherwise use mock data
//   const employeeData = employees.length > 0 ? employees : mockEmployees

//   const [formData, setFormData] = useState({ ...project })

//   const [startDate, setStartDate] = useState<Date | undefined>(
//     project.startDate ? parseDate(project.startDate) : new Date(),
//   )

//   const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(
//     project.deadline ? parseDate(project.deadline) : new Date(),
//   )

//   function parseDate(dateString: string): Date | undefined {
//     try {
//       // Try different date formats
//       try {
//         return parse(dateString, "MMMM d, yyyy", new Date())
//       } catch {
//         try {
//           return parse(dateString, "yyyy-MM-dd", new Date())
//         } catch {
//           return new Date(dateString)
//         }
//       }
//     } catch (error) {
//       console.error("Error parsing date:", error)
//       return new Date()
//     }
//   }

//   useEffect(() => {
//     setFormData({ ...project })
//     setStartDate(parseDate(project.startDate))
//     setDeadlineDate(parseDate(project.deadline))
//   }, [project])

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target
//     setFormData((prev) => ({ ...prev, [name]: value }))
//   }

//   const handleStartDateSelect = (date: Date | undefined) => {
//     if (date) {
//       setStartDate(date)
//       setFormData((prev) => ({ ...prev, startDate: format(date, "MMMM d, yyyy") }))
//       setStartDateOpen(false)
//     }
//   }

//   const handleDeadlineDateSelect = (date: Date | undefined) => {
//     if (date) {
//       setDeadlineDate(date)
//       setFormData((prev) => ({ ...prev, deadline: format(date, "MMMM d, yyyy") }))
//       setDeadlineDateOpen(false)
//     }
//   }

//   const handleTeamMemberToggle = (employeeName: string, checked: boolean) => {
//     if (checked) {
//       setFormData((prev) => ({
//         ...prev,
//         team: [...prev.team, employeeName],
//       }))
//     } else {
//       setFormData((prev) => ({
//         ...prev,
//         team: prev.team.filter((name: string) => name !== employeeName),
//       }))
//     }
//   }

//   const handleProgressChange = (value: number[]) => {
//     setFormData((prev) => ({ ...prev, progress: value[0] }))
//   }

//   const handleStatusChange = (value: string) => {
//     setFormData((prev) => ({ ...prev, status: value }))
//   }

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault()
//     onSubmit(formData)
//   }

//   return (
//     <form onSubmit={handleSubmit} className="space-y-6">
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         <div className="space-y-2">
//           <Label htmlFor="name">
//             Project Name <span className="text-red-500">*</span>
//           </Label>
//           <Input
//             id="name"
//             name="name"
//             value={formData.name}
//             onChange={handleChange}
//             placeholder="Enter project name"
//             required
//           />
//         </div>

//         <div className="space-y-2">
//           <Label htmlFor="client">
//             Client <span className="text-red-500">*</span>
//           </Label>
//           <Input
//             id="client"
//             name="client"
//             value={formData.client}
//             onChange={handleChange}
//             placeholder="Enter client name"
//             required
//           />
//         </div>

//         <div className="space-y-2">
//           <Label htmlFor="startDate">
//             Start Date <span className="text-red-500">*</span>
//           </Label>
//           <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
//             <PopoverTrigger asChild>
//               <Button
//                 id="startDate"
//                 variant="outline"
//                 className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
//               >
//                 <CalendarIcon className="mr-2 h-4 w-4" />
//                 {startDate ? format(startDate, "PPP") : "Select date"}
//               </Button>
//             </PopoverTrigger>
//             <PopoverContent className="w-auto p-0" align="start">
//               <Calendar mode="single" selected={startDate} onSelect={handleStartDateSelect} initialFocus />
//             </PopoverContent>
//           </Popover>
//         </div>

//         <div className="space-y-2">
//           <Label htmlFor="deadline">
//             Deadline <span className="text-red-500">*</span>
//           </Label>
//           <Popover open={deadlineDateOpen} onOpenChange={setDeadlineDateOpen}>
//             <PopoverTrigger asChild>
//               <Button
//                 id="deadline"
//                 variant="outline"
//                 className={cn("w-full justify-start text-left font-normal", !deadlineDate && "text-muted-foreground")}
//               >
//                 <CalendarIcon className="mr-2 h-4 w-4" />
//                 {deadlineDate ? format(deadlineDate, "PPP") : "Select date"}
//               </Button>
//             </PopoverTrigger>
//             <PopoverContent className="w-auto p-0" align="start">
//               <Calendar mode="single" selected={deadlineDate} onSelect={handleDeadlineDateSelect} initialFocus />
//             </PopoverContent>
//           </Popover>
//         </div>

//         <div className="space-y-2">
//           <Label htmlFor="status">Status</Label>
//           <Select value={formData.status} onValueChange={handleStatusChange}>
//             <SelectTrigger id="status">
//               <SelectValue placeholder="Select status" />
//             </SelectTrigger>
//             <SelectContent>
//               <SelectItem value="In Progress">In Progress</SelectItem>
//               <SelectItem value="Completed">Completed</SelectItem>
//               <SelectItem value="On Hold">On Hold</SelectItem>
//             </SelectContent>
//           </Select>
//         </div>

//         <div className="space-y-2">
//           <div className="flex justify-between">
//             <Label htmlFor="progress">Progress</Label>
//             <span className="text-sm">{formData.progress}%</span>
//           </div>
//           <Slider
//             id="progress"
//             defaultValue={[formData.progress]}
//             max={100}
//             step={5}
//             onValueChange={handleProgressChange}
//             className="py-2"
//           />
//         </div>
//       </div>

//       <div className="space-y-2">
//         <Label htmlFor="team">
//           Team Members <span className="text-red-500">*</span>
//         </Label>
//         <div className="border rounded-md">
//           <ScrollArea className="h-[200px] p-4">
//             <div className="space-y-2">
//               {employeeData.map((employee) => (
//                 <div key={employee.id} className="flex items-center space-x-2">
//                   <Checkbox
//                     id={`team-${employee.id}`}
//                     checked={formData.team.includes(employee.name)}
//                     onCheckedChange={(checked) => handleTeamMemberToggle(employee.name, checked === true)}
//                   />
//                   <Label htmlFor={`team-${employee.id}`} className="flex-1">
//                     {employee.name} - {employee.position}
//                   </Label>
//                 </div>
//               ))}
//             </div>
//           </ScrollArea>
//         </div>
//         <p className="text-sm text-muted-foreground">{formData.team.length} team members selected</p>
//       </div>

//       <div className="space-y-2">
//         <Label htmlFor="description">Project Description</Label>
//         <Textarea
//           id="description"
//           name="description"
//           value={formData.description || ""}
//           onChange={handleChange}
//           placeholder="Enter project description"
//           rows={4}
//         />
//       </div>

//       <div className="flex justify-end gap-2">
//         <Button type="button" variant="outline" onClick={onCancel}>
//           Cancel
//         </Button>
//         <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
//           Save Changes
//         </Button>
//       </div>
//     </form>
//   )
// }



"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format, parse } from "date-fns"
import { cn } from "@/lib/utils"
import { useLayout } from "@/components/layout/layout-provider"
import { mockEmployees } from "@/lib/mock-data"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"

interface EditProjectFormProps {
  project: any
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function EditProjectForm({ project, onSubmit, onCancel }: EditProjectFormProps) {
  const { employees } = useLayout()
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [deadlineDateOpen, setDeadlineDateOpen] = useState(false)

  // Use employees from context if available, otherwise use mock data
  const employeeData = employees.length > 0 ? employees : mockEmployees

  const [formData, setFormData] = useState({ ...project })

  const [startDate, setStartDate] = useState<Date | undefined>(
    project.startDate ? parseDate(project.startDate) : new Date(),
  )

  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(
    project.deadline ? parseDate(project.deadline) : new Date(),
  )

  function parseDate(dateString: string): Date | undefined {
    try {
      // Try different date formats
      try {
        return parse(dateString, "MMMM d, yyyy", new Date())
      } catch {
        try {
          return parse(dateString, "yyyy-MM-dd", new Date())
        } catch {
          return new Date(dateString)
        }
      }
    } catch (error) {
      console.error("Error parsing date:", error)
      return new Date()
    }
  }

  useEffect(() => {
    setFormData({ ...project })
    setStartDate(parseDate(project.startDate))
    setDeadlineDate(parseDate(project.deadline))
  }, [project])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(date)
      setFormData((prev) => ({ ...prev, startDate: format(date, "MMMM d, yyyy") }))
      setStartDateOpen(false)
    }
  }

  const handleDeadlineDateSelect = (date: Date | undefined) => {
    if (date) {
      setDeadlineDate(date)
      setFormData((prev) => ({ ...prev, deadline: format(date, "MMMM d, yyyy") }))
      setDeadlineDateOpen(false)
    }
  }

  const handleTeamMemberToggle = (employeeName: string, checked: boolean) => {
    if (checked) {
      setFormData((prev) => ({
        ...prev,
        team: [...prev.team, employeeName],
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        team: prev.team.filter((name: string) => name !== employeeName),
      }))
    }
  }

  const handleProgressChange = (value: number[]) => {
    setFormData((prev) => ({ ...prev, progress: value[0] }))
  }

  const handleStatusChange = (value: string) => {
    setFormData((prev) => ({ ...prev, status: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">
            Project Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter project name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client">
            Client <span className="text-red-500">*</span>
          </Label>
          <Input
            id="client"
            name="client"
            value={formData.client}
            onChange={handleChange}
            placeholder="Enter client name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="startDate">
            Start Date <span className="text-red-500">*</span>
          </Label>
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="startDate"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate ? format(startDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={startDate} onSelect={handleStartDateSelect} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deadline">
            Deadline <span className="text-red-500">*</span>
          </Label>
          <Popover open={deadlineDateOpen} onOpenChange={setDeadlineDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="deadline"
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !deadlineDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadlineDate ? format(deadlineDate, "PPP") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={deadlineDate} onSelect={handleDeadlineDateSelect} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={handleStatusChange}>
            <SelectTrigger id="status">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="On Hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="progress">Progress</Label>
            <span className="text-sm">{formData.progress}%</span>
          </div>
          <Slider
            id="progress"
            defaultValue={[formData.progress]}
            max={100}
            step={5}
            onValueChange={handleProgressChange}
            className="py-2"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="team">
          Team Members <span className="text-red-500">*</span>
        </Label>
        <div className="border rounded-md">
          <ScrollArea className="h-[200px] p-4">
            <div className="space-y-2">
              {employeeData.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`team-${employee.id}`}
                    checked={formData.team.includes(employee.name)}
                    onCheckedChange={(checked) => handleTeamMemberToggle(employee.name, checked === true)}
                  />
                  <Label htmlFor={`team-${employee.id}`} className="flex-1">
                    {employee.name} - {employee.position}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
        <p className="text-sm text-muted-foreground">{formData.team.length} team members selected</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Project Description</Label>
        <Textarea
          id="description"
          name="description"
          value={formData.description || ""}
          onChange={handleChange}
          placeholder="Enter project description"
          rows={4}
        />
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
