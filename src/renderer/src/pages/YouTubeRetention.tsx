import { useEffect, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { YouTubeRetentionResult, YouTubeVideoSummary } from '@shared/types'
import { useDashboard } from '../state/DashboardContext'
import EmptyState from '../components/EmptyState'
import { formatNumber } from '../lib/format'

export default function YouTubeRetention(): JSX.Element {
  const { dashboard, loading: dashboardLoading } = useDashboard()
  const [videos, setVideos] = useState<YouTubeVideoSummary[] | null>(null)
  const [selected, setSelected] = useState<YouTubeVideoSummary | null>(null)
  const [retention, setRetention] = useState<YouTubeRetentionResult | null>(null)
  const [loadingRetention, setLoadingRetention] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

  useEffect(() => {
    if (!dashboard?.youtube.connected) return
    window.api
      .listYouTubeVideos()
      .then((v) => {
        setVideos(v)
        if (v[0]) setSelected(v[0])
      })
      .catch((err) => setVideoError((err as Error).message))
  }, [dashboard?.youtube.connected])

  useEffect(() => {
    if (!selected) return
    setLoadingRetention(true)
    setRetention(null)
    window.api
      .getYouTubeRetention(selected)
      .then(setRetention)
      .catch((err) => setVideoError((err as Error).message))
      .finally(() => setLoadingRetention(false))
  }, [selected])

  if (dashboardLoading) return <div className="page-loading">Loading…</div>

  if (!dashboard?.youtube.connected) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>YouTube Retention</h1>
        </header>
        <EmptyState
          title="Connect YouTube first"
          description="Real per-video audience retention comes straight from the YouTube Analytics API."
          ctaLabel="Go to Settings"
          ctaTo="/settings"
        />
      </div>
    )
  }

  const chartData = retention?.points.map((p) => ({
    elapsed: Math.round(p.elapsedVideoTimeRatio * 100),
    retention: Math.round(p.audienceWatchRatio * 100)
  }))

  return (
    <div className="page">
      <header className="page-header">
        <h1>YouTube Retention</h1>
        <p>Audience retention curve per video, and exactly where viewers drop off.</p>
      </header>

      <div className="retention-layout">
        <div className="video-list">
          {videos === null && !videoError && <div className="page-loading">Loading videos…</div>}
          {videoError && <div className="page-error">{videoError}</div>}
          {videos?.map((v) => (
            <button
              key={v.id}
              className={`video-item${selected?.id === v.id ? ' active' : ''}`}
              onClick={() => setSelected(v)}
            >
              {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" />}
              <div className="video-item-meta">
                <div className="video-item-title">{v.title}</div>
                <div className="video-item-sub">{formatNumber(v.views)} views</div>
              </div>
            </button>
          ))}
        </div>

        <div className="panel retention-panel">
          {loadingRetention && <div className="page-loading">Loading retention curve…</div>}
          {!loadingRetention && retention && chartData && chartData.length > 0 && (
            <>
              <div className="panel-header">
                <h2>{retention.video.title}</h2>
                {retention.dropOffElapsedRatio != null && (
                  <p>
                    Biggest single drop-off around <strong>{Math.round(retention.dropOffElapsedRatio * 100)}%</strong>{' '}
                    into the video (
                    {retention.dropOffMagnitude != null ? `${Math.round(retention.dropOffMagnitude * 100)}pt drop` : ''}
                    ).
                  </p>
                )}
              </div>
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--youtube)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--youtube)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="elapsed"
                    stroke="var(--text-dim)"
                    fontSize={12}
                    tickFormatter={(v) => `${v}%`}
                    label={{ value: 'Video elapsed', position: 'insideBottom', offset: -4, fill: 'var(--text-dim)' }}
                  />
                  <YAxis stroke="var(--text-dim)" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8 }}
                    formatter={(v: number) => [`${v}%`, 'Audience retained']}
                    labelFormatter={(v) => `${v}% elapsed`}
                  />
                  {retention.dropOffElapsedRatio != null && (
                    <ReferenceLine
                      x={Math.round(retention.dropOffElapsedRatio * 100)}
                      stroke="var(--danger)"
                      strokeDasharray="4 4"
                      label={{ value: 'Drop-off', fill: 'var(--danger)', fontSize: 12, position: 'top' }}
                    />
                  )}
                  <Area type="monotone" dataKey="retention" stroke="var(--youtube)" strokeWidth={2} fill="url(#retentionFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}
          {!loadingRetention && retention && chartData && chartData.length === 0 && (
            <EmptyState
              title="No retention data yet"
              description="YouTube usually needs a little view volume before Analytics returns a retention curve for a video."
            />
          )}
        </div>
      </div>
    </div>
  )
}
