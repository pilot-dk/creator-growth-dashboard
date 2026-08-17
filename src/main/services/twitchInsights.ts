import { dataStore } from '../store/dataStore'
import type { TwitchGameStat, TwitchSessionSummary } from '../../shared/types'

export function listTwitchSessions(limit = 50): TwitchSessionSummary[] {
  return dataStore.twitchSessions.slice(0, limit)
}

/** Retention-by-game, aggregated from locally polled live sessions. */
export function getTwitchGameStats(): TwitchGameStat[] {
  const byGame = new Map<string, TwitchSessionSummary[]>()
  for (const session of dataStore.twitchSessions) {
    const list = byGame.get(session.gameId) ?? []
    list.push(session)
    byGame.set(session.gameId, list)
  }

  const stats: TwitchGameStat[] = []
  for (const [gameId, sessions] of byGame) {
    const withSamples = sessions.filter((s) => s.samples.length > 1)
    const retentionRatios = withSamples.map((s) => {
      const peak = Math.max(...s.samples.map((p) => p.viewerCount), 1)
      const last = s.samples[s.samples.length - 1].viewerCount
      return last / peak
    })

    stats.push({
      gameId,
      gameName: sessions[0].gameName,
      sessionCount: sessions.length,
      avgViewers: Math.round(sessions.reduce((a, s) => a + s.avgViewers, 0) / sessions.length),
      peakViewers: Math.max(...sessions.map((s) => s.peakViewers)),
      avgRetentionRatio: retentionRatios.length
        ? retentionRatios.reduce((a, b) => a + b, 0) / retentionRatios.length
        : null,
      hasPolledData: sessions.some((s) => s.source === 'polled')
    })
  }

  return stats.sort((a, b) => b.sessionCount - a.sessionCount)
}
