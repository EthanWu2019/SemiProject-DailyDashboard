"use client"

import { useMemo, useState, useTransition, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { ProgressRing } from "@/components/progress-ring"
import { MiniRing } from "@/components/mini-ring"
import { Confetti } from "@/components/confetti"
import { MoreHorizontal, Plus, Pencil, Trash2, RotateCcw, Minus, AlertTriangle, Target, ListTodo, Settings, Calendar, RefreshCw, Quote, BarChart3 } from "lucide-react"
import { 
  toggleTask, 
  updateRelapseCount, 
  resetAllTasks,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  syncTodayTasks,
} from "@/lib/actions"
import type { Task, RelapseTracker, TaskTemplate, DailyScore, Statistics } from "@/lib/types"

interface DashboardProps {
  tasks: Task[]
  relapseTracker: RelapseTracker
  templates: TaskTemplate[]
  historyScores: DailyScore[]
  statistics: Statistics
  todayStr: string
  currentYear: number
}

// 计算惩罚分数
function calculatePenalty(count: number): number {
  if (count <= 2) return 0
  if (count === 3) return 30
  return 30 + (count - 3) * 50
}

// 获取颜色等级 (0-4)
function getColorLevel(percentage: number): number {
  if (percentage === 0) return 0
  if (percentage < 25) return 1
  if (percentage < 50) return 2
  if (percentage < 75) return 3
  return 4
}

// 生成日历数据
function generateCalendarData(year: number, scores: DailyScore[] = []) {
  const scoreMap = new Map((scores || []).map(s => [s.date, s]))
  const weeks: { date: string; level: number }[][] = []
  
  const startDate = new Date(year, 0, 1)
  const endDate = new Date(year, 11, 31)
  
  // 找到第一个周日
  const firstSunday = new Date(startDate)
  firstSunday.setDate(startDate.getDate() - startDate.getDay())
  
  let currentDate = new Date(firstSunday)
  let currentWeek: { date: string; level: number }[] = []
  
  while (currentDate <= endDate || currentWeek.length > 0) {
    const dateStr = currentDate.toISOString().split("T")[0]
    const isInYear = currentDate.getFullYear() === year
    const score = scoreMap.get(dateStr)
    
    currentWeek.push({
      date: dateStr,
      level: isInYear && score ? getColorLevel(score.percentage) : -1
    })
    
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
    
    if (currentDate > endDate && currentWeek.length === 0) break
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }
  
  return weeks
}

type ViewMode = "today" | "manage" | "calendar" | "stats"

export function Dashboard({ 
  tasks: initialTasks, 
  relapseTracker: initialTracker,
  templates: initialTemplates,
  historyScores: initialScores,
  statistics,
  todayStr,
  currentYear,
}: DashboardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [tracker, setTracker] = useState(initialTracker)
  const [templates, setTemplates] = useState(initialTemplates)
  const [scores] = useState(initialScores)
  const [isPending, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<ViewMode>("today")
  
  // 模板编辑
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    points: 10,
    taskType: "daily" as "daily" | "once",
    targetDate: ""
  })

  // 励志金句
  const [quote, setQuote] = useState({ content: "", from: "" })
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)

  const fetchQuote = useCallback(async () => {
    setIsLoadingQuote(true)
    try {
      const res = await fetch("https://v1.hitokoto.cn/?c=d&c=i&c=k&encode=json")
      const data = await res.json()
      setQuote({ content: data.hitokoto, from: data.from || data.from_who || "" })
    } catch {
      setQuote({ content: "每一天都是新的开始", from: "" })
    }
    setIsLoadingQuote(false)
  }, [])

  useEffect(() => {
    fetchQuote()
  }, [fetchQuote])

  // 计算分数和进度 - 满分固定为100，可以溢出
  const { totalPoints, earnedPoints, bonusPoints, penalty, progress, finalScore } = useMemo(() => {
    const total = tasks.reduce((sum, t) => sum + t.points, 0)
    const earned = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0)
    const bonus = tasks.reduce((sum, t) => sum + (t.bonus_points || 0), 0)
    const pen = calculatePenalty(tracker.count)
    const final = Math.max(0, earned + bonus - pen)
    // 满分固定为100，进度最高100%
    const prog = Math.min(100, final)
    return { totalPoints: total, earnedPoints: earned, bonusPoints: bonus, penalty: pen, progress: prog, finalScore: final }
  }, [tasks, tracker.count])

  const calendarData = useMemo(() => generateCalendarData(currentYear, scores), [scores, currentYear])

  // 时间进度计算
  const timeProgress = useMemo(() => {
    const now = new Date()
    const chicagoNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
    
    // 假期开始：5月6日，结束：8月24日
    const summerStart = new Date(currentYear, 4, 6) // 5月6日
    const summerEnd = new Date(currentYear, 7, 24)   // 8月24日
    const totalSummerDays = Math.ceil((summerEnd.getTime() - summerStart.getTime()) / (1000 * 60 * 60 * 24))
    const elapsedSummerDays = Math.max(0, Math.ceil((chicagoNow.getTime() - summerStart.getTime()) / (1000 * 60 * 60 * 24)))
    const daysUntilSchool = Math.max(0, Math.ceil((summerEnd.getTime() - chicagoNow.getTime()) / (1000 * 60 * 60 * 24)))
    const summerProgress = Math.min(100, (elapsedSummerDays / totalSummerDays) * 100)
    
    // 今日剩余（芝加哥时间，凌晨3点算新一天开始）
    let dayStart = new Date(chicagoNow)
    dayStart.setHours(3, 0, 0, 0)
    if (chicagoNow.getHours() < 3) {
      dayStart.setDate(dayStart.getDate() - 1)
    }
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const totalDayMs = dayEnd.getTime() - dayStart.getTime()
    const elapsedDayMs = chicagoNow.getTime() - dayStart.getTime()
    const dayRemaining = Math.max(0, 100 - (elapsedDayMs / totalDayMs) * 100)
    
    // 本周剩余（周一为开始，周日为结束）
    const dayOfWeek = chicagoNow.getDay() // 0=周日, 1=周一...
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const weekStart = new Date(chicagoNow)
    weekStart.setDate(chicagoNow.getDate() - daysFromMonday)
    weekStart.setHours(3, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const totalWeekMs = weekEnd.getTime() - weekStart.getTime()
    const elapsedWeekMs = chicagoNow.getTime() - weekStart.getTime()
    const weekRemaining = Math.max(0, 100 - (elapsedWeekMs / totalWeekMs) * 100)
    
    return {
      daysUntilSchool,
      summerProgress,
      dayRemaining,
      weekRemaining,
    }
  }, [currentYear])

  const handleToggle = (task: Task) => {
    const newCompleted = !task.completed
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, completed: newCompleted } : t
    ))
    
    startTransition(async () => {
      await toggleTask(task.id, newCompleted)
    })
  }

  const handleRelapseChange = (delta: number) => {
    const newCount = Math.max(0, tracker.count + delta)
    setTracker(prev => ({ ...prev, count: newCount }))
    
    startTransition(async () => {
      await updateRelapseCount(tracker.id, newCount)
    })
  }

  const handleReset = () => {
    setTasks(prev => prev.map(t => ({ ...t, completed: false })))
    
    startTransition(async () => {
      await resetAllTasks()
    })
  }

  // 同步今日任务
  const handleSyncTasks = () => {
    startTransition(async () => {
      const result = await syncTodayTasks()
      if (result.success && result.tasks) {
        setTasks(result.tasks)
      }
    })
  }

  // 模板操作
  const openAddTemplate = () => {
    setEditingTemplate(null)
    setTemplateForm({
      name: "",
      description: "",
      points: 10,
      taskType: "daily",
      targetDate: ""
    })
    setShowTemplateDialog(true)
  }

  const openEditTemplate = (template: TaskTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      points: template.points,
      taskType: template.task_type,
      targetDate: template.target_date || ""
    })
    setShowTemplateDialog(true)
  }

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) return
    
    startTransition(async () => {
      if (editingTemplate) {
        await updateTaskTemplate(
          editingTemplate.id,
          templateForm.name.trim(),
          templateForm.description || null,
          templateForm.points,
          templateForm.taskType,
          templateForm.taskType === "once" ? templateForm.targetDate || null : null
        )
        setTemplates(prev => prev.map(t => 
          t.id === editingTemplate.id 
            ? { 
                ...t, 
                name: templateForm.name.trim(),
                description: templateForm.description || null,
                points: templateForm.points,
                task_type: templateForm.taskType,
                target_date: templateForm.taskType === "once" ? templateForm.targetDate || null : null
              } 
            : t
        ))
      } else {
        const result = await createTaskTemplate(
          templateForm.name.trim(),
          templateForm.description || null,
          templateForm.points,
          templateForm.taskType,
          templateForm.taskType === "once" ? templateForm.targetDate || null : null
        )
        if (result.success && result.data) {
          setTemplates(prev => [...prev, result.data])
        }
      }
      setShowTemplateDialog(false)
      
      // 自动同步今日任务
      const syncResult = await syncTodayTasks()
      if (syncResult.success && syncResult.tasks) {
        setTasks(syncResult.tasks)
      }
    })
  }

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      await deleteTaskTemplate(id)
      // 自动同步今日任务
      const syncResult = await syncTodayTasks()
      if (syncResult.success && syncResult.tasks) {
        setTasks(syncResult.tasks)
      }
    })
  }

  const dailyTemplates = templates.filter(t => t.task_type === "daily")
  const onceTemplates = templates.filter(t => t.task_type === "once")

  return (
    <div className="h-screen flex flex-col p-4 md:p-6 max-w-7xl mx-auto">
      {/* 100%进度飘带效果 */}
      <Confetti active={finalScore >= 100} />

      {/* 顶部栏 */}
      <header className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <img 
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/FullLogo_NoBuffer-Photoroom-iq5y9MePI66aeBEGDe6R9qsbM5zGNb.png" 
            alt="Project Refactor" 
            className="h-12 dark:invert"
          />
          <p className="text-sm text-muted-foreground">
            {todayStr} · 距离开学还有 <span className="font-medium text-primary">{timeProgress.daysUntilSchool}</span> 天
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* 主内容��：��侧进度常驻 + 右侧切换 */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* 左侧统计面板 - 常驻 */}
        <Card className="md:col-span-1 flex flex-col">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              今日进度
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* 主进度环 */}
            <div className="flex flex-col items-center gap-1">
              <ProgressRing progress={progress} size={100} strokeWidth={6} />
              
              <div className="text-center">
                <div className="text-lg font-bold">
                  {finalScore} <span className="text-xs font-normal text-muted-foreground">/ 100</span>
                </div>
                {bonusPoints > 0 && (
                  <div className="text-xs text-green-500">
                    昨日溢出 +{bonusPoints} 分
                  </div>
                )}
                {finalScore > 100 && (
                  <div className="text-xs text-primary">
                    今日溢出 +{finalScore - 100} 分
                  </div>
                )}
                {penalty > 0 && (
                  <div className="text-xs text-destructive">
                    (已扣除 {penalty} 分惩罚)
                  </div>
                )}
              </div>
            </div>

            {/* 仪表盘小圆环组 */}
            <div className="w-full pt-2">
              <div className="grid grid-cols-3 gap-2">
                <MiniRing 
                  progress={timeProgress.summerProgress} 
                  label="假期进度"
                  size={48}
                  strokeWidth={3}
                />
                <MiniRing 
                  progress={timeProgress.weekRemaining} 
                  label="本周剩余"
                  size={48}
                  strokeWidth={3}
                />
                <MiniRing 
                  progress={timeProgress.dayRemaining} 
                  label="今日剩余"
                  size={48}
                  strokeWidth={3}
                />
              </div>
            </div>

            {/* 鹿管追踪器 */}
            <div className="w-full border-t pt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">本周鹿管</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    Math.max(0, 2 - tracker.count) > 0 
                      ? "bg-green-500/20 text-green-600 dark:text-green-400" 
                      : "bg-red-500/20 text-red-600 dark:text-red-400"
                  }`}>
                    剩余{Math.max(0, 2 - tracker.count)}次安全
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => handleRelapseChange(-1)}
                    disabled={isPending || tracker.count === 0}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-lg font-bold min-w-[24px] text-center">
                    {tracker.count}
                  </span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => handleRelapseChange(1)}
                    disabled={isPending}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                0-2次安全，第3次-30分，之后每次-50分
              </p>
            </div>

            {/* 励志金句 */}
            <div className="w-full border-t pt-3 mt-auto">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Quote className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">每日一言</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={fetchQuote}
                  disabled={isLoadingQuote}
                >
                  <RefreshCw className={`h-3 w-3 ${isLoadingQuote ? "animate-spin" : ""}`} />
                </Button>
              </div>
              <div className="text-sm text-muted-foreground italic leading-relaxed">
                {quote.content || "加载中..."}
              </div>
              {quote.from && (
                <div className="text-xs text-muted-foreground/70 mt-1 text-right">
                  —— {quote.from}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 右侧内容区 - 可切换 */}
        <Card className="md:col-span-2 flex flex-col min-h-0">
          {/* 切换标签 */}
          <CardHeader className="pb-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "today" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("today")}
                >
                  <ListTodo className="h-4 w-4 mr-1" />
                  今日任务
                </Button>
                <Button
                  variant={viewMode === "manage" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("manage")}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  任务管理
                </Button>
                <Button
                  variant={viewMode === "calendar" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("calendar")}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  历史日历
                </Button>
                <Button
                  variant={viewMode === "stats" ? "default" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setViewMode("stats")}
                >
                  <BarChart3 className="h-4 w-4 mr-1" />
                  数据统计
                </Button>
              </div>
              
              {/* 右侧操作按钮 */}
              {viewMode === "today" && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-muted-foreground hover:text-foreground"
                  onClick={handleReset}
                  disabled={isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  重置
                </Button>
              )}
              {viewMode === "manage" && (
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8"
                    onClick={handleSyncTasks}
                    disabled={isPending}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    同步
                  </Button>
                  <Button 
                    size="sm" 
                    className="h-8"
                    onClick={openAddTemplate}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto min-h-0 pr-2">
            {/* 今日任务视图 */}
            {viewMode === "today" && (
              <div className="space-y-1">
                {tasks.map((task) => (
                  <div 
                    key={task.id} 
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox 
                      checked={task.completed}
                      onCheckedChange={() => handleToggle(task)}
                      disabled={isPending}
                      className="h-4 w-4"
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm block truncate ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.name}
                      </span>
                      {task.description && (
                        <span className="text-xs text-muted-foreground block truncate">
                          {task.description}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-medium min-w-[40px] text-right ${task.completed ? "text-primary" : "text-muted-foreground"}`}>
                      +{task.points}
                    </span>
                    {task.task_type === "once" && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        一次性
                      </span>
                    )}
                  </div>
                ))}
                
                {tasks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无任务，请在任务管理中添加
                  </div>
                )}
              </div>
            )}

            {/* 任务管理视图 */}
            {viewMode === "manage" && (
              <div>
                {/* 每日任务 */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">每日任务</h3>
                  <div className="space-y-2">
                    {dailyTemplates.map((template) => (
                      <div 
                        key={template.id} 
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{template.name}</span>
                          {template.description && (
                            <span className="text-xs text-muted-foreground block truncate">
                              {template.description}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-primary">+{template.points}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditTemplate(template)}>
                              <Pencil className="h-3 w-3 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {dailyTemplates.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        暂无每日任务模板
                      </p>
                    )}
                  </div>
                </div>

                {/* 一次性任务 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">一次性任务</h3>
                  <div className="space-y-2">
                    {onceTemplates.map((template) => (
                      <div 
                        key={template.id} 
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md border bg-card"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{template.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {template.target_date || "未指定日期"}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-primary">+{template.points}</span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditTemplate(template)}>
                              <Pencil className="h-3 w-3 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-3 w-3 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    {onceTemplates.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        暂无一次性任务
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 历史日历视图 */}
            {viewMode === "calendar" && (
              <div>
                <h3 className="text-sm font-medium mb-4">{currentYear} 年度贡献</h3>
                <div className="overflow-x-auto">
                  <div className="flex gap-0.5 min-w-max">
                    {calendarData.map((week, weekIndex) => (
                      <div key={weekIndex} className="flex flex-col gap-0.5">
                        {week.map((day, dayIndex) => (
                          <div
                            key={`${weekIndex}-${dayIndex}`}
                            className={`w-3 h-3 rounded-sm ${
                              day.level === -1 ? "bg-transparent" :
                              day.level === 0 ? "bg-muted" :
                              day.level === 1 ? "bg-primary/20" :
                              day.level === 2 ? "bg-primary/40" :
                              day.level === 3 ? "bg-primary/60" :
                              "bg-primary"
                            }`}
                            title={day.date}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* 图例 */}
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <span>少</span>
                  <div className="flex gap-0.5">
                    <div className="w-3 h-3 rounded-sm bg-muted" />
                    <div className="w-3 h-3 rounded-sm bg-primary/20" />
                    <div className="w-3 h-3 rounded-sm bg-primary/40" />
                    <div className="w-3 h-3 rounded-sm bg-primary/60" />
                    <div className="w-3 h-3 rounded-sm bg-primary" />
                  </div>
                  <span>多</span>
                </div>
              </div>
            )}

            {/* 数据统计视图 */}
            {viewMode === "stats" && (
              <div className="space-y-6">
                {/* 进度统计 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">进度统计</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-primary">{statistics.weeklyAvgProgress}%</div>
                      <div className="text-xs text-muted-foreground">本周平均进度</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-primary">{statistics.monthlyAvgProgress}%</div>
                      <div className="text-xs text-muted-foreground">本月平均进度</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold">{statistics.avgDailyScore}</div>
                      <div className="text-xs text-muted-foreground">平均每日得分</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-green-500">{statistics.perfectDays}</div>
                      <div className="text-xs text-muted-foreground">完美日 (100+分)</div>
                    </div>
                  </div>
                </div>

                {/* 鹿管统计 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">鹿管统计</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-orange-500">{statistics.totalRelapseCount}</div>
                      <div className="text-xs text-muted-foreground">鹿管总次数</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold">{statistics.monthlyAvgRelapsePerWeek}</div>
                      <div className="text-xs text-muted-foreground">本月周均鹿管</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-2xl font-bold">{statistics.summerAvgRelapsePerWeek}</div>
                      <div className="text-xs text-muted-foreground">假期周均鹿管</div>
                    </div>
                  </div>
                </div>

                {/* 追踪信息 */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">追踪信息</h3>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">已追踪天数</div>
                        <div className="text-xl font-bold">{statistics.totalDaysTracked} 天</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">数据起始日</div>
                        <div className="text-xl font-bold">2025-05-07</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      * 统计数据不包含今天（今天尚未结算）
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 模板编辑对话框 */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "编辑任务" : "添加任务"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">任务名称</label>
              <Input
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入任务名称"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">描述（可选）</label>
              <Textarea
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入任务描述"
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">分值</label>
                <Input
                  type="number"
                  value={templateForm.points}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                  min={1}
                  max={100}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">任务类型</label>
                <Select
                  value={templateForm.taskType}
                  onValueChange={(value: "daily" | "once") => setTemplateForm(prev => ({ ...prev, taskType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">每日任务</SelectItem>
                    <SelectItem value="once">一次性任务</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {templateForm.taskType === "once" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">目标日期</label>
                <Input
                  type="date"
                  value={templateForm.targetDate}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, targetDate: e.target.value }))}
                />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isPending || !templateForm.name.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
