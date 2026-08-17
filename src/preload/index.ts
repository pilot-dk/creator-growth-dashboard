import { contextBridge, ipcRenderer } from 'electron'
import type {
  BestTimesResult,
  ConnectionStatus,
  CredentialsInput,
  DashboardSnapshot,
  Platform,
  SyncResult,
  TwitchGameStat,
  TwitchSessionSummary,
  YouTubeRetentionResult,
  YouTubeVideoSummary
} from '../shared/types'

const api = {
  getDashboard: (): Promise<DashboardSnapshot> => ipcRenderer.invoke('dashboard:get'),

  getConnectionStatus: (platform: Platform): Promise<ConnectionStatus> =>
    ipcRenderer.invoke('connection:status', platform),

  connect: (platform: Platform, creds: CredentialsInput): Promise<ConnectionStatus> =>
    ipcRenderer.invoke('connection:connect', platform, creds),

  disconnect: (platform: Platform): Promise<void> => ipcRenderer.invoke('connection:disconnect', platform),

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
