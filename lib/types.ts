export interface Task {
  id: string
  name: string
  points: number
  completed: boolean
  sort_order: number
  date: string
}

export interface RelapseTracker {
  id: string
  count: number
  week_start: string
}

export const DEFAULT_TASKS = [
  { name: '编程训练 (手写 JS/React/Python/SQL)', points: 50 },
  { name: '健身 (力量训练 / 有氧)', points: 30 },
  { name: '健康饮食 (自己做饭 / 无糖)', points: 20 },
  { name: '摄影 / 看电影散步', points: 20 },
  { name: '吉他练习', points: 15 },
  { name: 'Duolingo (30分钟)', points: 15 },
  { name: '清理游戏日常', points: 10 },
]
