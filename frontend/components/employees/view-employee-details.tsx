"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Award, FileText, Mail, Phone, MapPin, Calendar, Briefcase, Building, User } from "lucide-react"

interface ViewEmployeeDetailsProps {
  employee: any
}

export function ViewEmployeeDetails({ employee }: ViewEmployeeDetailsProps) {
  const getDepartmentColor = (department: string) => {
    switch (department) {
      case "Engineering":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      case "Marketing":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
      case "Human Resources":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
      case "Finance":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "Sales":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "Operations":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "On Leave":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      case "Remote":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-shrink-0">
          <Avatar className="h-24 w-24">
            <AvatarImage src={employee.avatar || "/placeholder.svg"} alt={employee.name} />
            <AvatarFallback className="text-2xl">{employee.name.charAt(0)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="flex-grow">
          <h2 className="text-2xl font-bold">{employee.name}</h2>
          <p className="text-muted-foreground">{employee.position}</p>

          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className={getDepartmentColor(employee.department)}>
              {employee.department}
            </Badge>
            <Badge variant="outline" className={getStatusColor(employee.status)}>
              {employee.status}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{employee.email}</span>
            </div>

            {employee.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{employee.phone}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Joined: {employee.joinDate}</span>
            </div>

            {employee.employeeId && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>ID: {employee.employeeId}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="documents">Documents & Skills</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employee.birthDate && (
                  <div className="flex items-start gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Date of Birth</p>
                      <p className="text-sm text-muted-foreground">{employee.birthDate}</p>
                    </div>
                  </div>
                )}

                {employee.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">{employee.address}</p>
                    </div>
                  </div>
                )}

                {employee.emergencyContact && (
                  <div className="flex items-start gap-2">
                    <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Emergency Contact</p>
                      <p className="text-sm text-muted-foreground">{employee.emergencyContact}</p>
                    </div>
                  </div>
                )}

                {employee.bloodGroup && (
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 flex items-center justify-center text-muted-foreground mt-0.5">
                      <span className="text-xs font-bold">B+</span>
                    </div>
                    <div>
                      <p className="font-medium">Blood Group</p>
                      <p className="text-sm text-muted-foreground">{employee.bloodGroup}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Position</p>
                    <p className="text-sm text-muted-foreground">{employee.position}</p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Department</p>
                    <p className="text-sm text-muted-foreground">{employee.department}</p>
                  </div>
                </div>

                {employee.employeeType && (
                  <div className="flex items-start gap-2">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Employee Type</p>
                      <p className="text-sm text-muted-foreground">{employee.employeeType}</p>
                    </div>
                  </div>
                )}

                {employee.manager && (
                  <div className="flex items-start gap-2">
                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Manager</p>
                      <p className="text-sm text-muted-foreground">{employee.manager}</p>
                    </div>
                  </div>
                )}

                {employee.workLocation && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Work Location</p>
                      <p className="text-sm text-muted-foreground">{employee.workLocation}</p>
                    </div>
                  </div>
                )}

                {employee.salary && (
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 flex items-center justify-center text-muted-foreground mt-0.5">
                      <span className="text-xs font-bold">$</span>
                    </div>
                    <div>
                      <p className="font-medium">Salary</p>
                      <p className="text-sm text-muted-foreground">{employee.salary}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {employee.skills && employee.skills.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {employee.skills.map((skill: string, index: number) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {employee.documents && employee.documents.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Documents</h3>
                  <div className="space-y-3">
                    {employee.documents.map((doc: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-md border">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div className="flex-grow">
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">Uploaded: {doc.uploadDate}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {employee.education && employee.education.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Education</h3>
                  <div className="space-y-4">
                    {employee.education.map((edu: any, index: number) => (
                      <div key={index} className="border-l-2 border-blue-500 pl-4">
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm">{edu.institution}</p>
                        <p className="text-xs text-muted-foreground">{edu.year}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {employee.achievements && employee.achievements.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Achievements</h3>
                  <div className="space-y-4">
                    {employee.achievements.map((achievement: any, index: number) => (
                      <div key={index} className="flex items-start gap-3">
                        <Award className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="font-medium">{achievement.title}</p>
                          <p className="text-sm">{achievement.description}</p>
                          <p className="text-xs text-muted-foreground">{achievement.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
