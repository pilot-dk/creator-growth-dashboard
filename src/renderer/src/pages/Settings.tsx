import { useState, type FormEvent } from 'react'
import type { Platform } from '@shared/types'
import { useDashboard } from '../state/DashboardContext'
import { TWITCH_REDIRECT_URI } from '@shared/constants'

function useCredentialForm(): {
  clientId: string
  clientSecret: string
  setClientId: (v: string) => void
  setClientSecret: (v: string) => void
} {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  return { clientId, clientSecret, setClientId, setClientSecret }
}

export default function Settings(): JSX.Element {
  const { dashboard, connect, disconnect } = useDashboard()

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
        <p>Bring your own API credentials — nothing is sent anywhere except directly to Google/Twitch, and secrets are encrypted on disk via your OS keychain.</p>
      </header>

      <PlatformCard
        platform="youtube"
        title="YouTube"
        connected={dashboard?.youtube.connected ?? false}
        accountName={dashboard?.youtube.accountName}
        avatarUrl={dashboard?.youtube.avatarUrl}
        onConnect={(creds) => connect('youtube', creds)}
        onDisconnect={() => disconnect('youtube')}
        instructions={
          <ol>
            <li>
              Open the{' '}
              <ExternalLink href="https://console.cloud.google.com/apis/credentials">
                Google Cloud Console credentials page
              </ExternalLink>{' '}
              (create a project if you don't have one).
            </li>
            <li>
              Enable the <strong>YouTube Data API v3</strong> and <strong>YouTube Analytics API</strong> for the project.
            </li>
            <li>
              Create an OAuth client ID of type <strong>Desktop app</strong>. No redirect URI needs to be registered —
              Google's desktop/loopback flow accepts any local port automatically.
            </li>
            <li>Copy the Client ID and Client Secret below.</li>
            <li>
              If your project is in "Testing" publishing status, add your own Google account under{' '}
              <strong>Audience → Test users</strong> so sign-in isn't blocked.
            </li>
          </ol>
        }
      />

      <PlatformCard
        platform="twitch"
        title="Twitch"
        connected={dashboard?.twitch.connected ?? false}
        accountName={dashboard?.twitch.accountName}
        avatarUrl={dashboard?.twitch.avatarUrl}
        onConnect={(creds) => connect('twitch', creds)}
        onDisconnect={() => disconnect('twitch')}
        instructions={
          <ol>
            <li>
              Open the{' '}
              <ExternalLink href="https://dev.twitch.tv/console/apps/create">Twitch developer console</ExternalLink> and
              register a new application.
            </li>
            <li>
              Set <strong>OAuth Redirect URLs</strong> to exactly:
              <code className="inline-code">{TWITCH_REDIRECT_URI}</code>
            </li>
            <li>
              Set <strong>Category</strong> to "Application Integration" and grab the Client ID + Client Secret.
            </li>
            <li>Paste them below.</li>
            <li>
              Subscriber counts require Affiliate/Partner status — the dashboard will simply show follower growth if
              you're not eligible yet.
            </li>
          </ol>
        }
      />
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }): JSX.Element {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault()
        window.api.openExternal(href)
      }}
    >
      {children}
    </a>
  )
}

interface PlatformCardProps {
  platform: Platform
  title: string
  connected: boolean
  accountName?: string
  avatarUrl?: string
  instructions: React.ReactNode
  onConnect: (creds: { clientId: string; clientSecret: string }) => Promise<{ ok: boolean; message?: string }>
  onDisconnect: () => Promise<void>
}

function PlatformCard(props: PlatformCardProps): JSX.Element {
  const { platform, title, connected, accountName, avatarUrl, instructions, onConnect, onDisconnect } = props
  const form = useCredentialForm()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(!connected)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await onConnect({ clientId: form.clientId.trim(), clientSecret: form.clientSecret.trim() })
    setBusy(false)
    if (!result.ok) setError(result.message ?? 'Something went wrong.')
  }

  return (
    <div className={`panel platform-card accent-${platform}`}>
      <div className="panel-header platform-card-header">
        <div>
          <h2>{title}</h2>
          {connected ? (
            <div className="platform-connected">
              {avatarUrl && <img src={avatarUrl} alt="" className="avatar" />}
              <span>Connected as {accountName}</span>
            </div>
          ) : (
            <p>Not connected</p>
          )}
        </div>
        {connected && (
          <button className="btn btn-ghost" onClick={() => void onDisconnect()}>
            Disconnect
          </button>
        )}
      </div>

      <button className="link-btn" onClick={() => setShowInstructions((v) => !v)}>
        {showInstructions ? 'Hide setup steps' : 'Show setup steps'}
      </button>
      {showInstructions && <div className="instructions">{instructions}</div>}

      {!connected && (
        <form className="credential-form" onSubmit={handleSubmit}>
          <label>
            Client ID
            <input
              type="text"
              value={form.clientId}
              onChange={(e) => form.setClientId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          <label>
            Client Secret
            <input
              type="password"
              value={form.clientSecret}
              onChange={(e) => form.setClientSecret(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Opening browser…' : `Connect ${title}`}
          </button>
        </form>
      )}
    </div>
  )
}
