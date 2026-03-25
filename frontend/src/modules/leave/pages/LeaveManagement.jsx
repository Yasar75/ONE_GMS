import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import LeaveShared from '../components/LeaveShared.jsx'

const LEAVE_MANAGEMENT_TABS = [
  { key: 'holiday', label: 'Holiday Calendar', helper: 'Org-wide holidays and closures' },
  { key: 'management', label: 'Leave Allocations', helper: 'Leave types and allocations' },
  { key: 'apply', label: 'Leave Requests', helper: 'Balances, requests, and approvals' }
]

export default function LeaveManagement() {
  return (
    <div>
      <PageHeader title="Leave Management" tagline="Control holiday calendars, leave policies, employee allocations, and approval workflows from a single workspace." />
      <LeaveShared workspaceType="management" tabs={LEAVE_MANAGEMENT_TABS} initialTab="holiday" />
    </div>
  )
}
