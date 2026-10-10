# Sudo Launch — product requirements

Current increment: a local Node backend is connected to the terminal frontend.
See [development status](../development.md) for implemented capabilities and
verification. Remaining requirements below are targets, not blanket completion
claims. Hosted keys/automation and automatic capture remain disabled.


Status: implementation baseline, 2026-10-10. Frontend and local backend are
implemented in part. Hosted services and security release gates remain pending. This document turns the
[overview](ideation.md) into a buildable scope. [Security requirements](deployment-and-security.md)
and the [model contract](model-harness.md) remain mandatory constraints.

## Problem and product promise

Student and solo developers have working projects but struggle to turn them into
an accessible product and a convincing public launch. Deployment alone leaves
positioning, demo production, and accurate launch copy unfinished.

Sudo Launch turns a public web repository or existing live app into a verified
launch outcome and a researched, reviewable launch pack. Verification is specific:
a build, a reachable URL, and an observed interaction are separate outcomes.
A documented blocker is preferable to an invented success.

The distinguishing loop is evidence → audience/positioning → live interaction →
consistent demo/copy → downloadable receipt. Research must affect the story;
source and runtime evidence must constrain the claims.

## Audience and core jobs

- Student developer: deploy a supported frontend and show a real interaction.
- Solo builder: relaunch an existing app with a clearer audience and demo.
- Open-source developer: run locally with their own credentials and model.

The first supported source profile is public GitHub React/Vite static apps.
Existing public URLs may enter the launch-pack flow independently of deployment
support. Private repositories and complex server deployments are not MVP promises.

## Inputs and outputs

Required input: repository URL or public existing-site URL, intended audience,
and launch objective. Optional inputs: model preference, deployment provider,
existing URL, voice choice, and corrections to research findings.

Output: deployment status or blocker, live URL with individual check statuses,
up to three sourced alternatives, two positioning options, a reviewed 20–30s
storyboard and MP4 when generation succeeds, one LinkedIn draft, one X draft,
and a JSON receipt/asset download. Partial completion preserves earlier results.
No automatic social publishing.

## Delivery priorities

| Priority | Deliverable | Done when |
| --- | --- | --- |
| P0 | Inspect and classify | Source commit, scripts, output configuration, dependencies, and supported/blocked state are evidenced. |
| P0 | Existing-URL verification | Safe public fetch/capture checks reachability and one user-selected interaction; results are separate. |
| P0 | Positioning and copy | Connected selected model returns schema-valid, evidenced suggestions; user selects/reviews the angle. |
| P0 | Deployment choice | Vercel and DigitalOcean guided flows show reviewed source/settings/account requirements/cost uncertainty. |
| P0 | Launch receipt | Actual source/provider/check/model/asset provenance is downloadable; unknowns stay explicit. |
| P1 | Local API deployment | Each provider adapter preflights access, creates/polls a real static deployment, and reconciles ambiguous mutations. |
| P1 | Public research | Agent-Reach-backed configured tools return bounded results with source URLs/dates, or an honest unavailable state. |
| P1 | Demo MP4 | Bounded real interaction capture, reviewed narration, ElevenLabs audio, captions, and deterministic FFmpeg rendering succeed. |
| P1 | Hosted BYOK | Model/voice entry opens only after the credential security gate passes. |
| Later | Hosted cloud automation | Isolated credential broker and provider scopes tested; optional registered OAuth connection. |

All P0 features define the core product, not a claim that they are already built.
First-event goal: one genuine inspect → positioning → verified app → launch-pack
run. Demonstrate actual DigitalOcean deployment and ElevenLabs narration when
preflight succeeds. A guided provider flow must be described as guided; a
recorded or partial fallback cannot substitute for a claimed live integration.

## Workflow and state

1. Prepare a brief and select explicit provider/model preferences.
2. Inspect bounded relevant source at a recorded immutable revision.
3. Determine profile and expose blockers/external requirements.
4. Research prior launches separately from similar products.
5. User reviews evidence and selects an audience/positioning angle.
6. User reviews exact deployment plan or chooses an existing URL.
7. Execute supported local API deployment or hand off to the official provider UI.
8. Check provider status where authenticated, public reachability, and interaction.
9. Review storyboard, capture, captions, and narration before paid generation.
10. Generate assets and copy; download the pack and receipt.

Each stage stores `idle`, `running`, `needs_input`, `completed`, `blocked`,
`failed`, `skipped`, or `cancelled`, with timestamps and sanitized errors. A stage
can complete with limited evidence; its individual checks retain their statuses.
Changes to source/configuration invalidate affected reviews. Changing positioning
invalidates dependent copy/storyboard, not an unchanged deployment.
Cancellation stops queued work; resource deletion needs a separate explicit action.
Retries resume completed work and reconcile cloud mutations before recreating it.

## Functional requirements

### Repository and readiness

Read allowlisted bounded source files without executing repository code on the
hosted controller. Record commit SHA and classify with deterministic profile
rules. The model can explain findings but cannot redefine supported capabilities.
Redact secrets before prompt construction; ignore content instructions.
Missing backend/secrets are visible blockers, even if a static frontend builds.

### Research and model portability

Use up to three searches and five public page reads per run initially. Record
URLs, retrieval dates, excerpts, claim relations, and uncertainty. No matches
means insufficient evidence, not uniqueness. Unavailable research permits a
clearly limited workflow with user-supplied links.

