// Parsing of user-pasted channel URLs into the identifiers each API needs.
// Accepts full URLs, bare handles, or plain names — people paste all three.

export interface YouTubeChannelRef {
  kind: 'handle' | 'channelId' | 'legacyUser'
  value: string
}

export function parseYouTubeUrl(input: string): YouTubeChannelRef | null {
  const raw = input.trim()
  if (!raw) return null

  // Bare handle, e.g. "@creator"
  if (raw.startsWith('@') && !raw.includes('/')) {
    return { kind: 'handle', value: raw }
  }

  // Bare channel ID, e.g. "UCxxxxxxxxxxxxxxxxxxxxxx"
  if (/^UC[\w-]{22}$/.test(raw)) {
    return { kind: 'channelId', value: raw }
  }

  let path: string
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== 'youtu.be') return null
    path = url.pathname
  } catch {
    return null
  }

  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null

  if (segments[0].startsWith('@')) return { kind: 'handle', value: segments[0] }
  if (segments[0] === 'channel' && segments[1]) return { kind: 'channelId', value: segments[1] }
  // /c/Name and /user/Name are both legacy custom-URL forms
  if ((segments[0] === 'c' || segments[0] === 'user') && segments[1]) {
    return { kind: 'legacyUser', value: segments[1] }
  }

  return null
}

/** Twitch is simpler: everything reduces to the channel's login name. */
export function parseTwitchUrl(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  // Bare login name
  if (/^[a-zA-Z0-9_]{3,25}$/.test(raw)) return raw.toLowerCase()

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return null
    const segment = url.pathname.split('/').filter(Boolean)[0]
    if (!segment) return null
    if (!/^[a-zA-Z0-9_]{3,25}$/.test(segment)) return null
    return segment.toLowerCase()
  } catch {
    return null
  }
}
