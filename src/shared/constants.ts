export const GOOGLE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly'
]

export const TWITCH_OAUTH_SCOPES = [
  'moderator:read:followers',
  'channel:read:subscriptions'
]

// Twitch requires an exact, pre-registered redirect URI (no dynamic ports),
// so we bind the local OAuth callback server to a fixed port. Users must add
// this exact URL to their Twitch application's "OAuth Redirect URLs".
export const TWITCH_REDIRECT_PORT = 53682
export const TWITCH_REDIRECT_URI = `http://localhost:${TWITCH_REDIRECT_PORT}/oauth/callback`

// Google's "loopback IP address" flow for Desktop app OAuth clients accepts
// any port on 127.0.0.1 at runtime, so we pick a random free port each time.
export const GOOGLE_REDIRECT_PATH = '/oauth/callback'

export const POLL_INTERVAL_MS = 60_000 // how often to check Twitch live status while active
export const SNAPSHOT_INTERVAL_MS = 6 * 60 * 60_000 // how often to record growth snapshots
