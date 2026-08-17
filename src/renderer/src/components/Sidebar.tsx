import { NavLink } from 'react-router-dom'
import { useDashboard } from '../state/DashboardContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/best-times', label: 'Best Days & Times', icon: '◷' },
  { to: '/youtube-retention', label: 'YouTube Retention', icon: '▶' },
  { to: '/twitch-insights', label: 'Twitch Insights', icon: '⬢' },
  { to: '/settings', label: 'Settings', icon: '⚙' }
]

export default function Sidebar(): JSX.Element {
  const { dashboard, syncing, syncNow } = useDashboard()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">CG</span>
        <div>
          <div className="brand-title">Creator Growth</div>
          <div className="brand-subtitle">Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="connection-pill">
          <span className={`dot ${dashboard?.youtube.connected ? 'ok' : 'off'}`} />
          YouTube {dashboard?.youtube.connected ? 'tracking' : 'not set up'}
        </div>
        <div className="connection-pill">
          <span className={`dot ${dashboard?.twitch.connected ? 'ok' : 'off'}`} />
          Twitch {dashboard?.twitch.connected ? 'tracking' : 'not set up'}
        </div>
        <button className="btn btn-ghost sync-btn" disabled={syncing} onClick={() => void syncNow()}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
    </aside>
  )
}
