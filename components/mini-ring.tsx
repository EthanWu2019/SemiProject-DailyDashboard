"use client"

import { cn } from "@/lib/utils"

interface MiniRingProps {
  progress: number // 0-100
  size?: number
  strokeWidth?: number
  label: string
  value?: string
  className?: string
}

export function MiniRing({ 
  progress, 
  size = 56, 
  strokeWidth = 4,
  label,
  value,
  className 
}: MiniRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const clampedProgress = Math.min(100, Math.max(0, progress))
  const offset = circumference - (clampedProgress / 100) * circumference

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          {/* 背景圆环 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-muted"
          />
          {/* 进度圆环 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="fill-none stroke-primary transition-all duration-500 ease-out"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: offset,
            }}
          />
        </svg>
        {/* 中心文字 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-foreground">
            {value || `${Math.round(clampedProgress)}%`}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
    </div>
  )
}
