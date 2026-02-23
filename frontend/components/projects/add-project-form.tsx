// // "use client"

// // import type React from "react"

// // import { useState } from "react"
// // import { Button } from "@/components/ui/button"
// // import { Input } from "@/components/ui/input"
// // import { Label } from "@/components/ui/label"
// // import { Textarea } from "@/components/ui/textarea"
// // import { Calendar } from "@/components/ui/calendar"
// // import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
// // import { CalendarIcon } from "lucide-react"
// // import { format } from "date-fns"
// // import { cn } from "@/lib/utils"
// // import { useLayout } from "@/components/layout/layout-provider"
// // import { mockEmployees } from "@/lib/mock-data"
// // import { ScrollArea } from "@/components/ui/scroll-area"
// // import { Checkbox } from "@/components/ui/checkbox"

// // interface AddProjectFormProps {
// //   onSubmit: (data: any) => void
// //   onCancel: () => void
// // }

// // export function AddProjectForm({ onSubmit, onCancel }: AddProjectFormProps) {
// //   const { employees } = useLayout()
// //   const [startDateOpen, setStartDateOpen] = useState(false)
// //   const [deadlineDateOpen, setDeadlineDateOpen] = useState(false)

// //   // Use employees from context if available, otherwise use mock data
// //   const employeeData = employees.length > 0 ? employees : mockEmployees

// //   const [formData, setFormData] = useState({
// //     name: "",
// //     client: "",
// //     startDate: format(new Date(), "MMMM d, yyyy"),
// //     deadline: format(new Date(new Date().setMonth(new Date().getMonth() + 1)), "MMMM d, yyyy"),
// //     team: [] as string[],
// //     description: "",
// //   })

// //   const [startDate, setStartDate] = useState<Date>(new Date())
// //   const [deadlineDate, setDeadlineDate] = useState<Date>(new Date(new Date().setMonth(new Date().getMonth() + 1)))

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
// //         team: prev.team.filter((name) => name !== employeeName),
// //       }))
// //     }
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
// //           value={formData.description}
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
// //           Create Project
// //         </Button>
// //       </div>
// //     </form>
// //   )
// // }



// "use client"

// import type React from "react"

// import { useState } from "react"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
// import { Textarea } from "@/components/ui/textarea"
// import { Calendar } from "@/components/ui/calendar"
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
// import { CalendarIcon } from "lucide-react"
// import { format } from "date-fns"
// import { cn } from "@/lib/utils"
// import { useLayout } from "@/components/layout/layout-provider"
// import { mockEmployees } from "@/lib/mock-data"
// import { ScrollArea } from "@/components/ui/scroll-area"
// import { Checkbox } from "@/components/ui/checkbox"

// interface AddProjectFormProps {
//   onSubmit: (data: any) => void
//   onCancel: () => void
// }

// export function AddProjectForm({ onSubmit, onCancel }: AddProjectFormProps) {
//   const { employees } = useLayout()
//   const [startDateOpen, setStartDateOpen] = useState(false)
//   const [deadlineDateOpen, setDeadlineDateOpen] = useState(false)

//   // Use employees from context if available, otherwise use mock data
//   const employeeData = employees.length > 0 ? employees : mockEmployees

//   const [formData, setFormData] = useState({
//     name: "",
//     client: "",
//     startDate: format(new Date(), "MMMM d, yyyy"),
//     deadline: format(new Date(new Date().setMonth(new Date().getMonth() + 1)), "MMMM d, yyyy"),
//     team: [] as string[],
//     description: "",
//   })

//   const [startDate, setStartDate] = useState<Date>(new Date())
//   const [deadlineDate, setDeadlineDate] = useState<Date>(new Date(new Date().setMonth(new Date().getMonth() + 1)))

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
//         team: prev.team.filter((name) => name !== employeeName),
//       }))
//     }
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
//           value={formData.description}
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
//           Create Project
//         </Button>
//       </div>
//     </form>
//   )
// }



"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useLayout } from "@/components/layout/layout-provider"
import { mockEmployees } from "@/lib/mock-data"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"

interface AddProjectFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function AddProjectForm({ onSubmit, onCancel }: AddProjectFormProps) {
  const { employees } = useLayout()
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [deadlineDateOpen, setDeadlineDateOpen] = useState(false)

  // Use employees from context if available, otherwise use mock data
  const employeeData = employees.length > 0 ? employees : mockEmployees

  const [formData, setFormData] = useState({
    name: "",
    client: "",
    startDate: format(new Date(), "MMMM d, yyyy"),
    deadline: format(new Date(new Date().setMonth(new Date().getMonth() + 1)), "MMMM d, yyyy"),
    team: [] as string[],
    description: "",
  })

  const [startDate, setStartDate] = useState<Date>(new Date())
  const [deadlineDate, setDeadlineDate] = useState<Date>(new Date(new Date().setMonth(new Date().getMonth() + 1)))

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
        team: prev.team.filter((name) => name !== employeeName),
      }))
    }
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
          value={formData.description}
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
          Create Project
        </Button>
      </div>
    </form>
  )
}
