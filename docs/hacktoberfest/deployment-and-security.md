# Sudo Launch — deployment and risk review

Current increment: a local Node backend is connected to the terminal frontend.
See [development status](../development.md) for implemented capabilities and
verification. Remaining requirements below are targets, not blanket completion
claims. Hosted keys/automation and automatic capture remain disabled.


Status: planning, reviewed 2026-10-10. These are implementation requirements,
not claims that security controls or deployment integrations already work.

## Deployment targets and packaging

Docker packages Sudo Launch and its browser/video dependencies for local or
self-hosted use. Target projects deploy through **Vercel or DigitalOcean App
Platform**; they do not need a Dockerfile for the supported static-site flow.

The first supported profile is React/Vite with a static output. Both adapters
inspect the build script, output directory, SPA routing, and external-service
requirements. A frontend with a missing backend is not a complete application.
Next.js/server runtimes, monorepos, databases, and arbitrary source repair are
later extensions, even where the underlying provider supports them.

The user selects the provider. Show the target account/project, source revision,
settings, environment-variable names, plan eligibility, and expected cost or
unresolved pricing before creating resources. No automatic plan upgrades,
GPU provisioning, or spending decisions by the model. Vercel Hobby is for
non-commercial personal use; do not promise it as a free commercial launch path.
Check DigitalOcean eligibility and actual account credits rather than treating
event credits as a permanent free tier.

| Path | Hosted website | Local/self-hosted |
| --- | --- | --- |
| Existing URL | Verify/capture the supplied public site; no cloud token needed. | Same workflow. |
| Provider-hosted deployment | Default: prepare reviewed settings and send the user to the official import/deployment UI, then accept the resulting URL. | Also available. |
| API automation | Optional later, enabled only after the credential controls below pass checks. | Planned automation with locally supplied scoped credentials. |

Vercel's Deploy Button creates a project and clones the source into the user's
Git account. Prefer normal repository import for an already-owned repo; disclose
cloning when using the button. DigitalOcean's deploy button opens its Control
Panel; its template/configuration requirements must be satisfied, otherwise use
the ordinary App Platform import wizard. Never put secrets in links or templates.
These handoffs are guided deployment, not fully automated API deployment.

Without authenticated provider evidence, a returned live URL establishes only
the checks we performed. Its built source revision remains unverified; the
receipt must not claim that it came from our inspected commit.

## API adapter contract

Each adapter implements prepare, preflight, create/update, poll, and verify.
Preflight validates token scope, account/project access, repository Git access,
supported configuration, and pricing constraints. A Vercel project-scoped token
requires an existing selected project; it cannot create arbitrary new projects.
Do not assume a GitHub URL grants the provider permission to build that repo.

Record the reviewed commit, adapter configuration, job ID, and provider resource
and deployment IDs. Pin source where supported; compare the provider's reported
built revision with the reviewed source. An unpinned branch or mismatch requires
an explicit unverified/stale result, not a reproducibility claim.

An API acceptance response is not success. Poll terminal provider status, then
check public reachability and the selected browser interaction separately.
Use one mutation lock per job and persist resource IDs. On a timeout, reconcile
provider state before retrying creation; if the outcome cannot be established,
stop for review. Do not assume vendor idempotency or create duplicate apps.
Cancellation stops our job; deleting a cloud resource is a separate explicit
user action. Show resource ownership and cleanup instructions after a run.

## Credential boundaries

The safest hosted deployment path does not send a cloud token to Sudo Launch:
the user signs in and deploys on the provider's own website. Model and voice
keys still require backend use when those optional features are selected.

Hosted API automation requires trust in our server and operators. The backend
must use a credential in plaintext transiently to call its provider. Encryption
at rest cannot protect it against complete host compromise. Users who prefer
to keep keys off our infrastructure can run the open-source app locally.

Required controls before public hosted credential entry/API automation:

1. **Transport and browser:** HTTPS; transient key fields cleared after submit;
   no localStorage/sessionStorage, URL parameters, client bundles, analytics,
   logs, prompts, or exported assets containing credentials. Disable third-party
   scripts on credential pages and apply a restrictive content security policy.
2. **Ownership:** isolated server-side sessions with secure HttpOnly SameSite
   cookies; CSRF/origin checks for mutations. Every job, credential reference,
   download, and cancellation must enforce owner authorization. Opaque IDs alone
   are not access control. Rate-limit jobs and bound usage per session.
3. **Broker:** only the credential broker/provider adapter reads deployment
   credentials. Models, research tools, and browser/render workers receive no
   tokens. Never pass credentials as process arguments. Provider responses and
   errors are sanitized before logging or model input.
