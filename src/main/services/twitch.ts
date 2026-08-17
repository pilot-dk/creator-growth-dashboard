import { getTwitchAppCredentials } from '../config/credentials'
import { settingsStore } from '../store/settingsStore'
import { dataStore } from '../store/dataStore'
import { parseTwitchUrl } from '../../shared/channelUrl'
import type { ConnectionStatus, DayScore, TwitchTotals } from '../../shared/types'

const HELIX = 'https://api.twitch.tv/helix'
const TOKEN_ENDPOINT = 'https://id.twitch.tv/oauth2/token'

/**
 * Twitch access here is an *app* access token (client-credentials grant): the
 * app authenticates as itself, not as the user. That's enough for everything
 * this dashboard shows — follower totals, live status/viewer counts, and past
 * broadcasts — so there's no sign-in step, no redirect URI, and no OAuth
 * consent screen. The only thing it can't reach is subscriber counts, which
 * would require a broadcaster user token.
 */
let cachedToken: { token: string; expiresAt: number } | null = null

async function getAppToken(): Promise<{ token: string; clientId: string }> {
  const creds = getTwitchAppCredentials()
  if (!creds) throw new Error('Twitch API keys are not configured in this build.')

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return { token: cachedToken.token, clientId: creds.clientId }
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'client_credentials'
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch app authentication failed: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return { token: json.access_token, clientId: creds.clientId }
}

async function apiFetch<T>(path: string): Promise<{ status: number; json: T | null }> {
  const { token, clientId } = await getAppToken()
  const res = await fetch(`${HELIX}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId }
  })
  if (res.status === 204) return { status: res.status, json: null }
  const json = (await res.json().catch(() => null)) as T | null
  return { status: res.status, json }
}

interface TwitchUser {
  id: string
  login: string
  display_name: string
  profile_image_url: string
}

/** Resolves a pasted twitch.tv URL (or bare name) to a channel and saves it. */
export async function setTwitchChannel(url: string): Promise<ConnectionStatus> {
  const login = parseTwitchUrl(url)
  if (!login) {
    throw new Error("That doesn't look like a Twitch channel URL. Try something like twitch.tv/yourname")
  }

  const { json } = await apiFetch<{ data: TwitchUser[] }>(`/users?login=${encodeURIComponent(login)}`)
  const user = json?.data?.[0]
  if (!user) throw new Error(`No Twitch channel found for "${login}".`)

  settingsStore.patch({
    twitchUrl: url.trim(),
    twitchLogin: user.login,
    twitchUserId: user.id,
    twitchDisplayName: user.display_name,
    twitchAvatar: user.profile_image_url
  })

  return getTwitchStatus()
}

export function getTwitchStatus(): ConnectionStatus {
  const s = settingsStore.all
  if (!s.twitchUserId) return { connected: false }
  return {
    connected: true,
    accountId: s.twitchUserId,
    accountName: s.twitchDisplayName,
    avatarUrl: s.twitchAvatar,
    lastSyncedAt: dataStore.getLastSynced('twitch') ?? null
  }
}

export function clearTwitchChannel(): void {
  settingsStore.clearTwitch()
}

export async function getFollowerCount(broadcasterId: string): Promise<number | null> {
  const { json } = await apiFetch<{ total: number }>(`/channels/followers?broadcaster_id=${broadcasterId}&first=1`)
  return json?.total ?? null
}

export interface TwitchStreamStatus {
  isLive: boolean
  viewerCount?: number
  gameId?: string
  gameName?: string
  title?: string
  startedAt?: string
}

export async function getCurrentStream(broadcasterId: string): Promise<TwitchStreamStatus> {
  const { json } = await apiFetch<{
    data: Array<{
      viewer_count: number
      game_id: string
      game_name: string
      title: string
      started_at: string
    }>
  }>(`/streams?user_id=${broadcasterId}`)
  const stream = json?.data?.[0]
  if (!stream) return { isLive: false }
  return {
    isLive: true,
    viewerCount: stream.viewer_count,
    gameId: stream.game_id,
    gameName: stream.game_name || 'Just Chatting',
    title: stream.title,
    startedAt: stream.started_at
  }
}

export async function getTwitchTotals(broadcasterId: string, displayName: string): Promise<TwitchTotals> {
  const [followers, stream] = await Promise.all([
    getFollowerCount(broadcasterId),
    getCurrentStream(broadcasterId)
  ])
  return {
    followers: followers ?? 0,
    // Subscriber counts need a broadcaster user token, which this app
    // deliberately doesn't ask for — see the note at the top of this file.
    subscribers: null,
    isLive: stream.isLive,
    currentGame: stream.gameName,
    currentViewers: stream.viewerCount,
    displayName
  }
}

interface TwitchVideo {
  id: string
  title: string
  created_at: string
  duration: string
  view_count: number
}

export async function getRecentBroadcasts(broadcasterId: string, first = 20): Promise<TwitchVideo[]> {
  const { json } = await apiFetch<{ data: TwitchVideo[] }>(
    `/videos?user_id=${broadcasterId}&type=archive&first=${first}`
  )
  return json?.data ?? []
}

/**
 * Best day-of-week to go live, from past broadcast start times (view_count
 * as a rough popularity proxy). Hour-of-day granularity comes from the live
 * poller instead, once enough sessions have been recorded — see bestTimes.ts.
 */
export async function getTwitchDayScores(broadcasterId: string): Promise<DayScore[]> {
  const videos = await getRecentBroadcasts(broadcasterId, 20)
  const totals = new Array(7).fill(0) as number[]
  const counts = new Array(7).fill(0) as number[]
  for (const v of videos) {
    const dow = new Date(v.created_at).getDay()
    totals[dow] += v.view_count
    counts[dow] += 1
  }
  const max = Math.max(...totals, 1)
  return totals.map((total, dayOfWeek) => ({
    dayOfWeek,
    score: total / max,
    sampleCount: counts[dayOfWeek]
  }))
}
