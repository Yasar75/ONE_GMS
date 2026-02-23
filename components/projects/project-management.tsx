 

// "use client"

// import { useState } from "react"
// import { Card } from "@/components/ui/card"
// import { Button } from "@/components/ui/button"
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { Plus, Clock, CheckCircle, AlertCircle, Briefcase, Edit, Trash2, Download, Eye } from "lucide-react"
// import { mockProjects } from "@/lib/mock-data"
// import { useLayout } from "@/components/layout/layout-provider"
// import { useToast } from "@/hooks/use-toast"
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { AddProjectForm } from "@/components/projects/add-project-form"
// import { EditProjectForm } from "@/components/projects/edit-project-form"
// import { ViewProjectDetails } from "@/components/projects/view-project-details"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { Progress } from "@/components/ui/progress"
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// import { Badge } from "@/components/ui/badge"
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
// import {
//   AlertDialog,
//   AlertDialogAction,
//   AlertDialogCancel,
//   AlertDialogContent,
//   AlertDialogDescription,
//   AlertDialogFooter,
//   AlertDialogHeader,
//   AlertDialogTitle,
// } from "@/components/ui/alert-dialog"

// export function ProjectManagement() {
//   const { projects, addProject, updateProject, deleteProject } = useLayout()
//   const { toast } = useToast()

//   // Dialog states
//   const [addDialogOpen, setAddDialogOpen] = useState(false)
//   const [editDialogOpen, setEditDialogOpen] = useState(false)
//   const [viewDialogOpen, setViewDialogOpen] = useState(false)
//   const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
//   const [selectedProject, setSelectedProject] = useState<any>(null)

//   // Use projects from context if available, otherwise use mock data
//   const projectData = projects.length > 0 ? projects : mockProjects

//   const handleAddProject = (project: any) => {
//     const newProject = {
//       ...project,
//       id: (projectData.length + 1).toString(),
//       progress: 0,
//       status: "In Progress",
//     }

//     addProject(newProject)
//     setAddDialogOpen(false)

//     toast({
//       title: "Project Added",
//       description: `${project.name} has been added successfully.`,
//     })
//   }

//   const handleEditProject = (project: any) => {
//     updateProject(project)
//     setEditDialogOpen(false)

//     toast({
//       title: "Project Updated",
//       description: `${project.name} has been updated successfully.`,
//     })
//   }

//   const handleDeleteProject = () => {
//     if (selectedProject) {
//       deleteProject(selectedProject.id)
//       setDeleteDialogOpen(false)

//       toast({
//         title: "Project Deleted",
//         description: `${selectedProject.name} has been deleted.`,
//         variant: "destructive",
//       })
//     }
//   }

//   const openViewDialog = (project: any) => {
//     setSelectedProject(project)
//     setViewDialogOpen(true)
//   }

//   const openEditDialog = (project: any) => {
//     setSelectedProject(project)
//     setEditDialogOpen(true)
//   }

//   const openDeleteDialog = (project: any) => {
//     setSelectedProject(project)
//     setDeleteDialogOpen(true)
//   }

//   const exportToCSV = () => {
//     // Create CSV content
//     const headers = ["Project Name", "Client", "Start Date", "Deadline", "Team", "Progress", "Status"]
//     const csvContent = [
//       headers.join(","),
//       ...projectData.map((project) => {
//         return [
//           `"${project.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
//           `"${project.client.replace(/"/g, '""')}"`,
//           project.startDate,
//           project.deadline,
//           `"${project.team.join(", ").replace(/"/g, '""')}"`,
//           project.progress,
//           project.status,
//         ].join(",")
//       }),
//     ].join("\n")

//     // Create a blob and download
//     const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
//     const url = URL.createObjectURL(blob)
//     const link = document.createElement("a")
//     link.setAttribute("href", url)
//     link.setAttribute("download", "projects.csv")
//     link.style.visibility = "hidden"
//     document.body.appendChild(link)
//     link.click()
//     document.body.removeChild(link)

