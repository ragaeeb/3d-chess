# 3D Chess

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/0df08abe-0892-405c-901d-684ff8cb7af1.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/0df08abe-0892-405c-901d-684ff8cb7af1)
[![codecov](https://codecov.io/gh/ragaeeb/3d-chess/graph/badge.svg?token=5DKNZ728JV)](https://codecov.io/gh/ragaeeb/3d-chess)
[![Netlify Status](https://api.netlify.com/api/v1/badges/3ce1cbce-bc5f-4f5b-b0af-4b24bb30b4de/deploy-status)](https://app.netlify.com/projects/chessie/deploys)

An immersive multiplayer 3D chess experience built with Next.js 16 and Bun. The project now relies on serverless Netlify Functions powered by Pusher Channels for real-time multiplayer rather than a traditional long-running server.

## Tech Stack

- **Next.js 16** (App Router) for pages and UI composition.
- **React 19** for UI composition.
- **Three.js** and **@react-three/fiber** for the interactive 3D board.
- **Pusher Channels** for realtime move broadcasting across serverless functions.
- **Netlify Functions** for server-side move validation and matchmaking.
- **Tailwind CSS 4** for utility-first styling.
- **Bun** for dependency management and scripts.
- **Biome** for linting and formatting.
- **chess.js** powering chess move validation on both client and server.

## Repository Structure

- `app/` – Next.js routes and client-side UI.
- `src/` – Shared React components, utilities, and types.
- `netlify/functions/` – Serverless functions for Pusher authentication and move validation.
- `public/` – Static assets served by Next.js.
- `tailwind.config.ts` – Tailwind CSS configuration targeting v4.
- `postcss.config.js` – PostCSS pipeline using `@tailwindcss/postcss`.
- `frontend/` & `server/` – Legacy packages retained only for their lockfiles' node_modules caches; they are not part of the active application.

## Getting Started

1. Install dependencies with [Bun](https://bun.sh):

   ```bash
   bun install
   ```

2. Copy `.env.example` to `.env.local` (see the environment variables section below) and fill in your Pusher credentials.

3. Run the standard Next.js development server:

   ```bash
   bun run dev
   ```

   The app now exposes the Netlify handlers under `/.netlify/functions/*` even in `next dev`, so realtime matchmaking and moves work at [http://localhost:3000](http://localhost:3000).

4. (Optional) Start the Netlify dev server for a full parity test, including Netlify's local Functions emulator:

   ```bash
   netlify dev
   ```

   This command proxies the same `/.netlify/functions/*` endpoints through Netlify's simulator and serves the app on port `8888`.

5. Open `/game` in two browser windows to verify realtime play locally.

## Environment Variables

Create a `.env.local` file (or configure environment variables in Netlify) with the following keys:

| Variable | Description |
| --- | --- |
| `PUSHER_APP_ID` | Pusher Channels App ID used by Netlify Functions. |
| `PUSHER_KEY` | Pusher Channels key used by Netlify Functions. |
| `PUSHER_SECRET` | Pusher Channels secret used by Netlify Functions. |
| `PUSHER_CLUSTER` | Cluster slug for the Pusher app (e.g. `mt1`). |
| `NEXT_PUBLIC_PUSHER_KEY` | The same key exposed to the browser to create the Pusher client. |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Cluster slug mirrored to the browser environment. |

For local development the quickest path is to copy `.env.example` to `.env.local`, fill in the values from your Pusher dashboard, and run `netlify dev` so the functions have access to the same variables.

## Quality Checks

- `bun run lint` – run Biome static analysis and formatting checks.
- `bun run build` – create a production build using the Next.js compiler.

## Coding Conventions

- TypeScript targets **ESNext** modules with strict type checking enabled.
- Use Biome formatting (`bun run lint --apply`) to maintain consistent style.
- Prefer type-only imports when values are not required at runtime.
- Client components should explicitly declare `"use client"` when accessing browser-only APIs.
- Use Tailwind CSS utilities for component-level styling and CSS variables in `app/globals.css` for shared tokens.

## Multiplayer Flow

Players join a queue by calling the Netlify `/.netlify/functions/move` endpoint with `action: "queue"`. The function performs lightweight matchmaking, initialises a canonical chess.js state, and broadcasts the pairing through a private Pusher channel. Clients submit moves with `action: "move"`, the server validates them against the canonical board, and publishes updates to the corresponding `private-game-{id}` channel. Presence channels (`presence-game-{id}`) keep track of online players so the UI can surface disconnects immediately—no polling required.

# Acknowledgements

Credit goes to Faisal Husa for the original implementation of [3d-chess](https://github.com/faisal004/3d-chess) based on R3F and WebSockets.