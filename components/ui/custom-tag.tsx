import type React from "react"
import { cn } from "@/lib/utils"

interface CustomTagProps {
  children: React.ReactNode
  color?: string
  className?: string
}

export function CustomTag({ children, color = "#e5e7eb", className }: CustomTagProps) {
  // Calculate text color based on background color brightness
  const getTextColor = (bgColor: string) => {
    // For hex colors
    if (bgColor.startsWith("#")) {
      const hex = bgColor.substring(1)
      const rgb = Number.parseInt(hex, 16)
      const r = (rgb >> 16) & 0xff
      const g = (rgb >> 8) & 0xff
      const b = (rgb >> 0) & 0xff
      const brightness = (r * 299 + g * 587 + b * 114) / 1000
      return brightness > 128 ? "#000000" : "#ffffff"
    }
    // Default to black text
    return "#000000"
  }

  const textColor = getTextColor(color)

  return (
    <span
      className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium", className)}
      style={{
        backgroundColor: color,
        color: textColor,
        border: `1px solid ${color}`,
      }}
    >
      {children}
    </span>
  )
}
