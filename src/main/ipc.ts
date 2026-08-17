import { ipcMain, shell } from 'electron'
import {
  setYouTubeChannel,
  clearYouTubeChannel,
  getYouTubeStatus,
  listRecentYouTubeVideos,
  getYouTubeRetention,
  connectYouTubeAccount,
  disconnectYouTubeAccount,
  getYouTubeAccountStatus
} from './services/youtube'
import { setTwitchChannel, clearTwitchChannel, getTwitchStatus } from './services/twitch'
import { getDashboard, syncNow } from './services/dashboard'
import { computeBestTimes } from './services/bestTimes'
import { getTwitchGameStats, listTwitchSessions } from './services/twitchInsights'
import { getCredentialAvailability } from './config/credentials'
import { settingsStore } from './store/settingsStore'
import type { Platform, YouTubeVideoSummary } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('dashboard:get', () => getDashboard())

  ipcMain.handle('setup:get', () => ({
    credentials: getCredentialAvailability(),
    channels: settingsStore.all,
    youtubeAccount: getYouTubeAccountStatus()
  }))

  ipcMain.handle('channel:set', (_e, platform: Platform, url: string) =>
    platform === 'youtube' ? setYouTubeChannel(url) : setTwitchChannel(url)
  )

  ipcMain.handle('channel:clear', (_e, platform: Platform) => {
    if (platform === 'youtube') clearYouTubeChannel()
    else clearTwitchChannel()
  })

  ipcMain.handle('connection:status', (_e, platform: Platform) =>
    platform === 'youtube' ? getYouTubeStatus() : getTwitchStatus()
  )

  ipcMain.handle('youtubeAccount:connect', () => connectYouTubeAccount())
  ipcMain.handle('youtubeAccount:disconnect', () => disconnectYouTubeAccount())

  ipcMain.handle('sync:run', (_e, platform?: Platform) => syncNow(platform))

  ipcMain.handle('bestTimes:get', () => computeBestTimes())

  ipcMain.handle('youtube:listVideos', () => listRecentYouTubeVideos())

  ipcMain.handle('youtube:retention', (_e, video: YouTubeVideoSummary) => getYouTubeRetention(video))

  ipcMain.handle('twitch:gameStats', () => getTwitchGameStats())

  ipcMain.handle('twitch:sessions', (_e, limit?: number) => listTwitchSessions(limit))

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
  })
}
