export const endpoints = {
  auth: {
    login: '/api/v1/auth/login',
    me: '/api/v1/auth/me',
    refresh: '/api/v1/auth/refresh_token',
    requestPasswordReset: '/api/v1/auth/password-forget-request',
    confirmPasswordReset: (token) => `/api/v1/auth/password-forget-confirm/${token}`,
    changePassword: '/api/v1/auth/change-password',
    unlockUser: '/api/v1/auth/unlock-user',
    lockedUsers: '/api/v1/auth/locked-users',
    unlockedUsers: '/api/v1/auth/unlocked-users'
  },
  dashboard: {
    admin: '/dashboard/admin',
    employee: '/dashboard/employee'
  },
  employee: {
    list: '/api/v1/employee/',
    create: '/api/v1/employee',
    me: '/api/v1/employee/me/record',
    detail: (employeeUid) => `/api/v1/employee/${employeeUid}`,
    profile: {
      byEmployee: (employeeUid) => `/api/v1/employee/${employeeUid}/profile`,
      photo: (employeeUid) => `/api/v1/employee/${employeeUid}/profile-image`,
      nickname: (employeeUid) => `/api/v1/employee/${employeeUid}/nick-name`
    }
  },
  employeeSkill: {
    list: '/api/v1/employee_skill/',
    create: '/api/v1/employee_skill',
    byEmployee: (employeeUid) => `/api/v1/employee_skill/employee/${employeeUid}`,
    detail: (skillUid) => `/api/v1/employee_skill/${skillUid}`
  },
  employeeDocuments: {
    upload: '/api/v1/employee_documents-upload/upload',
    detail: (documentUid) => `/api/v1/employee_documents-upload/${documentUid}`,
    replaceFile: (documentUid) => `/api/v1/employee_documents-upload/${documentUid}/replace-file`,
    byEmployee: (employeeUid) => `/api/v1/employee_documents-upload/employee/${employeeUid}`
  },
  employeeFamily: {
    list: '/api/v1/employee_documents/',
    create: '/api/v1/employee_documents/',
    byEmployee: (employeeUid) => `/api/v1/employee_documents/employee/${employeeUid}`,
    detail: (familyUid) => `/api/v1/employee_documents/${familyUid}`
  },
  employeeWorkExperience: {
    list: '/api/v1/employee_work_experience/',
    create: '/api/v1/employee_work_experience/',
    byEmployee: (employeeUid) => `/api/v1/employee_work_experience/employee/${employeeUid}`,
    detail: (experienceUid) => `/api/v1/employee_work_experience/${experienceUid}`
  },
  employeeMetadata: {
    list: '/api/v1/employee-metadata/',
    create: '/api/v1/employee-metadata/',
    detail: (metadataUid) => `/api/v1/employee-metadata/${metadataUid}`
  },
  roles: {
    list: '/api/v1/roles/roles',
    create: '/api/v1/roles/create-role',
    detail: (roleUid) => `/api/v1/roles/role/${roleUid}`,
    modules: '/api/v1/roles/modules'
  },
  attendance: {
    list: '/api/v1/attendance/',
    detail: (attendanceUid) => `/api/v1/attendance/${attendanceUid}`,
    update: (attendanceUid) => `/api/v1/attendance/${attendanceUid}`
  },
  punchLog: {
    punchIn: '/api/v1/punch_log/punch-in',
    punchOut: '/api/v1/punch_log/punch-out',
    myLogs: '/api/v1/punch_log/my-logs'
  },
  regularization: {
    create: '/api/v1/attendance-regularization/',
    myRequests: '/api/v1/attendance-regularization/my-requests',
    managerPending: '/api/v1/attendance-regularization/employees-pending',
    approve: (regularizationUid) => `/api/v1/attendance-regularization/${regularizationUid}/approve`,
    reject: (regularizationUid) => `/api/v1/attendance-regularization/${regularizationUid}/reject`,
    logs: (regularizationUid) => `/api/v1/attendance-regularization-log/${regularizationUid}`
  },
  shiftRoster: {
    list: '/api/v1/shift_roster/',
    create: '/api/v1/shift_roster',
    detail: (shiftUid) => `/api/v1/shift_roster/${shiftUid}`
  },
  employeeShift: {
    list: '/api/v1/employee_shift_roster/',
    create: '/api/v1/employee_shift_roster',
    detail: (assignmentUid) => `/api/v1/employee_shift_roster/${assignmentUid}`,
    byEmployee: (employeeUid) => `/api/v1/employee_shift_roster/employee-uid/${employeeUid}`
  },
  leave: {
    holidays: {
      list: '/api/v1/holiday-calendar/',
      create: '/api/v1/holiday-calendar/',
      detail: (holidayUid) => `/api/v1/holiday-calendar/${holidayUid}`
    },
    types: {
      list: '/api/v1/leave-types/',
      create: '/api/v1/leave-types/',
      detail: (leaveTypeUid) => `/api/v1/leave-types/${leaveTypeUid}`
    },
    balances: {
      generate: '/api/v1/employee-leave-balances/generate',
      manualGrant: '/api/v1/employee-leave-balances/manual-grant',
      mine: '/api/v1/employee-leave-balances/my-balances',
      byEmployee: (employeeUid) => `/api/v1/employee-leave-balances/${employeeUid}`
    },
    requests: {
      preview: '/api/v1/leave-requests/preview-days',
      apply: '/api/v1/leave-requests/apply',
      mine: '/api/v1/leave-requests/my-requests',
      pending: '/api/v1/leave-requests/leave-request-pending',
      approve: (leaveRequestUid) => `/api/v1/leave-requests/${leaveRequestUid}/approve`,
      reject: (leaveRequestUid) => `/api/v1/leave-requests/${leaveRequestUid}/reject`
    }
  }
}
