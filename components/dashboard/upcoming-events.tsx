"use client"

import { Card, List } from "antd"
import { Calendar, Users, Briefcase, GraduationCap } from "lucide-react"

const upcomingEvents = [
  {
    id: "1",
    title: "Team Meeting",
    date: "May 3, 2023",
    time: "10:00 AM",
    type: "meeting",
    icon: Users,
  },
  {
    id: "2",
    title: "Project Deadline",
    date: "May 5, 2023",
    time: "5:00 PM",
    type: "deadline",
    icon: Briefcase,
  },
  {
    id: "3",
    title: "Company Holiday",
    date: "May 8, 2023",
    time: "All Day",
    type: "holiday",
    icon: Calendar,
  },
  {
    id: "4",
    title: "Training Session",
    date: "May 10, 2023",
    time: "2:00 PM",
    type: "training",
    icon: GraduationCap,
  },
]

const getTypeColor = (type: string) => {
  switch (type) {
    case "meeting":
      return "#3b82f6" // blue
    case "deadline":
      return "#ef4444" // red
    case "holiday":
      return "#10b981" // green
    case "training":
      return "#a855f7" // purple
    default:
      return "#6b7280" // gray
  }
}

export function UpcomingEvents() {
  return (
    <Card title="Upcoming Events" className="shadow-sm hover:shadow-md transition-shadow h-full">
      <List
        itemLayout="horizontal"
        dataSource={upcomingEvents}
        renderItem={(event) => {
          const Icon = event.icon
          return (
            <List.Item>
              <div className="flex items-start w-full">
                <div className="flex-shrink-0 mr-4">
                  <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                  </div>
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">{event.title}</h4>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getTypeColor(event.type) }}></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {event.date} • {event.time}
                  </p>
                </div>
              </div>
            </List.Item>
          )
        }}
      />
    </Card>
  )
}
