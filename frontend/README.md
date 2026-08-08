# Rakshika Frontend

This is the custom frontend for the **Rakshika** voice agent (Voice for Bharat 10-day challenge).

## Tech Stack
- Next.js (App Router, TypeScript)
- Tailwind CSS v4 (@theme inline tokens)
- framer-motion
- @livekit/components-react

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure environment variables:
   Copy `.env.local.example` to `.env.local` and add your LiveKit credentials:
   ```bash
   LIVEKIT_API_KEY=your_key
   LIVEKIT_API_SECRET=your_secret
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-url.livekit.cloud
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

## Wiring to the Voice Agent
The frontend fetches a token from `GET /api/token`. 
When the user connects, LiveKit dispatches the agent worker if `AGENT_NAME` is set, or the worker simply listens for new rooms being created on this project.
