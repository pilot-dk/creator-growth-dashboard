import { contextBridge, ipcRenderer } from 'electron'
import type {
  BestTimesResult,
  ConnectionStatus,
  DashboardSnapshot,
  Platform,
  SetupInfo,
  SyncResult,
  TwitchGameStat,
  TwitchSessionSummary,
  YouTubeRetentionResult,
  YouTubeVideoSummary
} from '../shared/types'

const api = {
  getDashboard: (): Promise<DashboardSnapshot> => ipcRenderer.invoke('dashboard:get'),

  getSetup: (): Promise<SetupInfo> => ipcRenderer.invoke('setup:get'),

  setChannel: (platform: Platform, url: string): Promise<ConnectionStatus> =>
    ipcRenderer.invoke('channel:set', platform, url),

  clearChannel: (platform: Platform): Promise<void> => ipcRenderer.invoke('channel:clear', platform),

  getConnectionStatus: (platform: Platform): Promise<ConnectionStatus> =>
    ipcRenderer.invoke('connection:status', platform),

  connectYouTubeAccount: (): Promise<ConnectionStatus> => ipcRenderer.invoke('youtubeAccount:connect'),

  disconnectYouTubeAccount: (): Promise<void> => ipcRenderer.invoke('youtubeAccount:disconnect'),

  sync: (platform?: Platform): Promise<SyncResult[]> => ipcRenderer.invoke('sync:run', platform),

  getBestTimes: (): Promise<BestTimesResult> => ipcRenderer.invoke('bestTimes:get'),

  listYouTubeVideos: (): Promise<YouTubeVideoSummary[]> => ipcRenderer.invoke('youtube:listVideos'),

  getYouTubeRetention: (video: YouTubeVideoSummary): Promise<YouTubeRetentionResult> =>
    ipcRenderer.invoke('youtube:retention', video),

  getTwitchGameStats: (): Promise<TwitchGameStat[]> => ipcRenderer.invoke('twitch:gameStats'),

  getTwitchSessions: (limit?: number): Promise<TwitchSessionSummary[]> =>
    ipcRenderer.invoke('twitch:sessions', limit),

  onLiveUpdate: (cb: (session: TwitchSessionSummary) => void): (() => void) => {
    const listener = (_e: Electron.IpcRendererEvent, session: TwitchSessionSummary): void => cb(session)
    ipcRenderer.on('twitch:liveUpdate', listener)
    return () => ipcRenderer.removeListener('twitch:liveUpdate', listener)
  },

  openExternal: (url: string): void => {
    void ipcRenderer.invoke('shell:openExternal', url)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
