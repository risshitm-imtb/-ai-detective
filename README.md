# AI Detective by Lang Net

An interactive, team-based AI investigation platform combining bold **arcade aesthetics** with futuristic **glassmorphism**. Presented by **LANG NET**.

> **Tagline:** "Question everything. Verify the evidence. Outsmart the algorithm."
> **Club Motto:** "Use LLMs and engineer prompts effectively."

---

## Architecture Overview

- **Frontend:** React 18 + Vite SPA, arcade-meets-glassmorphism design system (`Space Grotesk`, `DM Mono`, `Manrope`).
- **Participant Access:** 3-field team registration (`Team Name`, `Team Lead Name`, `USN`). No participant password or email required. Session is protected by high-entropy, opaque server-issued `HttpOnly`, `SameSite` cookies with duplicate USN constraints.
- **Organizer Auth & Control:** Supabase Auth for authorized organizers (`is_organizer` checked server-side). Full Command Center controlling event lifecycle, pause/resume, early close, finalization, submission reviews, and audited score adjustments.
- **Backend & Database:** Remote Supabase PostgreSQL instance with versioned migrations (`202610210001`, `202610210002`, `202610220001`), atomic state transitions, row-level security (RLS), isolated answer keys in `challenge_keys`, and immutable audit logs.
- **Participant API:** Serverless route (`api/participant/[action].js`) running in Vite dev middleware and Vercel serverless runtime.

---

## 4 Investigation Rounds

| Stage | Round Title | Duration | Max Points | Investigative Focus |
|---|---|---|---|---|
| **01** | **Human or Machine?** | 10 mins | 20 pts | LLM stylometrics, perplexity, hedging, AI authorship classification |
| **02** | **Fake or Fact?** | 12 mins | 25 pts | Fact-checking, hallucination detection, primary source verification |
| **03** | **Deepfake Detective** | 13 mins | 25 pts | Multimodal analysis, C2PA cryptographic provenance, physical lighting/ELA |
| **04** | **The Final Investigation** | 15 mins | 30 pts | Multi-part case workspace, evidence board, timeline, relationship map, telemetry chart, 10-field report |

---

## Local Development & Setup

### Prerequisites
- Node.js 20 LTS or newer
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Ensure `.env.local` contains your Supabase credentials:
```ini
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-public-anon-key>
# Server-only: never prefix with VITE_ and never commit this value
SUPABASE_SERVICE_ROLE_KEY=<your-server-service-role-key>
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173` (or the port Vite reports).

---

## Organizer Account & Verification Scripts

### Provision Organizer Account
```bash
node scripts/setup-organizer.js admin@langnet.ai LangNetDetective2026!
```
This script provisions the organizer account in Supabase Auth and adds them to `public.organizers`.

### Seed Challenge Packs
```bash
node scripts/seed-challenges.js
```
Populates verified challenges for all 4 rounds with complete answer keys, explanations, provenance, and rubrics.

### Run Verification Test Suite
```bash
node scripts/test-full-integration.js
```
Runs the full 8-point end-to-end integration test (registration, duplicate rejection, cookie persistence, organizer auth, admin event state, and round challenge verification).

---

## Production Build & Vercel Deployment

### Build Locally
```bash
npm run build
npm run preview
```

### Deploying to Vercel
1. Link repository to Vercel:
   ```bash
   vercel
   ```
2. Configure Environment Variables in the Vercel Project Settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (Server-only, do not check "Expose to browser")
3. Deploy to production:
   ```bash
   vercel --prod
   ```
4. Vercel automatically routes `/api/participant/...` to `api/participant/[action].js` with SPA rewrites configured in `vercel.json`.
