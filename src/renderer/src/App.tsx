import { Routes, Route } from 'react-router-dom'
import { DashboardProvider } from './state/DashboardContext'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import BestTimes from './pages/BestTimes'
import YouTubeRetention from './pages/YouTubeRetention'
import TwitchInsights from './pages/TwitchInsights'
import Settings from './pages/Settings'

export default function App(): JSX.Element {
  return (
    <DashboardProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/best-times" element={<BestTimes />} />
            <Route path="/youtube-retention" element={<YouTubeRetention />} />
            <Route path="/twitch-insights" element={<TwitchInsights />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </DashboardProvider>
  )
}
