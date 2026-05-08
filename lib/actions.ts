"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { DEFAULT_TASKS, type Task, type DailyScore } from "./types"
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

// 获取自控追踪器
export async function getRelapseTracker() {
  const supabase = await createClient()
  const weekStart = getWeekStart()
  
  const { data, error } = await supabase
    .from("relapse_tracker")
    .select("*")
    .eq("week_start", weekStart)
    .single()
  
  if (error && error.code !== "PGRST116") {
    console.error("Error fetching relapse tracker:", error)
  }
  
  if (!data) {
    const { data: newTracker, error: insertError } = await supabase
      .from("relapse_tracker")
      .insert({ count: 0, week_start: weekStart })
      .select()
      .single()
    
    if (insertError) {
      console.error("Error creating relapse tracker:", insertError)
      return { id: "", count: 0, week_start: weekStart }
    }
    
    return newTracker
  }
  
  return data
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
