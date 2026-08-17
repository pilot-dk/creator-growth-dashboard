# Creator Growth Dashboard

A growth dashboard for creators who stream or upload on both **YouTube** and **Twitch**. It pulls subscriber/follower growth, best days & times to go live or publish, retention by game, and where viewers drop off into one place — so check-ins are a glance instead of manual digging across two dashboards.

Native macOS app (Apple Silicon). Everything runs locally — there is no backend, and no data leaves your Mac except direct calls to Google's and Twitch's APIs.

## Features

- **Unified growth chart** — YouTube subscribers and Twitch followers over time, on one timeline.
- **Best days & times** — best day to publish on YouTube, plus a Twitch day×hour viewer heatmap built from live sessions.
- **Twitch retention by game** — end-of-stream viewer retention and peak/average viewers per game, plus a live-updating drop-off chart while you're streaming.
- **YouTube retention curves** *(optional)* — real per-video audience retention with the biggest drop-off point flagged automatically.

## Setup

**In the app, setup is just pasting your two channel links.** That's it — no sign-in, no consent screens.

That works because the app authenticates *as itself* using API keys baked in at build time. If you're building from source you'll need to supply your own (they're free, and the app still runs without them — it just asks for them in Settings instead).

<details>
<summary><b>Building from source: getting the keys</b></summary>

Copy `.env.example` to `.env` and fill in:

**`MAIN_VITE_YOUTUBE_API_KEY`** — powers YouTube subscriber/view/video stats.
1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create a project.
2. Enable **YouTube Data API v3**.
3. **Create credentials → API key**. Copy it. (No OAuth consent screen needed.)

**`MAIN_VITE_TWITCH_CLIENT_ID`** / **`MAIN_VITE_TWITCH_CLIENT_SECRET`** — powers everything Twitch.
1. Register an app at the [Twitch developer console](https://dev.twitch.tv/console/apps/create).
2. Set OAuth Redirect URL to `http://localhost` — it's never used, since the app authenticates as itself rather than as you.
3. Copy the Client ID, then **New Secret** and copy that.

**`MAIN_VITE_GOOGLE_OAUTH_CLIENT_ID`** / **`..._SECRET`** *(optional — only for YouTube retention curves)*
1. Same Google project: also enable **YouTube Analytics API**.
2. Create an OAuth client ID of type **Desktop app**. No redirect URI to register.
3. If your consent screen is in "Testing" mode, add your own Google account under **Audience → Test users**.

`.env` is gitignored, so keys baked into your build never reach the repo.
</details>

## Why some things fill in over time

**Twitch's public API doesn't expose historical viewer-count-over-time** to third-party apps — that data only lives in Twitch's own creator dashboard. So this app builds its own history by polling your live viewer count once a minute while you're streaming and the app is open. That means retention-by-game and the day×hour heatmap start empty and fill in after your first few streams. Streams from before you installed the app show aggregate stats only.

**YouTube's Analytics API has no hour-of-day dimension** for channel reports, so YouTube timing insight is day-of-week only. Without the optional sign-in, that day-of-week score is estimated from average views per upload; with it, it uses your real trailing-90-day watch history.

**Twitch subscriber counts** aren't shown — they'd require a broadcaster sign-in, which the app deliberately avoids. Follower growth is tracked instead.

## Install

Download the `.dmg` from the [Releases page](../../releases) and drag the app to Applications.

This build isn't notarized (that needs a paid Apple Developer account), so macOS may refuse to open it. On macOS 15+ the old right-click → Open trick no longer works and you may see **"the app is damaged"** — that's Gatekeeper being strict about un-notarized software, not actual corruption. To clear it:

```bash
xattr -cr "/Applications/Creator Growth Dashboard.app"
```

Then open it normally. Building from source (below) avoids this entirely, since locally-built apps are never quarantined.

## Development

```bash
git clone https://github.com/pilot-dk/creator-growth-dashboard.git
cd creator-growth-dashboard
npm install
cp .env.example .env   # add your keys
npm run dev
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for build/release details.

## Tech stack

Electron + React + TypeScript, built with [electron-vite](https://electron-vite.org/), packaged with [electron-builder](https://www.electron.build/). Charts via [Recharts](https://recharts.org/).

## License

[MIT](./LICENSE)
