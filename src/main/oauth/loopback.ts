import { createServer, type Server } from 'node:http'
import { URL } from 'node:url'

const SUCCESS_HTML = (title: string, message: string): string => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b0f14;color:#e6edf3;
    display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
  .card{text-align:center;padding:2.5rem 3rem;border-radius:16px;background:#131a22;box-shadow:0 8px 30px rgba(0,0,0,.4)}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{color:#8b98a5;margin:0}
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`

export interface LoopbackHandle {
  port: number
  /** Resolves with the redirect's query params once the callback arrives, then closes the server. */
  waitForCallback: (expectedState: string, timeoutMs?: number) => Promise<URLSearchParams>
  close: () => void
}

/**
 * Binds a short-lived local HTTP server that will catch an OAuth redirect.
 * Returns the bound port immediately so callers can build the redirect_uri
 * before sending the user to the provider's consent screen.
 *
 * @param fixedPort bind to this exact port (required by providers like
 *   Twitch that require an exact pre-registered redirect URI). Omit to let
 *   the OS assign a free port (used for Google's loopback flow).
 */
export function startLoopbackServer(opts: { path: string; fixedPort?: number }): Promise<LoopbackHandle> {
  const { path, fixedPort } = opts

  return new Promise((resolveHandle, rejectHandle) => {
    let pendingResolve: ((params: URLSearchParams) => void) | null = null
    let pendingReject: ((err: Error) => void) | null = null
    let pendingState: string | null = null

    const server: Server = createServer((req, res) => {
      if (!req.url) return
      const url = new URL(req.url, 'http://localhost')
      if (url.pathname !== path) {
        res.writeHead(404).end()
        return
      }
      const params = url.searchParams
      const error = params.get('error')
      const state = params.get('state')

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(SUCCESS_HTML('Sign-in failed', error))
        pendingReject?.(new Error(`OAuth provider returned an error: ${error}`))
        return
      }
      if (pendingState && state !== pendingState) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(SUCCESS_HTML('Sign-in failed', 'State mismatch — please try connecting again.'))
        pendingReject?.(new Error('OAuth state mismatch'))
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(SUCCESS_HTML('You’re connected', 'You can close this tab and return to the app.'))
      pendingResolve?.(params)
    })

    server.on('error', (err) => rejectHandle(err))

    server.listen(fixedPort ?? 0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      resolveHandle({
        port,
        waitForCallback: (expectedState: string, timeoutMs = 5 * 60_000) => {
          pendingState = expectedState
          return new Promise<URLSearchParams>((resolve, reject) => {
            const timer = setTimeout(() => {
              reject(new Error('Timed out waiting for the browser sign-in to complete.'))
              server.close()
            }, timeoutMs)
            pendingResolve = (params) => {
              clearTimeout(timer)
              resolve(params)
              setTimeout(() => server.close(), 100)
            }
            pendingReject = (err) => {
              clearTimeout(timer)
              reject(err)
              setTimeout(() => server.close(), 100)
            }
          })
        },
        close: () => server.close()
      })
    })
  })
}
