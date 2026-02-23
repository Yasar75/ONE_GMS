 
// "use client"

// import { Badge } from "@/components/ui/badge"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Progress } from "@/components/ui/progress"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// import { CalendarDays, Clock, CheckCircle, AlertCircle, Building, Calendar } from "lucide-react"

// interface ViewProjectDetailsProps {
//   project: any
// }

// export function ViewProjectDetails({ project }: ViewProjectDetailsProps) {
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

//   // Generate a reliable avatar URL based on the member's name and index
//   const getAvatarUrl = (name: string, index: number) => {
//     // Use a set of reliable professional avatar images
//     const avatarSet = [
//       "https://randomuser.me/api/portraits/men/1.jpg",
//       "https://randomuser.me/api/portraits/women/2.jpg",
//       "https://randomuser.me/api/portraits/men/3.jpg",
//       "https://randomuser.me/api/portraits/women/4.jpg",
//       "https://randomuser.me/api/portraits/men/5.jpg",
//       "https://randomuser.me/api/portraits/women/6.jpg",
//       "https://randomuser.me/api/portraits/men/7.jpg",
//       "https://randomuser.me/api/portraits/women/8.jpg",
//       "https://randomuser.me/api/portraits/men/9.jpg",
//       "https://randomuser.me/api/portraits/women/10.jpg",
//     ]

//     // Use modulo to cycle through the avatar set
//     return avatarSet[index % avatarSet.length]
//   }

//   return (
//     <div className="space-y-6">
//       <div className="flex flex-col md:flex-row gap-6">
//         <div className="flex-1 space-y-6">
//           <Card>
//             <CardHeader className="pb-2">
//               <CardTitle className="text-xl font-bold">{project.name}</CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 <div className="flex items-center gap-2">
//                   <Building className="h-4 w-4 text-muted-foreground" />
//                   <span className="text-sm font-medium">Client:</span>
//                   <span>{project.client}</span>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <Calendar className="h-4 w-4 text-muted-foreground" />
//                   <span className="text-sm font-medium">Start Date:</span>
//                   <span>{project.startDate}</span>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <CalendarDays className="h-4 w-4 text-muted-foreground" />
//                   <span className="text-sm font-medium">Deadline:</span>
//                   <span>{project.deadline}</span>
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <span className="text-sm font-medium">Status:</span>
//                   {getStatusBadge(project.status)}
//                 </div>

//                 <div className="space-y-2">
//                   <div className="flex items-center justify-between">
//                     <span className="text-sm font-medium">Progress:</span>
//                     <span className="text-sm">{project.progress}%</span>
//                   </div>
//                   <Progress
//                     value={project.progress}
//                     className="h-2"
//                     indicatorClassName={getProgressColor(project.progress)}
//                   />
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           {project.description && (
//             <Card>
//               <CardHeader className="pb-2">
//                 <CardTitle className="text-base font-medium">Description</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <p className="text-sm">{project.description}</p>
//               </CardContent>
//             </Card>
//           )}
//         </div>

//         <div className="flex-1">
//           <Card>
//             <CardHeader className="pb-2">
//               <div className="flex items-center justify-between">
//                 <CardTitle className="text-base font-medium">Team Members</CardTitle>
//                 <Badge variant="outline" className="ml-2">
//                   {project.team.length} members
//                 </Badge>
//               </div>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 {project.team.map((member: string, index: number) => (
//                   <div key={index} className="flex items-center gap-3">
//                     <Avatar className="h-8 w-8 border shadow-sm">
//                       <AvatarImage src={getAvatarUrl(member, index) || "/placeholder.svg"} alt={member} />
//                       <AvatarFallback>{member.charAt(0)}</AvatarFallback>
//                     </Avatar>
//                     <div>
//                       <p className="text-sm font-medium">{member}</p>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     </div>
//   )
// }



"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarDays, Clock, CheckCircle, AlertCircle, Building, Calendar } from "lucide-react"

interface ViewProjectDetailsProps {
  project: any
}

export function ViewProjectDetails({ project }: ViewProjectDetailsProps) {
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

  // Generate a reliable avatar URL based on the member's name and index
  const getAvatarUrl = (name: string, index: number) => {
    // Use a set of reliable professional avatar images
    const avatarSet = [
      "https://randomuser.me/api/portraits/men/1.jpg",
      "https://randomuser.me/api/portraits/women/2.jpg",
      "https://randomuser.me/api/portraits/men/3.jpg",
      "https://randomuser.me/api/portraits/women/4.jpg",
      "https://randomuser.me/api/portraits/men/5.jpg",
      "https://randomuser.me/api/portraits/women/6.jpg",
      "https://randomuser.me/api/portraits/men/7.jpg",
      "https://randomuser.me/api/portraits/women/8.jpg",
      "https://randomuser.me/api/portraits/men/9.jpg",
      "https://randomuser.me/api/portraits/women/10.jpg",
    ]

    // Use modulo to cycle through the avatar set
    return avatarSet[index % avatarSet.length]
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold">{project.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Client:</span>
                  <span>{project.client}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Start Date:</span>
                  <span>{project.startDate}</span>
                </div>

                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Deadline:</span>
                  <span>{project.deadline}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Status:</span>
                  {getStatusBadge(project.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Progress:</span>
                    <span className="text-sm">{project.progress}%</span>
                  </div>
                  <Progress
                    value={project.progress}
                    className="h-2"
                    indicatorClassName={getProgressColor(project.progress)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {project.description && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{project.description}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex-1">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-medium">Team Members</CardTitle>
                <Badge variant="outline" className="ml-2">
                  {project.team.length} members
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {project.team.map((member: string, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 border shadow-sm">
                      <AvatarImage src={getAvatarUrl(member, index) || "/placeholder.svg"} alt={member} />
                      <AvatarFallback>{member.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{member}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
