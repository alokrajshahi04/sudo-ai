# Local development

Updated 2026-10-10. The frontend is connected to a real local Node API. Public
hosting and browser key entry remain disabled. Target deployments, automatic
code previews, and automatic capture are outside the current scope. This is a local development application, not a completed
hosted service.

## Start

Requires Node.js 22, npm, and FFmpeg/ffprobe for media operations.

```bash
npm install
cp .env.example .env  # only if you do not already have .env
npm run dev
```

Frontend: http://localhost:5173. The Node API binds to `127.0.0.1:3001`; Vite
proxies `/api`. Both run under one dev command. `npm run build` type-checks
frontend/backend/shared types and builds the frontend. `npm start` serves the
built frontend and API locally on port 3001. `npm test` runs bounded-controller,
network-policy, schema, ownership, and actual FFmpeg integration checks.

Both services bind to loopback. Do not expose them publicly through a tunnel;
public credential/worker-isolation gates have not been completed.

## Configuration

Set keys in `.env` on your machine, then restart `npm run dev`. Never paste them
in the command bar or commit them. `.env` is ignored; `.env.example` is placeholders.
The browser displays configuration availability, never keys. Configured means
values exist, not that account access has passed a provider request.

| Variables | Use |
| --- | --- |
| `GITHUB_TOKEN` | Optional server-side GitHub access to improve public API rate limits. Use a read-only token and do not enable private-repo workflows. |
| `GOOGLE_API_KEY`, `GOOGLE_MODEL` | Native Gemini API text generation with Gemma. Default documented ID: `gemma-4-31b-it`; actual access/quota is checked on use. |
| `NEBIUS_API_KEY`, `NEBIUS_MODEL` | Nebius Token Factory inference. Copy the exact model ID from your account catalog; GLM-5.3-Flash availability is not assumed. |
| `CUSTOM_MODEL_BASE_URL`, `CUSTOM_MODEL_API_KEY`, `CUSTOM_MODEL_ID` | Locally configured OpenAI-compatible API, including a local endpoint. Base URL excludes `/chat/completions`; requires a key value even for a local server expecting a placeholder. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Optional reviewed narration using the configured existing voice. No voice cloning. |
| `PORT` | Local API port, default 3001. Keep default for the existing Vite proxy. |

No deployment provider or token is used. Sudo Launch prepares marketing and a
developer-owned publishing checklist. Keys remain in the local process environment
until it exits. Cloud APIs receive relevant submitted source/narration inputs.
Redaction catches common secret patterns; it cannot guarantee arbitrary public
source cannot contain a secret.

## Product marketing workflow

1. **Discover:** scan a public GitHub username or paste a direct repo. Discovery
   looks at up to 100 recent public owned repos and shortlists up to 30 non-fork,
   non-archived, non-empty candidates with metadata-based reasons. The owner
   chooses a project and supplies audience/goal; no automatic batch spending.
2. **Understand:** read metadata, pinned commit/tree, and at most ten bounded
   README/manifest/entry files. No repository scripts execute. Vite, Next.js,
   Python tools, libraries, workspaces, documentation, and unknown profiles are
   all eligible for marketing; incomplete coverage stays visible.
3. **Position:** collect bounded GitHub search results and up to three supplied
   public pages; select an explicitly configured model and generate two angles,
   each with its own LinkedIn/X drafts and narration. Validate schema/evidence.
   Current research is not yet Agent-Reach/social search.
4. **Launch plan:** review sharing channels, timing, and the release checklist.
   Developer handles publishing/distribution; no Vercel/DigitalOcean integration.
   Optional existing-URL HTTP check does not establish feature behavior.
5. **Demo:** upload MP4/WebM footage, 3–120s and ≤30 MB. FFprobe validates; optional
   approved ElevenLabs narration and fixed FFmpeg render produce up to 30s of
   landscape MP4. Silent output works. Caption overlays are pending. No automatic
   code preview or capture; owner footage keeps that provenance.
6. **Pack:** review/copy posts, download media and the actual-execution receipt.
   Sharing happens manually. Unknown features/launch status remain explicit.

Missing model keys do not block source reading, strategy, or media rendering.
Missing FFmpeg disables media operations. Sample walkthroughs cover three invented
project types and never substitute for failed real stages. Jobs are session-owned
and in memory, not stored in browser localStorage.

## API and ownership

| Endpoint | Purpose |
| --- | --- |
| `GET /api/capabilities` | Configuration booleans/model IDs and implemented capability limits. |
| `POST /api/discover` | Scan bounded public GitHub profile metadata. |
| `GET/POST /api/jobs` | List owned jobs / create and inspect. |
| `GET/DELETE /api/jobs/:id` | Read / delete owned idle job and media. |
| `POST /api/jobs/:id/inspect` | Reinspect immutable source and invalidate stale outcomes. |
| `POST /api/jobs/:id/research` | Query plus up to three public links. |
| `POST /api/jobs/:id/position` | Selected model generation, schema-validated. |
| `POST /api/jobs/:id/angle` | Choose angle; invalidate dependent voice/video on change. |
| `POST /api/jobs/:id/strategy` | Selected-angle channel/release marketing checklist. |
| `POST /api/jobs/:id/verify` | Public HTTPS reachability/title check. |
| `POST /api/jobs/:id/recording` | Raw MP4/WebM upload and validation. |
| `POST /api/jobs/:id/narrate` | Reviewed text with `approved: true`; optional ElevenLabs call. |
| `POST /api/jobs/:id/render` | Fixed FFmpeg pipeline with optional voice. |
| `GET /api/jobs/:id/assets/:type` | Owned recording/audio/video bytes. |
| `GET /api/jobs/:id/receipt` | JSON actual-execution receipt. |

Jobs/media are in memory for up to one hour, cleared on restart or explicit
job deletion. The frontend restores the latest session-owned job on refresh.
Cookies are HttpOnly and SameSite Strict. Mutations require the local app's
Origin. Each job/receipt/asset enforces session ownership. Bounds: five jobs per
session, 30 jobs total, three concurrent operations, 200 MB retained media, and
30 mutations/minute/session. These are local resource controls, not production
multi-tenant security claims.

Public page checks allow only HTTPS/443, validate all resolved addresses, pin
DNS to a validated address while preserving TLS hostname verification, and
revalidate redirects. Private/reserved IPv4/IPv6 destinations are blocked. No
browser/subresource execution occurs in these checks. There is no automatic browser capture or preview feature.

FFmpeg runs locally with fixed arguments, no shell, capped duration, restricted
input containers/protocols, and disposable temporary files. It is not an isolated
hosted worker; do not accept arbitrary public uploads until sandboxing is built.

## Current verification

`npm test` includes cross-session job/receipt/asset denial, mutation Origin denial,
missing-provider failure, source revision/provenance, public IP policy, invalid
model evidence/actions, actual recording/render, and honest receipt statuses.
Source fixture/API checks cover Vite, Next.js, Python CLI, README-first prototype,
workspace, and library. Profile filtering/ranking is tested independently.

Fixtures are not PokeChess code. Earlier PokeChess checks were one real smoke test;
that repo is not hardcoded in production or the walkthrough. Paid model/voice
success requires credentials and is not implied by the fixtures.


Current verification after the marketing update: production build and 13 automated
tests passed; real profile discovery returned 23 eligible projects from the
participant's public account. A real Tolti Next.js repository passed source
inspection and launch-strategy preparation. Desktop/mobile browser checks passed
all five tabs with internal content scrolling and persistent navigation/input.
No live model/voice success is claimed without credentials.
