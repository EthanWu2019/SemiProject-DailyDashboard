import { Dashboard } from "@/components/dashboard"
import { getTodayTasks, getRelapseTracker, getTaskTemplates, getHistoryScores, getChicagoDate } from "@/lib/actions"

export default async function Home() {
  const chicagoDate = getChicagoDate()
  const currentYear = chicagoDate.getFullYear()
  
  // 格式化日期字符串（在服务端完成，避免水合不匹配）
  const todayStr = chicagoDate.toLocaleDateString("zh-CN", { 
    month: "long", 
    day: "numeric",
    weekday: "long",
    timeZone: "America/Chicago"
  })
  
  const [tasks, relapseTracker, templates, historyScores] = await Promise.all([
    getTodayTasks(),
    getRelapseTracker(),
    getTaskTemplates(),
    getHistoryScores(currentYear),
  ])

  return (
    <Dashboard 
      tasks={tasks} 
      relapseTracker={relapseTracker} 
      templates={templates}
      historyScores={historyScores}
      todayStr={todayStr}
      currentYear={currentYear}
    />
  )
}
