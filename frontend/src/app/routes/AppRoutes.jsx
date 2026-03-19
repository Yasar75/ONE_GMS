import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { ProtectedRoute } from './ProtectedRoute.jsx'
import { RoleRedirect } from './RoleRedirect.jsx'

import { AuthLayout } from '../../layouts/AuthLayout.jsx'
import { AppLayout } from '../../layouts/AppLayout.jsx'

import Login from '../../features/auth/pages/Login.jsx'

import AdminDashboard from '../../features/dashboard/admin/AdminDashboard.jsx'
import EmployeeDashboard from '../../features/dashboard/employee/EmployeeDashboard.jsx'

import AdminEmployees from '../../features/admin/pages/EmployeesManagement.jsx'
import AdminAttendance from '../../features/admin/pages/AttendanceManagement.jsx'
import AdminLeaveManagement from '../../features/admin/pages/LeaveManagement.jsx'

import EmployeeAttendance from '../../features/employee/pages/Attendance.jsx'
import EmployeeApplyLeave from '../../features/employee/pages/ApplyLeave.jsx'
import ProfilePage from '../../features/employee/pages/Profile.jsx'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/employees-management" element={<AdminEmployees />} />
          <Route path="/admin/attendance-management" element={<AdminAttendance />} />
          <Route path="/admin/leave-management" element={<AdminLeaveManagement />} />

          <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
          <Route path="/employee/attendance" element={<EmployeeAttendance />} />
          <Route path="/employee/apply-leave" element={<EmployeeApplyLeave />} />
          <Route path="/profile" element={<ProfilePage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
