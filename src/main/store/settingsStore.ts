import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface ChannelSettings {
  /** Exactly what the user pasted, kept so Settings can show it back to them. */
  youtubeUrl?: string
  /** Resolved once, then cached — saves an API call on every launch. */
  youtubeChannelId?: string
  youtubeTitle?: string
  youtubeThumbnail?: string

  twitchUrl?: string
  twitchLogin?: string
  twitchUserId?: string
  twitchDisplayName?: string
  twitchAvatar?: string
}

/**
 * Non-secret app settings — which channels to track. Kept separate from
 * secureStore so it stays plain JSON the user can inspect or hand-edit.
 */
class SettingsStore {
  private filePath: string
  private data: ChannelSettings

  constructor() {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'settings.json')
    this.data = this.load()
  }

  private load(): ChannelSettings {
    if (!existsSync(this.filePath)) return {}
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as ChannelSettings
    } catch {
      return {}
    }
  }

  private persist(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data, null, 2))
    } catch (err) {
      console.error('[settingsStore] failed to persist', err)
    }
  }

  get all(): ChannelSettings {
    return this.data
  }

  patch(update: Partial<ChannelSettings>): void {
    Object.assign(this.data, update)
    this.persist()
  }

  clearYouTube(): void {
    delete this.data.youtubeUrl
    delete this.data.youtubeChannelId
    delete this.data.youtubeTitle
    delete this.data.youtubeThumbnail
    this.persist()
  }

  clearTwitch(): void {
    delete this.data.twitchUrl
    delete this.data.twitchLogin
    delete this.data.twitchUserId
    delete this.data.twitchDisplayName
    delete this.data.twitchAvatar
    this.persist()
  }
}

export const settingsStore = new SettingsStore()
