import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TwitchGameStat, TwitchSessionSummary } from '@shared/types'
import { useDashboard } from '../state/DashboardContext'
import EmptyState from '../components/EmptyState'
import { formatNumber, formatPercent } from '../lib/format'

export default function TwitchInsights(): JSX.Element {
  const { dashboard, loading: dashboardLoading } = useDashboard()
  const [gameStats, setGameStats] = useState<TwitchGameStat[] | null>(null)
  const [sessions, setSessions] = useState<TwitchSessionSummary[] | null>(null)
  const [liveSession, setLiveSession] = useState<TwitchSessionSummary | null>(null)

  useEffect(() => {
    if (!dashboard?.twitch.connected) return
    window.api.getTwitchGameStats().then(setGameStats)
    window.api.getTwitchSessions(10).then((s) => {
      setSessions(s)
      const live = s.find((session) => session.isLive)
      if (live) setLiveSession(live)
    })
  }, [dashboard?.twitch.connected])

  useEffect(() => {
    const unsubscribe = window.api.onLiveUpdate((session) => {
      setLiveSession(session)
      if (!session.isLive) {
        window.api.getTwitchGameStats().then(setGameStats)
        window.api.getTwitchSessions(10).then(setSessions)
      }
    })
    return unsubscribe
  }, [])

  if (dashboardLoading) return <div className="page-loading">Loading…</div>

  if (!dashboard?.twitch.connected) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Twitch Insights</h1>
        </header>
        <EmptyState
          title="Add your Twitch channel first"
          description="Paste your Twitch channel link in Settings — retention by game and drop-off timing build up from live viewer samples while you stream."
          ctaLabel="Go to Settings"
          ctaTo="/settings"
        />
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Twitch Insights</h1>
        <p>Retention by game and where viewers drop off, built from live sessions.</p>
      </header>

      {liveSession?.isLive && (
        <div className="panel live-panel">
          <div className="panel-header">
            <h2>
              <span className="live-dot" /> Live now — {liveSession.gameName}
            </h2>
            <p>{liveSession.samples.length} samples polled this session</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={liveSession.samples.map((s) => ({
                time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                viewers: s.viewerCount
              }))}
            >
              <defs>
                <linearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--twitch)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--twitch)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="time" stroke="var(--text-dim)" fontSize={12} />
              <YAxis stroke="var(--text-dim)" fontSize={12} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
              />
              <Area type="monotone" dataKey="viewers" stroke="var(--twitch)" strokeWidth={2} fill="url(#liveFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Retention by game</h2>
          <p>End-of-session viewers as a share of that session's peak — higher means fewer people left before you ended.</p>
        </div>
        {!gameStats || gameStats.length === 0 ? (
          <EmptyState
            title="No sessions recorded yet"
            description="Go live with the app open and this will fill in automatically."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Sessions</th>
                <th>Avg viewers</th>
                <th>Peak viewers</th>
                <th>End-of-stream retention</th>
              </tr>
            </thead>
            <tbody>
              {gameStats.map((g) => (
                <tr key={g.gameId}>
                  <td>{g.gameName}</td>
                  <td>{g.sessionCount}</td>
                  <td>{formatNumber(g.avgViewers)}</td>
                  <td>{formatNumber(g.peakViewers)}</td>
                  <td>
                    {g.avgRetentionRatio != null ? (
                      <span className={g.avgRetentionRatio < 0.5 ? 'badge badge-warn' : 'badge badge-ok'}>
                        {formatPercent(g.avgRetentionRatio)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Recent sessions</h2>
        </div>
        {!sessions || sessions.length === 0 ? (
          <EmptyState title="Nothing yet" description="Recent live sessions will show up here." />
        ) : (
          <ul className="session-list">
            {sessions.map((s) => (
              <li key={s.id}>
                <div>
                  <strong>{s.gameName}</strong>
                  <span className="session-date">{new Date(s.startedAt).toLocaleString()}</span>
                </div>
                <div className="session-stats">
                  <span>Peak {formatNumber(s.peakViewers)}</span>
                  <span>Avg {formatNumber(s.avgViewers)}</span>
                  {s.followersGained != null && <span>+{formatNumber(s.followersGained)} followers</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
