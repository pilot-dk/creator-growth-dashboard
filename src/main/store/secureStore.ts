import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface PlatformSecrets {
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
  expiresAt?: number // epoch ms
  accountId?: string
  accountName?: string
  avatarUrl?: string
}

interface SecretsFile {
  youtube?: PlatformSecrets
  twitch?: PlatformSecrets
}

/**
 * Encrypts credentials at rest using the OS keychain (via Electron's
 * safeStorage, backed by Keychain Services on macOS) before writing them to
 * disk in the app's userData directory. Falls back to a warning + plaintext
 * only if the OS keychain is genuinely unavailable (e.g. some Linux setups).
 */
class SecureStore {
  private filePath: string
  private cache: SecretsFile | null = null

  constructor() {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'secrets.enc')
  }

  private load(): SecretsFile {
    if (this.cache) return this.cache
    if (!existsSync(this.filePath)) {
      this.cache = {}
      return this.cache
    }
    try {
      const raw = readFileSync(this.filePath)
      if (raw.length === 0) {
        this.cache = {}
        return this.cache
      }
      const decrypted = safeStorage.isEncryptionAvailable()
        ? safeStorage.decryptString(raw)
        : raw.toString('utf-8')
      this.cache = JSON.parse(decrypted) as SecretsFile
    } catch (err) {
      console.error('[secureStore] failed to load secrets, resetting', err)
      this.cache = {}
    }
    return this.cache
  }

  private persist(): void {
    if (!this.cache) return
    const json = JSON.stringify(this.cache)
    const buf = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(json)
      : Buffer.from(json, 'utf-8')
    writeFileSync(this.filePath, buf, { mode: 0o600 })
  }

  get(platform: 'youtube' | 'twitch'): PlatformSecrets | undefined {
    return this.load()[platform]
  }

  set(platform: 'youtube' | 'twitch', secrets: PlatformSecrets): void {
    const data = this.load()
    data[platform] = secrets
    this.persist()
  }

  update(platform: 'youtube' | 'twitch', patch: Partial<PlatformSecrets>): void {
    const data = this.load()
    const existing = data[platform]
    if (!existing) return
    data[platform] = { ...existing, ...patch }
    this.persist()
  }

  clear(platform: 'youtube' | 'twitch'): void {
    const data = this.load()
    delete data[platform]
    this.persist()
  }
}

export const secureStore = new SecureStore()
