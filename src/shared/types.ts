// Shared type contracts between main and renderer processes.
// Keep this file dependency-free so it can be imported from both worlds.

export type Platform = 'youtube' | 'twitch'

export interface ConnectionStatus {
  connected: boolean
  accountName?: string
  accountId?: string
  avatarUrl?: string
  lastSyncedAt?: string | null
  error?: string | null
}

export interface CredentialAvailability {
  /** API key present, so public YouTube stats work. */
  youtubePublic: boolean
  /** Twitch app keys present, so all Twitch features work. */
  twitch: boolean
  /** Google OAuth client present, so the optional retention feature is offered. */
  youtubeOAuth: boolean
}

export interface ChannelSettings {
  youtubeUrl?: string
  youtubeChannelId?: string
  youtubeTitle?: string
  youtubeThumbnail?: string
  twitchUrl?: string
  twitchLogin?: string
  twitchUserId?: string
  twitchDisplayName?: string
  twitchAvatar?: string
}

export interface SetupInfo {
  credentials: CredentialAvailability
  channels: ChannelSettings
  youtubeAccount: ConnectionStatus
}

/** A single actionable recommendation derived from the user's own data. */
export interface Insight {
  id: string
  platform: Platform | 'both'
  severity: 'good' | 'opportunity' | 'warning'
  title: string
  detail: string
  /** Plain-language statement of what this was computed from. */
  basis: string
}

export interface CategoryOpportunity {
  gameId: string
  gameName: string
  boxArtUrl?: string
  /** Total viewers across the sampled streams — a floor, not the category total. */
  totalViewers: number
  /** Number of live streams sampled (capped at 100 by the API page size). */
  channelCount: number
  viewersPerChannel: number
  /** Share of the sampled (largest 100) streams under 50 viewers — how attainable the category's front page is. */
  smallStreamerShare: number
  /** True when the user has streamed this game before. */
  streamedBefore: boolean
}

export interface VideoIdea {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  thumbnailUrl?: string
  views: number
}

export interface SuggestionsResult {
  insights: Insight[]
  notes: string[]
}

export interface GrowthPoint {
  date: string // ISO date, day granularity
  youtubeSubscribers?: number
  twitchFollowers?: number
}

export interface DayScore {
  dayOfWeek: number // 0 = Sunday .. 6 = Saturday
  score: number // normalized 0-1
  sampleCount: number
}

export interface DayHourCell {
  dayOfWeek: number
  hour: number // 0-23, local time
  score: number // normalized 0-1
  sampleCount: number
}

export interface BestTimesResult {
  youtubeByDay: DayScore[]
  twitchByDayHour: DayHourCell[]
  twitchByDay: DayScore[]
  notes: string[]
}

export interface YouTubeVideoSummary {
  id: string
  title: string
  publishedAt: string
  thumbnailUrl?: string
  views: number
  averageViewDurationSeconds?: number
}

export interface RetentionPoint {
  elapsedVideoTimeRatio: number
  audienceWatchRatio: number
  relativeRetentionPerformance: number | null
}

export interface YouTubeRetentionResult {
  video: YouTubeVideoSummary
  points: RetentionPoint[]
  dropOffElapsedRatio: number | null
  dropOffMagnitude: number | null
}

export interface TwitchLiveSample {
  timestamp: string
  viewerCount: number
}

export interface TwitchSessionSummary {
  id: string
  gameId: string
  gameName: string
  title: string
  startedAt: string
  endedAt: string | null
  peakViewers: number
  avgViewers: number
  followersGained: number | null
  isLive: boolean
  samples: TwitchLiveSample[]
  source: 'polled' | 'historical'
}

export interface TwitchGameStat {
  gameId: string
  gameName: string
  sessionCount: number
  avgViewers: number
  peakViewers: number
  avgRetentionRatio: number | null
  hasPolledData: boolean
}

export interface SyncResult {
  platform: Platform
  ok: boolean
  message?: string
  syncedAt: string
}

export interface YouTubeTotals {
  subscribers: number
  totalViews: number
  videoCount: number
  channelTitle: string
}

export interface TwitchTotals {
  followers: number
  subscribers: number | null
  isLive: boolean
  currentGame?: string
  currentViewers?: number
  displayName: string
}

export interface DashboardSnapshot {
  youtube: ConnectionStatus
  twitch: ConnectionStatus
  growth: GrowthPoint[]
  youtubeTotals: YouTubeTotals | null
  twitchTotals: TwitchTotals | null
}

export interface SyncStatusEvent {
  platform: Platform
  state: 'syncing' | 'idle' | 'error'
  message?: string
}