4. **Retention:** no saved-credentials feature in the MVP. If session retention
   is necessary, use authenticated encryption in a short-lived server-side
   vault with a separate key held in the host secret manager. Proposed maximum
   TTL: one hour, with deletion on completion/disconnect and expiry cleanup
   after crashes. Exclude vault records from backups. Do not promise physical
   memory wiping or provider revocation merely because our copy was deleted.
5. **Scope:** OAuth is preferred when a registered integration and its consent
   flow have been verified. Otherwise use expiring least-privilege tokens:
   Vercel project scope for an existing target; DigitalOcean custom App Platform
   permissions needed by the adapter, without blanket account write/delete.
   Confirm exact scopes during adapter preflight. Offer revocation instructions.
6. **Separate application secrets:** never inject Sudo Launch's deployment,
   model, or voice credentials into a target app. For static sites, bundled
   `VITE_*` and similar public variables are public data, not secret storage.
   A feature requiring a server-side secret needs a backend or stays blocked.
7. **Isolation:** builds execute in the provider account, not on the shared
   Sudo Launch server. Browser/research workers have no broker network access or
   secret mounts. Enforce public-only egress at network and application layers,
   including DNS resolution, redirects, and browser subresources; block private,
   loopback, link-local, metadata, and internal IPv4/IPv6 destinations.
   Reject arbitrary hosted model endpoints; use validated provider presets.
8. **Artifacts:** isolate per-job files and downloads; protect against path
   traversal. Proposed artifact TTL: 24 hours, with an immediate delete option.
   Warn before screenshots/narration send app content to selected external APIs;
   skip private/sensitive pages by default.

Local mode keeps keys on the user's machine, but cloud model/voice services
still receive submitted inputs. Bind the local UI to loopback by default and
protect mutations against cross-origin requests. Self-hosting publicly requires
the same controls as our hosted deployment; Docker itself is not a security
boundary. Local execution of repository scripts requires deliberate user action.

## Weaknesses and design fixes

| Weakness | Required fix |
| --- | --- |
| Too many integrations for a solo event build | One framework, two narrow deployment adapters, one demo interaction, and one video template. Preflight integrations early; cut styling/research breadth first. |
| A generic deployment/copy wrapper has weak differentiation | Make research change the positioning; link claims to evidence and export an honest launch receipt. Demonstrate a real interaction and useful relaunch angle. |
| Hosting someone else's tokens creates trust and breach risk | Provider-hosted handoff by default; local automation; gate hosted credentials behind implemented/tested isolation. |
| “Deploy any repo” fails on backend/configuration problems | Deterministic supported profiles and explicit blockers. Keep unsupported projects eligible for an existing-site launch pack. |
| AI produces hype, false uniqueness, or unsafe actions | Bounded schemas, cited evidence, fixed handlers, user-reviewed claims, and no model-generated shell. Search absence remains uncertainty. |
| Repo/pages contain hostile instructions | Treat content as data; validate actions independently and isolate research/capture networks. Prompts alone are insufficient. |
| Duplicate deployments, stale branches, or surprise charges | Record resource IDs, reconcile ambiguous mutations, compare built revisions, and disclose account/plan/cost before creation. |
| Reachable site is mistaken for a working product | Separate deployment status, HTTP reachability, and observed interaction. Report each independently. |
| Browser/video/voice integrations fail | Bound capture duration and retries; retain earlier artifacts, offer caption-only output or a user-supplied recording, and label its provenance. |
| External APIs fail during judging | Save the successful pack for demo playback, show partial statuses honestly, and resume stages without recreating resources. Never present a recording as a live successful run. |
| Open source is hard for others to run | Plan an `.env.example` with no secrets, provider-specific setup, loopback defaults, Docker packaging, and an existing-URL path needing no cloud deployment key. Validate these from a fresh checkout. |

## Release gates

Before public BYOK: test cross-session access denial, CSRF, secret redaction and
expiry, permitted endpoint validation, and worker isolation/SSRF blocking across
redirects and subresources. Before automation: test provider scope denial,
failed builds, mutation timeouts/reconciliation, revision mismatch, and a real
React/Vite deployment on each advertised provider. A failed gate disables the
corresponding feature; it does not block a local or guided demonstration.

## Inspected references

- [Vercel access token scopes](https://vercel.com/docs/accounts/access-tokens)
- [Vercel deployment API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment)
- [Vercel Deploy Button](https://vercel.com/docs/deploy-button)
- [Vercel Hobby eligibility](https://vercel.com/docs/plans/hobby)
- [DigitalOcean scoped tokens](https://docs.digitalocean.com/reference/api/create-personal-access-token/)
- [DigitalOcean OAuth](https://docs.digitalocean.com/reference/api/oauth/)
- [DigitalOcean deploy button](https://docs.digitalocean.com/products/app-platform/how-to/add-deploy-do-button/)
- [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
