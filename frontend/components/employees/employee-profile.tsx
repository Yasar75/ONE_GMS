"use client"

import { Tabs, Card, Descriptions, Avatar, Button, Timeline } from "antd"
import { Award, FileText, Edit } from "lucide-react"
import { CustomTag } from "@/components/ui/custom-tag"

const { TabPane } = Tabs

export function EmployeeProfile({ employee }: { employee: any }) {
  // Get a reliable avatar URL based on employee ID
  const getReliableAvatarUrl = (employee: any) => {
    // Extract a number from the employee ID to use as an index
    const idNumber = Number.parseInt(employee.employeeId.replace(/\D/g, "")) || 1
    const gender = idNumber % 2 === 0 ? "women" : "men"
    const imageNumber = (idNumber % 30) + 1 // Limit to 30 images per gender

    return `https://randomuser.me/api/portraits/${gender}/${imageNumber}.jpg`
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-shrink-0">
            <Avatar src={getReliableAvatarUrl(employee)} size={96} className="border-2 border-white shadow-lg" />
          </div>
          <div className="flex-grow">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{employee.name}</h2>
                <p className="text-gray-500">{employee.position}</p>
                <div className="flex items-center gap-2 mt-2">
                  <CustomTag color={getDepartmentColor(employee.department)}>{employee.department}</CustomTag>
                  <CustomTag color={getStatusColor(employee.status)}>{employee.status}</CustomTag>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="primary" icon={<Edit className="h-4 w-4" />} className="bg-sky-600 hover:bg-sky-700">
                  Edit Profile
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultActiveKey="1" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
        <TabPane tab="Personal Information" key="1">
          <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
            <Descriptions.Item label="Full Name">{employee.name}</Descriptions.Item>
            <Descriptions.Item label="Employee ID">{employee.employeeId}</Descriptions.Item>
            <Descriptions.Item label="Email">{employee.email}</Descriptions.Item>
            <Descriptions.Item label="Phone">{employee.phone}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">{employee.birthDate}</Descriptions.Item>
            <Descriptions.Item label="Address">{employee.address}</Descriptions.Item>
            <Descriptions.Item label="Emergency Contact">{employee.emergencyContact}</Descriptions.Item>
            <Descriptions.Item label="Blood Group">{employee.bloodGroup}</Descriptions.Item>
          </Descriptions>
        </TabPane>

        <TabPane tab="Employment" key="2">
          <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
            <Descriptions.Item label="Position">{employee.position}</Descriptions.Item>
            <Descriptions.Item label="Department">{employee.department}</Descriptions.Item>
            <Descriptions.Item label="Join Date">{employee.joinDate}</Descriptions.Item>
            <Descriptions.Item label="Employee Type">{employee.employeeType}</Descriptions.Item>
            <Descriptions.Item label="Manager">{employee.manager}</Descriptions.Item>
            <Descriptions.Item label="Work Location">{employee.workLocation}</Descriptions.Item>
            <Descriptions.Item label="Salary">{employee.salary}</Descriptions.Item>
            <Descriptions.Item label="Status">{employee.status}</Descriptions.Item>
          </Descriptions>
        </TabPane>

        <TabPane tab="Skills & Education" key="3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Skills" className="shadow-sm">
              <div className="flex flex-wrap gap-2">
                {employee.skills?.map((skill: string, index: number) => (
                  <CustomTag key={index} color="#3b82f6">
                    {skill}
                  </CustomTag>
                ))}
              </div>
            </Card>

            <Card title="Education" className="shadow-sm">
              <Timeline>
                {employee.education?.map((edu: any, index: number) => (
                  <Timeline.Item key={index}>
                    <div className="font-medium">{edu.degree}</div>
                    <div>{edu.institution}</div>
                    <div className="text-sm text-gray-500">{edu.year}</div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </div>
        </TabPane>

        <TabPane tab="Documents" key="4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {employee.documents?.map((doc: any, index: number) => (
              <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-sky-600" />
                  <div>
                    <h4 className="font-medium">{doc.name}</h4>
                    <p className="text-xs text-gray-500">Uploaded: {doc.uploadDate}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button type="link" className="text-sky-600 p-0">
                    View
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </TabPane>

        <TabPane tab="Performance" key="5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Recent Reviews" className="shadow-sm">
              <Timeline>
                {employee.reviews?.map((review: any, index: number) => (
                  <Timeline.Item key={index} color={getReviewColor(review.rating)}>
                    <div className="font-medium">
                      {review.title} - Rating: {review.rating}/5
                    </div>
                    <div className="text-sm">{review.comments}</div>
                    <div className="text-xs text-gray-500">
                      By: {review.reviewer} on {review.date}
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>

            <Card title="Achievements" className="shadow-sm">
              <Timeline>
                {employee.achievements?.map((achievement: any, index: number) => (
                  <Timeline.Item key={index} dot={<Award className="h-4 w-4 text-amber-500" />}>
                    <div className="font-medium">{achievement.title}</div>
                    <div className="text-sm">{achievement.description}</div>
                    <div className="text-xs text-gray-500">{achievement.date}</div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </div>
        </TabPane>
      </Tabs>
    </div>
  )
}

function getDepartmentColor(department: string) {
  switch (department) {
    case "Engineering":
      return "#3b82f6" // blue
    case "Marketing":
      return "#f97316" // orange
    case "Human Resources":
      return "#a855f7" // purple
    case "Finance":
      return "#10b981" // green
    case "Sales":
      return "#ef4444" // red
    case "Operations":
      return "#06b6d4" // cyan
    default:
      return "#6b7280" // gray
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "Active":
      return "#10b981" // green
    case "On Leave":
      return "#f97316" // orange
    case "Remote":
      return "#3b82f6" // blue
    default:
      return "#6b7280" // gray
  }
}

function getReviewColor(rating: number) {
  if (rating >= 4) return "#10b981" // green
  if (rating >= 3) return "#3b82f6" // blue
  if (rating >= 2) return "#f97316" // orange
  return "#ef4444" // red
}
