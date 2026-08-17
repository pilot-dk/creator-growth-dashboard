import { useEffect, useState, type FormEvent } from 'react'
import type { CategoryOpportunity, Insight, SuggestionsResult, VideoIdea } from '@shared/types'
import { useDashboard } from '../state/DashboardContext'
import EmptyState from '../components/EmptyState'
import { formatCompactNumber, formatNumber, formatPercent } from '../lib/format'

export default function Suggestions(): JSX.Element {
  const { dashboard, loading } = useDashboard()
  const [data, setData] = useState<SuggestionsResult | null>(null)
  const [categories, setCategories] = useState<CategoryOpportunity[] | null>(null)
  const [loadingCats, setLoadingCats] = useState(false)

  useEffect(() => {
    void window.api.getInsights().then(setData)
  }, [dashboard?.youtube.connected, dashboard?.twitch.connected])

  useEffect(() => {
    if (!dashboard?.twitch.connected) return
    setLoadingCats(true)
    window.api
      .getCategoryOpportunities()
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoadingCats(false))
  }, [dashboard?.twitch.connected])

  if (loading) return <div className="page-loading">Loading…</div>

  const nothingSetUp = !dashboard?.youtube.connected && !dashboard?.twitch.connected

  return (
    <div className="page">
      <header className="page-header">
        <h1>Suggestions</h1>
        <p>What to make next — worked out from your own numbers and what's live right now.</p>
      </header>

      {nothingSetUp && (
        <EmptyState
          title="Add a channel first"
          description="Suggestions are built from your own history, so add a channel in Settings to get started."
          ctaLabel="Go to Settings"
          ctaTo="/settings"
        />
      )}

      {data && data.insights.length > 0 && (
        <div className="insight-grid">
          {data.insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {data?.notes.map((note) => (
        <p key={note} className="note">
          {note}
        </p>
      ))}

      {dashboard?.twitch.connected && (
        <div className="panel">
          <div className="panel-header">
            <h2>Where there's room on Twitch right now</h2>
            <p>
              A live snapshot of the biggest categories, ranked by how attainable their front page is. The
              last column is the share of each category's 100 largest live streams that have under 50
              viewers — a high number means you could rank among the most-viewed streams there without a big
              audience. 0% means even the 100th-biggest stream is large, so you'd start far down the list.
            </p>
          </div>
          {loadingCats ? (
            <div className="page-loading">Sampling live categories…</div>
          ) : !categories || categories.length === 0 ? (
            <EmptyState title="Couldn't load categories" description="Check your connection and try again." />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Viewers</th>
                  <th>Streams</th>
                  <th>Viewers / stream</th>
                  <th>Small streams in top 100</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.gameId}>
                    <td>
                      <div className="category-cell">
                        {c.boxArtUrl && <img src={c.boxArtUrl} alt="" className="box-art" />}
                        <span>
                          {c.gameName}
                          {c.streamedBefore && <span className="badge badge-neutral">you've streamed this</span>}
                        </span>
                      </div>
                    </td>
                    <td>{formatCompactNumber(c.totalViewers)}</td>
                    <td>{c.channelCount}</td>
                    <td>{formatNumber(Math.round(c.viewersPerChannel))}</td>
                    <td>
                      <span className={c.smallStreamerShare > 0.4 ? 'badge badge-ok' : 'badge badge-warn'}>
                        {formatPercent(c.smallStreamerShare)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="note">
            Sampled from up to the 100 largest live streams per category, right now. Viewer and stream counts
            are therefore a floor, not a category total. This describes the current moment rather than
            predicting anything — worth re-checking before you plan a stream.
          </p>
        </div>
      )}

      {dashboard?.youtube.connected && <TopicResearch />}
    </div>
  )
}

function InsightCard({ insight }: { insight: Insight }): JSX.Element {
  const icon = insight.severity === 'good' ? '✓' : insight.severity === 'warning' ? '!' : '↗'
  return (
    <div className={`insight-card severity-${insight.severity}`}>
      <div className="insight-head">
        <span className="insight-icon">{icon}</span>
        <h3>{insight.title}</h3>
      </div>
      <p>{insight.detail}</p>
      <div className="insight-basis">Based on {insight.basis}</div>
    </div>
  )
}

function TopicResearch(): JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VideoIdea[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    setError(null)
    try {
      setResults(await window.api.researchTopic(query))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Check a video idea against what's working</h2>
        <p>
          Search a topic to see the highest-viewed videos published in the last 90 days. Useful for sanity
          checking an idea, and for seeing how others frame it, before you commit to filming.
        </p>
      </div>

      <form className="research-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. speedrun tutorial, indie horror review"
          spellCheck={false}
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}

      {results && results.length === 0 && !error && (
        <p className="note">Nothing found for that topic in the last 90 days.</p>
      )}

      {results && results.length > 0 && (
        <ul className="idea-list">
          {results.map((v) => (
            <li key={v.videoId}>
              <button
                className="idea-item"
                onClick={() => window.api.openExternal(`https://www.youtube.com/watch?v=${v.videoId}`)}
              >
                {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" />}
                <div className="idea-meta">
                  <div className="idea-title">{v.title}</div>
                  <div className="idea-sub">
                    {v.channelTitle} · {formatCompactNumber(v.views)} views ·{' '}
                    {new Date(v.publishedAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
