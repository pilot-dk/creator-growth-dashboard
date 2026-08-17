import { secureStore } from '../store/secureStore'
import { dataStore } from '../store/dataStore'
import { getCurrentStream, getFollowerCount } from './twitch'
import { getYouTubeTotals } from './youtube'
import { POLL_INTERVAL_MS, SNAPSHOT_INTERVAL_MS } from '../../shared/constants'
import type { TwitchSessionSummary } from '../../shared/types'

function summarize(session: TwitchSessionSummary): TwitchSessionSummary {
  const counts = session.samples.map((s) => s.viewerCount)
  return {
    ...session,
    peakViewers: counts.length ? Math.max(...counts) : 0,
    avgViewers: counts.length ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length) : 0
  }
}

/**
 * Polls Twitch's live status in the background so we can build real
 * viewer-drop-off curves and per-game retention going forward (Twitch's
 * public API does not expose this for past broadcasts — see README).
 */
class LivePoller {
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private snapshotTimer: ReturnType<typeof setInterval> | null = null
  private activeSession: TwitchSessionSummary | null = null
  private overallStreamStartedAt: string | null = null
  private followersAtSessionStart: number | null = null
  private onLiveUpdate: ((session: TwitchSessionSummary) => void) | null = null

  start(onLiveUpdate: (session: TwitchSessionSummary) => void): void {
    this.onLiveUpdate = onLiveUpdate
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => void this.tick(), POLL_INTERVAL_MS)
    this.snapshotTimer = setInterval(() => void this.snapshotGrowth(), SNAPSHOT_INTERVAL_MS)
    void this.tick()
    void this.snapshotGrowth()
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.snapshotTimer) clearInterval(this.snapshotTimer)
    this.pollTimer = null
    this.snapshotTimer = null
  }

  private async tick(): Promise<void> {
    const secrets = secureStore.get('twitch')
    if (!secrets?.accountId) return

    let status
    try {
      status = await getCurrentStream(secrets.accountId)
    } catch (err) {
      console.error('[poller] failed to fetch stream status', err)
      return
    }

    if (!status.isLive) {
      if (this.activeSession) this.finalizeSession()
      this.overallStreamStartedAt = null
      return
    }

    const gameChanged = this.activeSession && this.activeSession.gameId !== status.gameId
    const newBroadcast = this.overallStreamStartedAt !== status.startedAt

    if (!this.activeSession || gameChanged || newBroadcast) {
      if (this.activeSession) this.finalizeSession()
      this.overallStreamStartedAt = status.startedAt ?? new Date().toISOString()
      this.followersAtSessionStart = await getFollowerCount(secrets.accountId).catch(() => null)
      this.activeSession = {
        id: `polled:${status.startedAt}:${status.gameId}:${Date.now()}`,
        gameId: status.gameId ?? 'unknown',
        gameName: status.gameName ?? 'Unknown',
        title: status.title ?? '',
        startedAt: new Date().toISOString(),
        endedAt: null,
        peakViewers: 0,
        avgViewers: 0,
        followersGained: null,
        isLive: true,
        samples: [],
        source: 'polled'
      }
    }

    this.activeSession.samples.push({
      timestamp: new Date().toISOString(),
      viewerCount: status.viewerCount ?? 0
    })
    this.activeSession = summarize(this.activeSession)
    dataStore.upsertTwitchSession(this.activeSession)
    this.onLiveUpdate?.(this.activeSession)
  }

  private finalizeSession(): void {
    if (!this.activeSession) return
    const secrets = secureStore.get('twitch')
    const session = summarize({ ...this.activeSession, endedAt: new Date().toISOString(), isLive: false })

    if (secrets?.accountId && this.followersAtSessionStart != null) {
      getFollowerCount(secrets.accountId)
        .then((endFollowers) => {
          if (endFollowers == null) return
          const gained = endFollowers - (this.followersAtSessionStart ?? endFollowers)
          dataStore.upsertTwitchSession({ ...session, followersGained: gained })
        })
        .catch(() => undefined)
    }

    dataStore.upsertTwitchSession(session)
    this.onLiveUpdate?.(session)
    this.activeSession = null
    this.followersAtSessionStart = null
  }

  private async snapshotGrowth(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    const youtubeSecrets = secureStore.get('youtube')
    const twitchSecrets = secureStore.get('twitch')

    const point: { date: string; youtubeSubscribers?: number; twitchFollowers?: number } = { date: today }

    if (youtubeSecrets?.accessToken) {
      try {
        const totals = await getYouTubeTotals()
        point.youtubeSubscribers = totals.subscribers
        dataStore.setLastSynced('youtube', new Date().toISOString())
      } catch (err) {
        console.error('[poller] youtube snapshot failed', err)
      }
    }

    if (twitchSecrets?.accountId) {
      try {
        const followers = await getFollowerCount(twitchSecrets.accountId)
        if (followers != null) point.twitchFollowers = followers
        dataStore.setLastSynced('twitch', new Date().toISOString())
      } catch (err) {
        console.error('[poller] twitch snapshot failed', err)
      }
    }

    if (point.youtubeSubscribers != null || point.twitchFollowers != null) {
      dataStore.addGrowthPoint(point)
    }
  }
}

export const livePoller = new LivePoller()
