"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { DEFAULT_TASKS, type Task, type DailyScore, type Statistics, type DailyRecord } from "./types"
import { getChicagoDateStr } from "./utils"

// 获取本周一的日期（芝加哥时间）
function getWeekStart() {
  const now = new Date()
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Chicago" }))
  if (chicagoTime.getHours() < 3) {
    chicagoTime.setDate(chicagoTime.getDate() - 1)
  }
  const day = chicagoTime.getDay()
  const diff = chicagoTime.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(chicagoTime.setDate(diff)).toISOString().split("T")[0]
}

// 获取今日任务
export async function getTodayTasks(): Promise<Task[]> {
  const supabase = await createClient()
  const today = getChicagoDateStr()
  
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("date", today)
    .order("sort_order", { ascending: true })
  
  if (error) {
    console.error("Error fetching tasks:", error)
    return []
  }
  
  // 如果今天没有任务，从模板创建
  if (!data || data.length === 0) {
    // 获取所有每日任务模板
    const { data: templates } = await supabase
      .from("task_templates")
      .select("*")
      .eq("task_type", "daily")
      .order("sort_order", { ascending: true })
    
    // 获取今天需要完成的一次性任务
    const { data: onceTasks } = await supabase
      .from("task_templates")
      .select("*")
      .eq("task_type", "once")
      .eq("target_date", today)
    
    let tasksToCreate: any[] = []
    
    if (templates && templates.length > 0) {
      tasksToCreate = templates.map((t, index) => ({
        name: t.name,
        description: t.description,
        points: t.points,
        completed: false,
        sort_order: index,
        date: today,
        task_type: "daily",
        target_date: null,
      }))
    } else {
      // 模板表为空，先创建默认模板
      const defaultTemplates = DEFAULT_TASKS.map((task, index) => ({
        name: task.name,
        description: task.description,
        points: task.points,
        task_type: "daily" as const,
        target_date: null,
        sort_order: index,
      }))
      
      await supabase.from("task_templates").insert(defaultTemplates)
      
      // 然后创建今日任务
      tasksToCreate = DEFAULT_TASKS.map((task, index) => ({
        name: task.name,
        description: task.description,
        points: task.points,
        completed: false,
        sort_order: index,
        date: today,
        task_type: "daily",
        target_date: null,
      }))
    }
    
    // 添加一次性任务
    if (onceTasks && onceTasks.length > 0) {
      const onceTasksToAdd = onceTasks.map((t, index) => ({
        name: t.name,
        description: t.description,
        points: t.points,
        completed: false,
        sort_order: tasksToCreate.length + index,
        date: today,
        task_type: "once",
        target_date: t.target_date,
      }))
      tasksToCreate = [...tasksToCreate, ...onceTasksToAdd]
    }
    
    if (tasksToCreate.length > 0) {
      const { data: newTasks, error: insertError } = await supabase
        .from("tasks")
        .insert(tasksToCreate)
        .select()
      
      if (insertError) {
        console.error("Error creating tasks:", insertError)
        return []
      }
      
      return newTasks || []
    }
  }
  
  return data || []
}

// 获取任务模板（用于任务管理界面）
export async function getTaskTemplates() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .order("task_type", { ascending: true })
    .order("sort_order", { ascending: true })
  
  if (error) {
    console.error("Error fetching task templates:", error)
    return []
  }
  
  return data || []
}

// 创建任务模板
export async function createTaskTemplate(
  name: string,
  description: string | null,
  points: number,
  taskType: "daily" | "once",
  targetDate: string | null
) {
  const supabase = await createClient()
  
  // 获取当前最大排序
  const { data: existingTemplates } = await supabase
    .from("task_templates")
    .select("sort_order")
    .eq("task_type", taskType)
    .order("sort_order", { ascending: false })
    .limit(1)
  
  const maxOrder = existingTemplates?.[0]?.sort_order ?? -1
  
  const { data, error } = await supabase
    .from("task_templates")
    .insert({
      name,
      description,
      points,
      task_type: taskType,
      target_date: targetDate,
      sort_order: maxOrder + 1,
    })
    .select()
    .single()
  
  if (error) {
    console.error("Error creating task template:", error)
    return { success: false, data: null }
  }
  
  revalidatePath("/")
  return { success: true, data }
}

