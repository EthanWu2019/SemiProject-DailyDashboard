"use client"

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { MoreHorizontal, Plus, Pencil, Trash2, RotateCcw, Minus, AlertTriangle, Target, ListTodo, Settings, Calendar } from "lucide-react"
import { 
  toggleTask, 
  updateRelapseCount, 
  resetAllTasks,
  getTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  getHistoryScores
} from "@/lib/actions"
import type { Task, RelapseTracker, TaskTemplate, DailyScore } from "@/lib/types"

interface DashboardProps {
  tasks: Task[]
  relapseTracker: RelapseTracker
  templates: TaskTemplate[]
  historyScores: DailyScore[]
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

export function Dashboard({ 
  tasks: initialTasks, 
  relapseTracker: initialTracker,
  templates: initialTemplates,
  historyScores: initialScores,
  todayStr,
  currentYear,
}: DashboardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [tracker, setTracker] = useState(initialTracker)
  const [templates, setTemplates] = useState(initialTemplates)
  const [scores] = useState(initialScores)
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState("today")
  
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

  // 计算分数和进度
  const { totalPoints, earnedPoints, penalty, progress } = useMemo(() => {
    const total = tasks.reduce((sum, t) => sum + t.points, 0)
    const earned = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0)
    const pen = calculatePenalty(tracker.count)
    const finalScore = Math.max(0, earned - pen)
    const prog = total > 0 ? (finalScore / total) * 100 : 0
    return { totalPoints: total, earnedPoints: earned, penalty: pen, progress: prog }
  }, [tasks, tracker.count])

  const calendarData = useMemo(() => generateCalendarData(currentYear, scores), [scores, currentYear])

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
    })
  }

  const handleDeleteTemplate = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id))
    startTransition(async () => {
      await deleteTaskTemplate(id)
    })
  }

  const dailyTemplates = templates.filter(t => t.task_type === "daily")
  const onceTemplates = templates.filter(t => t.task_type === "once")

  return (
    <div className="h-screen flex flex-col p-4 md:p-6 max-w-7xl mx-auto">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-foreground">Summer Level-Up</h1>
          <p className="text-sm text-muted-foreground">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* 标签页切换 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-3 mb-4 flex-shrink-0">
          <TabsTrigger value="today" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            <span className="hidden sm:inline">今日任务</span>
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">任务管理</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">历史日历</span>
          </TabsTrigger>
        </TabsList>

        {/* 今日任务 */}
        <TabsContent value="today" className="flex-1 min-h-0 mt-0">
          <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 左侧统计面板 */}
            <Card className="md:col-span-1 flex flex-col">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  今日进度
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center gap-4">
                <ProgressRing progress={progress} size={140} strokeWidth={10} />
                
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold">
                    {Math.max(0, earnedPoints - penalty)} <span className="text-sm font-normal text-muted-foreground">/ {totalPoints}</span>
                  </div>
                  {penalty > 0 && (
                    <div className="text-xs text-destructive">
                      (已扣除 {penalty} 分惩罚)
                    </div>
                  )}
                </div>

                {/* 自控追踪器 */}
                <div className="w-full border-t pt-4 mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">本周自控</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-7 w-7"
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
                        className="h-7 w-7"
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
              </CardContent>
            </Card>

            {/* 右侧任务列表 */}
            <Card className="md:col-span-2 flex flex-col min-h-0">
              <CardHeader className="pb-2 flex-row items-center justify-between flex-shrink-0">
                <CardTitle className="text-sm font-medium">今日任务</CardTitle>
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
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto min-h-0 pr-2">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 任务管理 */}
        <TabsContent value="manage" className="flex-1 min-h-0 mt-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-row items-center justify-between flex-shrink-0">
              <CardTitle className="text-sm font-medium">任务模板管理</CardTitle>
              <Button 
                size="sm" 
                className="h-8"
                onClick={openAddTemplate}
              >
                <Plus className="h-4 w-4 mr-1" />
                添加任务
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto min-h-0">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* 历史日历 */}
        <TabsContent value="calendar" className="flex-1 min-h-0 mt-0">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="text-sm font-medium">{currentYear} 年度贡献</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              <div className="flex gap-1">
                {calendarData.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {week.map((day, dayIndex) => (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        className={`w-3 h-3 rounded-sm ${
                          day.level === -1 
                            ? "bg-transparent" 
                            : day.level === 0 
                              ? "bg-muted" 
                              : day.level === 1 
                                ? "bg-primary/20" 
                                : day.level === 2 
                                  ? "bg-primary/40" 
                                  : day.level === 3 
                                    ? "bg-primary/70" 
                                    : "bg-primary"
                        }`}
                        title={day.date}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                <span>少</span>
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <div className="w-3 h-3 rounded-sm bg-primary/20" />
                <div className="w-3 h-3 rounded-sm bg-primary/40" />
                <div className="w-3 h-3 rounded-sm bg-primary/70" />
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span>多</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 模板编辑对话框 */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="sm:max-w-[450px]">
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
              <label className="text-sm font-medium">任务描述 (可选)</label>
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
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, points: Number(e.target.value) }))}
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
              {editingTemplate ? "保存" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
