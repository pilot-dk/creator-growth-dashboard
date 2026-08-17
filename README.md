# Creator Growth Dashboard

A cross-platform growth dashboard for creators who stream or upload on both **YouTube** and **Twitch**. It pulls subscriber/follower growth, best days & times to go live or publish, retention by game, and where viewers drop off into one place — so check-ins are a glance instead of manual digging across two dashboards.

Runs as a native macOS app. Your API credentials and tokens are encrypted at rest via your Mac's Keychain and never leave your machine except to talk directly to Google/Twitch.

## Features

- **Unified growth chart** — YouTube subscribers and Twitch followers over time, on one timeline.
- **Best days & times** — YouTube's best day to publish from your real watch-time history, plus a Twitch day×hour viewer heatmap built from live sessions.
- **YouTube retention curves** — real per-video audience retention from the YouTube Analytics API, with the biggest drop-off point called out automatically.
- **Twitch retention by game** — end-of-stream viewer retention and peak/average viewers, broken down by game, plus a live-updating drop-off chart while you're streaming.
- **Bring your own API credentials** — no bundled secrets, no third-party backend. You connect your own Google Cloud and Twitch developer apps.

## Why some things only fill in over time

YouTube's Analytics API exposes real per-video audience retention and day-level watch-time history, but it has **no hour-of-day dimension** — so YouTube best-time insights are day-of-week only.

Twitch's public API doesn't expose historical viewer-count-over-time for past broadcasts to third-party apps at all — that data only exists in Twitch's own creator dashboard. So this app builds its own history by **polling your live viewer count while you stream** (once a minute, only while the app is running and you're live). That means:

- Retention-by-game and the day×hour heatmap start empty and fill in after your first few streams with the app open.
- Historical streams from before you started using the app won't have drop-off curves — only aggregate stats (view count, start time) pulled from Twitch's video history.

## Getting started

### 1. Download

Grab the latest `.dmg` from the [Releases page](../../releases). Since this build isn't signed with an Apple Developer certificate, macOS Gatekeeper will flag it as from an unidentified developer the first time:

1. Move **Creator Growth Dashboard.app** to Applications.
2. Right-click the app → **Open** → confirm **Open** in the dialog. (Only needed once.)

### 2. Connect your accounts

Open **Settings** in the app and follow the in-app setup steps for each platform. In short:

**YouTube**
1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Enable the **YouTube Data API v3** and **YouTube Analytics API**.
3. Create an OAuth **Desktop app** client ID — no redirect URI to register.
4. Paste the Client ID/Secret into the app.
5. If your OAuth consent screen is in "Testing" mode, add your own Google account as a test user.

**Twitch**
1. Register an app at the [Twitch developer console](https://dev.twitch.tv/console/apps/create).
2. Add `http://localhost:53682/oauth/callback` as an OAuth Redirect URL (must match exactly).
3. Paste the Client ID/Secret into the app.

Nothing is uploaded to any server the app's authors run — there isn't one. Requests go straight from your Mac to Google's and Twitch's own APIs.

## Development

```bash
git clone https://github.com/pilot-dk/creator-growth-dashboard.git
cd creator-growth-dashboard
npm install
npm run dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for build/release details.

## Tech stack

Electron + React + TypeScript, built with [electron-vite](https://electron-vite.org/) and packaged with [electron-builder](https://www.electron.build/). Charts via [Recharts](https://recharts.org/).

## License

[MIT](./LICENSE)
