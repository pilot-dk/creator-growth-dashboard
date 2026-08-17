import { shell } from 'electron'
import { GOOGLE_OAUTH_SCOPES, GOOGLE_REDIRECT_PATH } from '../../shared/constants'
import { generatePkcePair, generateState } from './pkce'
import { startLoopbackServer } from './loopback'

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

export interface GoogleTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

/**
 * Runs Google's "loopback IP address" OAuth flow for installed apps: binds a
 * local server first (so we know the port), opens the system browser to
 * Google's consent screen with a PKCE challenge, waits for the redirect,
 * then exchanges the code for tokens directly with Google.
 */
export async function runGoogleOAuth(clientId: string, clientSecret: string): Promise<GoogleTokens> {
  const state = generateState()
  const { verifier, challenge } = generatePkcePair()

  const server = await startLoopbackServer({ path: GOOGLE_REDIRECT_PATH })
  const redirectUri = `http://127.0.0.1:${server.port}${GOOGLE_REDIRECT_PATH}`

  const authUrl = new URL(AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', GOOGLE_OAUTH_SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', challenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  const callbackPromise = server.waitForCallback(state)
  await shell.openExternal(authUrl.toString())

  let params: URLSearchParams
  try {
    params = await callbackPromise
  } finally {
    server.close()
  }

  const code = params.get('code')
  if (!code) throw new Error('Google did not return an authorization code.')

  const tokenRes = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    throw new Error(`Google token exchange failed: ${tokenRes.status} ${text}`)
  }

  const json = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000
  }
}

export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<GoogleTokens> {
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
    throw new Error(`Google token refresh failed: ${res.status} ${text}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in: number }
  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: Date.now() + json.expires_in * 1000
  }
}
