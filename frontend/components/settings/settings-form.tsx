"use client"

import type React from "react"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { User, Lock, Bell, Palette, UploadIcon, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export function SettingsForm() {
  const { toast } = useToast()
  const [themeMode, setThemeMode] = useState("light")

  // Form state
  const [profileForm, setProfileForm] = useState({
    companyName: "Acme Corporation",
    email: "admin@acmecorp.com",
    phone: "+1 (555) 123-4567",
    address: "123 Business Ave, Suite 100, San Francisco, CA 94107",
    website: "https://acmecorp.com",
    timezone: "America/Los_Angeles",
    language: "en-US",
  })

  const [securityForm, setSecurityForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorAuth: true,
    sessionTimeout: "30",
    passwordExpiry: "90",
  })

  const [notificationForm, setNotificationForm] = useState({
    emailNotifications: true,
    pushNotifications: true,
    newEmployee: true,
    leaveRequests: true,
    attendanceAlerts: true,
    projectUpdates: true,
    systemUpdates: false,
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Profile settings updated",
      description: "Your profile settings have been updated successfully.",
    })
  }

  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Security settings updated",
      description: "Your security settings have been updated successfully.",
    })
  }

  const handleNotificationSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast({
      title: "Notification settings updated",
      description: "Your notification settings have been updated successfully.",
    })
  }

  return (
    <Card>
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Lock className="h-4 w-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" /> Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <CardContent className="pt-6">
            <form onSubmit={handleProfileSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-6">
                    <Label htmlFor="companyLogo">Company Logo</Label>
                    <div className="mt-2 flex items-center">
                      <Button variant="outline" className="w-full">
                        <UploadIcon className="mr-2 h-4 w-4" /> Upload Logo
                      </Button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={profileForm.companyName}
                      onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                      className="mt-2"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="mt-2"
                      placeholder="Enter email address"
                    />
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="mt-2"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-6">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={profileForm.address}
                      onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                      className="mt-2"
                      placeholder="Enter address"
                      rows={4}
                    />
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={profileForm.website}
                      onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                      className="mt-2"
                      placeholder="Enter website URL"
                    />
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={profileForm.timezone}
                      onValueChange={(value) => setProfileForm({ ...profileForm, timezone: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Los_Angeles">Pacific Time (US & Canada)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (US & Canada)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (US & Canada)</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (US & Canada)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={profileForm.language}
                      onValueChange={(value) => setProfileForm({ ...profileForm, language: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="en-GB">English (UK)</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </TabsContent>

        <TabsContent value="security">
          <CardContent className="pt-6">
            <form onSubmit={handleSecuritySubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="mb-6">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={securityForm.currentPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                      className="mt-2"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={securityForm.newPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                      className="mt-2"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={securityForm.confirmPassword}
                      onChange={(e) => setSecurityForm({ ...securityForm, confirmPassword: e.target.value })}
                      className="mt-2"
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-6">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="twoFactorAuth">Two-Factor Authentication</Label>
                      <Switch
                        id="twoFactorAuth"
                        checked={securityForm.twoFactorAuth}
                        onCheckedChange={(checked) => setSecurityForm({ ...securityForm, twoFactorAuth: checked })}
                      />
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Select
                      value={securityForm.sessionTimeout}
                      onValueChange={(value) => setSecurityForm({ ...securityForm, sessionTimeout: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select timeout" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-6">
                    <Label htmlFor="passwordExpiry">Password Expiry (days)</Label>
                    <Select
                      value={securityForm.passwordExpiry}
                      onValueChange={(value) => setSecurityForm({ ...securityForm, passwordExpiry: value })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Select expiry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="never">Never</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </TabsContent>

        <TabsContent value="notifications">
          <CardContent className="pt-6">
            <form onSubmit={handleNotificationSubmit}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailNotifications">Email Notifications</Label>
                    <Switch
                      id="emailNotifications"
                      checked={notificationForm.emailNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationForm({ ...notificationForm, emailNotifications: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="pushNotifications">Push Notifications</Label>
                    <Switch
                      id="pushNotifications"
                      checked={notificationForm.pushNotifications}
                      onCheckedChange={(checked) =>
                        setNotificationForm({ ...notificationForm, pushNotifications: checked })
                      }
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Notification Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="newEmployee">New Employee Joins</Label>
                      <Switch
                        id="newEmployee"
                        checked={notificationForm.newEmployee}
                        onCheckedChange={(checked) =>
                          setNotificationForm({ ...notificationForm, newEmployee: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="leaveRequests">Leave Requests</Label>
                      <Switch
                        id="leaveRequests"
                        checked={notificationForm.leaveRequests}
                        onCheckedChange={(checked) =>
                          setNotificationForm({ ...notificationForm, leaveRequests: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="attendanceAlerts">Attendance Alerts</Label>
                      <Switch
                        id="attendanceAlerts"
                        checked={notificationForm.attendanceAlerts}
                        onCheckedChange={(checked) =>
                          setNotificationForm({ ...notificationForm, attendanceAlerts: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="projectUpdates">Project Updates</Label>
                      <Switch
                        id="projectUpdates"
                        checked={notificationForm.projectUpdates}
                        onCheckedChange={(checked) =>
                          setNotificationForm({ ...notificationForm, projectUpdates: checked })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="systemUpdates">System Updates</Label>
                      <Switch
                        id="systemUpdates"
                        checked={notificationForm.systemUpdates}
                        onCheckedChange={(checked) =>
                          setNotificationForm({ ...notificationForm, systemUpdates: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <Button type="submit" className="bg-sky-600 hover:bg-sky-700">
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </TabsContent>

        <TabsContent value="appearance">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4">Theme</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div
                    className={`cursor-pointer rounded-lg border-2 p-4 hover:shadow-md transition-shadow ${themeMode === "light" ? "border-sky-600" : "border-gray-200 dark:border-gray-700"}`}
                    onClick={() => setThemeMode("light")}
                  >
                    <div className="h-24 bg-white border border-gray-200 rounded-md mb-2"></div>
                    <p className="text-center font-medium">Light</p>
                  </div>

                  <div
                    className={`cursor-pointer rounded-lg border-2 p-4 hover:shadow-md transition-shadow ${themeMode === "dark" ? "border-sky-600" : "border-gray-200 dark:border-gray-700"}`}
                    onClick={() => setThemeMode("dark")}
                  >
                    <div className="h-24 bg-gray-900 border border-gray-700 rounded-md mb-2"></div>
                    <p className="text-center font-medium">Dark</p>
                  </div>

                  <div
                    className={`cursor-pointer rounded-lg border-2 p-4 hover:shadow-md transition-shadow ${themeMode === "system" ? "border-sky-600" : "border-gray-200 dark:border-gray-700"}`}
                    onClick={() => setThemeMode("system")}
                  >
                    <div className="h-24 bg-gradient-to-r from-white to-gray-900 border border-gray-200 rounded-md mb-2"></div>
                    <p className="text-center font-medium">System</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Primary Color</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="cursor-pointer h-10 rounded-md bg-sky-600 border-2 border-sky-600 flex items-center justify-center">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                  <div className="cursor-pointer h-10 rounded-md bg-purple-600"></div>
                  <div className="cursor-pointer h-10 rounded-md bg-green-600"></div>
                  <div className="cursor-pointer h-10 rounded-md bg-amber-600"></div>
                  <div className="cursor-pointer h-10 rounded-md bg-red-600"></div>
                  <div className="cursor-pointer h-10 rounded-md bg-pink-600"></div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button className="bg-sky-600 hover:bg-sky-700">Save Changes</Button>
              </div>
            </div>
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  )
}
