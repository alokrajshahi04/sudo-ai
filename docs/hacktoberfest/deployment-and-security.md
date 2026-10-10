# Sudo Launch — credentials and operational boundaries

Updated after mentor feedback. Deployment integrations and user-project cloud
credentials are removed from the active scope. Earlier deployment/security design
is preserved in checkpoint `dbd6d47`. This filename remains for stable links.

## Current local boundaries

Sudo Launch reads public or explicitly consented private source, discovers projects, researches, generates reviewed
marketing drafts, and renders escaped source visuals, owner-uploaded media or explicitly approved public-page recordings. It does not install/run an
input repository, preview its code/issues, provision services, collect deployment
tokens, or publish social posts.

Keys live in the ignored local `.env`/process environment; only relevant provider
adapters use them. They do not enter frontend storage, source bundles, prompts,
receipts, URLs, or renderer arguments. Redaction catches common source secret
patterns but cannot guarantee arbitrary public source is secret-free.

Server binds to loopback, checks Host/Origin, and uses HttpOnly SameSite Strict
session cookies. Every job, receipt, and asset checks session ownership. Jobs/media
persist through restarts in ignored local SQLite and expire after seven days by default. Deletion cascades to media; cookie secrets are hashed before storage. The database contains private project content and has owner-only permissions, but is not encrypted. Provider and GitHub tokens are excluded; GitHub reconnect is needed after restart. Operations have concurrency,
rate, response-size, media-size, and time bounds.

Public page checks validate HTTPS/443 and resolved IPv4/IPv6 destinations, reject
private/reserved IPs, pin the validated DNS address, and revalidate redirects.
Link checks fetch text only. A separate approved capture browser loads public-page resources through pinned transport: GET only, bounded requests/bytes, no saved authenticated session, service workers, sockets or private/reserved destinations. Redirects are intercepted and checked again. Downloaded public-page JavaScript can run inside this capture browser; repository source is not installed or executed.
Custom model endpoints are configured locally, never through public browser input.

Uploaded footage is validated with FFprobe and rendered with fixed FFmpeg arguments,
container/protocol limits, temporary files, and time caps. User footage is never
reported as an automatically verified interaction. These local processes are not
isolated hosted workers; public upload acceptance requires sandboxing first.

## Hosted release gates

Public BYOK needs HTTPS, authenticated sessions/ownership, CSRF controls, secret
broker isolation, short encrypted session retention, expiry/disconnect cleanup,
no third-party scripts on key pages, log/error redaction, and tested public-only
worker egress. Backend key use still requires trusting the host/operators;
encryption does not eliminate that trust. Do not expose this local build by tunnel
as if those hosted controls had passed.

Publication and paid generation remain explicit human actions. Source/pages cannot
authorize tasks or request credentials. Validate every model output independently
and retain limitations in artifacts. Do not automatically spend across every
repository discovered on a profile.

## Verification

Tests cover owner denial, Origin denial, malicious URL/profile inputs, reserved-IP
policy, structured-output/evidence validation, missing keys, multiple source types,
actual local media rendering, and honest receipt statuses. These are scoped
checks, not comprehensive production security certification.

See [development](../development.md) and the
[model contract](model-harness.md). Relevant guidance:
[OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html),
[OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## GitHub connection and private source

OAuth uses random state, PKCE S256 and a callback-only HttpOnly SameSite Lax nonce. The regular application cookie stays Strict; the callback restores its original owner only after validating state/nonce/active session and exchanging the code. State is single-use and expires in ten minutes. Provider tokens never enter responses or browser storage.

GitHub OAuth `repo` permission is broad, including write access. Only read endpoints are used. A configured local fine-grained read-only token is connected explicitly to one session; there is no global authenticated fallback. Private reading and model transfer need consent. Public profile discovery stays public. Disconnect clears private jobs/artifacts and tokens, and blocks while operations are running.

Secret files are excluded from source selection; common formats and exact configured keys are redacted. Arbitrary secret detection is incomplete, so the owner must still review excerpts and sharing. Private-project public research starts disabled and warns about query disclosure. Media/receipts/Brag handoffs may contain private source; downloads require the owning session and should be shared deliberately.

The composition browser only renders escaped, app-generated SVG with scripts/network denied. It never navigates to input project pages; the separate approved capture browser does so under the public-network limits above. Brag integration is an adapted local renderer and upstream handoff, not execution of an unrestricted agent skill.
