import { settingsStore } from '../store/settingsStore'
import { dataStore } from '../store/dataStore'
import { getYouTubeDayScores, isYouTubeAccountConnected } from './youtube'
import { getTwitchDayScores } from './twitch'
import type { BestTimesResult, DayHourCell, DayScore } from '../../shared/types'

const MIN_POLLED_SESSIONS_FOR_HOUR_GRID = 3

function dayHourFromPolledSessions(): { cells: DayHourCell[]; sessionCount: number } {
  const polled = dataStore.twitchSessions.filter((s) => s.source === 'polled' && s.samples.length > 0)
  const buckets = new Map<string, { total: number; count: number }>()

  for (const session of polled) {
    for (const sample of session.samples) {
      const d = new Date(sample.timestamp)
      const key = `${d.getDay()}:${d.getHours()}`
      const bucket = buckets.get(key) ?? { total: 0, count: 0 }
      bucket.total += sample.viewerCount
      bucket.count += 1
      buckets.set(key, bucket)
    }
  }

  const cells: DayHourCell[] = []
  let max = 1
  for (const bucket of buckets.values()) {
    const avg = bucket.total / bucket.count
    if (avg > max) max = avg
  }
  for (const [key, bucket] of buckets) {
    const [dayOfWeek, hour] = key.split(':').map(Number)
    cells.push({ dayOfWeek, hour, score: bucket.total / bucket.count / max, sampleCount: bucket.count })
  }

  return { cells, sessionCount: polled.length }
}

export async function computeBestTimes(): Promise<BestTimesResult> {
  const notes: string[] = []
  const settings = settingsStore.all

  let youtubeByDay: DayScore[] = []
  if (settings.youtubeChannelId) {
    try {
      youtubeByDay = await getYouTubeDayScores()
    } catch (err) {
      console.error('[bestTimes] youtube day scores failed', err)
    }

    notes.push(
      isYouTubeAccountConnected()
        ? 'YouTube: day-of-week uses your real trailing 90-day watch history. The Analytics API has no hour-of-day dimension for channels, so hour-level timing isn’t available for YouTube.'
        : 'YouTube: day-of-week is estimated from average views per upload, grouped by the day each video went out. Connect your YouTube account in Settings to use real watch-history data instead.'
    )
  }

  let twitchByDay: DayScore[] = []
  if (settings.twitchUserId) {
    try {
      twitchByDay = await getTwitchDayScores(settings.twitchUserId)
    } catch (err) {
      console.error('[bestTimes] twitch day scores failed', err)
    }
  }

  const { cells: twitchByDayHour, sessionCount } = dayHourFromPolledSessions()
  if (settings.twitchUserId && sessionCount < MIN_POLLED_SESSIONS_FOR_HOUR_GRID) {
    notes.push(
      `Twitch hour-of-day grid needs a few live sessions with the app running (${sessionCount}/${MIN_POLLED_SESSIONS_FOR_HOUR_GRID} so far) — Twitch’s public API doesn’t expose historical viewer counts, so this builds up only while you stream with the app open.`
    )
  }

  return { youtubeByDay, twitchByDayHour, twitchByDay, notes }
}
