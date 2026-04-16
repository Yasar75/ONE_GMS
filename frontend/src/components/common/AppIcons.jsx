import React from 'react'

function baseProps(className) {
  return {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className,
    'aria-hidden': 'true'
  }
}

export function SearchIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function PlusIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function ExportIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}


export function ImportIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M12 21V9" />
      <path d="m7 14 5-5 5 5" />
      <path d="M5 3h14" />
    </svg>
  )
}

export function DownloadIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

export function EyeIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function EyeOffIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m3 3 18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 13.3 13.4" />
      <path d="M9.9 5.2A11.2 11.2 0 0 1 12 5c6.5 0 10 7 10 7a17.2 17.2 0 0 1-3.1 3.9" />
      <path d="M6.6 6.7A17.5 17.5 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.4 4.8-1.1" />
    </svg>
  )
}

export function FilterIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </svg>
  )
}

export function UserPlusIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M15 19a5 5 0 0 0-10 0" />
      <circle cx="10" cy="8" r="4" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </svg>
  )
}

export function PencilIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m13.5 6.5 3 3" />
    </svg>
  )
}

export function TrashIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
    </svg>
  )
}

export function ViewIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <path d="M12 9v6" />
      <path d="M9 12h6" />
    </svg>
  )
}

export function CheckCircleIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.4 2.4 4.8-5.2" />
    </svg>
  )
}

export function XCircleIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  )
}

export function SparklesIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z" />
      <path d="m18 14 .7 2.1L21 16.8l-2.3.8L18 20l-.7-2.4-2.3-.8 2.3-.7L18 14Z" />
      <path d="m5 14 .7 2.1L8 16.8l-2.3.8L5 20l-.7-2.4-2.3-.8 2.3-.7L5 14Z" />
    </svg>
  )
}

export function ShieldUserIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M12 3 6.5 5.2v4.6c0 4 2.3 7.1 5.5 8.7 3.2-1.6 5.5-4.7 5.5-8.7V5.2L12 3Z" />
      <circle cx="12" cy="9.5" r="2.2" />
      <path d="M8.8 15a4 4 0 0 1 6.4 0" />
    </svg>
  )
}

export function LockClosedIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <rect x="5" y="11" width="14" height="10" rx="2.2" />
      <path d="M8.5 11V8.5a3.5 3.5 0 1 1 7 0V11" />
      <circle cx="12" cy="16" r="1.2" />
    </svg>
  )
}

export function LockOpenIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <rect x="5" y="11" width="14" height="10" rx="2.2" />
      <path d="M9.2 11V8.7a3.5 3.5 0 0 1 6-2.3" />
      <circle cx="12" cy="16" r="1.2" />
    </svg>
  )
}

export function BriefcaseIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" />
      <path d="M3 12h18" />
    </svg>
  )
}

export function HomeIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m3 11 9-7 9 7" />
      <path d="M6.5 10.5V20h11V10.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  )
}

export function UsersIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="9" cy="9" r="3" />
      <path d="M4 19a5 5 0 0 1 10 0" />
      <circle cx="17.2" cy="9.8" r="2.2" />
      <path d="M14.8 18.3a4.2 4.2 0 0 1 5.2-2.7" />
    </svg>
  )
}

export function ClockIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5l3.5 2" />
    </svg>
  )
}

export function ChecklistIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="m7.5 10 1.5 1.6L11 9.3" />
      <path d="M13 10h4" />
      <path d="m7.5 15 1.5 1.6L11 14.3" />
      <path d="M13 15h4" />
    </svg>
  )
}


export function CheckIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m5 12 4.2 4.2L19 7.8" />
    </svg>
  )
}


export function HandIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M8 12V7.8a1.8 1.8 0 0 1 3.6 0V11" />
      <path d="M11.6 11V6.8a1.8 1.8 0 0 1 3.6 0V11" />
      <path d="M15.2 11V8.6a1.8 1.8 0 0 1 3.6 0v5.1c0 3.5-2.8 6.3-6.3 6.3h-1.8A6.7 6.7 0 0 1 4 13.3V11a1.8 1.8 0 0 1 3.6 0v2.4" />
      <path d="M8 13V5.8A1.8 1.8 0 0 0 4.4 5.8V10" />
    </svg>
  )
}

export function CalendarIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
    </svg>
  )
}

export function BellIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.7 5.8 2.5 6.5H4c.8-.7 2.5-2.5 2.5-6.5" />
      <path d="M10 19a2.2 2.2 0 0 0 4 0" />
    </svg>
  )
}

export function XIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  )
}

export function RotateCcwIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </svg>
  )
}

export function ChevronUpIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m6 14 6-6 6 6" />
    </svg>
  )
}

export function ChevronDownIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m6 10 6 6 6-6" />
    </svg>
  )
}

export function ChevronLeftIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  )
}

export function DoubleChevronLeftIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m16.5 6-6 6 6 6" />
      <path d="m12.5 6-6 6 6 6" />
    </svg>
  )
}

export function ChevronRightIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m10 6 6 6-6 6" />
    </svg>
  )
}

export function DoubleChevronRightIcon({ className }) {
  return (
    <svg {...baseProps(className)}>
      <path d="m7.5 6 6 6-6 6" />
      <path d="m11.5 6 6 6-6 6" />
    </svg>
  )
}
