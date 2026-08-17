import { settingsStore } from '../store/settingsStore'
import { dataStore } from '../store/dataStore'
import { getTwitchAppCredentials, getYouTubeApiKey } from '../config/credentials'
import { getTwitchGameStats } from './twitchInsights'
import { listRecentYouTubeVideos } from './youtube'
import { computeBestTimes } from './bestTimes'
import type { CategoryOpportunity, Insight, SuggestionsResult, VideoIdea } from '../../shared/types'

const HELIX = 'https://api.twitch.tv/helix'
const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? 'am' : 'pm'}`
}

// ---------------------------------------------------------------------------
// Insights derived from the user's own history
// ---------------------------------------------------------------------------

/**
 * Every insight below is computed from data the app actually holds — the
 * user's own sessions, uploads and timing history. Nothing here is a generic
 * content tip; if there isn't enough data to support a claim, no insight is
 * emitted rather than guessing.
 */
export async function getInsights(): Promise<SuggestionsResult> {
  const insights: Insight[] = []
  const notes: string[] = []
  const settings = settingsStore.all

  // --- Twitch: retention by game -----------------------------------------
  const gameStats = getTwitchGameStats().filter((g) => g.avgRetentionRatio != null && g.sessionCount >= 2)

  if (gameStats.length >= 2) {
    const ranked = [...gameStats].sort((a, b) => (b.avgRetentionRatio ?? 0) - (a.avgRetentionRatio ?? 0))
    const best = ranked[0]
    const worst = ranked[ranked.length - 1]
    const overall = ranked.reduce((a, g) => a + (g.avgRetentionRatio ?? 0), 0) / ranked.length

    if ((best.avgRetentionRatio ?? 0) > overall * 1.15) {
      insights.push({
        id: 'twitch-best-game',
        platform: 'twitch',
        severity: 'good',
        title: `${best.gameName} holds your audience best`,
        detail: `It keeps ${Math.round((best.avgRetentionRatio ?? 0) * 100)}% of peak viewers by stream's end, against a ${Math.round(overall * 100)}% average across your games. Worth a bigger share of your schedule.`,
        basis: `${best.sessionCount} recorded sessions`
      })
    }

    if ((worst.avgRetentionRatio ?? 1) < overall * 0.85 && worst.gameId !== best.gameId) {
      insights.push({
        id: 'twitch-worst-game',
        platform: 'twitch',
        severity: 'warning',
        title: `Viewers leave fastest during ${worst.gameName}`,
        detail: `Only ${Math.round((worst.avgRetentionRatio ?? 0) * 100)}% of peak viewers are still there at the end. Try it in shorter blocks, or place it early rather than closing on it.`,
        basis: `${worst.sessionCount} recorded sessions`
      })
    }
  } else if (settings.twitchUserId) {
    notes.push(
      'Retention-by-game suggestions need at least two games with two or more recorded sessions each. Stream with the app open and these will appear.'
    )
  }

  // --- Twitch: peak viewing window vs. actual schedule --------------------
  const bestTimes = await computeBestTimes().catch(() => null)
  const hourCells = bestTimes?.twitchByDayHour ?? []
  if (hourCells.length >= 6) {
    const top = [...hourCells].sort((a, b) => b.score - a.score)[0]
    insights.push({
      id: 'twitch-peak-window',
      platform: 'twitch',
      severity: 'opportunity',
      title: `${DAY_LABELS[top.dayOfWeek]} around ${formatHour(top.hour)} is your strongest window`,
      detail: `That hour averages the highest viewer count of any slot you've streamed. If your schedule doesn't already cover it, that's the cheapest growth available.`,
      basis: `${top.sampleCount} viewer samples in that slot`
    })
  }

  // --- Twitch: follower gain per session ----------------------------------
  const withFollowers = dataStore.twitchSessions.filter((s) => s.followersGained != null)
  if (withFollowers.length >= 3) {
    const ranked = [...withFollowers].sort((a, b) => (b.followersGained ?? 0) - (a.followersGained ?? 0))
    const top = ranked[0]
    if ((top.followersGained ?? 0) > 0) {
      insights.push({
        id: 'twitch-follower-session',
        platform: 'twitch',
        severity: 'good',
        title: `Your best converting stream was ${top.gameName}`,
        detail: `It gained ${top.followersGained} followers — more than any other recorded session. Peak that day was ${top.peakViewers} viewers.`,
        basis: `${withFollowers.length} sessions with follower tracking`
      })
    }
  }

  // --- YouTube: upload cadence -------------------------------------------
  if (settings.youtubeChannelId) {
    const videos = await listRecentYouTubeVideos(20).catch(() => [])
    if (videos.length >= 2) {
      const newest = new Date(videos[0].publishedAt)
      const daysSince = Math.floor((Date.now() - newest.getTime()) / 86_400_000)

      const gaps: number[] = []
      for (let i = 1; i < Math.min(videos.length, 10); i++) {
        const a = new Date(videos[i - 1].publishedAt).getTime()
        const b = new Date(videos[i].publishedAt).getTime()
        gaps.push(Math.round((a - b) / 86_400_000))
      }
      const medianGap = gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0

      if (medianGap > 0 && daysSince > medianGap * 2) {
        insights.push({
          id: 'youtube-cadence',
          platform: 'youtube',
          severity: 'warning',
          title: `It's been ${daysSince} days since your last upload`,
          detail: `Your typical gap is about ${medianGap} days. You're currently at more than double that.`,
          basis: `last ${gaps.length + 1} uploads`
        })
      }

      // Which topics actually performed, by that channel's own standards
      const sorted = [...videos].sort((a, b) => b.views - a.views)
      const median = sorted[Math.floor(sorted.length / 2)].views
      const outperformers = sorted.filter((v) => v.views > median * 2)
      if (outperformers.length > 0 && median > 0) {
        insights.push({
          id: 'youtube-outperformers',
          platform: 'youtube',
          severity: 'opportunity',
          title: `${outperformers.length} recent video${outperformers.length > 1 ? 's' : ''} more than doubled your median views`,
          detail: `Top performer: "${outperformers[0].title}" at ${outperformers[0].views.toLocaleString()} views vs a ${median.toLocaleString()} median. Look at what these share — format, topic, thumbnail — and make more like them.`,
          basis: `${videos.length} recent uploads`
        })
      }

      // Best publishing day, from the channel's own numbers
      const byDay = new Map<number, { views: number; count: number }>()
      for (const v of videos) {
        const d = new Date(v.publishedAt).getDay()
        const cur = byDay.get(d) ?? { views: 0, count: 0 }
        cur.views += v.views
        cur.count += 1
        byDay.set(d, cur)
      }
      const dayAverages = [...byDay.entries()]
        .filter(([, s]) => s.count >= 2)
        .map(([day, s]) => ({ day, avg: s.views / s.count, count: s.count }))
        .sort((a, b) => b.avg - a.avg)

      if (dayAverages.length >= 2) {
        const best = dayAverages[0]
        const rest = dayAverages.slice(1)
        const restAvg = rest.reduce((a, d) => a + d.avg, 0) / rest.length
        if (best.avg > restAvg * 1.25) {
          insights.push({
            id: 'youtube-best-day',
            platform: 'youtube',
            severity: 'opportunity',
            title: `${DAY_LABELS[best.day]} uploads outperform your other days`,
            detail: `They average ${Math.round(best.avg).toLocaleString()} views versus ${Math.round(restAvg).toLocaleString()} elsewhere — about ${(best.avg / restAvg).toFixed(1)}× better.`,
            basis: `${best.count} uploads on that day`
          })
        }
      }
    }
  }

  // --- Cross-platform ------------------------------------------------------
  if (settings.youtubeChannelId && settings.twitchUserId) {
    const twitchSessions = dataStore.twitchSessions.length
    const ytVideos = await listRecentYouTubeVideos(5).catch(() => [])
    if (twitchSessions >= 3 && ytVideos.length > 0) {
      const lastUpload = new Date(ytVideos[0].publishedAt).getTime()
      const recentStreams = dataStore.twitchSessions.filter(
        (s) => new Date(s.startedAt).getTime() > lastUpload
      ).length
      if (recentStreams >= 3) {
        insights.push({
          id: 'cross-repurpose',
          platform: 'both',
          severity: 'opportunity',
          title: `${recentStreams} streams since your last YouTube upload`,
          detail: `Your best-retaining stream segments are the obvious source material for YouTube. Check Twitch Insights for which sessions held viewers longest and cut those first.`,
          basis: 'stream and upload timestamps'
        })
      }
    }
  }

  if (insights.length === 0) {
    notes.push(
      "No suggestions yet — they're all computed from your own history, so they appear as the app records streams and uploads."
    )
  }

  return { insights, notes }
}

