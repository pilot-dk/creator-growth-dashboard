import { shell } from 'electron'
import { TWITCH_OAUTH_SCOPES, TWITCH_REDIRECT_PORT, TWITCH_REDIRECT_URI } from '../../shared/constants'
import { generateState } from './pkce'
import { startLoopbackServer } from './loopback'

const AUTH_ENDPOINT = 'https://id.twitch.tv/oauth2/authorize'
const TOKEN_ENDPOINT = 'https://id.twitch.tv/oauth2/token'
const REDIRECT_PATH = '/oauth/callback'

export interface TwitchTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

/**
 * Runs Twitch's Authorization Code flow. Unlike Google, Twitch requires the
 * redirect URI registered on the app to match exactly (including port), so
 * this binds a fixed local port — the user must add TWITCH_REDIRECT_URI to
 * their Twitch application's "OAuth Redirect URLs" for this to work.
 */
export async function runTwitchOAuth(clientId: string, clientSecret: string): Promise<TwitchTokens> {
  const state = generateState()

  const server = await startLoopbackServer({ path: REDIRECT_PATH, fixedPort: TWITCH_REDIRECT_PORT }).catch(
    (err: Error) => {
      throw new Error(
        `Couldn't start the local sign-in listener on port ${TWITCH_REDIRECT_PORT} (${err.message}). ` +
          'Make sure nothing else on your Mac is using that port and try again.'
      )
    }
  )

  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', TWITCH_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', TWITCH_OAUTH_SCOPES.join(' '))
  authUrl.searchParams.set('state', state)

  const callbackPromise = server.waitForCallback(state)
  await shell.openExternal(authUrl.toString())

  let params: URLSearchParams
  try {
    params = await callbackPromise
  } finally {
    server.close()
  }

  const code = params.get('code')
  if (!code) throw new Error('Twitch did not return an authorization code.')

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TWITCH_REDIRECT_URI
    })
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Twitch token exchange failed: ${tokenRes.status} ${text}`)
  }

  const json = (await tokenRes.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000
  }
}

export async function refreshTwitchToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<TwitchTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitch token refresh failed: ${res.status} ${text}`)
  }
  const json = (await res.json()) as {
    access_token: string
    refresh_token: string
    expires_in: number
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000
  }
}
