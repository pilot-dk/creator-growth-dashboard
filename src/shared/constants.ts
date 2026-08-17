export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
]

// Google's "loopback IP address" flow for Desktop app OAuth clients accepts
// any port on 127.0.0.1 at runtime, so we pick a random free port each time
// and never need a redirect URI registered up front.
export const GOOGLE_REDIRECT_PATH = '/oauth/callback'

export const POLL_INTERVAL_MS = 60_000 // how often to check Twitch live status while active
export const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60_000 // how often to record growth snapshots
