export function formatCompactNumber(n: number | undefined | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatNumber(n: number | undefined | null): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US').format(n)
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? 'am' : 'pm'}`
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null) return '—'
  return `${Math.round(ratio * 100)}%`
}
