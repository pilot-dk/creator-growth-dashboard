import { ipcMain, shell, type BrowserWindow } from 'electron'
import { connectYouTube, disconnectYouTube, getYouTubeStatus, listRecentYouTubeVideos, getYouTubeRetention } from './services/youtube'
import { connectTwitch, disconnectTwitch, getTwitchStatus } from './services/twitch'
import { getDashboard, syncNow } from './services/dashboard'
import { computeBestTimes } from './services/bestTimes'
import { getTwitchGameStats, listTwitchSessions } from './services/twitchInsights'
import type { CredentialsInput, Platform, YouTubeVideoSummary } from '../shared/types'

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('dashboard:get', () => getDashboard())

  ipcMain.handle('connection:status', (_e, platform: Platform) =>
    platform === 'youtube' ? getYouTubeStatus() : getTwitchStatus()
  )

  ipcMain.handle('connection:connect', async (_e, platform: Platform, creds: CredentialsInput) => {
    if (platform === 'youtube') return connectYouTube(creds.clientId, creds.clientSecret)
    return connectTwitch(creds.clientId, creds.clientSecret)
  })

  ipcMain.handle('connection:disconnect', (_e, platform: Platform) => {
    if (platform === 'youtube') disconnectYouTube()
    else disconnectTwitch()
  })

  ipcMain.handle('sync:run', (_e, platform?: Platform) => syncNow(platform))

  ipcMain.handle('bestTimes:get', () => computeBestTimes())

  ipcMain.handle('youtube:listVideos', () => listRecentYouTubeVideos())

  ipcMain.handle('youtube:retention', (_e, video: YouTubeVideoSummary) => getYouTubeRetention(video))

  ipcMain.handle('twitch:gameStats', () => getTwitchGameStats())

  ipcMain.handle('twitch:sessions', (_e, limit?: number) => listTwitchSessions(limit))

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url)
  })

  void getWindow
}
