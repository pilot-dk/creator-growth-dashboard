import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { GrowthPoint, TwitchSessionSummary, YouTubeRetentionResult } from '../../shared/types'

interface DataFile {
  growth: GrowthPoint[]
  twitchSessions: TwitchSessionSummary[]
  youtubeRetentionCache: Record<string, YouTubeRetentionResult>
  youtubeChannelId?: string
  lastSyncedAt: Partial<Record<'youtube' | 'twitch', string>>
}

const EMPTY: DataFile = {
  growth: [],
  twitchSessions: [],
  youtubeRetentionCache: {},
  lastSyncedAt: {}
}

/**
 * Plain (non-secret) local cache of fetched analytics: growth history,
 * Twitch live-session samples used for drop-off/retention-by-game, and a
 * small cache of YouTube retention curves so re-opening a video is instant.
 */
class DataStore {
  private filePath: string
  private data: DataFile
  private writeScheduled = false

  constructor() {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'data.json')
    this.data = this.load()
  }

  private load(): DataFile {
    if (!existsSync(this.filePath)) return structuredClone(EMPTY)
    try {
      const raw = readFileSync(this.filePath, 'utf-8')
      return { ...structuredClone(EMPTY), ...JSON.parse(raw) }
    } catch (err) {
      console.error('[dataStore] failed to load, resetting', err)
      return structuredClone(EMPTY)
    }
  }

  private scheduleWrite(): void {
    if (this.writeScheduled) return
    this.writeScheduled = true
    setTimeout(() => {
      this.writeScheduled = false
      try {
        writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
      } catch (err) {
        console.error('[dataStore] failed to persist', err)
      }
    }, 250)
  }

  get all(): DataFile {
    return this.data
  }

  setYouTubeChannelId(id: string): void {
    this.data.youtubeChannelId = id
    this.scheduleWrite()
  }

  addGrowthPoint(point: GrowthPoint): void {
    const existing = this.data.growth.find((p) => p.date === point.date)
    if (existing) {
      Object.assign(existing, point)
    } else {
      this.data.growth.push(point)
      this.data.growth.sort((a, b) => a.date.localeCompare(b.date))
    }
    this.scheduleWrite()
  }

  get growth(): GrowthPoint[] {
    return this.data.growth
  }

  get twitchSessions(): TwitchSessionSummary[] {
    return this.data.twitchSessions
  }

  upsertTwitchSession(session: TwitchSessionSummary): void {
    const idx = this.data.twitchSessions.findIndex((s) => s.id === session.id)
    if (idx >= 0) this.data.twitchSessions[idx] = session
    else this.data.twitchSessions.push(session)
    // keep at most the most recent 200 sessions
    this.data.twitchSessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    if (this.data.twitchSessions.length > 200) this.data.twitchSessions.length = 200
    this.scheduleWrite()
  }

  cacheYouTubeRetention(videoId: string, result: YouTubeRetentionResult): void {
    this.data.youtubeRetentionCache[videoId] = result
    this.scheduleWrite()
  }

  getCachedYouTubeRetention(videoId: string): YouTubeRetentionResult | undefined {
    return this.data.youtubeRetentionCache[videoId]
  }

  setLastSynced(platform: 'youtube' | 'twitch', iso: string): void {
    this.data.lastSyncedAt[platform] = iso
    this.scheduleWrite()
  }

  getLastSynced(platform: 'youtube' | 'twitch'): string | undefined {
    return this.data.lastSyncedAt[platform]
  }
}

export const dataStore = new DataStore()