// 更新任务模板
export async function updateTaskTemplate(
  id: string,
  name: string,
  description: string | null,
  points: number,
  taskType: "daily" | "once",
  targetDate: string | null
) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("task_templates")
    .update({
      name,
      description,
      points,
      task_type: taskType,
      target_date: targetDate,
    })
    .eq("id", id)
  
  if (error) {
    console.error("Error updating task template:", error)
    return { success: false }
  }
  
  revalidatePath("/")
  return { success: true }
}

// 删除任务模板
export async function deleteTaskTemplate(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("task_templates")
    .delete()
    .eq("id", id)
  
  if (error) {
    console.error("Error deleting task template:", error)
    return { success: false }
  }
  
  revalidatePath("/")
  return { success: true }
}

// 获取鹿管追踪器
export async function getRelapseTracker() {
  const supabase = await createClient()
  const weekStart = getWeekStart()
  
  // 先尝试查询现有记录
  const { data: existing } = await supabase
    .from("relapse_tracker")
    .select("*")
    .eq("week_start", weekStart)
    .single()
  
  if (existing) {
    return existing
  }
  
  // 如果不存在，创建新记录
  const { data: newTracker, error: insertError } = await supabase
    .from("relapse_tracker")
    .insert({ count: 0, week_start: weekStart })
    .select()
    .single()
  
  if (insertError) {
    // 如果插入失败（可能是并发插入导致），再次查询
    const { data: retryData } = await supabase
      .from("relapse_tracker")
      .select("*")
      .eq("week_start", weekStart)
      .single()
    
    if (retryData) {
      return retryData
    }
    
    console.error("Error creating relapse tracker:", insertError)
    return { id: "", count: 0, week_start: weekStart, created_at: "", updated_at: "" }
  }
  
  return newTracker
}

// 切换任务完成状态
export async function toggleTask(taskId: string, completed: boolean) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("tasks")
    .update({ completed, updated_at: new Date().toISOString() })
    .eq("id", taskId)
  
  if (error) {
    console.error("Error toggling task:", error)
    return { success: false }
  }
  
  revalidatePath("/")
  return { success: true }
}

// 更新自控计数
export async function updateRelapseCount(trackerId: string, count: number) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("relapse_tracker")
    .update({ count, updated_at: new Date().toISOString() })
    .eq("id", trackerId)
  
  if (error) {
    console.error("Error updating relapse count:", error)
    return { success: false }
  }
  
  revalidatePath("/")
  return { success: true }
}

// 重置今日所有任务
export async function resetAllTasks() {
  const supabase = await createClient()
  const today = getChicagoDateStr()
  
  const { error } = await supabase
    .from("tasks")
    .update({ completed: false, updated_at: new Date().toISOString() })
    .eq("date", today)
  
  if (error) {
    console.error("Error resetting tasks:", error)
    return { success: false }
  }
  
  revalidatePath("/")
  return { success: true }
}

