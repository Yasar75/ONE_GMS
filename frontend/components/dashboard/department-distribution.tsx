"use client"

import { Card } from "antd"
import dynamic from "next/dynamic"
import { DoughnutChart, type DoughnutChartProps } from "@/components/ui/chart"

// Dynamically import the chart to avoid SSR issues
const Chart = dynamic(() => Promise.resolve(DoughnutChart), { ssr: false })

export function DepartmentDistribution() {
  const chartData: DoughnutChartProps = {
    data: {
      labels: ["Engineering", "Marketing", "HR", "Finance", "Operations", "Sales"],
      datasets: [
        {
          data: [38, 22, 15, 18, 12, 19],
          backgroundColor: [
            "rgba(14, 165, 233, 0.7)", // sky-500
            "rgba(249, 115, 22, 0.7)", // orange-500
            "rgba(139, 92, 246, 0.7)", // purple-500
            "rgba(16, 185, 129, 0.7)", // green-500
            "rgba(245, 158, 11, 0.7)", // amber-500
            "rgba(239, 68, 68, 0.7)", // red-500
          ],
          borderColor: [
            "rgba(14, 165, 233, 1)", // sky-500
            "rgba(249, 115, 22, 1)", // orange-500
            "rgba(139, 92, 246, 1)", // purple-500
            "rgba(16, 185, 129, 1)", // green-500
            "rgba(245, 158, 11, 1)", // amber-500
            "rgba(239, 68, 68, 1)", // red-500
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
      cutout: "60%",
    },
  }

  return (
    <Card title="Department Distribution" className="shadow-sm hover:shadow-md transition-shadow h-full">
      <Chart {...chartData} />
    </Card>
  )
}