//     toast({
//       title: "Export Successful",
//       description: `${projectData.length} projects exported to CSV.`,
//     })
//   }

//   const getStatusBadge = (status: string) => {
//     switch (status) {
//       case "Completed":
//         return (
//           <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
//             <CheckCircle className="h-3 w-3" /> {status}
//           </Badge>
//         )
//       case "In Progress":
//         return (
//           <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
//             <Clock className="h-3 w-3" /> {status}
//           </Badge>
//         )
//       case "On Hold":
//         return (
//           <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
//             <AlertCircle className="h-3 w-3" /> {status}
//           </Badge>
//         )
//       default:
//         return <Badge>{status}</Badge>
//     }
//   }

//   const getProgressColor = (progress: number) => {
//     if (progress < 30) return "bg-red-500"
//     if (progress < 70) return "bg-amber-500"
//     return "bg-green-500"
//   }

//   return (
//     <div className="space-y-6">
//       <Card className="shadow-sm p-4">
//         <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//           <div className="flex items-center gap-2">
//             <Briefcase className="h-5 w-5 text-sky-600" />
//             <h3 className="text-lg font-medium">Project Management</h3>
//           </div>
//           <div className="flex gap-2">
//             <TooltipProvider>
//               <Tooltip>
//                 <TooltipTrigger asChild>
//                   <Button variant="outline" className="flex items-center gap-2" onClick={exportToCSV}>
//                     <Download className="h-4 w-4" />
//                     <span className="hidden sm:inline">Export</span>
//                   </Button>
//                 </TooltipTrigger>
//                 <TooltipContent>
//                   <p>Export projects to CSV</p>
//                 </TooltipContent>
//               </Tooltip>
//             </TooltipProvider>

//             <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => setAddDialogOpen(true)}>
//               <Plus className="h-4 w-4 mr-2" /> Add Project
//             </Button>
//           </div>
//         </div>
//       </Card>

//       <Card className="shadow-sm">
//         <Tabs defaultValue="all">
//           <TabsList className="w-full border-b rounded-none justify-start">
//             <TabsTrigger value="all">All Projects</TabsTrigger>
//             <TabsTrigger value="in-progress">In Progress</TabsTrigger>
//             <TabsTrigger value="completed">Completed</TabsTrigger>
//             <TabsTrigger value="on-hold">On Hold</TabsTrigger>
//           </TabsList>

//           <TabsContent value="all">
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Project Name</TableHead>
//                     <TableHead>Client</TableHead>
//                     <TableHead>Start Date</TableHead>
//                     <TableHead>Deadline</TableHead>
//                     <TableHead>Team</TableHead>
//                     <TableHead>Progress</TableHead>
//                     <TableHead>Status</TableHead>
//                     <TableHead>Actions</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {projectData.map((project) => (
//                     <TableRow key={project.id}>
//                       <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
//                       <TableCell>{project.client}</TableCell>
//                       <TableCell>{project.startDate}</TableCell>
//                       <TableCell>{project.deadline}</TableCell>
//                       <TableCell>
//                         <div className="flex -space-x-2">
//                           {project.team.slice(0, 3).map((member, index) => (
//                             <Avatar key={index} className="h-8 w-8 border-2 border-background">
//                               <AvatarImage src={`/placeholder.svg?height=32&width=32`} alt={member} />
//                               <AvatarFallback>{member.charAt(0)}</AvatarFallback>
//                             </Avatar>
//                           ))}
//                           {project.team.length > 3 && (
//                             <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
//                               +{project.team.length - 3}
//                             </div>
//                           )}
//                         </div>
//                       </TableCell>
//                       <TableCell>
//                         <div className="flex items-center gap-2">
//                           <Progress
//                             value={project.progress}
//                             className="h-2 w-[100px]"
//                             indicatorClassName={getProgressColor(project.progress)}
//                           />
//                           <span className="text-xs">{project.progress}%</span>
//                         </div>
//                       </TableCell>
//                       <TableCell>{getStatusBadge(project.status)}</TableCell>
//                       <TableCell>
//                         <div className="flex space-x-2">
//                           <TooltipProvider>
//                             <Tooltip>
//                               <TooltipTrigger asChild>
//                                 <Button
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 text-blue-600"
//                                   onClick={() => openViewDialog(project)}
//                                 >
//                                   <Eye className="h-4 w-4" />
//                                   <span className="sr-only">View</span>
//                                 </Button>
//                               </TooltipTrigger>
//                               <TooltipContent>
//                                 <p>View project details</p>
//                               </TooltipContent>
//                             </Tooltip>
//                           </TooltipProvider>

