"use client"

import { useMemo, useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
import { MoreHorizontal, Plus, Pencil, Trash2, RotateCcw, Minus, AlertTriangle, Target } from "lucide-react"
import { toggleTask, addTask, updateTask, deleteTask, updateRelapseCount, resetAllTasks } from "@/lib/actions"
import type { Task, RelapseTracker } from "@/lib/types"

interface DashboardProps {
  tasks: Task[]
  relapseTracker: RelapseTracker
}

// 计算惩罚分数
function calculatePenalty(count: number): number {
  if (count <= 2) return 0
  if (count === 3) return 30
  return 30 + (count - 3) * 50
}

export function Dashboard({ tasks: initialTasks, relapseTracker: initialTracker }: DashboardProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [tracker, setTracker] = useState(initialTracker)
  const [isPending, startTransition] = useTransition()
  
  // 新增任务
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTaskName, setNewTaskName] = useState("")
  const [newTaskPoints, setNewTaskPoints] = useState(10)
  
  // 编辑任务
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editName, setEditName] = useState("")
  const [editPoints, setEditPoints] = useState(10)

  // 计算分数和进度
  const { totalPoints, earnedPoints, penalty, progress } = useMemo(() => {
    const total = tasks.reduce((sum, t) => sum + t.points, 0)
    const earned = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0)
    const pen = calculatePenalty(tracker.count)
    const finalScore = Math.max(0, earned - pen)
    const prog = total > 0 ? (finalScore / total) * 100 : 0
    return { totalPoints: total, earnedPoints: earned, penalty: pen, progress: prog }
  }, [tasks, tracker.count])

  const today = new Date().toLocaleDateString("zh-CN", { 
    month: "long", 
    day: "numeric",
    weekday: "long"
  })

  const handleToggle = (task: Task) => {
    const newCompleted = !task.completed
    setTasks(prev => prev.map(t => 
      t.id === task.id ? { ...t, completed: newCompleted } : t
    ))
    
    startTransition(async () => {
      await toggleTask(task.id, newCompleted)
    })
  }

  const handleAdd = () => {
    if (!newTaskName.trim()) return
    
    startTransition(async () => {
      const result = await addTask(newTaskName.trim(), newTaskPoints)
      if (result.success && result.data) {
        setTasks(prev => [...prev, result.data])
      }
      setNewTaskName("")
      setNewTaskPoints(10)
      setShowAddDialog(false)
    })
  }

  const handleEdit = () => {
    if (!editingTask || !editName.trim()) return
    
    setTasks(prev => prev.map(t => 
      t.id === editingTask.id ? { ...t, name: editName.trim(), points: editPoints } : t
    ))
    
    startTransition(async () => {
      await updateTask(editingTask.id, editName.trim(), editPoints)
      setEditingTask(null)
    })
  }

  const handleDelete = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    
    startTransition(async () => {
      await deleteTask(taskId)
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

  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setEditName(task.name)
    setEditPoints(task.points)
  }

  return (
    <div className="h-screen flex flex-col p-4 md:p-6 max-w-6xl mx-auto">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Summer Level-Up</h1>
          <p className="text-sm text-muted-foreground">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleReset}
            disabled={isPending}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            重置
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* 主内容区 */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* 左侧统计面板 */}
        <Card className="md:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
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
                  <AlertTriangle className="h-4 w-4 text-warning" />
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
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">今日任务</CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              添加
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto min-h-0 pr-2">
            <div className="space-y-1">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/50 group transition-colors"
                >
                  <Checkbox 
                    checked={task.completed}
                    onCheckedChange={() => handleToggle(task)}
                    disabled={isPending}
                    className="h-4 w-4"
                  />
                  <span className={`flex-1 text-sm ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.name}
                  </span>
                  <span className={`text-xs font-medium min-w-[40px] text-right ${task.completed ? "text-primary" : "text-muted-foreground"}`}>
                    +{task.points}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(task)}>
                        <Pencil className="h-3 w-3 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(task.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              
              {tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  暂无任务，点击上方添加按钮创建
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 添加任务对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>添加新任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">任务名称</label>
              <Input 
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="输入任务名称"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">分值</label>
              <Input 
                type="number"
                value={newTaskPoints}
                onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                min={1}
                max={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={isPending || !newTaskName.trim()}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑任务对话框 */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>编辑任务</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">任务名称</label>
              <Input 
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="输入任务名称"
                onKeyDown={(e) => e.key === "Enter" && handleEdit()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">分值</label>
              <Input 
                type="number"
                value={editPoints}
                onChange={(e) => setEditPoints(Number(e.target.value))}
                min={1}
                max={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={isPending || !editName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
