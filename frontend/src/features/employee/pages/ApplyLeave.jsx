import React from 'react'
import PageHeader from '../../../components/common/PageHeader.jsx'
import LeaveWorkspace from '../../leave/components/LeaveWorkspace.jsx'

export default function EmployeeApplyLeave() {
  return (
    <div>
      <PageHeader title="Leave Request" tagline="Review the holiday calendar, track your leave balance, and submit requests into the approval workflow." />
      <LeaveWorkspace initialTab="holiday" />
    </div>
  )
}