//                           <TooltipProvider>
//                             <Tooltip>
//                               <TooltipTrigger asChild>
//                                 <Button
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 text-amber-600"
//                                   onClick={() => openEditDialog(project)}
//                                 >
//                                   <Edit className="h-4 w-4" />
//                                   <span className="sr-only">Edit</span>
//                                 </Button>
//                               </TooltipTrigger>
//                               <TooltipContent>
//                                 <p>Edit project</p>
//                               </TooltipContent>
//                             </Tooltip>
//                           </TooltipProvider>

//                           <TooltipProvider>
//                             <Tooltip>
//                               <TooltipTrigger asChild>
//                                 <Button
//                                   variant="ghost"
//                                   size="icon"
//                                   className="h-8 w-8 text-red-600"
//                                   onClick={() => openDeleteDialog(project)}
//                                 >
//                                   <Trash2 className="h-4 w-4" />
//                                   <span className="sr-only">Delete</span>
//                                 </Button>
//                               </TooltipTrigger>
//                               <TooltipContent>
//                                 <p>Delete project</p>
//                               </TooltipContent>
//                             </Tooltip>
//                           </TooltipProvider>
//                         </div>
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </TabsContent>

//           <TabsContent value="in-progress">
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Project Name</TableHead>
//                     <TableHead>Client</TableHead>
//                     <TableHead>Start Date</TableHead>
//                     <TableHead>Deadline</TableHead>
//                     <TableHead>Team</TableHead>
//                     <TableHead>Progress</TableHead>
//                     <TableHead>Status</TableHead>
//                     <TableHead>Actions</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {projectData
//                     .filter((project) => project.status === "In Progress")
//                     .map((project) => (
//                       <TableRow key={project.id}>
//                         <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
//                         <TableCell>{project.client}</TableCell>
//                         <TableCell>{project.startDate}</TableCell>
//                         <TableCell>{project.deadline}</TableCell>
//                         <TableCell>
//                           <div className="flex -space-x-2">
//                             {project.team.slice(0, 3).map((member, index) => (
//                               <Avatar key={index} className="h-8 w-8 border-2 border-background">
//                                 <AvatarImage src={`/placeholder.svg?height=32&width=32`} alt={member} />
//                                 <AvatarFallback>{member.charAt(0)}</AvatarFallback>
//                               </Avatar>
//                             ))}
//                             {project.team.length > 3 && (
//                               <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
//                                 +{project.team.length - 3}
//                               </div>
//                             )}
//                           </div>
//                         </TableCell>
//                         <TableCell>
//                           <div className="flex items-center gap-2">
//                             <Progress
//                               value={project.progress}
//                               className="h-2 w-[100px]"
//                               indicatorClassName={getProgressColor(project.progress)}
//                             />
//                             <span className="text-xs">{project.progress}%</span>
//                           </div>
//                         </TableCell>
//                         <TableCell>{getStatusBadge(project.status)}</TableCell>
//                         <TableCell>
//                           <div className="flex space-x-2">
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-blue-600"
//                               onClick={() => openViewDialog(project)}
//                             >
//                               <Eye className="h-4 w-4" />
//                               <span className="sr-only">View</span>
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-amber-600"
//                               onClick={() => openEditDialog(project)}
//                             >
//                               <Edit className="h-4 w-4" />
//                               <span className="sr-only">Edit</span>
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-red-600"
//                               onClick={() => openDeleteDialog(project)}
//                             >
//                               <Trash2 className="h-4 w-4" />
//                               <span className="sr-only">Delete</span>
//                             </Button>
//                           </div>
//                         </TableCell>
//                       </TableRow>
//                     ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </TabsContent>

