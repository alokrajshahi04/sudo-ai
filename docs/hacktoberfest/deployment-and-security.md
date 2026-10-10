# Sudo Launch — credentials and operational boundaries

Updated after mentor feedback. Deployment integrations and user-project cloud
credentials are removed from the active scope. Earlier deployment/security design
is preserved in checkpoint `dbd6d47`. This filename remains for stable links.

## Current local boundaries

Sudo Launch reads public source, discovers projects, researches, generates reviewed
marketing drafts, and renders owner-uploaded media. It does not install/run an
input repository, preview its code/issues, provision services, collect deployment
tokens, or publish social posts.

Keys live in the ignored local `.env`/process environment; only relevant provider
adapters use them. They do not enter frontend storage, source bundles, prompts,
receipts, URLs, or renderer arguments. Redaction catches common source secret
patterns but cannot guarantee arbitrary public source is secret-free.

Server binds to loopback, checks Host/Origin, and uses HttpOnly SameSite Strict
session cookies. Every job, receipt, and asset checks session ownership. Jobs/media
expire after one hour and disappear on restart/deletion. Operations have concurrency,
rate, response-size, media-size, and time bounds.

Public page checks validate HTTPS/443 and resolved IPv4/IPv6 destinations, reject
private/reserved IPs, pin the validated DNS address, and revalidate redirects.
Checks fetch text only; they do not execute browsers/subresources or input code.
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
