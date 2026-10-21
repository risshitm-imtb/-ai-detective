# Lang Net: AI Detective — Prototype 0.2

A responsive React + Vite frontend prototype for Lang Net's four-round AI literacy competition.

## Requirements
- Node.js 20 LTS recommended
- npm

## Run locally (Windows PowerShell)
From this folder, run:

```powershell
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://localhost:5173/`.

## Build check

```powershell
npm run build
```

## What's in this prototype
- Futuristic dark glass / neon visual direction
- Team registration screen
- Four challenge modes: Human or Machine, Fake or Fact, Deepfake Detective, Final Investigation
- Round countdowns in the browser demo
- Answer submission, explanations and a local results summary
- Responsive layout for phones and laptops

## Important limitations before a real event
This remains a frontend-only demo. Team details, answers, countdown state and scores are local to one browser. It does **not** yet have a shared database, secure answer keys, an organiser console, cross-device synchronisation, or a genuinely live leaderboard. The timer is a UI prototype, not an authoritative server timer.

Before using this for a scored event, add a backend (e.g. Supabase), server-side round state and scoring, an organiser control panel, and tested challenge packs with documented provenance. Do not score authorship or deepfake judgements from style/appearance alone.