//           <TabsContent value="completed">
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Project Name</TableHead>
//                     <TableHead>Client</TableHead>
//                     <TableHead>Start Date</TableHead>
//                     <TableHead>Deadline</TableHead>
//                     <TableHead>Team</TableHead>
//                     <TableHead>Progress</TableHead>
//                     <TableHead>Status</TableHead>
//                     <TableHead>Actions</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {projectData
//                     .filter((project) => project.status === "Completed")
//                     .map((project) => (
//                       <TableRow key={project.id}>
//                         <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
//                         <TableCell>{project.client}</TableCell>
//                         <TableCell>{project.startDate}</TableCell>
//                         <TableCell>{project.deadline}</TableCell>
//                         <TableCell>
//                           <div className="flex -space-x-2">
//                             {project.team.slice(0, 3).map((member, index) => (
//                               <Avatar key={index} className="h-8 w-8 border-2 border-background">
//                                 <AvatarImage src={`/placeholder.svg?height=32&width=32`} alt={member} />
//                                 <AvatarFallback>{member.charAt(0)}</AvatarFallback>
//                               </Avatar>
//                             ))}
//                             {project.team.length > 3 && (
//                               <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
//                                 +{project.team.length - 3}
//                               </div>
//                             )}
//                           </div>
//                         </TableCell>
//                         <TableCell>
//                           <div className="flex items-center gap-2">
//                             <Progress
//                               value={project.progress}
//                               className="h-2 w-[100px]"
//                               indicatorClassName={getProgressColor(project.progress)}
//                             />
//                             <span className="text-xs">{project.progress}%</span>
//                           </div>
//                         </TableCell>
//                         <TableCell>{getStatusBadge(project.status)}</TableCell>
//                         <TableCell>
//                           <div className="flex space-x-2">
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-blue-600"
//                               onClick={() => openViewDialog(project)}
//                             >
//                               <Eye className="h-4 w-4" />
//                               <span className="sr-only">View</span>
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-amber-600"
//                               onClick={() => openEditDialog(project)}
//                             >
//                               <Edit className="h-4 w-4" />
//                               <span className="sr-only">Edit</span>
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-red-600"
//                               onClick={() => openDeleteDialog(project)}
//                             >
//                               <Trash2 className="h-4 w-4" />
//                               <span className="sr-only">Delete</span>
//                             </Button>
//                           </div>
//                         </TableCell>
//                       </TableRow>
//                     ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </TabsContent>

