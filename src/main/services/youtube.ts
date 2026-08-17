import { secureStore } from '../store/secureStore'
import { settingsStore } from '../store/settingsStore'
import { dataStore } from '../store/dataStore'
import { getYouTubeApiKey, getGoogleOAuthCredentials } from '../config/credentials'
import { runGoogleOAuth, refreshGoogleToken } from '../oauth/google'
import { parseYouTubeUrl } from '../../shared/channelUrl'
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

/**
 * YouTube is read in two modes:
 *
 *  - **Public (API key)** — subscriber counts, uploads, view counts. Needs
 *    nothing from the user but their channel URL. This powers the dashboard.
 *  - **Owner (OAuth)** — per-video audience retention. Optional, and the only
 *    reason the app ever asks anyone to sign in, since retention is private
 *    data that only the channel owner can read.
 */

async function publicFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = getYouTubeApiKey()
  if (!key) throw new Error('YouTube API key is not configured in this build.')
  const query = new URLSearchParams({ ...params, key })
  const res = await fetch(`${DATA_API}${path}?${query.toString()}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube API error ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

interface ChannelResource {
  id: string
  snippet: { title: string; thumbnails?: { default?: { url: string }; medium?: { url: string } } }
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string }
  contentDetails?: { relatedPlaylists: { uploads: string } }
}

/** Resolves a pasted YouTube URL/handle to a channel and saves it. */
export async function setYouTubeChannel(url: string): Promise<ConnectionStatus> {
  const ref = parseYouTubeUrl(url)
  if (!ref) {
    throw new Error(
      "That doesn't look like a YouTube channel URL. Try something like youtube.com/@yourhandle"
    )
  }

  const params: Record<string, string> = { part: 'snippet' }
  if (ref.kind === 'handle') params.forHandle = ref.value
  else if (ref.kind === 'channelId') params.id = ref.value
  else params.forUsername = ref.value

  const res = await publicFetch<{ items?: ChannelResource[] }>('/channels', params)
  const channel = res.items?.[0]
  if (!channel) throw new Error(`No YouTube channel found for "${url.trim()}".`)

  settingsStore.patch({
    youtubeUrl: url.trim(),
    youtubeChannelId: channel.id,
    youtubeTitle: channel.snippet.title,
    youtubeThumbnail: channel.snippet.thumbnails?.default?.url
  })
  dataStore.setYouTubeChannelId(channel.id)

  return getYouTubeStatus()
}

export function getYouTubeStatus(): ConnectionStatus {
  const s = settingsStore.all
  if (!s.youtubeChannelId) return { connected: false }
  return {
    connected: true,
    accountId: s.youtubeChannelId,
    accountName: s.youtubeTitle,
    avatarUrl: s.youtubeThumbnail,
    lastSyncedAt: dataStore.getLastSynced('youtube') ?? null
  }
}

export function clearYouTubeChannel(): void {
  settingsStore.clearYouTube()
}

export async function getYouTubeTotals(): Promise<YouTubeTotals> {
  const channelId = settingsStore.all.youtubeChannelId
  if (!channelId) throw new Error('No YouTube channel set.')
  const res = await publicFetch<{ items?: ChannelResource[] }>('/channels', {
    part: 'snippet,statistics',
    id: channelId
  })
  const item = res.items?.[0]
  if (!item) throw new Error('YouTube channel could not be loaded.')
  return {
    subscribers: Number(item.statistics?.subscriberCount ?? 0),
    totalViews: Number(item.statistics?.viewCount ?? 0),
    videoCount: Number(item.statistics?.videoCount ?? 0),
    channelTitle: item.snippet.title
  }
}

export async function listRecentYouTubeVideos(maxResults = 15): Promise<YouTubeVideoSummary[]> {
  const channelId = settingsStore.all.youtubeChannelId
  if (!channelId) return []

  const channelRes = await publicFetch<{ items?: ChannelResource[] }>('/channels', {
    part: 'contentDetails',
    id: channelId
  })
  const uploadsPlaylistId = channelRes.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
  if (!uploadsPlaylistId) return []

  const playlistRes = await publicFetch<{
    items: Array<{ contentDetails: { videoId: string } }>
  }>('/playlistItems', {
    part: 'contentDetails',
    maxResults: String(maxResults),
    playlistId: uploadsPlaylistId
  })

  const videoIds = playlistRes.items.map((i) => i.contentDetails.videoId).filter(Boolean)
  if (videoIds.length === 0) return []

  const videosRes = await publicFetch<{
    items: Array<{
      id: string
      snippet: { title: string; publishedAt: string; thumbnails?: { medium?: { url: string } } }
      statistics: { viewCount?: string }
    }>
  }>('/videos', { part: 'snippet,statistics', id: videoIds.join(',') })

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

/**
 * Best day-of-week to publish. With an owner OAuth session we use real
 * trailing-90-day watch history; otherwise we approximate from public view
 * counts grouped by the day each video went out.
 */
export async function getYouTubeDayScores(): Promise<DayScore[]> {
  if (isYouTubeAccountConnected()) {
    try {
      return await getDayScoresFromAnalytics()
    } catch (err) {
      console.error('[youtube] analytics day scores failed, falling back to public data', err)
    }
  }

  const videos = await listRecentYouTubeVideos(50)
  const totals = new Array(7).fill(0) as number[]
  const counts = new Array(7).fill(0) as number[]
  for (const v of videos) {
    const dow = new Date(v.publishedAt).getDay()
    totals[dow] += v.views
    counts[dow] += 1
  }
  // Average views per upload, so a day with many uploads isn't inflated.
  const averages = totals.map((total, i) => (counts[i] > 0 ? total / counts[i] : 0))
  const max = Math.max(...averages, 1)
  return averages.map((avg, dayOfWeek) => ({
    dayOfWeek,
    score: avg / max,
    sampleCount: counts[dayOfWeek]
  }))
}

// ---------------------------------------------------------------------------
// Optional owner-authenticated features (audience retention)
// ---------------------------------------------------------------------------

export function isYouTubeAccountConnected(): boolean {
  return secureStore.get('youtube')?.accessToken != null
}

export function getYouTubeAccountStatus(): ConnectionStatus {
  const secrets = secureStore.get('youtube')
  if (!secrets?.accessToken) return { connected: false }
  return {
    connected: true,
    accountId: secrets.accountId,
    accountName: secrets.accountName,
    avatarUrl: secrets.avatarUrl
  }
}

export async function connectYouTubeAccount(): Promise<ConnectionStatus> {
  const creds = getGoogleOAuthCredentials()
  if (!creds) {
    throw new Error(
      'YouTube sign-in is not configured in this build, so retention curves are unavailable.'
    )
  }

  const tokens = await runGoogleOAuth(creds.clientId, creds.clientSecret)
  secureStore.set('youtube', {
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  const me = await ownerFetch<{ items?: ChannelResource[] }>(
    `${DATA_API}/channels?part=snippet&mine=true`
  )
  const channel = me.items?.[0]
  if (channel) {
    secureStore.update('youtube', {
      accountId: channel.id,
      accountName: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url
    })
    // If no channel was set manually yet, adopt the signed-in one.
    if (!settingsStore.all.youtubeChannelId) {
      settingsStore.patch({
        youtubeChannelId: channel.id,
        youtubeTitle: channel.snippet.title,
        youtubeThumbnail: channel.snippet.thumbnails?.default?.url
      })
      dataStore.setYouTubeChannelId(channel.id)
    }
  }

  return getYouTubeAccountStatus()
}

export function disconnectYouTubeAccount(): void {
  secureStore.clear('youtube')
}

async function ensureFreshToken(): Promise<string> {
  const secrets = secureStore.get('youtube')
  if (!secrets?.accessToken) throw new Error('YouTube account is not connected.')
  const soonToExpire = !secrets.expiresAt || secrets.expiresAt < Date.now() + 60_000
  if (soonToExpire) {
    if (!secrets.refreshToken) throw new Error('YouTube session expired. Please reconnect.')
    const tokens = await refreshGoogleToken(secrets.clientId, secrets.clientSecret, secrets.refreshToken)
    secureStore.update('youtube', { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt })
    return tokens.accessToken
  }
  return secrets.accessToken
}

async function ownerFetch<T>(url: string): Promise<T> {
  const token = await ensureFreshToken()
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`YouTube API error ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

interface AnalyticsReport {
  columnHeaders: Array<{ name: string }>
  rows?: (string | number)[][]
}

async function fetchAnalyticsReport(query: Record<string, string>): Promise<AnalyticsReport> {
  const channelId = secureStore.get('youtube')?.accountId ?? settingsStore.all.youtubeChannelId
  if (!channelId) throw new Error('YouTube channel not linked yet.')
  const params = new URLSearchParams({ ids: `channel==${channelId}`, ...query })
  return ownerFetch<AnalyticsReport>(`${ANALYTICS_API}/reports?${params.toString()}`)
}

async function getDayScoresFromAnalytics(): Promise<DayScore[]> {
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
    const dow = new Date(`${String(row[dayIdx])}T00:00:00`).getDay()
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

/** Real per-video audience retention. Requires the optional owner sign-in. */
export async function getYouTubeRetention(video: YouTubeVideoSummary): Promise<YouTubeRetentionResult> {
  const cached = dataStore.getCachedYouTubeRetention(video.id)
  if (cached) return cached

  if (!isYouTubeAccountConnected()) {
    throw new Error('Connect your YouTube account in Settings to see retention curves.')
  }

  const report = await fetchAnalyticsReport({
    startDate: video.publishedAt.slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
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
      relativeRetentionPerformance:
        idx.relative >= 0 && row[idx.relative] != null ? Number(row[idx.relative]) : null
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
