import { settingsStore } from '../store/settingsStore'
import { dataStore } from '../store/dataStore'
import { getYouTubeStatus, getYouTubeTotals } from './youtube'
import { getTwitchStatus, getTwitchTotals } from './twitch'
import type { DashboardSnapshot, SyncResult } from '../../shared/types'

export async function getDashboard(): Promise<DashboardSnapshot> {
  const youtube = getYouTubeStatus()
  const twitch = getTwitchStatus()
  const settings = settingsStore.all

  const [youtubeTotals, twitchTotals] = await Promise.all([
    settings.youtubeChannelId ? getYouTubeTotals().catch(() => null) : Promise.resolve(null),
    settings.twitchUserId
      ? getTwitchTotals(settings.twitchUserId, settings.twitchDisplayName ?? '').catch(() => null)
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
  const settings = settingsStore.all

  for (const p of targets) {
    const syncedAt = new Date().toISOString()
    try {
      if (p === 'youtube') {
        if (!settings.youtubeChannelId) {
          results.push({ platform: p, ok: false, message: 'No channel set', syncedAt })
          continue
        }
        const totals = await getYouTubeTotals()
        dataStore.addGrowthPoint({ date: syncedAt.slice(0, 10), youtubeSubscribers: totals.subscribers })
      } else {
        if (!settings.twitchUserId) {
          results.push({ platform: p, ok: false, message: 'No channel set', syncedAt })
          continue
        }
        const totals = await getTwitchTotals(settings.twitchUserId, settings.twitchDisplayName ?? '')
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