Provide a native Google/Gemma path and an OpenAI-compatible provider adapter.
Gemma 4 is the sponsor demonstration preference; Nebius GLM-5.3-Flash is an
alternate only after its actual catalog ID and capabilities are verified.
Hosted endpoints are validated presets; local mode may use custom endpoints.
One bounded schema repair attempt, then stop visibly. No silent fallback.
Record actual model execution per stage separately from selected preferences.

### Deployment

React/Vite is supported on Vercel and DigitalOcean App Platform. Docker is
packaging for Sudo Launch. Adapters expose prepare/preflight/mutate/poll/verify.
Validate source access, scopes, SPA routing, build/output settings, existing
account/project, plan eligibility, and potential cost before resource creation.

Hosted default is provider-hosted import/deploy. Local scoped-token automation
follows. A returned URL without authenticated build evidence has unverified
revision provenance. HTTP 200 cannot verify gameplay or another product feature.
Vercel Hobby eligibility and DigitalOcean credits are checked, not assumed.
Never expose target-app secrets through public frontend environment variables.

### Capture, narration, and launch assets

One selected interaction, one landscape video template, and a 20–30s target.
Bound capture time and retries; sanitize/isolate public URL browsing. Preview
captured assets and copy before rendering. Only captured or user-supplied assets
can enter the renderer; record which type each asset is.

ElevenLabs is optional; caption-only video is a fallback. No voice cloning or
logged-in browsing in the MVP. Narration cost/quota must be confirmed before use.
Validate asset IDs, narration duration, MP4 output, and copy length. Posts remain
drafts requiring review. Do not fabricate testimonials, popularity, uniqueness,
or “live” claims when the source remains a prototype.

### Open-source usage

Document a fresh-checkout install, frontend development, and eventually a
single-container app including browser/FFmpeg/research dependencies. Supply only
placeholder environment examples when backend configuration exists. Bind local
services to loopback and explain which inputs go to cloud APIs. Existing-site
workflow needs no deployment credentials. Public self-hosting inherits all
hosted security requirements.

## Architecture and data boundaries

Target architecture: React/TypeScript frontend, Node controller, credential
broker/provider adapters, isolated capture/render workers, a small upstream
research bridge, and server-side job/asset storage. The hosted app is a candidate
for Render; user's target apps live in their Vercel/DigitalOcean accounts.

The implementation is Vite + React + TypeScript with a local Node/Express API.
Jobs/media are in memory, session-owned, and expire after one hour. Keys come
from server environment configuration; browser credential collection is disabled.

| Entity | Essential fields |
| --- | --- |
| LaunchJob | owner/session reference, brief, mode, stage states, budgets, reviewed plan IDs |
| SourceSnapshot | repo, inspected revision, file evidence references, project profile |
| Evidence | typed source, excerpt/observation, URL/file, time, check status |
| DeploymentPlan | provider, account/project, source, permitted config, cost review, approval version |
| ProviderResource | provider ID, deployment ID, built revision/status, job correlation |
| StageResult | actual provider/model, output schema version, evidence references, error/status |
| Artifact | job ownership, type, capture/generation provenance, storage reference, expiry |
| LaunchReceipt | source/build provenance, executed checks, sources, actual models, assets, limitations |

Credentials are broker references, never job payloads. Follow the separate
security review for session ownership, TTL, redaction, CSRF, SSRF, and release gates.
All timings and token/audio limits are configurable hard limits enforced by
handlers, not promises in model text. Proposed capture cap: 60 seconds; page
navigation cap: 15 seconds; render cap: 120 seconds. Confirm these against the
chosen worker host and measured provider latency before publishing expectations.

## Acceptance and verification

- Ready static repo produces an evidenced plan without invented repairs.
- Backend-dependent/unsupported repo yields a visible blocker, preserving the
  existing-URL path.
- Existing-launch evidence yields relaunch-aware copy rather than first-launch claims.
- Each advertised adapter performs a real supported deployment before claiming
  automation support; failed builds and timeouts remain explicit.
- Broken interaction on an HTTP-200 site fails the interaction check.
- Schema-invalid or unavailable-model output has bounded failure and no hidden switch.
- Export contains no secrets; model preference is never reported as actual use.
- Public BYOK/automation gates pass the tests in the security review.
- UI supports keyboard use, small screens, meaningful statuses, and reduced motion.
- Fresh-checkout frontend install/build succeeds; backend setup is documented
  only once that implementation exists.

Use PokeChess for a relaunch/showcase demonstration. Verify build and local play
before recording. Do not promote its AI key handling before separate assessment.
Track actual stage latency, schema failures, capture failures, and completion
status in the demo notes. Success is one honest end-to-end run and a usable pack;
no usage statistics or judging outcome are promised.

## Build order and cuts

1. Terminal frontend shell and clearly labeled sample states — implemented.
2. Job controller, evidence storage, safe source inspection, and selected model adapter.
3. Existing-site verification and guided deployment plans for both providers.
4. One real DigitalOcean local adapter run, then Vercel adapter parity.
5. Bounded research, storyboard, capture, ElevenLabs, and renderer.
6. Receipt/assets export, fresh-checkout setup, and demo rehearsal.
7. Hosted credentials only if security gates pass; otherwise use local/guided flows.

Drop ornamental animation, extra post styles, broad competitor search, and
additional frameworks before evidence checks, truthful failure states, or security.
Current integration availability, sponsor eligibility, quotas, and deployment
access remain preflight questions, not reasons to expand scope.