// 同步今日任务（根据模板重新生成，保留已完成状态）
export async function syncTodayTasks() {
  const supabase = await createClient()
  const today = getChicagoDateStr()
  
  // 获取当前今日任务及其完成状态
  const { data: currentTasks } = await supabase
    .from("tasks")
    .select("name, completed")
    .eq("date", today)
  
  const completedMap = new Map(
    currentTasks?.map(t => [t.name, t.completed]) || []
  )
  
  // 删除今日所有任务
  await supabase.from("tasks").delete().eq("date", today)
  
  // 获取所有每日任务模板
  const { data: templates } = await supabase
    .from("task_templates")
    .select("*")
    .eq("task_type", "daily")
    .order("sort_order", { ascending: true })
  
  // 获取今天需要完成的一次性任务
  const { data: onceTasks } = await supabase
    .from("task_templates")
    .select("*")
    .eq("task_type", "once")
    .eq("target_date", today)
  
  let tasksToCreate: any[] = []
  
  if (templates && templates.length > 0) {
    tasksToCreate = templates.map((t, index) => ({
      name: t.name,
      description: t.description,
      points: t.points,
      completed: completedMap.get(t.name) || false, // 保留已完成状态
      sort_order: index,
      date: today,
      task_type: "daily",
      target_date: null,
    }))
  }
  
  // 添加一次性任务
  if (onceTasks && onceTasks.length > 0) {
    const onceTasksToAdd = onceTasks.map((t, index) => ({
      name: t.name,
      description: t.description,
      points: t.points,
      completed: completedMap.get(t.name) || false,
      sort_order: tasksToCreate.length + index,
      date: today,
      task_type: "once",
      target_date: t.target_date,
    }))
    tasksToCreate = [...tasksToCreate, ...onceTasksToAdd]
  }
  
  if (tasksToCreate.length > 0) {
    const { data: newTasks, error } = await supabase
      .from("tasks")
      .insert(tasksToCreate)
      .select()
    
    if (error) {
      console.error("Error syncing tasks:", error)
      return { success: false, tasks: [] }
    }
    
    revalidatePath("/")
    return { success: true, tasks: newTasks || [] }
  }
  
  revalidatePath("/")
  return { success: true, tasks: [] }
}

