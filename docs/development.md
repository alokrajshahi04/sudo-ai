# Local development

Sudo Launch is a repo-first product marketing app: source review → confirmed brief → two launch stories → downloadable pack. This build runs on localhost; public hosting and browser credential entry are not enabled.

## Start

Requires Node.js 22 and npm. Install FFmpeg/ffprobe for media and Chromium for the source-card promo renderer.

```bash
npm install
cp .env.example .env  # only if .env does not already exist
npm run setup:browser
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the loopback Node API on port 3001. `npm run build` checks TypeScript and builds the frontend; `npm start` serves the built UI and API locally. An existing Chromium can be selected with `PLAYWRIGHT_CHROMIUM_PATH`.

## Credentials and GitHub

Set keys in ignored `.env`, then restart the API. Keys never belong in the command bar, browser storage, or commits. Configuration availability is not proof of account access.

| Variables | Use |
| --- | --- |
| `GOOGLE_API_KEY`, `GOOGLE_MODEL` | Google AI Studio inference. Default `gemma-4-26b-a4b-it`, chosen after faster live responses than `gemma-4-31b-it`; either exact ID can be configured. |
| `NEBIUS_API_KEY`, `NEBIUS_MODEL` | Exact model ID from your Nebius catalog; the requested GLM model's availability/license are not assumed. |
| `CUSTOM_MODEL_BASE_URL`, `CUSTOM_MODEL_API_KEY`, `CUSTOM_MODEL_ID` | Locally configured compatible chat-completions endpoint. Base excludes `/chat/completions`; even a local server needs a placeholder key value. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | OAuth app, callback `http://localhost:5173/api/auth/github/callback`. Use that origin for sign-in, or register the exact origin you run. Setup tasks are in [todo.md](../todo.md). |
| `GITHUB_TOKEN` | Optional fine-grained token with read-only Contents/Metadata on selected repos. Explicitly connect it in Settings; it is never applied automatically to other sessions. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Reviewed narration with an existing voice; music uses the same key and separate API permissions/quota. No voice cloning. |
| `PLAYWRIGHT_CHROMIUM_PATH` | Optional existing Chromium executable. |
| `PORT` | API port, default 3001; keep this for the existing Vite proxy. |

OAuth uses GitHub's broad `repo` scope, including write permission, although this app only reads. Prefer a selected-repo read-only token locally; a GitHub App is the future hosted approach. Tokens remain in server memory, belong to one session, and are removed on disconnect/expiry/restart. Disconnect also clears already-inspected private jobs. OAuth state, PKCE S256, and a callback-only HttpOnly SameSite Lax nonce bind the callback to the original Strict session.

Public profile discovery reads up to 100 recent public owned repos. Connected discovery reads up to 100 accessible public/private repos. Each shortlists up to 30 non-fork, non-archived, non-empty projects. Ranking explains metadata signals; it is not a product-quality score.

## Workflow

1. Paste a repository or choose one from discovery. Selected private files require explicit approval for source reading and model transfer. No code is executed.
2. Read an immutable commit/tree and up to 12 bounded README/manifest/entry files. Secret-file paths are excluded and common tokens are redacted. Coverage remains partial.
3. Review deterministic source-readiness tasks and a copyable coding-agent handoff. Findings are not runtime certification; the coding agent must confirm them before fixing anything.
4. The chosen model suggests a product summary, audience, goal, context and assumptions. These do **not** become a confirmed brief automatically. Edit and confirm them. Without a configured model, source review and manual brief entry still work.
5. Generate two stories with evidence IDs, LinkedIn/X drafts and narration. Optional bounded GitHub/link research runs first and stops the sequence on failure. Private projects default to research disabled; queries are public and must not contain private details. Agent-Reach/social search is pending.
6. Choose a story, prepare the sharing plan and download the Markdown kit/JSON receipt. Review and publish yourself.
7. Optionally review a 25-second storyboard, generate approved ElevenLabs voice/music, then render source cards or uploaded footage (MP4/WebM, 3–120s, ≤30 MB). Download MP4 and PNG poster. Narration longer than the storyboard is rejected with a shorten-script instruction, rather than silently cut.

