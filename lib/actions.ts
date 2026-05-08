"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { DEFAULT_TASKS } from "./types"

// 获取今天的日期字符串 (YYYY-MM-DD)
function getTodayDate() {
  return new Date().toISOString().split("T")[0]
}

// 获取本周一的日期
function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(now.setDate(diff)).toISOString().split("T")[0]
}

// 获取今日任务
export async function getTodayTasks() {
  const supabase = await createClient()
  const today = getTodayDate()
  
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("date", today)
    .order("sort_order", { ascending: true })
  
  if (error) {
    console.error("Error fetching tasks:", error)
    return []
  }
  
  // 如果今天没有任务，创建默认任务
  if (!data || data.length === 0) {
    const defaultTasks = DEFAULT_TASKS.map((task, index) => ({
      name: task.name,
      points: task.points,
      completed: false,
      sort_order: index,
      date: today,
    }))
    
    const { data: newTasks, error: insertError } = await supabase
      .from("tasks")
      .insert(defaultTasks)
      .select()
    
    if (insertError) {
      console.error("Error creating default tasks:", insertError)
      return []
    }
    
    return newTasks || []
  }
  
  return data
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
  
  // 如果本周没有记录，创建新记录
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

// 添加新任务
export async function addTask(name: string, points: number) {
  const supabase = await createClient()
  const today = getTodayDate()
  
  // 获取当前最大排序
  const { data: existingTasks } = await supabase
    .from("tasks")
    .select("sort_order")
    .eq("date", today)
    .order("sort_order", { ascending: false })
    .limit(1)
  
  const maxOrder = existingTasks?.[0]?.sort_order ?? -1
  
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      name,
      points,
      completed: false,
      sort_order: maxOrder + 1,
      date: today,
    })
    .select()
    .single()
  
  if (error) {
    console.error("Error adding task:", error)
    return { success: false, data: null }
  }
  
  revalidatePath("/")
  return { success: true, data }
}

// 更新任务
export async function updateTask(taskId: string, name: string, points: number) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("tasks")
    .update({ name, points, updated_at: new Date().toISOString() })
    .eq("id", taskId)
  
  if (error) {
    console.error("Error updating task:", error)
    return { success: false }
  }
  
  revalidatePath("/")
  return { success: true }
}

// 删除任务
export async function deleteTask(taskId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId)
  
  if (error) {
    console.error("Error deleting task:", error)
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
  const today = getTodayDate()
  
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
