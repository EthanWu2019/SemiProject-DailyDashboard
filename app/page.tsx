import { Dashboard } from "@/components/dashboard"
import { getTodayTasks, getRelapseTracker, getTaskTemplates, getHistoryScores } from "@/lib/actions"

export default async function Home() {
  const currentYear = new Date().getFullYear()
  
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
    />
  )
}
