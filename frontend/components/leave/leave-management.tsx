"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Plus,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Hourglass,
  CheckCircle2,
  XCircleIcon,
} from "lucide-react"
import { mockLeaveRequests } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AddLeaveRequestForm } from "@/components/leave/add-leave-request-form"
import { useLayout } from "@/components/layout/layout-provider"
import { useToast } from "@/hooks/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StatCard } from "@/components/leave/stat-card"

export function LeaveManagement() {
  const { leaveRequests, addLeaveRequest, updateLeaveRequest } = useLayout()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null)
  const [leaveRequestData, setLeaveRequestData] = useState<any[]>([])

  useEffect(() => {
    setMounted(true)
    setLeaveRequestData(leaveRequests.length > 0 ? leaveRequests : mockLeaveRequests)
  }, [leaveRequests])

  const handleAddLeaveRequest = (request: any) => {
    addLeaveRequest({
      ...request,
      id: (leaveRequestData.length + 1).toString(),
      status: "Pending",
    })

    setDialogOpen(false)

    toast({
      title: "Leave Request Submitted",
      description: "Your leave request has been submitted successfully.",
    })
  }

  const handleApproveRequest = (id: string) => {
    const request = leaveRequestData.find((req) => req.id === id)
    if (request) {
      updateLeaveRequest({
        ...request,
        status: "Approved",
      })

      toast({
        title: "Leave Request Approved",
        description: `Leave request for ${request.employeeName} has been approved.`,
      })
    }
  }

  const handleRejectRequest = (id: string) => {
    const request = leaveRequestData.find((req) => req.id === id)
    if (request) {
      updateLeaveRequest({
        ...request,
        status: "Rejected",
      })

      toast({
        title: "Leave Request Rejected",
        description: `Leave request for ${request.employeeName} has been rejected.`,
      })
    }
  }

  const exportToCSV = () => {
    // Create CSV content
    const headers = ["Employee", "Leave Type", "From", "To", "Days", "Reason", "Status"]
    const csvContent = [
      headers.join(","),
      ...leaveRequestData.map((request) => {
        return [
          request.employeeName,
          request.leaveType,
          request.startDate,
          request.endDate,
          request.days,
          `"${request.reason.replace(/"/g, '""')}"`, // Escape quotes in CSV
          request.status,
        ].join(",")
      }),
    ].join("\n")

    // Create a blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "leave_requests.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: "Export Successful",
      description: `${leaveRequestData.length} leave requests exported to CSV.`,
    })
  }

  const renderStatusBadge = (status: string) => {
    let color = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
    let icon = <AlertCircle className="h-4 w-4 mr-1" />

    if (status === "Approved") {
      color = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      icon = <CheckCircle className="h-4 w-4 mr-1" />
    } else if (status === "Rejected") {
      color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      icon = <XCircle className="h-4 w-4 mr-1" />
    }

    return (
      <Badge variant="outline" className={`flex items-center ${color}`}>
        {icon} {status}
      </Badge>
    )
  }

  const renderLeaveTypeBadge = (leaveType: string) => {
    let color = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"

    if (leaveType === "Sick Leave") color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    if (leaveType === "Vacation") color = "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    if (leaveType === "Personal") color = "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"

    return (
      <Badge variant="outline" className={color}>
        {leaveType}
      </Badge>
    )
  }

  // Derive summary stats from current data (recomputes on each render)
  const totalCount = leaveRequestData.length
  const pendingCount = leaveRequestData.filter((r) => r.status === "Pending").length
  const approvedCount = leaveRequestData.filter((r) => r.status === "Approved").length
  const rejectedCount = leaveRequestData.filter((r) => r.status === "Rejected").length

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-sky-600" />
          <h3 className="text-lg font-medium">Leave Management</h3>
        </div>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  onClick={exportToCSV}
                  disabled={!mounted}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Export leave requests to CSV</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button className="bg-sky-600 hover:bg-sky-700" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Apply for Leave
          </Button>
        </div>
      </Card>

      {mounted ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Requests"
              value={totalCount}
              gradientFrom="from-sky-600"
              gradientTo="to-cyan-500"
              icon={<Calendar className="h-5 w-5" aria-hidden="true" />}
              subtext="All submitted requests"
            />
            <StatCard
              title="Pending"
              value={pendingCount}
              gradientFrom="from-sky-700"
              gradientTo="to-sky-500"
              icon={<Hourglass className="h-5 w-5" aria-hidden="true" />}
              subtext="Awaiting review"
            />
            <StatCard
              title="Approved"
              value={approvedCount}
              gradientFrom="from-green-600"
              gradientTo="to-emerald-500"
              icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              subtext="Approved requests"
            />
            <StatCard
              title="Rejected"
              value={rejectedCount}
              gradientFrom="from-red-600"
              gradientTo="to-red-500"
              icon={<XCircleIcon className="h-5 w-5" aria-hidden="true" />}
              subtext="Rejected requests"
            />
          </div>

          {/* Tabs with Counts */}
          <Card>
            <Tabs defaultValue="all">
              <TabsList className="w-full border-b rounded-none justify-start">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  All Requests
                  <Badge variant="secondary" className="rounded-full">
                    {totalCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="flex items-center gap-2">
                  Pending
                  <Badge variant="secondary" className="rounded-full">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="flex items-center gap-2">
                  Approved
                  <Badge variant="secondary" className="rounded-full">
                    {approvedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex items-center gap-2">
                  Rejected
                  <Badge variant="secondary" className="rounded-full">
                    {rejectedCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* All */}
              <TabsContent value="all">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequestData.map((request,index) => (
                        <TableRow key={index}>
                          <TableCell>{request.employeeName}</TableCell>
                          <TableCell>{renderLeaveTypeBadge(request.leaveType)}</TableCell>
                          <TableCell>{request.startDate}</TableCell>
                          <TableCell>{request.endDate}</TableCell>
                          <TableCell>{request.days}</TableCell>
                          <TableCell>{renderStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              {request.status === "Pending" && (
                                <>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="link"
                                          size="sm"
                                          className="text-green-600 p-0 h-auto"
                                          onClick={() => handleApproveRequest(request.id)}
                                        >
                                          Approve
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Approve this leave request</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>

                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="link"
                                          size="sm"
                                          className="text-red-600 p-0 h-auto"
                                          onClick={() => handleRejectRequest(request.id)}
                                        >
                                          Reject
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Reject this leave request</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </>
                              )}
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="text-sky-600 p-0 h-auto"
                                      onClick={() => {
                                        setSelectedRequest(request)
                                        setViewOpen(true)
                                      }}
                                    >
                                      View
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View leave request details</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Pending */}
              <TabsContent value="pending">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequestData
                        .filter((request) => request.status === "Pending")
                        .map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{request.employeeName}</TableCell>
                            <TableCell>{renderLeaveTypeBadge(request.leaveType)}</TableCell>
                            <TableCell>{request.startDate}</TableCell>
                            <TableCell>{request.endDate}</TableCell>
                            <TableCell>{request.days}</TableCell>
                            <TableCell>{renderStatusBadge(request.status)}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-green-600 p-0 h-auto"
                                  onClick={() => handleApproveRequest(request.id)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-red-600 p-0 h-auto"
                                  onClick={() => handleRejectRequest(request.id)}
                                >
                                  Reject
                                </Button>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="text-sky-600 p-0 h-auto"
                                  onClick={() => {
                                    setSelectedRequest(request)
                                    setViewOpen(true)
                                  }}
                                >
                                  View
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Approved */}
              <TabsContent value="approved">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequestData
                        .filter((request) => request.status === "Approved")
                        .map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{request.employeeName}</TableCell>
                            <TableCell>{renderLeaveTypeBadge(request.leaveType)}</TableCell>
                            <TableCell>{request.startDate}</TableCell>
                            <TableCell>{request.endDate}</TableCell>
                            <TableCell>{request.days}</TableCell>
                            <TableCell>{renderStatusBadge(request.status)}</TableCell>
                            <TableCell>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-sky-600 p-0 h-auto"
                                onClick={() => {
                                  setSelectedRequest(request)
                                  setViewOpen(true)
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Rejected */}
              <TabsContent value="rejected">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Days</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequestData
                        .filter((request) => request.status === "Rejected")
                        .map((request) => (
                          <TableRow key={request.id}>
                            <TableCell>{request.employeeName}</TableCell>
                            <TableCell>{renderLeaveTypeBadge(request.leaveType)}</TableCell>
                            <TableCell>{request.startDate}</TableCell>
                            <TableCell>{request.endDate}</TableCell>
                            <TableCell>{request.days}</TableCell>
                            <TableCell>{renderStatusBadge(request.status)}</TableCell>
                            <TableCell>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-sky-600 p-0 h-auto"
                                onClick={() => {
                                  setSelectedRequest(request)
                                  setViewOpen(true)
                                }}
                              >
                                View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </>
      ) : (
        <Card>
          <div className="p-6 text-sm text-muted-foreground">Loading leave requests…</div>
        </Card>
      )}

      {/* Apply for Leave Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <AddLeaveRequestForm onSubmit={handleAddLeaveRequest} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      {mounted && (
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Leave Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs/5 opacity-70">Employee</p>
                    <p className="text-sm font-medium">{selectedRequest.employeeName}</p>
                  </div>
                  <div>
                    <p className="text-xs/5 opacity-70">Leave Type</p>
                    <p className="text-sm font-medium">{selectedRequest.leaveType}</p>
                  </div>
                  <div>
                    <p className="text-xs/5 opacity-70">From</p>
                    <p className="text-sm font-medium">{selectedRequest.startDate}</p>
                  </div>
                  <div>
                    <p className="text-xs/5 opacity-70">To</p>
                    <p className="text-sm font-medium">{selectedRequest.endDate}</p>
                  </div>
                  <div>
                    <p className="text-xs/5 opacity-70">Days</p>
                    <p className="text-sm font-medium">{selectedRequest.days}</p>
                  </div>
                  <div>
                    <p className="text-xs/5 opacity-70">Status</p>
                    <div className="mt-1">{renderStatusBadge(selectedRequest.status)}</div>
                  </div>
                </div>
                <div>
                  <p className="text-xs/5 opacity-70">Reason</p>
                  <p className="text-sm mt-1">{selectedRequest.reason}</p>
                </div>
                {selectedRequest.status === "Pending" ? (
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="text-red-600 bg-transparent"
                      onClick={() => {
                        handleRejectRequest(selectedRequest.id)
                        setViewOpen(false)
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        handleApproveRequest(selectedRequest.id)
                        setViewOpen(false)
                      }}
                    >
                      Approve
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button onClick={() => setViewOpen(false)}>Close</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No request selected.</div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
