function sleep(ms){ return new Promise((r) => setTimeout(r, ms)) }

export const dashboardMock = {
  async getAdmin() {
    await sleep(300)
    return {
      kpis: [
        { label: 'Total Employees', value: 128 },
        { label: 'Present Today', value: 94 },
        { label: 'Hours Worked', value: '742h' },
        { label: 'On Leave', value: 7 }
      ],
      charts: {
        attendanceTrend: [
          { day: 'Mon', present: 88, absent: 12 },
          { day: 'Tue', present: 92, absent: 10 },
          { day: 'Wed', present: 90, absent: 11 },
          { day: 'Thu', present: 94, absent: 9 },
          { day: 'Fri', present: 86, absent: 15 }
        ],
        hoursByDept: [
          { name: 'Engineering', hours: 260 },
          { name: 'Design', hours: 140 },
          { name: 'HR', hours: 90 },
          { name: 'Ops', hours: 160 }
        ],
        leaveSplit: [
          { name: 'Sick', value: 3 },
          { name: 'Casual', value: 2 },
          { name: 'Earned', value: 2 }
        ]
      },
      widgets: {
        upcomingEvents: [
          { title: 'All-hands Meeting', date: 'Mar 05' },
          { title: 'Compliance Training', date: 'Mar 12' }
        ],
        holidayCalendar: [
          { title: 'Holi', date: 'Mar 14' },
          { title: 'Good Friday', date: 'Apr 03' }
        ],
        recentlyJoined: [
          { name: 'Riya Sen', dept: 'Design' },
          { name: 'Amit Das', dept: 'Engineering' },
          { name: 'Nisha Roy', dept: 'HR' }
        ],
        updates: [
          'Payroll submission cut-off: 25th of every month',
          'New leave policy draft published for review'
        ]
      }
    }
  },

  async getEmployee() {
    await sleep(300)
    return {
      kpis: [
        { label: 'Days Worked (Monthly)', value: 18 },
        { label: 'Present / Absent (Monthly)', value: '18 / 2' },
        { label: 'Hours Worked (Today / Monthly)', value: '7.5h / 142h' },
        { label: 'Leaves + Half Days', value: '1 + 1' }
      ],
      charts: {
        hoursTrend: [
          { day: 'Mon', hours: 7.2 },
          { day: 'Tue', hours: 8.0 },
          { day: 'Wed', hours: 7.6 },
          { day: 'Thu', hours: 7.8 },
          { day: 'Fri', hours: 6.9 }
        ],
        attendanceDonut: [
          { name: 'Present', value: 18 },
          { name: 'Absent', value: 2 }
        ],
        leaveUsage: [
          { name: 'Taken', value: 1 },
          { name: 'Remaining', value: 11 }
        ]
      },
      widgets: {
        upcomingEvents: [
          { title: 'Team Sync', date: 'Mar 04' },
          { title: 'Workshop: Time Management', date: 'Mar 10' }
        ],
        holidayCalendar: [
          { title: 'Holi', date: 'Mar 14' },
          { title: 'Good Friday', date: 'Apr 03' }
        ],
        recentlyJoined: [
          { name: 'Riya Sen', dept: 'Design' },
          { name: 'Amit Das', dept: 'Engineering' }
        ],
        updates: [
          'Remember to apply leave at least 2 days in advance',
          'Complete mandatory training before month-end'
        ]
      }
    }
  }
}
