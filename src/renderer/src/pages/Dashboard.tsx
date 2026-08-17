import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts'
import { useDashboard } from '../state/DashboardContext'
import StatCard from '../components/StatCard'
import EmptyState from '../components/EmptyState'
import { formatCompactNumber, formatNumber, formatRelativeTime } from '../lib/format'

export default function Dashboard(): JSX.Element {
  const { dashboard, loading, error } = useDashboard()

  if (loading) return <div className="page-loading">Loading dashboard…</div>
  if (error) return <div className="page-error">{error}</div>
  if (!dashboard) return <div className="page-loading">No data yet.</div>

  const bothDisconnected = !dashboard.youtube.connected && !dashboard.twitch.connected

  return (
    <div className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p>Subscriber and follower growth across both platforms, at a glance.</p>
      </header>

      {bothDisconnected && (
        <EmptyState
          title="Connect an account to get started"
          description="Link your YouTube channel and/or Twitch channel in Settings to start pulling in analytics."
          ctaLabel="Go to Settings"
          ctaTo="/settings"
        />
      )}

      <div className="stat-grid">
        <StatCard
          accent="youtube"
          label="YouTube subscribers"
          value={formatCompactNumber(dashboard.youtubeTotals?.subscribers)}
          hint={dashboard.youtube.connected ? `Synced ${formatRelativeTime(dashboard.youtube.lastSyncedAt)}` : 'Not connected'}
        />
        <StatCard
          accent="youtube"
          label="YouTube total views"
          value={formatCompactNumber(dashboard.youtubeTotals?.totalViews)}
          hint={dashboard.youtubeTotals ? `${formatNumber(dashboard.youtubeTotals.videoCount)} videos` : undefined}
        />
        <StatCard
          accent="twitch"
          label="Twitch followers"
          value={formatCompactNumber(dashboard.twitchTotals?.followers)}
          hint={dashboard.twitch.connected ? `Synced ${formatRelativeTime(dashboard.twitch.lastSyncedAt)}` : 'Not connected'}
        />
        <StatCard
          accent="twitch"
          label="Twitch right now"
          value={dashboard.twitchTotals?.isLive ? `🔴 Live · ${formatNumber(dashboard.twitchTotals.currentViewers)} viewers` : 'Offline'}
          hint={dashboard.twitchTotals?.isLive ? dashboard.twitchTotals.currentGame : undefined}
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2>Growth over time</h2>
          <p>Daily snapshots recorded automatically while the app is running.</p>
        </div>
        {dashboard.growth.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Growth history builds up from daily snapshots once you're connected — check back after your first sync."
          />
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={dashboard.growth} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--text-dim)" fontSize={12} />
              <YAxis stroke="var(--text-dim)" fontSize={12} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text)' }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="youtubeSubscribers"
                name="YouTube subscribers"
                stroke="var(--youtube)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="twitchFollowers"
                name="Twitch followers"
                stroke="var(--twitch)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
