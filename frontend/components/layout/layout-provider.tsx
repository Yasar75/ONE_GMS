"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

// Define types for our data
export type Employee = {
  id: string
  name: string
  employeeId: string
  position: string
  department: string
  email: string
  phone: string
  joinDate: string
  status: string
  avatar: string
  [key: string]: any // Allow additional properties
}

export type LeaveRequest = {
  id: string
  employeeId: string
  employeeName: string
  leaveType: string
  startDate: string
  endDate: string
  days: number
  reason: string
  status: string
}

export type Project = {
  id: string
  name: string
  client: string
  startDate: string
  deadline: string
  team: string[]
  progress: number
  status: string
}

export type Attendance = {
  id: string
  employeeId: string
  employeeName: string
  date: string
  checkIn: string
  checkOut: string
  checkInStatus: string
  checkOutStatus: string
  workingHours: string
  status: string
}

// Define the context type
type LayoutContextType = {
  employees: Employee[]
  addEmployee: (employee: Employee) => void
  updateEmployee: (employee: Employee) => void
  deleteEmployee: (id: string) => void

  leaveRequests: LeaveRequest[]
  addLeaveRequest: (request: LeaveRequest) => void
  updateLeaveRequest: (request: LeaveRequest) => void
  deleteLeaveRequest: (id: string) => void

  projects: Project[]
  addProject: (project: Project) => void
  updateProject: (project: Project) => void
  deleteProject: (id: string) => void

  attendance: Attendance[]
  addAttendance: (record: Attendance) => void
  updateAttendance: (record: Attendance) => void
  deleteAttendance: (id: string) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  darkMode: boolean
  setDarkMode: (dark: boolean) => void
}

// Create the context
const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

// Create a provider component
export function LayoutProvider({ children }: { children: ReactNode }) {
  // Initialize state from localStorage if available, otherwise use default values
  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("employees")
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("leaveRequests")
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  
  const [projects, setProjects] = useState<Project[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("projects")
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  const [attendance, setAttendance] = useState<Attendance[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("attendance")
      return saved ? JSON.parse(saved) : []
    }
    return []
  })

  // Initialize sidebar state based on screen size
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768
    }
    return true
  })

  // Initialize dark mode from localStorage or system preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("darkMode")
      if (savedMode !== null) {
        return savedMode === "true"
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    return false
  })

  // Update localStorage when state changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("employees", JSON.stringify(employees))
    }
  }, [employees])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("leaveRequests", JSON.stringify(leaveRequests))
    }
  }, [leaveRequests])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("projects", JSON.stringify(projects))
    }
  }, [projects])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("attendance", JSON.stringify(attendance))
    }
  }, [attendance])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", darkMode.toString())
    }
  }, [darkMode])

  // CRUD operations for employees
  const addEmployee = (employee: Employee) => {
    setEmployees([...employees, employee])
  }

  const updateEmployee = (employee: Employee) => {
    setEmployees(employees.map((e) => (e.id === employee.id ? employee : e)))
  }

  const deleteEmployee = (id: string) => {
    setEmployees(employees.filter((e) => e.id !== id))
  }

  // CRUD operations for leave requests
  const addLeaveRequest = (request: LeaveRequest) => {
    setLeaveRequests([...leaveRequests, request])
  }

  const updateLeaveRequest = (request: LeaveRequest) => {
    setLeaveRequests(leaveRequests.map((r) => (r.id === request.id ? request : r)))
  }

  const deleteLeaveRequest = (id: string) => {
    setLeaveRequests(leaveRequests.filter((r) => r.id !== id))
  }

  // CRUD operations for projects
  const addProject = (project: Project) => {
    setProjects([...projects, project])
  }

  const updateProject = (project: Project) => {
    setProjects(projects.map((p) => (p.id === project.id ? project : p)))
  }

  const deleteProject = (id: string) => {
    setProjects(projects.filter((p) => p.id !== id))
  }

  // CRUD operations for attendance
  const addAttendance = (record: Attendance) => {
    setAttendance([...attendance, record])
  }

  const updateAttendance = (record: Attendance) => {
    setAttendance(attendance.map((a) => (a.id === record.id ? record : a)))
  }

  const deleteAttendance = (id: string) => {
     console.log("attendence11",attendance)
    setAttendance(attendance.filter((a) => a.id !== id))
  }

  return (
    <LayoutContext.Provider
      value={{
        employees,
        addEmployee,
        updateEmployee,
        deleteEmployee,

        leaveRequests,
        addLeaveRequest,
        updateLeaveRequest,
        deleteLeaveRequest,

        projects,
        addProject,
        updateProject,
        deleteProject,


        attendance,
        addAttendance,
        updateAttendance,
        deleteAttendance,
        setAttendance,

        sidebarOpen,
        setSidebarOpen,

        darkMode,
        setDarkMode,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}

// Create a custom hook to use the context
export function useLayout() {
  const context = useContext(LayoutContext)
  if (context === undefined) {
    throw new Error("useLayout must be used within a LayoutProvider")
  }
  return context
}
