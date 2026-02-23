import { AttendanceTracker } from "@/components/attendance/attendance-tracker"

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Attendance Tracker</h1>
      <AttendanceTracker />
    </div>
  )
}
