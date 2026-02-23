"use client"

import { Card } from "antd"
import dynamic from "next/dynamic"
import { LineChart, type LineChartProps } from "@/components/ui/chart"

// Dynamically import the chart to avoid SSR issues
const Chart = dynamic(() => Promise.resolve(LineChart), { ssr: false })

export function EmployeeActivity() {
  const chartData: LineChartProps = {
    data: {
      labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      datasets: [
        {
          label: "Check-ins",
          data: [95, 92, 90, 93, 89, 45, 42],
          borderColor: "#0ea5e9", // sky-500
          backgroundColor: "rgba(14, 165, 233, 0.5)", // sky-500 with opacity
          tension: 0.3,
        },
        {
          label: "Check-outs",
          data: [88, 90, 87, 91, 86, 43, 40],
          borderColor: "#f97316", // orange-500
          backgroundColor: "rgba(249, 115, 22, 0.5)", // orange-500 with opacity
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  }

  return (
    <Card title="Weekly Activity" className="shadow-sm hover:shadow-md transition-shadow h-full">
      <Chart {...chartData} />
    </Card>
  )
}
