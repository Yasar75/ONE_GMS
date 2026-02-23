"use client"

import { Card, Avatar, List } from "antd"
import Link from "next/link"

const recentEmployees = [
  {
    id: "1",
    name: "Sarah Johnson",
    position: "Frontend Developer",
    department: "Engineering",
    joinDate: "May 1, 2023",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "2",
    name: "Michael Brown",
    position: "Marketing Specialist",
    department: "Marketing",
    joinDate: "April 15, 2023",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "3",
    name: "Emily Davis",
    position: "HR Manager",
    department: "Human Resources",
    joinDate: "April 10, 2023",
    avatar: "/placeholder.svg?height=40&width=40",
  },
  {
    id: "4",
    name: "David Wilson",
    position: "Backend Developer",
    department: "Engineering",
    joinDate: "April 5, 2023",
    avatar: "/placeholder.svg?height=40&width=40",
  },
]

export function RecentEmployees() {
  return (
    <Card title="Recently Joined Employees" className="shadow-sm hover:shadow-md transition-shadow h-full">
      <List
        itemLayout="horizontal"
        dataSource={recentEmployees}
        renderItem={(employee) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Avatar src={employee.avatar} />}
              title={
                <Link href={`/dashboard/employees/${employee.id}`} className="text-sky-600 hover:underline">
                  {employee.name}
                </Link>
              }
              description={
                <div className="text-xs">
                  <p>
                    {employee.position} • {employee.department}
                  </p>
                  <p className="text-gray-500">Joined: {employee.joinDate}</p>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </Card>
  )
}
