import { secureStore } from '../store/secureStore'
import { dataStore } from '../store/dataStore'
import { getYouTubeStatus, getYouTubeTotals } from './youtube'
import { getTwitchStatus, getTwitchTotals } from './twitch'
import type { DashboardSnapshot, SyncResult } from '../../shared/types'

export async function getDashboard(): Promise<DashboardSnapshot> {
  const youtube = getYouTubeStatus()
  const twitch = getTwitchStatus()

  const [youtubeTotals, twitchTotals] = await Promise.all([
    youtube.connected ? getYouTubeTotals().catch(() => null) : Promise.resolve(null),
    twitch.connected
      ? getTwitchTotals(secureStore.get('twitch')!.accountId!, twitch.accountName ?? '').catch(() => null)
      : Promise.resolve(null)
  ])

  return {
    youtube,
    twitch,
    growth: dataStore.growth,
    youtubeTotals,
    twitchTotals
  }
}

export async function syncNow(platform?: 'youtube' | 'twitch'): Promise<SyncResult[]> {
  const results: SyncResult[] = []
  const targets: Array<'youtube' | 'twitch'> = platform ? [platform] : ['youtube', 'twitch']

  for (const p of targets) {
    const syncedAt = new Date().toISOString()
    try {
      if (p === 'youtube') {
        const secrets = secureStore.get('youtube')
        if (!secrets?.accessToken) {
          results.push({ platform: p, ok: false, message: 'Not connected', syncedAt })
          continue
        }
        const totals = await getYouTubeTotals()
        dataStore.addGrowthPoint({ date: syncedAt.slice(0, 10), youtubeSubscribers: totals.subscribers })
      } else {
        const secrets = secureStore.get('twitch')
        if (!secrets?.accountId) {
          results.push({ platform: p, ok: false, message: 'Not connected', syncedAt })
          continue
        }
        const totals = await getTwitchTotals(secrets.accountId, secrets.accountName ?? '')
        dataStore.addGrowthPoint({ date: syncedAt.slice(0, 10), twitchFollowers: totals.followers })
      }
      dataStore.setLastSynced(p, syncedAt)
      results.push({ platform: p, ok: true, syncedAt })
    } catch (err) {
      results.push({ platform: p, ok: false, message: (err as Error).message, syncedAt })
    }
  }

  return results
}
