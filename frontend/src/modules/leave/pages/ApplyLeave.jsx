import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import LeaveShared from '../components/LeaveShared.jsx'

const APPLY_LEAVE_TABS = [
  { key: 'holiday', label: 'Holiday Calendar', helper: 'Upcoming holidays and closures' },
  { key: 'apply', label: 'Leave Requests', helper: 'Balance visibility and request actions' }
]

export default function ApplyLeave() {
  return (
    <div>
      <PageHeader title="Leave Request" tagline="Review the holiday calendar, track your leave balance, and submit requests into the approval workflow." />
      <LeaveShared workspaceType="request" tabs={APPLY_LEAVE_TABS} initialTab="holiday" />
    </div>
  )
}
