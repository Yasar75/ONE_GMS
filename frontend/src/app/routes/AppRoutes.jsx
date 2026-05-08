import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { ProtectedRoute } from './ProtectedRoute.jsx'
import { RoleRedirect } from './RoleRedirect.jsx'

import { AuthLayout } from '../../layouts/AuthLayout.jsx'
import { AppLayout } from '../../layouts/AppLayout.jsx'

import Login from '../../modules/auth/pages/Login.jsx'
import ResetPassword from '../../modules/auth/pages/ResetPassword.jsx'

import Dashboard from '../../modules/dashboard/pages/Dashboard.jsx'

import EmployeesManagement from '../../modules/employee/pages/EmployeesManagement.jsx'
import AttendanceManagement from '../../modules/attendance/pages/AttendanceManagement.jsx'
import LeaveManagement from '../../modules/leave/pages/LeaveManagement.jsx'
import ProjectManagement from '../../modules/project/pages/ProjectManagement.jsx'
import TaskManagement from '../../modules/task/pages/TaskManagement.jsx'
import EmployeesOverview from '../../modules/task/pages/EmployeesOverview.jsx'
import PayslipManagement from '../../modules/payslip/pages/PayslipManagement.jsx'
import Payslip from '../../modules/payslip/pages/Payslip.jsx'

import MarkAttendance from '../../modules/attendance/pages/MarkAttendance.jsx'
import ApplyLeave from '../../modules/leave/pages/ApplyLeave.jsx'
import ProfilePage from '../../modules/employee/components/Profile.jsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          <Route path="/admin/dashboard" element={<Dashboard />} />
          <Route path="/admin/employees-management" element={<EmployeesManagement />} />
          <Route path="/admin/attendance-management" element={<AttendanceManagement />} />
          <Route path="/admin/leave-management" element={<LeaveManagement />} />
          <Route path="/admin/project-management" element={<ProjectManagement />} />
          <Route path="/admin/task-management" element={<TaskManagement />} />
          <Route path="/admin/task-management/employees/:employeeUid" element={<EmployeesOverview />} />
          <Route path="/admin/payslip-management" element={<PayslipManagement />} />
          <Route path="/admin/payslip-management/employees/:employeeUid" element={<PayslipManagement mode="employee" />} />

          <Route path="/employee/dashboard" element={<Dashboard />} />
          <Route path="/employee/attendance" element={<MarkAttendance />} />
          <Route path="/employee/apply-leave" element={<ApplyLeave />} />
          <Route path="/employee/payslip" element={<Payslip />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
