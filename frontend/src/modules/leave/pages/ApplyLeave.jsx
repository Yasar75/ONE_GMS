import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import LeaveShared from '../components/LeaveShared.jsx'

const APPLY_LEAVE_TABS = [
  { key: 'holiday', label: 'Holiday Calendar', helper: 'Upcoming holidays and closures' },
  { key: 'apply', label: 'Apply Leave', helper: 'Balance visibility and request actions' }
]

export default function ApplyLeave() {
  return (
    <div>
      <PageHeader title="Leave" tagline="Review the holiday calendar and submit leave requests from your self-service workspace." />
      <LeaveShared workspaceType="request" tabs={APPLY_LEAVE_TABS} initialTab="holiday" />
    </div>
  )
}