// ---------------------------------------------------------------------------
// Twitch category opportunities (live API data)
// ---------------------------------------------------------------------------

let appToken: { token: string; expiresAt: number } | null = null

async function twitchToken(): Promise<{ token: string; clientId: string }> {
  const creds = getTwitchAppCredentials()
  if (!creds) throw new Error('Twitch API keys are not configured.')
  if (appToken && appToken.expiresAt > Date.now() + 60_000) {
    return { token: appToken.token, clientId: creds.clientId }
  }
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'client_credentials'
    })
  })
  if (!res.ok) throw new Error(`Twitch auth failed: ${res.status}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  appToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return { token: json.access_token, clientId: creds.clientId }
}

async function helix<T>(path: string): Promise<T | null> {
  const { token, clientId } = await twitchToken()
  const res = await fetch(`${HELIX}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId }
  })
  if (!res.ok) return null
  return (await res.json()) as T
}

/**
 * Samples the live top-100 streams in each of the current top categories to
 * show how crowded each one is. This is a snapshot of what's live right now,
 * not a forecast — the UI says so explicitly.
 */
export async function getCategoryOpportunities(limit = 12): Promise<CategoryOpportunity[]> {
  const top = await helix<{ data: Array<{ id: string; name: string; box_art_url: string }> }>(
    `/games/top?first=${limit}`
  )
  if (!top?.data) return []

  const playedGameIds = new Set(dataStore.twitchSessions.map((s) => s.gameId))

  const results = await Promise.all(
    top.data.map(async (game) => {
      const streams = await helix<{ data: Array<{ viewer_count: number }> }>(
        `/streams?game_id=${game.id}&first=100`
      )
      const list = streams?.data ?? []
      const totalViewers = list.reduce((a, s) => a + s.viewer_count, 0)
      const channelCount = list.length
      const small = list.filter((s) => s.viewer_count < 50).length
      return {
        gameId: game.id,
        gameName: game.name,
        boxArtUrl: game.box_art_url.replace('{width}x{height}', '96x128'),
        totalViewers,
        channelCount,
        viewersPerChannel: channelCount > 0 ? totalViewers / channelCount : 0,
        smallStreamerShare: channelCount > 0 ? small / channelCount : 0,
        streamedBefore: playedGameIds.has(game.id)
      } satisfies CategoryOpportunity
    })
  )

  return results.sort((a, b) => b.smallStreamerShare - a.smallStreamerShare)
}

