import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import LeaveShared from '../components/LeaveShared.jsx'

const LEAVE_MANAGEMENT_TABS = [
  { key: 'holiday', label: 'Holiday Calendar', helper: 'Org-wide holidays and closures' },
  { key: 'management', label: 'Leave Allocations', helper: 'Leave types and allocations' },
  { key: 'apply', label: 'Manage Leaves', helper: 'Balances, requests, and approvals' }
]

export default function LeaveManagement() {
  return (
    <div>
      <PageHeader title="Leave Management" tagline="Manage holidays, leave allocations, and leave workflows from one admin workspace." />
      <LeaveShared workspaceType="management" tabs={LEAVE_MANAGEMENT_TABS} initialTab="holiday" />
    </div>
  )
}
