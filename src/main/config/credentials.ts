import { secureStore } from '../store/secureStore'

/**
 * Credentials resolve in two steps:
 *   1. Baked into the build at compile time from a gitignored `.env`
 *      (electron-vite exposes MAIN_VITE_* on import.meta.env).
 *   2. Otherwise, whatever the user entered in Settings.
 *
 * This lets a personal build ship with keys already in place — so setup is
 * just "paste your channel URLs" — while the public repo stays key-free and
 * anyone building from source can supply their own via Settings instead.
 */

function baked(key: string): string | undefined {
  const value = (import.meta.env as unknown as Record<string, string | undefined>)[key]
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function getYouTubeApiKey(): string | null {
  return baked('MAIN_VITE_YOUTUBE_API_KEY') ?? secureStore.get('youtubeApiKey')?.clientId ?? null
}

export interface AppCredentials {
  clientId: string
  clientSecret: string
}

export function getTwitchAppCredentials(): AppCredentials | null {
  const id = baked('MAIN_VITE_TWITCH_CLIENT_ID')
  const secret = baked('MAIN_VITE_TWITCH_CLIENT_SECRET')
  if (id && secret) return { clientId: id, clientSecret: secret }

  const stored = secureStore.get('twitch')
  if (stored?.clientId && stored.clientSecret) {
    return { clientId: stored.clientId, clientSecret: stored.clientSecret }
  }
  return null
}

/** Only needed for the optional YouTube retention feature. */
export function getGoogleOAuthCredentials(): AppCredentials | null {
  const id = baked('MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID')
  const secret = baked('MAIN_VITE_GOOGLE_OAUTH_CLIENT_SECRET')
  if (id && secret) return { clientId: id, clientSecret: secret }

  const stored = secureStore.get('youtube')
  if (stored?.clientId && stored.clientSecret) {
    return { clientId: stored.clientId, clientSecret: stored.clientSecret }
  }
  return null
}

export interface CredentialAvailability {
  youtubePublic: boolean
  twitch: boolean
  youtubeOAuth: boolean
}

export function getCredentialAvailability(): CredentialAvailability {
  return {
    youtubePublic: getYouTubeApiKey() != null,
    twitch: getTwitchAppCredentials() != null,
    youtubeOAuth: getGoogleOAuthCredentials() != null
  }
}
