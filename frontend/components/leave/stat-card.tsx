"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type StatCardProps = {
  title: string
  value: number | string
  icon?: ReactNode
  gradientFrom: string // e.g. "from-sky-600"
  gradientTo: string // e.g. "to-cyan-500"
  className?: string
  subtext?: string
}

export function StatCard({ title, value, icon, gradientFrom, gradientTo, className, subtext }: StatCardProps) {
  return (
    <div
      className={cn("rounded-xl p-4 text-white shadow-sm bg-gradient-to-br", gradientFrom, gradientTo, className)}
      role="region"
      aria-label={title}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm/6 opacity-90">{title}</p>
          <div className="text-2xl font-semibold">{value}</div>
          {subtext ? <p className="text-xs/5 opacity-90">{subtext}</p> : null}
        </div>
        {icon ? <div className="opacity-90">{icon}</div> : null}
      </div>
    </div>
  )
}
