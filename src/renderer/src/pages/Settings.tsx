import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Platform, SetupInfo } from '@shared/types'
import { useDashboard } from '../state/DashboardContext'

export default function Settings(): JSX.Element {
  const { refresh } = useDashboard()
  const [setup, setSetup] = useState<SetupInfo | null>(null)

  const reload = async (): Promise<void> => {
    setSetup(await window.api.getSetup())
    await refresh()
  }

  useEffect(() => {
    void window.api.getSetup().then(setSetup)
  }, [])

  if (!setup) return <div className="page-loading">Loading…</div>

  const { credentials, channels, youtubeAccount } = setup

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
        <p>Paste your channel links and you're done. Everything stays on this Mac.</p>
      </header>

      <ChannelCard
        platform="youtube"
        title="YouTube"
        placeholder="youtube.com/@yourhandle"
        available={credentials.youtubePublic}
        unavailableNote="This build has no YouTube API key baked in. See the README for how to add one."
        currentUrl={channels.youtubeUrl}
        currentName={channels.youtubeTitle}
        avatar={channels.youtubeThumbnail}
        onSave={(url) => window.api.setChannel('youtube', url)}
        onClear={() => window.api.clearChannel('youtube')}
        onDone={reload}
      />

      <ChannelCard
        platform="twitch"
        title="Twitch"
        placeholder="twitch.tv/yourname"
        available={credentials.twitch}
        unavailableNote="This build has no Twitch API keys baked in. See the README for how to add them."
        currentUrl={channels.twitchUrl}
        currentName={channels.twitchDisplayName}
        avatar={channels.twitchAvatar}
        onSave={(url) => window.api.setChannel('twitch', url)}
        onClear={() => window.api.clearChannel('twitch')}
        onDone={reload}
      />

      <div className="panel">
        <div className="panel-header">
          <h2>YouTube retention curves <span className="badge badge-neutral">Optional</span></h2>
          <p>
            Per-video audience retention is private data, so it's the one feature that needs you to sign in to
            your Google account. Everything else works without this.
          </p>
        </div>

        {!credentials.youtubeOAuth ? (
          <p className="note">
            Not available in this build — no Google OAuth client is configured. See the README to enable it.
          </p>
        ) : youtubeAccount.connected ? (
          <div className="platform-card-header">
            <div className="platform-connected">
              {youtubeAccount.avatarUrl && <img src={youtubeAccount.avatarUrl} alt="" className="avatar" />}
              <span>Signed in as {youtubeAccount.accountName}</span>
            </div>
            <button
              className="btn btn-ghost"
              onClick={async () => {
                await window.api.disconnectYouTubeAccount()
                await reload()
              }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <ConnectAccountButton onDone={reload} />
        )}
      </div>
    </div>
  )
}

function ConnectAccountButton({ onDone }: { onDone: () => Promise<void> }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        className="btn btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await window.api.connectYouTubeAccount()
            await onDone()
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Waiting for browser…' : 'Connect YouTube account'}
      </button>
      {error && <div className="form-error">{error}</div>}
    </>
  )
}

interface ChannelCardProps {
  platform: Platform
  title: string
  placeholder: string
  available: boolean
  unavailableNote: string
  currentUrl?: string
  currentName?: string
  avatar?: string
  onSave: (url: string) => Promise<unknown>
  onClear: () => Promise<void>
  onDone: () => Promise<void>
}

function ChannelCard(props: ChannelCardProps): JSX.Element {
  const { platform, title, placeholder, available, unavailableNote } = props
  const { currentUrl, currentName, avatar, onSave, onClear, onDone } = props

  const [url, setUrl] = useState(currentUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setUrl(currentUrl ?? ''), [currentUrl])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(url)
      await onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  let body: ReactNode
  if (!available) {
    body = <p className="note">{unavailableNote}</p>
  } else if (currentName) {
    body = (
      <div className="platform-card-header">
        <div className="platform-connected">
          {avatar && <img src={avatar} alt="" className="avatar" />}
          <span>Tracking {currentName}</span>
        </div>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await onClear()
            setUrl('')
            await onDone()
          }}
        >
          Change
        </button>
      </div>
    )
  } else {
    body = (
      <form className="credential-form" onSubmit={handleSubmit}>
        <label>
          Channel link
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Checking…' : `Track this ${title} channel`}
        </button>
      </form>
    )
  }

  return (
    <div className={`panel platform-card accent-${platform}`}>
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      {body}
    </div>
  )
}
