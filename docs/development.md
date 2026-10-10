# Local development

Updated 2026-10-10. The frontend is connected to a real local Node API. Public
hosting, browser key entry, automated cloud deployment, and automatic browser
capture remain disabled. This is a local development application, not a completed
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

No Vercel or DigitalOcean token is needed: current deployment uses a reviewed
plan and official provider UI handoff. Keys remain in the local process environment
until it exits; there is no per-job saved-key vault. Cloud APIs receive relevant
submitted source/narration inputs. Source redaction catches common secret patterns;
it is not a guarantee that arbitrary public source cannot contain a secret.

## Real workflow

1. **Start a launch:** public root GitHub repo and audience brief. Inspection reads
   metadata, a pinned commit/tree, and at most ten bounded source files; no scripts
   run. Unsupported profiles have blockers. Reinspection invalidates affected
   plans/artifacts when the revision changes.
2. **Position:** bounded GitHub repository search and up to three user-supplied
   HTTPS research pages. Search coverage stays explicit; this is not yet
   Agent-Reach or logged-in social research. Generate two angles through the
   selected configured model; each angle includes its own posts and narration.
   Output schema/evidence IDs are validated, with one repair attempt.
3. **Deploy:** prepare Vercel or DigitalOcean static settings. Review/import on the
   provider website. Return an existing/new live URL for an HTTP check. HTTP
   status/title are actual checks; interactions and built revision remain unverified.
4. **Demo:** upload MP4/WebM footage, 3–120 seconds and at most 30 MB. FFprobe
   validates it. Review narration and approve an ElevenLabs request explicitly.
   Render a landscape MP4 with optional narration; silent output is available.
   Output is capped at 30 seconds. Caption overlays and automatic capture are
   pending, and user footage is labeled user-supplied rather than verified capture.
5. **Pack:** review/copy the selected angle's LinkedIn/X drafts, download media,
   and export the actual launch receipt. No social post is published automatically.

Missing model keys do not block inspection/plans/HTTP checks/recording renders.
Missing FFmpeg disables recording/rendering. No sample content substitutes for
failed real stages. The sample workspace remains separately labeled.

## API and ownership

| Endpoint | Purpose |
| --- | --- |
| `GET /api/capabilities` | Configuration booleans/model IDs and implemented capability limits. |
| `GET/POST /api/jobs` | List owned jobs / create and inspect. |
| `GET/DELETE /api/jobs/:id` | Read / delete owned idle job and media. |
| `POST /api/jobs/:id/inspect` | Reinspect immutable source and invalidate stale outcomes. |
| `POST /api/jobs/:id/research` | Query plus up to three public links. |
| `POST /api/jobs/:id/position` | Selected model generation, schema-validated. |
| `POST /api/jobs/:id/angle` | Choose angle; invalidate dependent voice/video on change. |
| `POST /api/jobs/:id/plan` | Source-based reviewed-provider handoff settings. |
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
browser/subresource execution occurs in these checks. Automatic browser capture
still requires an isolated public-egress worker.

FFmpeg runs locally with fixed arguments, no shell, capped duration, restricted
input containers/protocols, and disposable temporary files. It is not an isolated
hosted worker; do not accept arbitrary public uploads until sandboxing is built.

## Current verification

`npm test` includes cross-session job/receipt/asset denial, mutation origin denial,
missing-provider failure, source revision/provenance, public IP policy, invalid
model evidence/actions, actual recording validation/render, and truthful receipt
statuses. GitHub is fixture-backed in automated integration tests; a separate
real PokeChess browser run passed actual GitHub access, guided Vercel planning,
HTTP-200 public reachability, and receipt download.
Live model/ElevenLabs success requires credentials and is not implied by mocks.