// 获取历史得分数据（用于日历视图）
export async function getHistoryScores(year: number): Promise<DailyScore[]> {
  const supabase = await createClient()
  
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`
  
  const { data, error } = await supabase
    .from("tasks")
    .select("date, points, completed")
    .gte("date", startDate)
    .lte("date", endDate)
  
  if (error) {
    console.error("Error fetching history:", error)
    return []
  }
  
  // 按日期聚合
  const scoreMap = new Map<string, { total: number; earned: number }>()
  
  data?.forEach((task) => {
    const existing = scoreMap.get(task.date) || { total: 0, earned: 0 }
    existing.total += task.points
    if (task.completed) {
      existing.earned += task.points
    }
    scoreMap.set(task.date, existing)
  })
  
  const scores: DailyScore[] = []
  scoreMap.forEach((value, date) => {
    scores.push({
      date,
      total_points: value.total,
      earned_points: value.earned,
      percentage: value.total > 0 ? Math.round((value.earned / value.total) * 100) : 0,
    })
  })
  
  return scores.sort((a, b) => a.date.localeCompare(b.date))
}

// 计算惩罚分数
function calculatePenalty(count: number): number {
  if (count <= 2) return 0
  if (count === 3) return 30
  return 30 + (count - 3) * 50
}

// 保存每日结算记录（由定时任务在凌晨3点调用，或者页面加载时检查是否需要结算前一天）
export async function saveDailyRecord(date: string) {
  const supabase = await createClient()
  
  // 检查是否已经结算过
  const { data: existing } = await supabase
    .from("daily_records")
    .select("id")
    .eq("date", date)
    .single()
  
  if (existing) {
    return { success: true, message: "Already recorded" }
  }
  
  // 获取该日任务
  const { data: tasks } = await supabase
    .from("tasks")
    .select("points, completed")
    .eq("date", date)
  
  if (!tasks || tasks.length === 0) {
    return { success: false, message: "No tasks for this date" }
  }
  
  // 获取该周的鹿管次数
  const taskDate = new Date(date)
  const day = taskDate.getDay()
  const diff = taskDate.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(taskDate.setDate(diff)).toISOString().split("T")[0]
  
  const { data: tracker } = await supabase
    .from("relapse_tracker")
    .select("count")
    .eq("week_start", weekStart)
    .single()
  
  const relapseCount = tracker?.count || 0
  const totalPoints = tasks.reduce((sum, t) => sum + t.points, 0)
  const earnedPoints = tasks.filter(t => t.completed).reduce((sum, t) => sum + t.points, 0)
  const penalty = calculatePenalty(relapseCount)
  const finalScore = Math.max(0, earnedPoints - penalty)
  
  const { error } = await supabase
    .from("daily_records")
    .insert({
      date,
      total_points: totalPoints,
      earned_points: earnedPoints,
      relapse_count: relapseCount,
      penalty,
      final_score: finalScore,
    })
  
  if (error) {
    console.error("Error saving daily record:", error)
    return { success: false }
  }
  
  return { success: true }
}

// 检查并结算前一天（页面加载时调用）
export async function checkAndSettlePreviousDay() {
  const today = getChicagoDateStr()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]
  
  // 只结算5月7日之后的数据
  if (yesterdayStr < "2025-05-07") {
    return { success: true, message: "Before tracking start date" }
  }
  
  return await saveDailyRecord(yesterdayStr)
}

// 获取统计数据
export async function getStatistics(): Promise<Statistics> {
  const supabase = await createClient()
  const today = getChicagoDateStr()
  
  // 获取所有已结算记录（不包括今天）
  const { data: records } = await supabase
    .from("daily_records")
    .select("*")
    .lt("date", today)
    .gte("date", "2025-05-07")
    .order("date", { ascending: false })
  
  if (!records || records.length === 0) {
    return {
      weeklyAvgProgress: 0,
      monthlyAvgProgress: 0,
      totalRelapseCount: 0,
      monthlyAvgRelapsePerWeek: 0,
      summerAvgRelapsePerWeek: 0,
      totalDaysTracked: 0,
      perfectDays: 0,
      avgDailyScore: 0,
    }
  }
  
  // 计算本周数据（周一开始）
  const chicagoNow = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Chicago" }))
  const dayOfWeek = chicagoNow.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekStart = new Date(chicagoNow)
  weekStart.setDate(chicagoNow.getDate() - daysFromMonday)
  const weekStartStr = weekStart.toISOString().split("T")[0]
  
  const weekRecords = records.filter(r => r.date >= weekStartStr)
  const weeklyAvgProgress = weekRecords.length > 0
    ? weekRecords.reduce((sum, r) => sum + Math.min(100, r.final_score), 0) / weekRecords.length
    : 0
  
  // 计算本月数据
  const monthStart = `${chicagoNow.getFullYear()}-${String(chicagoNow.getMonth() + 1).padStart(2, "0")}-01`
  const monthRecords = records.filter(r => r.date >= monthStart)
  const monthlyAvgProgress = monthRecords.length > 0
    ? monthRecords.reduce((sum, r) => sum + Math.min(100, r.final_score), 0) / monthRecords.length
    : 0
  
  // 总鹿管次数（从所有周记录中获取）
  const { data: allTrackers } = await supabase
    .from("relapse_tracker")
    .select("count, week_start")
    .order("week_start", { ascending: false })
  
  const totalRelapseCount = allTrackers?.reduce((sum, t) => sum + t.count, 0) || 0
  
  // 本月平均每周鹿管次数
  const monthTrackers = allTrackers?.filter(t => t.week_start >= monthStart) || []
  const monthlyAvgRelapsePerWeek = monthTrackers.length > 0
    ? monthTrackers.reduce((sum, t) => sum + t.count, 0) / monthTrackers.length
    : 0
  
  // 假期到现在平均每周鹿管次数
  const summerAvgRelapsePerWeek = allTrackers && allTrackers.length > 0
    ? totalRelapseCount / allTrackers.length
    : 0
  
  // 总追踪天数
  const totalDaysTracked = records.length
  
  // 完美日（100分或以上）
  const perfectDays = records.filter(r => r.final_score >= 100).length
  
  // 平均每日得分
  const avgDailyScore = records.reduce((sum, r) => sum + r.final_score, 0) / records.length
  
  return {
    weeklyAvgProgress: Math.round(weeklyAvgProgress * 10) / 10,
    monthlyAvgProgress: Math.round(monthlyAvgProgress * 10) / 10,
    totalRelapseCount,
    monthlyAvgRelapsePerWeek: Math.round(monthlyAvgRelapsePerWeek * 10) / 10,
    summerAvgRelapsePerWeek: Math.round(summerAvgRelapsePerWeek * 10) / 10,
    totalDaysTracked,
    perfectDays,
    avgDailyScore: Math.round(avgDailyScore * 10) / 10,
  }
}
