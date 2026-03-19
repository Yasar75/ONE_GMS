import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import LeaveWorkspace from '../../leave/components/LeaveWorkspace.jsx'

export default function AdminLeaveManagement() {
  return (
    <div>
      <PageHeader title="Leave Management" tagline="Control holiday calendars, leave policies, employee allocations, and approval workflows from a single workspace." />
      <LeaveWorkspace isAdmin initialTab="holiday" />
    </div>
  )
}
