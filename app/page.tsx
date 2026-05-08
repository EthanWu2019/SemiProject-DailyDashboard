import { Dashboard } from "@/components/dashboard"
import { getTodayTasks, getRelapseTracker } from "@/lib/actions"

export default async function Home() {
  const [tasks, relapseTracker] = await Promise.all([
    getTodayTasks(),
    getRelapseTracker(),
  ])

  return <Dashboard tasks={tasks} relapseTracker={relapseTracker} />
}