//           <TabsContent value="on-hold">
//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead>Project Name</TableHead>
//                     <TableHead>Client</TableHead>
//                     <TableHead>Start Date</TableHead>
//                     <TableHead>Deadline</TableHead>
//                     <TableHead>Team</TableHead>
//                     <TableHead>Progress</TableHead>
//                     <TableHead>Status</TableHead>
//                     <TableHead>Actions</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {projectData
//                     .filter((project) => project.status === "On Hold")
//                     .map((project) => (
//                       <TableRow key={project.id}>
//                         <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
//                         <TableCell>{project.client}</TableCell>
//                         <TableCell>{project.startDate}</TableCell>
//                         <TableCell>{project.deadline}</TableCell>
//                         <TableCell>
//                           <div className="flex -space-x-2">
//                             {project.team.slice(0, 3).map((member, index) => (
//                               <Avatar key={index} className="h-8 w-8 border-2 border-background">
//                                 <AvatarImage src={`/placeholder.svg?height=32&width=32`} alt={member} />
//                                 <AvatarFallback>{member.charAt(0)}</AvatarFallback>
//                               </Avatar>
//                             ))}
//                             {project.team.length > 3 && (
//                               <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
//                                 +{project.team.length - 3}
//                               </div>
//                             )}
//                           </div>
//                         </TableCell>
//                         <TableCell>
//                           <div className="flex items-center gap-2">
//                             <Progress
//                               value={project.progress}
//                               className="h-2 w-[100px]"
//                               indicatorClassName={getProgressColor(project.progress)}
//                             />
//                             <span className="text-xs">{project.progress}%</span>
//                           </div>
//                         </TableCell>
//                         <TableCell>{getStatusBadge(project.status)}</TableCell>
//                         <TableCell>
//                           <div className="flex space-x-2">
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-blue-600"
//                               onClick={() => openViewDialog(project)}
//                             >
//                               <Eye className="h-4 w-4" />
//                               <span className="sr-only">View</span>
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-amber-600"
//                               onClick={() => openEditDialog(project)}
//                             >
//                               <Edit className="h-4 w-4" />
//                               <span className="sr-only">Edit</span>
//                             </Button>
//                             <Button
//                               variant="ghost"
//                               size="icon"
//                               className="h-8 w-8 text-red-600"
//                               onClick={() => openDeleteDialog(project)}
//                             >
//                               <Trash2 className="h-4 w-4" />
//                               <span className="sr-only">Delete</span>
//                             </Button>
//                           </div>
//                         </TableCell>
//                       </TableRow>
//                     ))}
//                 </TableBody>
//               </Table>
//             </div>
//           </TabsContent>
//         </Tabs>
//       </Card>

//       {/* Add Project Dialog */}
//       <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
//         <DialogContent className="sm:max-w-[700px]">
//           <DialogHeader>
//             <DialogTitle>Add New Project</DialogTitle>
//           </DialogHeader>
//           <AddProjectForm onSubmit={handleAddProject} onCancel={() => setAddDialogOpen(false)} />
//         </DialogContent>
//       </Dialog>

//       {/* View Project Dialog */}
//       <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
//         <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
//           <DialogHeader>
//             <DialogTitle>Project Details</DialogTitle>
//           </DialogHeader>
//           {selectedProject && <ViewProjectDetails project={selectedProject} />}
//         </DialogContent>
//       </Dialog>

//       {/* Edit Project Dialog */}
//       <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
//         <DialogContent className="sm:max-w-[700px]">
//           <DialogHeader>
//             <DialogTitle>Edit Project</DialogTitle>
//           </DialogHeader>
//           {selectedProject && (
//             <EditProjectForm
//               project={selectedProject}
//               onSubmit={handleEditProject}
//               onCancel={() => setEditDialogOpen(false)}
//             />
//           )}
//         </DialogContent>
//       </Dialog>

//       {/* Delete Confirmation Dialog */}
//       <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
//         <AlertDialogContent>
//           <AlertDialogHeader>
//             <AlertDialogTitle>Are you sure?</AlertDialogTitle>
//             <AlertDialogDescription>
//               This action cannot be undone. This will permanently delete the project and remove all associated
//               data.emove all associated data.
//             </AlertDialogDescription>
//           </AlertDialogHeader>
//           <AlertDialogFooter>
//             <AlertDialogCancel>Cancel</AlertDialogCancel>
//             <AlertDialogAction onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-700 text-white">
//               Delete
//             </AlertDialogAction>
//           </AlertDialogFooter>
//         </AlertDialogContent>
//       </AlertDialog>
//     </div>
//   )
// }



"use client"

import { useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Clock, CheckCircle, AlertCircle, Briefcase, Edit, Trash2, Download, Eye } from "lucide-react"
import { mockProjects } from "@/lib/mock-data"
import { useLayout } from "@/components/layout/layout-provider"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddProjectForm } from "@/components/projects/add-project-form"
import { EditProjectForm } from "@/components/projects/edit-project-form"
import { ViewProjectDetails } from "@/components/projects/view-project-details"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, BarChart3, CheckCircle2, Clock3, AlertTriangle } from "lucide-react"

