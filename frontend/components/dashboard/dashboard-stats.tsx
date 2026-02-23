"use client"

import { Card } from "@/components/ui/card"
import { Users, Clock, Calendar, Briefcase } from "lucide-react"

export function DashboardStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total Employees */}
      <Card className="shadow-sm hover:shadow-lg transition-shadow p-6 bg-gradient-to-r from-blue-500 to-sky-600 text-white">
        <div className="flex flex-col">
          <div className="flex items-center mb-4">
            <div className="p-2 rounded-full bg-white/20 mr-3">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">Total Employees</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-3xl font-bold">124</p>
            <p className="text-xs text-white/80">+12 from last month</p>
          </div>
        </div>
      </Card>

      {/* Present Today */}
      <Card className="shadow-sm hover:shadow-lg transition-shadow p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
        <div className="flex flex-col">
          <div className="flex items-center mb-4">
            <div className="p-2 rounded-full bg-white/20 mr-3">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">Present Today</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-3xl font-bold">98</p>
            <p className="text-xs text-white/80">79% attendance rate</p>
          </div>
        </div>
      </Card>

      {/* On Leave */}
      <Card className="shadow-sm hover:shadow-lg transition-shadow p-6 bg-gradient-to-r from-amber-400 to-orange-600 text-white">
        <div className="flex flex-col">
          <div className="flex items-center mb-4">
            <div className="p-2 rounded-full bg-white/20 mr-3">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">On Leave</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-3xl font-bold">8</p>
            <p className="text-xs text-white/80">6% of workforce</p>
          </div>
        </div>
      </Card>

      {/* Active Projects */}
      <Card className="shadow-sm hover:shadow-lg transition-shadow p-6 bg-gradient-to-r from-purple-500 to-pink-600 text-white">
        <div className="flex flex-col">
          <div className="flex items-center mb-4">
            <div className="p-2 rounded-full bg-white/20 mr-3">
              <Briefcase className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">Active Projects</h3>
          </div>
          <div className="flex justify-between items-end">
            <p className="text-3xl font-bold">16</p>
            <p className="text-xs text-white/80">3 due this week</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
