interface StatCardProps {
  label: string
  value: string
  hint?: string
  accent?: 'youtube' | 'twitch' | 'neutral'
}

export default function StatCard({ label, value, hint, accent = 'neutral' }: StatCardProps): JSX.Element {
  return (
    <div className={`stat-card accent-${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  )
}