export function ProjectManagement() {
  const { projects, addProject, updateProject, deleteProject } = useLayout()
  const { toast } = useToast()

  // Local fallback when context has no projects (or if user prefers persistence)
  const [localProjects, setLocalProjects] = useState<any[] | null>(null)
  const useLocal = projects.length === 0

  // seed localProjects from localStorage or mock
  useEffect(() => {
    if (useLocal) {
      try {
        const saved = typeof window !== "undefined" ? window.localStorage.getItem("pm_projects") : null
        if (saved) {
          setLocalProjects(JSON.parse(saved))
        } else {
          setLocalProjects(mockProjects)
        }
      } catch {
        setLocalProjects(mockProjects)
      }
    }
  }, [useLocal])

  // persist local projects
  useEffect(() => {
    if (useLocal && localProjects) {
      try {
        window.localStorage.setItem("pm_projects", JSON.stringify(localProjects))
      } catch {}
    }
  }, [useLocal, localProjects])

  // Source of truth for rendering
  const projectData = useLocal ? (localProjects ?? []) : projects

  // Search/filter
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    if (!query.trim()) return projectData
    const q = query.toLowerCase()
    return projectData.filter((p: any) => {
      return (
        p.name?.toLowerCase().includes(q) ||
        p.client?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q) ||
        p.team?.some((t: string) => t.toLowerCase().includes(q))
      )
    })
  }, [projectData, query])

  // Derived metrics for summary cards
  const metrics = useMemo(() => {
    const total = projectData.length
    const inProgress = projectData.filter((p: any) => p.status === "In Progress").length
    const completed = projectData.filter((p: any) => p.status === "Completed").length
    const onHold = projectData.filter((p: any) => p.status === "On Hold").length
    const avgProgress =
      total === 0 ? 0 : Math.round(projectData.reduce((acc: number, p: any) => acc + (p.progress || 0), 0) / total)
    return { total, inProgress, completed, onHold, avgProgress }
  }, [projectData])

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<any>(null)

  // CRUD handlers support both context and local fallback
  const handleAddProject = (project: any) => {
    const newProject = {
      ...project,
      id: (projectData.length + 1).toString(),
      progress: 0,
      status: "In Progress",
    }
    if (useLocal) {
      setLocalProjects((prev) => (prev ? [newProject, ...prev] : [newProject]))
    } else {
      addProject(newProject)
    }
    setAddDialogOpen(false)
    toast({ title: "Project Added", description: `${project.name} has been added successfully.` })
  }

  const handleEditProject = (project: any) => {
    if (useLocal) {
      setLocalProjects((prev) => (prev ? prev.map((p) => (p.id === project.id ? project : p)) : [project]))
    } else {
      updateProject(project)
    }
    setEditDialogOpen(false)
    toast({ title: "Project Updated", description: `${project.name} has been updated successfully.` })
  }

  const handleDeleteProject = () => {
    if (!selectedProject) return
    if (useLocal) {
      setLocalProjects((prev) => (prev ? prev.filter((p) => p.id !== selectedProject.id) : []))
    } else {
      deleteProject(selectedProject.id)
    }
    setDeleteDialogOpen(false)
    toast({
      title: "Project Deleted",
      description: `${selectedProject.name} has been deleted.`,
      variant: "destructive",
    })
  }

  const openViewDialog = (project: any) => {
    setSelectedProject(project)
    setViewDialogOpen(true)
  }
  const openEditDialog = (project: any) => {
    setSelectedProject(project)
    setEditDialogOpen(true)
  }
  const openDeleteDialog = (project: any) => {
    setSelectedProject(project)
    setDeleteDialogOpen(true)
  }

  const exportToCSV = () => {
    const headers = ["Project Name", "Client", "Start Date", "Deadline", "Team", "Progress", "Status"]
    const csvContent = [
      headers.join(","),
      ...projectData.map((project: any) => {
        return [
          `"${String(project.name || "").replace(/"/g, '""')}"`,
          `"${String(project.client || "").replace(/"/g, '""')}"`,
          project.startDate || "",
          project.deadline || "",
          `"${(project.team || []).join(", ").replace(/"/g, '""')}"`,
          project.progress ?? 0,
          project.status || "",
        ].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "projects.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({ title: "Export Successful", description: `${projectData.length} projects exported to CSV.` })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Completed":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> {status}
          </Badge>
        )
      case "In Progress":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {status}
          </Badge>
        )
      case "On Hold":
        return (
          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {status}
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getProgressColor = (progress: number) => {
    if (progress < 30) return "bg-red-500"
    if (progress < 70) return "bg-amber-500"
    return "bg-green-500"
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <Card className="shadow-sm bg-gradient-to-r from-sky-500 to-blue-600 text-white">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">Total Projects</CardTitle>
    </CardHeader>
    <CardContent className="flex items-center justify-between">
      <span className="text-2xl font-semibold">{metrics.total}</span>
      <BarChart3 className="h-5 w-5" />
    </CardContent>
  </Card>

  <Card className="shadow-sm bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">In Progress</CardTitle>
    </CardHeader>
    <CardContent className="flex items-center justify-between">
      <span className="text-2xl font-semibold">{metrics.inProgress}</span>
      <Clock3 className="h-5 w-5" />
    </CardContent>
  </Card>

  <Card className="shadow-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">Completed</CardTitle>
    </CardHeader>
    <CardContent className="flex items-center justify-between">
      <span className="text-2xl font-semibold">{metrics.completed}</span>
      <CheckCircle2 className="h-5 w-5" />
    </CardContent>
  </Card>

  <Card className="shadow-sm bg-gradient-to-r from-amber-400 to-orange-600 text-white">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm">On Hold</CardTitle>
    </CardHeader>
    <CardContent className="flex items-center justify-between">
      <span className="text-2xl font-semibold">{metrics.onHold}</span>
      <AlertTriangle className="h-5 w-5" />
    </CardContent>
  </Card>

 
</div>


      {/* Header + actions */}
      <Card className="shadow-sm p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-medium">Project Management</h3>
          </div>
          <div className="flex flex-1 md:flex-none gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-8"
                aria-label="Search projects"
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="flex items-center gap-2 bg-transparent" onClick={exportToCSV}>
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Export projects to CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Project
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs + Table (uses filtered data) */}
      <Card className="shadow-sm">
        <Tabs defaultValue="all">
          <TabsList className="w-full border-b rounded-none justify-start">
            <TabsTrigger value="all">All Projects</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="on-hold">On Hold</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {/* ... existing table wrapper ... */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((project: any) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
                      <TableCell>{project.client}</TableCell>
                      <TableCell>{project.startDate}</TableCell>
                      <TableCell>{project.deadline}</TableCell>
                      <TableCell>
                        <div className="flex -space-x-2">
                          {project.team.slice(0, 3).map((member: string, index: number) => (
                            <Avatar key={index} className="h-8 w-8 border-2 border-background">
                              <AvatarImage
                                src={`/ceholder-svg-key-kymhd.png?key=kymhd&height=32&width=32`}
                                alt={member}
                              />
                              <AvatarFallback>{member.charAt(0)}</AvatarFallback>
                            </Avatar>
                          ))}
                          {project.team.length > 3 && (
                            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
                              +{project.team.length - 3}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={project.progress}
                            className="h-2 w-[100px]"
                            indicatorClassName={getProgressColor(project.progress)}
                          />
                          <span className="text-xs">{project.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-blue-600"
                                  onClick={() => openViewDialog(project)}
                                >
                                  <Eye className="h-4 w-4" />
                                  <span className="sr-only">View</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View project details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600"
                                  onClick={() => openEditDialog(project)}
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Edit project</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600"
                                  onClick={() => openDeleteDialog(project)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Delete project</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                        No projects match your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* The other tab contents keep the original filter logic but now apply search first */}
          <TabsContent value="in-progress">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered
                    .filter((project: any) => project.status === "In Progress")
                    .map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
                        <TableCell>{project.client}</TableCell>
                        <TableCell>{project.startDate}</TableCell>
                        <TableCell>{project.deadline}</TableCell>
                        <TableCell>
                          <div className="flex -space-x-2">
                            {project.team.slice(0, 3).map((member: string, index: number) => (
                              <Avatar key={index} className="h-8 w-8 border-2 border-background">
                                <AvatarImage
                                  src={`/ceholder-svg-key-i4x6f.png?key=i4x6f&height=32&width=32`}
                                  alt={member}
                                />
                                <AvatarFallback>{member.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {project.team.length > 3 && (
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
                                +{project.team.length - 3}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={project.progress}
                              className="h-2 w-[100px]"
                              indicatorClassName={getProgressColor(project.progress)}
                            />
                            <span className="text-xs">{project.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600"
                              onClick={() => openViewDialog(project)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600"
                              onClick={() => openEditDialog(project)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => openDeleteDialog(project)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="completed">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered
                    .filter((project: any) => project.status === "Completed")
                    .map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
                        <TableCell>{project.client}</TableCell>
                        <TableCell>{project.startDate}</TableCell>
                        <TableCell>{project.deadline}</TableCell>
                        <TableCell>
                          <div className="flex -space-x-2">
                            {project.team.slice(0, 3).map((member: string, index: number) => (
                              <Avatar key={index} className="h-8 w-8 border-2 border-background">
                                <AvatarImage
                                  src={`/ceholder-svg-key-5fa1r.png?key=5fa1r&height=32&width=32`}
                                  alt={member}
                                />
                                <AvatarFallback>{member.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {project.team.length > 3 && (
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
                                +{project.team.length - 3}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={project.progress}
                              className="h-2 w-[100px]"
                              indicatorClassName={getProgressColor(project.progress)}
                            />
                            <span className="text-xs">{project.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600"
                              onClick={() => openViewDialog(project)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600"
                              onClick={() => openEditDialog(project)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => openDeleteDialog(project)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="on-hold">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered
                    .filter((project: any) => project.status === "On Hold")
                    .map((project: any) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium text-sky-600">{project.name}</TableCell>
                        <TableCell>{project.client}</TableCell>
                        <TableCell>{project.startDate}</TableCell>
                        <TableCell>{project.deadline}</TableCell>
                        <TableCell>
                          <div className="flex -space-x-2">
                            {project.team.slice(0, 3).map((member: string, index: number) => (
                              <Avatar key={index} className="h-8 w-8 border-2 border-background">
                                <AvatarImage
                                  src={`/ceholder-svg-key-p56cf.png?key=p56cf&height=32&width=32`}
                                  alt={member}
                                />
                                <AvatarFallback>{member.charAt(0)}</AvatarFallback>
                              </Avatar>
                            ))}
                            {project.team.length > 3 && (
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium">
                                +{project.team.length - 3}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={project.progress}
                              className="h-2 w-[100px]"
                              indicatorClassName={getProgressColor(project.progress)}
                            />
                            <span className="text-xs">{project.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600"
                              onClick={() => openViewDialog(project)}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600"
                              onClick={() => openEditDialog(project)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => openDeleteDialog(project)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Add Project Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Add New Project</DialogTitle>
          </DialogHeader>
          <AddProjectForm onSubmit={handleAddProject} onCancel={() => setAddDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* View Project Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Details</DialogTitle>
          </DialogHeader>
          {selectedProject && <ViewProjectDetails project={selectedProject} />}
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <EditProjectForm
              project={selectedProject}
              onSubmit={handleEditProject}
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
              This action cannot be undone. This will permanently delete the project and remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
