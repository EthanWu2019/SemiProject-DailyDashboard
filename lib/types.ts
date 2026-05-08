export interface Task {
  id: string
  name: string
  description: string | null
  points: number
  completed: boolean
  sort_order: number
  date: string
  task_type: 'daily' | 'once'
  target_date: string | null
  created_at: string
  updated_at: string
}

export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  points: number
  sort_order: number
  task_type: 'daily' | 'once'
  target_date: string | null
  created_at: string
}

export interface RelapseTracker {
  id: string
  count: number
  week_start: string
  created_at: string
  updated_at: string
}

export interface DailyScore {
  date: string
  total_points: number
  earned_points: number
  percentage: number
}

export const DEFAULT_TASKS = [
  { name: '编程训练 (手写 JS/React/Python/SQL)', points: 50, description: '每天练习编程技能' },
  { name: '健身 (力量训练 / 有氧)', points: 30, description: '保持身体健康' },
  { name: '健康饮食 (自己做饭 / 无糖)', points: 20, description: '健康饮食习惯' },
  { name: '摄影 / 看电影散步', points: 20, description: '放松和创意活动' },
  { name: '吉他练习', points: 15, description: '音乐技能提升' },
  { name: 'Duolingo (30分钟)', points: 15, description: '语言学习' },
  { name: '清理游戏日常', points: 10, description: '游戏任务' },
]
