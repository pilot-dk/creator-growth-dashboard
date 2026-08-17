import { secureStore } from '../store/secureStore'
import { dataStore } from '../store/dataStore'
import { runGoogleOAuth, refreshGoogleToken } from '../oauth/google'
import type {
  ConnectionStatus,
  DayScore,
  RetentionPoint,
  YouTubeRetentionResult,
  YouTubeTotals,
  YouTubeVideoSummary
} from '../../shared/types'

const DATA_API = 'https://www.googleapis.com/youtube/v3'
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2'

async function ensureFreshToken(): Promise<string> {
  const secrets = secureStore.get('youtube')
  if (!secrets?.accessToken) throw new Error('YouTube is not connected.')
  const soonToExpire = !secrets.expiresAt || secrets.expiresAt < Date.now() + 60_000
  if (soonToExpire) {
    if (!secrets.refreshToken) throw new Error('YouTube session expired. Please reconnect.')
    const tokens = await refreshGoogleToken(secrets.clientId, secrets.clientSecret, secrets.refreshToken)
    secureStore.update('youtube', {
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt
    })
    return tokens.accessToken
  }
  return secrets.accessToken
}

async function apiFetch<T>(url: string): Promise<T> {
  const token = await ensureFreshToken()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube API error ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

export async function connectYouTube(clientId: string, clientSecret: string): Promise<ConnectionStatus> {
  const tokens = await runGoogleOAuth(clientId, clientSecret)
  secureStore.set('youtube', {
    clientId,
    clientSecret,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  const me = await apiFetch<{
    items: Array<{ id: string; snippet: { title: string; thumbnails?: { default?: { url: string } } } }>
  }>(`${DATA_API}/channels?part=snippet&mine=true`)

  const channel = me.items?.[0]
  if (!channel) throw new Error('Could not find a YouTube channel for this Google account.')

  dataStore.setYouTubeChannelId(channel.id)
  secureStore.update('youtube', {
    accountId: channel.id,
    accountName: channel.snippet.title,
    avatarUrl: channel.snippet.thumbnails?.default?.url
  })

  return getYouTubeStatus()
}

export function getYouTubeStatus(): ConnectionStatus {
  const secrets = secureStore.get('youtube')
  if (!secrets?.accessToken) return { connected: false }
  return {
    connected: true,
    accountId: secrets.accountId,
    accountName: secrets.accountName,
    avatarUrl: secrets.avatarUrl,
    lastSyncedAt: dataStore.getLastSynced('youtube') ?? null
  }
}

export function disconnectYouTube(): void {
  secureStore.clear('youtube')
}

export async function getYouTubeTotals(): Promise<YouTubeTotals> {
  const res = await apiFetch<{
    items: Array<{ snippet: { title: string }; statistics: { subscriberCount: string; viewCount: string; videoCount: string } }>
  }>(`${DATA_API}/channels?part=snippet,statistics&mine=true`)
  const item = res.items?.[0]
  if (!item) throw new Error('No YouTube channel found.')
  return {
    subscribers: Number(item.statistics.subscriberCount),
    totalViews: Number(item.statistics.viewCount),
    videoCount: Number(item.statistics.videoCount),
    channelTitle: item.snippet.title
  }
}

export async function listRecentYouTubeVideos(maxResults = 15): Promise<YouTubeVideoSummary[]> {
  const channelRes = await apiFetch<{
    items: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>
  }>(`${DATA_API}/channels?part=contentDetails&mine=true`)
  const uploadsPlaylistId = channelRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) return []

  const playlistRes = await apiFetch<{
    items: Array<{ contentDetails: { videoId: string; videoPublishedAt: string } }>
  }>(`${DATA_API}/playlistItems?part=contentDetails&maxResults=${maxResults}&playlistId=${uploadsPlaylistId}`)

  const videoIds = playlistRes.items.map((i) => i.contentDetails.videoId).filter(Boolean)
  if (videoIds.length === 0) return []

  const videosRes = await apiFetch<{
    items: Array<{
      id: string
      snippet: { title: string; publishedAt: string; thumbnails?: { medium?: { url: string } } }
      statistics: { viewCount?: string }
      contentDetails: { duration: string }
    }>
  }>(`${DATA_API}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}`)

  return videosRes.items
    .map((v) => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumbnailUrl: v.snippet.thumbnails?.medium?.url,
      views: Number(v.statistics.viewCount ?? 0)
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

interface AnalyticsReport {
  columnHeaders: Array<{ name: string }>
  rows?: (string | number)[][]
}

async function fetchAnalyticsReport(query: Record<string, string>): Promise<AnalyticsReport> {
  const channelId = dataStore.all.youtubeChannelId
  if (!channelId) throw new Error('YouTube channel not linked yet — try reconnecting.')
  const params = new URLSearchParams({ ids: `channel==${channelId}`, ...query })
  return apiFetch<AnalyticsReport>(`${ANALYTICS_API}/reports?${params.toString()}`)
}

/** Real per-video audience retention, straight from the YouTube Analytics API. */
export async function getYouTubeRetention(video: YouTubeVideoSummary): Promise<YouTubeRetentionResult> {
  const cached = dataStore.getCachedYouTubeRetention(video.id)
  if (cached) return cached

  const publishedDate = video.publishedAt.slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const report = await fetchAnalyticsReport({
    startDate: publishedDate,
    endDate: today,
    metrics: 'audienceWatchRatio,relativeRetentionPerformance',
    dimensions: 'elapsedVideoTimeRatio',
    filters: `video==${video.id}`
  })

  const idx = {
    elapsed: report.columnHeaders.findIndex((h) => h.name === 'elapsedVideoTimeRatio'),
    watch: report.columnHeaders.findIndex((h) => h.name === 'audienceWatchRatio'),
    relative: report.columnHeaders.findIndex((h) => h.name === 'relativeRetentionPerformance')
  }

  const points: RetentionPoint[] = (report.rows ?? [])
    .map((row) => ({
      elapsedVideoTimeRatio: Number(row[idx.elapsed]),
      audienceWatchRatio: Number(row[idx.watch]),
      relativeRetentionPerformance: idx.relative >= 0 && row[idx.relative] != null ? Number(row[idx.relative]) : null
    }))
    .sort((a, b) => a.elapsedVideoTimeRatio - b.elapsedVideoTimeRatio)

  let dropOffElapsedRatio: number | null = null
  let dropOffMagnitude: number | null = null
  for (let i = 1; i < points.length; i++) {
    const delta = points[i - 1].audienceWatchRatio - points[i].audienceWatchRatio
    if (dropOffMagnitude === null || delta > dropOffMagnitude) {
      dropOffMagnitude = delta
      dropOffElapsedRatio = points[i].elapsedVideoTimeRatio
    }
  }

  const result: YouTubeRetentionResult = { video, points, dropOffElapsedRatio, dropOffMagnitude }
  dataStore.cacheYouTubeRetention(video.id, result)
  return result
}

/**
 * Best day-of-week to publish, based on trailing-90-day views by day.
 * YouTube's Analytics API has no hour-of-day dimension for channel reports,
 * so we only surface day-of-week here (see BestTimes page for why Twitch
 * gets full day×hour granularity and YouTube doesn't).
 */
export async function getYouTubeDayScores(): Promise<DayScore[]> {
  const end = new Date()
  const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000)
  const report = await fetchAnalyticsReport({
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    metrics: 'views',
    dimensions: 'day'
  })

  const dayIdx = report.columnHeaders.findIndex((h) => h.name === 'day')
  const viewsIdx = report.columnHeaders.findIndex((h) => h.name === 'views')

  const totals = new Array(7).fill(0) as number[]
  const counts = new Array(7).fill(0) as number[]
  for (const row of report.rows ?? []) {
    const date = new Date(String(row[dayIdx]))
    const dow = date.getUTCDay()
    totals[dow] += Number(row[viewsIdx])
    counts[dow] += 1
  }

  const max = Math.max(...totals, 1)
  return totals.map((total, dayOfWeek) => ({
    dayOfWeek,
    score: total / max,
    sampleCount: counts[dayOfWeek]
  }))
}
