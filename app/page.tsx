import { Dashboard } from "@/components/dashboard"
import { getTodayTasks, getRelapseTracker, getTaskTemplates, getHistoryScores, getStatistics, checkAndSettlePreviousDay } from "@/lib/actions"
import { getChicagoDate } from "@/lib/utils"

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
  
  // 检查并结算前一天
  await checkAndSettlePreviousDay()
  
  const [tasks, relapseTracker, templates, historyScores, statistics] = await Promise.all([
    getTodayTasks(),
    getRelapseTracker(),
    getTaskTemplates(),
    getHistoryScores(currentYear),
    getStatistics(),
  ])

  return (
    <Dashboard 
      tasks={tasks} 
      relapseTracker={relapseTracker} 
      templates={templates}
      historyScores={historyScores}
      statistics={statistics}
      todayStr={todayStr}
      currentYear={currentYear}
    />
  )
}