The renderer adapts [Brag](https://github.com/latent-spaces/brag)'s inspect/plan/compose/deliver structure, scene timing, readable holds and source provenance. It uses Chromium + FFmpeg, **not upstream Hyperframes**. A Markdown storyboard handoff is exported for the upstream Brag skill. No upstream bundled music/SFX are included; see [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Source-card videos do not demonstrate working product interactions.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/capabilities` | Model IDs/configuration, media availability, GitHub connection status; never keys. |
| `POST /api/auth/github/start`, `GET /api/auth/github/callback` | Stateful PKCE OAuth sign-in. |
| `POST /api/auth/github/local`, `/disconnect` | Explicit local-token connection / disconnect and private-source cleanup. |
| `GET /api/auth/github/status` | Session connection status. |
| `POST /api/discover`, `/api/discover/connected` | Public profile / connected private-inclusive shortlist. |
| `GET/POST /api/jobs` | Owned list / create with repository, model and optional private consent. Legacy briefs still accepted. |
| `GET/DELETE /api/jobs/:id` | Read/delete owned idle job and media. |
| `POST /api/jobs/:id/inspect`, `/analyze`, `/brief` | Refresh source, request model suggestions, confirm/edit structured brief. |
| `POST /api/jobs/:id/research`, `/position`, `/angle`, `/strategy` | Research, two stories, story selection, sharing plan. |
| `POST /api/jobs/:id/verify` | Optional public HTTPS reachability/title; no feature verification. |
| `POST /api/jobs/:id/recording`, `/narrate`, `/music` | Validated upload / explicitly approved paid audio. |
| `POST /api/jobs/:id/storyboard`, `/promo` | Reviewable storyboard / bounded 25s composition. |
| `GET /api/jobs/:id/brag` | Upstream Brag handoff Markdown. |
| `POST /api/jobs/:id/render` | Recording-only render, up to 30s, optional voice. |
| `GET /api/jobs/:id/assets/:type`, `/receipt` | Owned media / actual-execution receipt. |

## Local boundaries

Jobs/media expire after one hour and disappear on restart/deletion. Five jobs/session, 30 jobs total, three concurrent operations, 200 MB retained media, 30 mutations/minute/session. The UI resumes owned jobs after refresh; only the first-visit hint flag uses localStorage.

Host/Origin checks and HttpOnly Strict cookies protect local requests. Public page checks enforce HTTPS/443, reject private/reserved IPs, pin validated DNS and revalidate redirects. Source/pages/model output are untrusted data and cannot authorize tools. Model JSON/evidence validation permits one targeted repair, then fails visibly with no provider fallback.

The composition browser renders only escaped, app-generated SVG, denies scripts/network requests, and never opens the input project. FFmpeg uses fixed arguments, no shell, format/protocol limits and disposable files. These are local safeguards, not isolated public workers. Hosted BYOK still needs the security work in [security](hacktoberfest/deployment-and-security.md); do not expose this local build as a public credential service.

## Verification

`npm test` covers six source categories, ownership, origin policy, private-source consent and secret-file exclusion, OAuth state/nonce/PKCE and callback session restoration, bounded model schemas, SSRF policy, source-readiness handoffs, and real media rendering. Promo tests skip only when FFmpeg/Chromium are unavailable. Set `PLAYWRIGHT_CHROMIUM_PATH` for an existing browser.

`npm run test:ui` checks repo-first suggestion/confirmation, onboarding/shortcuts, two generic profile-to-pack flows, missing setup, errors/retries, correction/resume, export content, readiness handoff and storyboard/audio gates at 1440×900, 1280×720 and 390×844. Screenshots/traces are ignored under `test-results/`. Browser fixtures verify UX, not live inference.

Live checks on 2026-10-10: both Gemma 4 variants responded; the 26B A4B model produced a Tolti summary and valid two-story pack that described its starter/prototype status. ElevenLabs TTS and 25s instrumental music returned real audio; these were mixed into a verified 25s 1280×720 MP4 and PNG poster. OAuth uses controlled integration responses until the participant creates the OAuth app; Nebius remains unconfigured.

Public discovery was also verified through the live browser for `alokrajshahi04` (23 eligible projects, no JavaScript errors). API-outage recovery is covered at all three viewport sizes.
