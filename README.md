# Indie Radar

Find the newest and most-anticipated **indie games on Steam** and see which ones have **Roblox potential**.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

This starts the Steam API server (port 3001) and the React app, then opens http://localhost:3000.

To run everything as a single app on one port instead: `npm run serve`, then open http://localhost:3001.

## What it shows

| Tab | Source on Steam | Why it matters |
| --- | --- | --- |
| **Most-wanted upcoming** | Popular upcoming indie games (wishlists/follows) | Find hype *before* a game launches |
| **Hot new releases** | Popular new indie games from the last 60 days | Proven demand; ranked by reviews per day |
| **Newest releases** | Every indie game, newest first | See things first (noisy) |
| **Releasing soonest** | Indie games launching next | Time a Roblox game to a launch |
| **★ Saved** | Games you saved, with notes | Your shortlist (stored in your browser) |

Each game gets a **Roblox fit score (0–100)**, worked out from its Steam tags. Co-op, multiplayer, horror, survival, simulator/tycoon, idle, obby-style platforming, physics/funny and tower defense count up. Visual novels, story-heavy, turn-based, 2D-only and adult content count down. Each card also suggests a Roblox format, for example "Tycoon: earn → upgrade → rebirth".

**Sort → Fit × hype** brings games that are both Roblox-friendly and getting attention to the top.

## How it works

- `server/steam.js` fetches Steam's public store search, tag list and app details, parses them, and scores each game.
- `server/index.js` is a small Node server with no dependencies. It caches results for 15 minutes, because browsers can't call Steam directly (CORS).
- `src/` holds the React UI.

Tests: `npm run test:server` (parser and scoring) and `npm test` (UI).

> Use these games as inspiration for genres and mechanics, not as copies. Roblox removes experiences that reuse another game's name, characters, art or music after a DMCA report.
