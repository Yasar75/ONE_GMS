const today = new Date()

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDateOffset(year, month, day) {
  const value = new Date(year, month - 1, day)
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}

export const employeeSeed = [
  {
    id: 'EMP-1001',
    fullName: 'Aarav Sharma',
    position: 'Engineering',
    email: 'aarav.sharma@giantmind.in',
    phone: '+91 98765 12001',
    joinDate: formatDateOffset(2022, 2, 14),
    status: 'Active',
    attendanceStatus: 'Present',
    dateOfBirth: formatDateOffset(1995, 4, 11),
    address: 'Indiranagar, Bengaluru',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1002',
    fullName: 'Meera Nair',
    position: 'HR',
    email: 'meera.nair@giantmind.in',
    phone: '+91 98765 12002',
    joinDate: formatDateOffset(2021, 8, 2),
    status: 'Active',
    attendanceStatus: 'Remote',
    dateOfBirth: formatDateOffset(1993, 9, 19),
    address: 'Kakkanad, Kochi',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1003',
    fullName: 'Rohan Verma',
    position: 'Finance',
    email: 'rohan.verma@giantmind.in',
    phone: '+91 98765 12003',
    joinDate: formatDateOffset(2020, 5, 9),
    status: 'Inactive',
    attendanceStatus: 'On Leave',
    dateOfBirth: formatDateOffset(1991, 1, 24),
    address: 'Noida Sector 62, Uttar Pradesh',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1004',
    fullName: 'Priya Desai',
    position: 'Marketing',
    email: 'priya.desai@giantmind.in',
    phone: '+91 98765 12004',
    joinDate: formatDateOffset(2023, 1, 18),
    status: 'Active',
    attendanceStatus: 'Half-Day',
    dateOfBirth: formatDateOffset(1997, 12, 4),
    address: 'Vastrapur, Ahmedabad',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1005',
    fullName: 'Karan Malhotra',
    position: 'Sales',
    email: 'karan.malhotra@giantmind.in',
    phone: '+91 98765 12005',
    joinDate: formatDateOffset(2024, 4, 5),
    status: 'Active',
    attendanceStatus: 'Remote',
    dateOfBirth: formatDateOffset(1998, 7, 8),
    address: 'Dwarka, New Delhi',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1006',
    fullName: 'Sneha Patil',
    position: 'Operations',
    email: 'sneha.patil@giantmind.in',
    phone: '+91 98765 12006',
    joinDate: formatDateOffset(2022, 11, 30),
    status: 'Inactive',
    attendanceStatus: 'Present',
    dateOfBirth: formatDateOffset(1994, 3, 3),
    address: 'Baner, Pune',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1007',
    fullName: 'Vikram Iyer',
    position: 'Engineering',
    email: 'vikram.iyer@giantmind.in',
    phone: '+91 98765 12007',
    joinDate: formatDateOffset(2021, 6, 21),
    status: 'Active',
    attendanceStatus: 'Present',
    dateOfBirth: formatDateOffset(1990, 10, 30),
    address: 'Anna Nagar, Chennai',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  },
  {
    id: 'EMP-1008',
    fullName: 'Ananya Gupta',
    position: 'Engineering',
    email: 'ananya.gupta@giantmind.in',
    phone: '+91 98765 12008',
    joinDate: formatDateOffset(2023, 9, 12),
    status: 'Active',
    attendanceStatus: 'On Leave',
    dateOfBirth: formatDateOffset(1996, 5, 17),
    address: 'Salt Lake, Kolkata',
    createdAt: today.toISOString(),
    updatedAt: today.toISOString()
  }
]
