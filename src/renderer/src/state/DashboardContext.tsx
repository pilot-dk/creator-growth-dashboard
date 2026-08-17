import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DashboardSnapshot, Platform } from '@shared/types'

interface DashboardContextValue {
  dashboard: DashboardSnapshot | null
  loading: boolean
  syncing: boolean
  error: string | null
  refresh: () => Promise<void>
  syncNow: (platform?: Platform) => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }): JSX.Element {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await window.api.getDashboard()
      setDashboard(data)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const syncNow = useCallback(
    async (platform?: Platform) => {
      setSyncing(true)
      try {
        await window.api.sync(platform)
        await refresh()
      } finally {
        setSyncing(false)
      }
    },
    [refresh]
  )

  return (
    <DashboardContext.Provider value={{ dashboard, loading, syncing, error, refresh, syncNow }}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
