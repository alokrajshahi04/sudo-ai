# Sudo Launch — product marketing PRD

Status: current requirements after mentor feedback, 2026-10-10. Supersedes the
repo-to-deployment specification preserved in checkpoint `dbd6d47`.

## Problem and promise

Developers build projects but struggle to explain who needs them, show their
value, and launch them publicly. Sudo Launch turns public or consented private GitHub source and a
confirmed owner brief into an audience-specific, researched, reviewable launch pack.

Primary user: student/solo developer. Success: a useful project-specific angle,
accurate drafts, a real usage demo when supplied, and a receipt tracing inputs and
actual generation. We do not promise market fit, uniqueness, traction, or judging
outcomes.

## Scope and boundaries

Logical workflow: Discover → Understand → Position → Launch plan → optional Demo → Launch pack.
Guided UI: Project brief → Launch story → Launch pack. Research feeds the story
step; strategy and optional media belong in the pack.

Any accessible root repo can enter, including apps, Python tools, libraries, workspaces,
documentation, and prototypes. Bounded inspection can be incomplete; describe
coverage rather than promise universal understanding. Deployment compatibility is not a source-inspection gate. Web apps require a reachable public URL or an explicit prototype launch before generating stories; CLI/library/docs can launch from source.

No target deployment integrations, cloud-token collection, automatic execution of repository code/issue previews, input backend orchestration, source repair, or social publishing. The
product's own Node API handles source/model/voice operations. CLI/MCP is later.

## Requirements and acceptance

| Requirement | Acceptance |
| --- | --- |
| Profile discovery | Valid username returns bounded public metadata, exclusions, ranking reasons, and scope. Connected discovery includes private repos; the owner selects one before analysis. |
| Repository entry | Direct repository URL works independently of profile discovery or a specific owner's account. |
| Owner brief | Model-suggested audience/goal/context and assumptions need explicit owner confirmation; manual entry is supported. Owned brief edits preserve source and invalidate dependent generated outputs only when changed. |
| Source understanding | Commit-pinned README/manifests/entry files, typed evidence, no install/build execution. Missing deployment setup does not block marketing. |
| Category coverage | Fixture-backed API runs accept Vite, Next.js, Python CLI, library, README-first prototype, and workspace. Unknown profile remains visible. |
| Positioning | Selected model returns two schema-valid angles, each with its own audience, rationale, evidence IDs, posts, and narration. Unknown evidence/action fields are rejected. |
| Research | Up to three relevant GitHub results plus three public supplied pages; sources/dates and query coverage retained. No results means uncertainty. |
| Launch strategy | Audience/angle informs reviewed channel purposes, sharing timing, and a release checklist. Publishing remains developer-owned. |
| Readiness | Deterministic and source-quoted AI findings, recommendations and a coding-agent prompt; explicit acknowledgement before positioning. No runtime certification or source edits. |
| GitHub access | State + PKCE + callback nonce; private source needs consent and a session-specific token. Disconnect clears tokens/private jobs. |
| Demo assets | Approved public URL capture with exact-label clicks/scrolls, uploaded footage or PNG/JPEG; reviewed 25s storyboard, portrait/landscape, ElevenLabs aligned narration/captions and optional music; Chromium + FFmpeg MP4/poster/SRT. |
| Calendar | Future-dated ICS reminders with reviewed posts; no automatic publication. |
| Pack | Selected-angle drafts, generated assets, and actual-execution receipt downloadable. Model preference is distinct from actual use. |
| Workspace | Three guided steps, one document scroll area, visible next actions, optional command panel; desktop/mobile/zoom checks pass. |
| Secrets/ownership | No browser keys; owned jobs/assets; Origin checks; bounded public URL access; no secrets in prompts/exports. Hosted release needs additional security gates. |

## Input and output

Input: public profile or connected repositories, repo URL, confirmed audience/launch goal, explicit
model preference, optional supplied research pages, existing public URL, and usage
recording. No cloud deployment token.

Output: product/evidence brief, sources/limitations, two positioning angles,
LinkedIn/X drafts, launch strategy, narration and video when generated, and JSON
receipt. Automated public posting and mass generation across a profile are absent.

## Runtime and reliability

Node controller owns immutable profiles, evidence IDs, stage states, and fixed
handlers. Model outputs are data; no generated shell, code, deployment, or
publishing actions execute. Validate schema/IDs; one repair attempt; no silent
provider fallback. Record actual provider/model on success.

Per-stage states: idle/running/completed/failed. Preserve valid earlier results;
source revision, selected angle, or new evidence invalidates dependent content
and media. One operation/job, three concurrent operations total. Public research
is untrusted input. Failures show sanitized messages and bounded retries.

Local jobs expire after one hour or backend restart. Five jobs/session, 30 total,
200 MB retained media, 30 mutations/minute/session. These are local safeguards,
not a hosted multi-tenant release claim.

## Architecture and integrations

React/TypeScript/Vite UI → local Node/Express controller → GitHub source/discovery,
Google Gemma or Nebius/custom model, public research access, optional ElevenLabs,
and local Chromium/FFmpeg. Session-owned jobs/evidence/media remain in memory.

The app may later be hosted on Render or DigitalOcean if suitable; that is hosting
Sudo Launch itself, not integrating deployments of users' products. Sponsor credit
and account eligibility remain separate from scope decisions.

## Priorities

P0: broad source/discovery, clear onboarding, structured positioning/copy, launch
strategy, evidence receipt, workspace fit. P1: stronger Agent-Reach research,
reviewed voice/video polish, secure hosted BYOK. Later: CLI/MCP and more asset types.

Repo-first analysis, readiness handoff, OAuth/private access, local model adapters,
launch strategy, storyboard/audio/promo rendering and receipts are implemented.
Gemma analysis/positioning and ElevenLabs voice/music passed live checks. OAuth app registration is a deferred account task. Nebius GLM is configured with schema-constrained citations/quotes; Agent-Reach is pending. Do not report an unconfigured integration
as working because a button or mock exists.

## Demonstration and checks

Use several source fixtures in automation and multiple real public projects in
manual checks. PokeChess is optional demonstration input. A mentor's new repo
must travel through the same URL/profile flow and expose its actual profile,
source coverage, warnings, and outputs.

Validate profile filtering, category-specific source files, explicit web/demo/prototype gate,
malicious embedded instructions/schema fields, absent research, model failure,
owner isolation, public IP rules, real media render, and honest receipts. Browser
checks include internal stage scrolling, persistent navigation, command palette,
project selection, and narrow-screen layout. Paid live calls require configured
credentials; fixture checks do not imply verified model account access.

See [overview](ideation.md), [model instructions](model-harness.md),
[UI/UX](ui-ux.md), [security](deployment-and-security.md), and
[development/setup](../development.md).
