import { secureStore } from '../store/secureStore'
import { dataStore } from '../store/dataStore'
import { runTwitchOAuth, refreshTwitchToken } from '../oauth/twitch'
import type { ConnectionStatus, DayScore, TwitchTotals } from '../../shared/types'

const HELIX = 'https://api.twitch.tv/helix'

async function ensureFreshToken(): Promise<{ token: string; clientId: string }> {
  const secrets = secureStore.get('twitch')
  if (!secrets?.accessToken) throw new Error('Twitch is not connected.')
  const soonToExpire = !secrets.expiresAt || secrets.expiresAt < Date.now() + 60_000
  if (soonToExpire) {
    if (!secrets.refreshToken) throw new Error('Twitch session expired. Please reconnect.')
    const tokens = await refreshTwitchToken(secrets.clientId, secrets.clientSecret, secrets.refreshToken)
    secureStore.update('twitch', {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt
    })
    return { token: tokens.accessToken, clientId: secrets.clientId }
  }
  return { token: secrets.accessToken, clientId: secrets.clientId }
}

async function apiFetch<T>(path: string): Promise<{ status: number; json: T | null }> {
  const { token, clientId } = await ensureFreshToken()
  const res = await fetch(`${HELIX}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId }
  })
  if (res.status === 204) return { status: res.status, json: null }
  const json = (await res.json().catch(() => null)) as T | null
  if (!res.ok) {
    return { status: res.status, json }
  }
  return { status: res.status, json }
}

export async function connectTwitch(clientId: string, clientSecret: string): Promise<ConnectionStatus> {
  const tokens = await runTwitchOAuth(clientId, clientSecret)
  secureStore.set('twitch', {
    clientId,
    clientSecret,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt
  })

  const { json } = await apiFetch<{
    data: Array<{ id: string; login: string; display_name: string; profile_image_url: string }>
  }>('/users')
  const user = json?.data?.[0]
  if (!user) throw new Error('Could not fetch the Twitch account for these credentials.')

  secureStore.update('twitch', {
    accountId: user.id,
    accountName: user.display_name,
    avatarUrl: user.profile_image_url
  })

  return getTwitchStatus()
}

export function getTwitchStatus(): ConnectionStatus {
  const secrets = secureStore.get('twitch')
  if (!secrets?.accessToken) return { connected: false }
  return {
    connected: true,
    accountId: secrets.accountId,
    accountName: secrets.accountName,
    avatarUrl: secrets.avatarUrl,
    lastSyncedAt: dataStore.getLastSynced('twitch') ?? null
  }
}

export function disconnectTwitch(): void {
  secureStore.clear('twitch')
}

export async function getFollowerCount(broadcasterId: string): Promise<number | null> {
  const { json } = await apiFetch<{ total: number }>(`/channels/followers?broadcaster_id=${broadcasterId}&first=1`)
  return json?.total ?? null
}

/** Requires Affiliate/Partner status; returns null (not an error) if unavailable. */
export async function getSubscriberCount(broadcasterId: string): Promise<number | null> {
  const { status, json } = await apiFetch<{ total?: number }>(
    `/subscriptions?broadcaster_id=${broadcasterId}&first=1`
  )
  if (status === 403) return null
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
  const [followers, subscribers, stream] = await Promise.all([
    getFollowerCount(broadcasterId),
    getSubscriberCount(broadcasterId),
    getCurrentStream(broadcasterId)
  ])
  return {
    followers: followers ?? 0,
    subscribers,
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
    const dow = new Date(v.created_at).getUTCDay()
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
