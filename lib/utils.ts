import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 获取芝加哥时间的 Date 对象（用于服务端渲染日期字符串）
export function getChicagoDate(): Date {
  const now = new Date()
  // 转换为芝加哥时间
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
  // 如果还没到凌晨3点，算作前一天
  if (chicagoTime.getHours() < 3) {
    chicagoTime.setDate(chicagoTime.getDate() - 1)
  }
  return chicagoTime
}

// 获取芝加哥时间的日期字符串 (凌晨3点刷新)
export function getChicagoDateStr(): string {
  return getChicagoDate().toISOString().split("T")[0]
}
