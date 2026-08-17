import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BestTimesResult } from '@shared/types'
import { useDashboard } from '../state/DashboardContext'
import { DAY_LABELS, formatHour } from '../lib/format'
import EmptyState from '../components/EmptyState'

export default function BestTimes(): JSX.Element {
  const { dashboard, loading: dashboardLoading } = useDashboard()
  const [data, setData] = useState<BestTimesResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api
      .getBestTimes()
      .then(setData)
      .finally(() => setLoading(false))
  }, [dashboard?.youtube.connected, dashboard?.twitch.connected])

  if (dashboardLoading || loading) return <div className="page-loading">Crunching timing data…</div>

  const neitherConnected = !dashboard?.youtube.connected && !dashboard?.twitch.connected

  return (
    <div className="page">
      <header className="page-header">
        <h1>Best Days &amp; Times</h1>
        <p>When your audience actually shows up, from real analytics — not gut feel.</p>
      </header>

      {neitherConnected && (
        <EmptyState
          title="Connect a platform first"
          description="Best-time insights need at least one connected account."
          ctaLabel="Go to Settings"
          ctaTo="/settings"
        />
      )}

      {dashboard?.youtube.connected && (
        <div className="panel">
          <div className="panel-header">
            <h2>YouTube — best day to publish</h2>
            <p>Trailing 90-day views, aggregated by day of week.</p>
          </div>
          {data && data.youtubeByDay.some((d) => d.sampleCount > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.youtubeByDay.map((d) => ({ ...d, label: DAY_LABELS[d.dayOfWeek] }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--text-dim)" fontSize={12} />
                <YAxis stroke="var(--text-dim)" fontSize={12} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                  formatter={(v: number) => [`${Math.round(v * 100)}% of peak`, 'Relative views']}
                />
                <Bar dataKey="score" fill="var(--youtube)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="Not enough data yet" description="Publish a few more videos and check back." />
          )}
        </div>
      )}

      {dashboard?.twitch.connected && (
        <div className="panel">
          <div className="panel-header">
            <h2>Twitch — viewer heatmap by day &amp; hour</h2>
            <p>Built from live sessions polled while the app was open. Keep it running while you stream to fill this in.</p>
          </div>
          <TwitchHeatmap cells={data?.twitchByDayHour ?? []} />
        </div>
      )}

      {data?.notes.map((note) => (
        <p key={note} className="note">
          {note}
        </p>
      ))}
    </div>
  )
}

function TwitchHeatmap({ cells }: { cells: BestTimesResult['twitchByDayHour'] }): JSX.Element {
  if (cells.length === 0) {
    return (
      <EmptyState
        title="No live sessions polled yet"
        description="Once you go live with the app running, viewer samples will start filling in this grid."
      />
    )
  }

  const lookup = new Map(cells.map((c) => [`${c.dayOfWeek}:${c.hour}`, c]))

  return (
    <div className="heatmap">
      <div className="heatmap-hours">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 3 === 0 ? formatHour(h) : ''}</span>
        ))}
      </div>
      {DAY_LABELS.map((label, dayOfWeek) => (
        <div className="heatmap-row" key={label}>
          <span className="heatmap-row-label">{label}</span>
          <div className="heatmap-cells">
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = lookup.get(`${dayOfWeek}:${hour}`)
              const score = cell?.score ?? 0
              return (
                <div
                  key={hour}
                  className="heatmap-cell"
                  style={{ background: `rgba(145, 70, 255, ${0.08 + score * 0.82})` }}
                  title={cell ? `${label} ${formatHour(hour)} · ${Math.round(score * 100)}% of peak (${cell.sampleCount} samples)` : 'No data'}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
