# 3D Chess

An immersive multiplayer 3D chess experience built with Next.js 16 and Bun. The project combines the frontend and backend into a single Next.js application that streams real-time updates through Server-Sent Events.

## Getting Started

1. Install dependencies with [Bun](https://bun.sh):

   ```bash
   bun install
   ```

2. Run the development server:

   ```bash
   bun run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view the app. The `/game` route launches the multiplayer 3D chess board.

## Available Scripts

- `bun run dev` – start the development server.
- `bun run build` – create a production build.
- `bun run start` – run the production server.
- `bun run lint` – run ESLint checks.

## Technology Highlights

- **Next.js 16** with the App Router for pages and API routes.
- **Bun** as the package manager and runtime for scripts.
- **Server-Sent Events (SSE)** used for multiplayer game synchronization instead of WebSockets.
- **Three.js** and **@react-three/fiber** rendering the interactive 3D chess board.
- **Tailwind CSS** for styling.