// ---------------------------------------------------------------------------
// YouTube topic research (live API data)
// ---------------------------------------------------------------------------

/**
 * Recent high-view videos for a topic, so ideas are checked against what is
 * actually performing rather than invented. Uses the search endpoint, which
 * costs 100 quota units per call against a 10,000/day default — hence the
 * manual trigger rather than running automatically.
 */
export async function researchTopic(query: string): Promise<VideoIdea[]> {
  const key = getYouTubeApiKey()
  if (!key) throw new Error('YouTube API key is not configured.')
  const trimmed = query.trim()
  if (!trimmed) return []

  const publishedAfter = new Date(Date.now() - 90 * 86_400_000).toISOString()
  const searchParams = new URLSearchParams({
    part: 'snippet',
    q: trimmed,
    type: 'video',
    order: 'viewCount',
    publishedAfter,
    maxResults: '12',
    key
  })

  const search = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`)
  if (!search.ok) {
    const text = await search.text()
    throw new Error(`YouTube search failed (${search.status}): ${text.slice(0, 200)}`)
  }
  const searchJson = (await search.json()) as {
    items: Array<{
      id: { videoId: string }
      snippet: {
        title: string
        channelTitle: string
        publishedAt: string
        thumbnails?: { medium?: { url: string } }
      }
    }>
  }

  const ids = searchJson.items.map((i) => i.id.videoId).filter(Boolean)
  if (ids.length === 0) return []

  const statsParams = new URLSearchParams({ part: 'statistics', id: ids.join(','), key })
  const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams}`)
  const statsJson = statsRes.ok
    ? ((await statsRes.json()) as { items: Array<{ id: string; statistics: { viewCount?: string } }> })
    : { items: [] }
  const viewsById = new Map(statsJson.items.map((i) => [i.id, Number(i.statistics.viewCount ?? 0)]))

  return searchJson.items
    .map((i) => ({
      videoId: i.id.videoId,
      title: i.snippet.title,
      channelTitle: i.snippet.channelTitle,
      publishedAt: i.snippet.publishedAt,
      thumbnailUrl: i.snippet.thumbnails?.medium?.url,
      views: viewsById.get(i.id.videoId) ?? 0
    }))
    .sort((a, b) => b.views - a.views)
}
