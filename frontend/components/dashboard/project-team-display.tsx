"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"

interface ProjectTeamDisplayProps {
  project: {
    name: string
    team: string[]
  }
}

export function ProjectTeamDisplay({ project }: ProjectTeamDisplayProps) {
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
    <Card className="overflow-hidden">
      <CardHeader className="bg-sky-50 dark:bg-sky-900/20 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center">
            <Users className="h-4 w-4 mr-2 text-sky-600" />
            {project.name} Team
          </CardTitle>
          <Badge variant="outline" className="bg-white">
            {project.team.length} members
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {project.team.map((member, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-colors"
            >
              <Avatar className="h-9 w-9 border-2 border-white shadow">
                <AvatarImage src={getAvatarUrl(member, index) || "/placeholder.svg"} alt={member} />
                <AvatarFallback>{member.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{member}</p>
                <p className="text-xs text-muted-foreground">Team Member</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
