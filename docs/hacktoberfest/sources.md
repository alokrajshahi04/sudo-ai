# Sources and verification record

Prepared: 2026-10-10 (UTC).

## Source register

The event and published challenge pages, sponsor pages, selected repository
source, and model/provider documentation have been inspected during planning.
Venue announcements and actual credits received remain participant-provided
context. The source statuses below distinguish inspected material from references
that have not been retrieved.

| ID | Source | Purpose | Status |
| --- | --- | --- | --- |
| S1 | [Supplied MLH event listing](https://www.mlh.com/events/hacktoberfest-hack-day-amaravati-x-foss-srm-ap) | Event description, logistics, organizer identity, and registration links. | Retrieved and inspected on 2026-10-10. Title, dates, format, description, deadline, and published categories are recorded in the event brief. |
| S2 | [Hacktoberfest official website](https://hacktoberfest.com/) | Identify the relevant edition and follow its current participation/rules links. | Not retrieved. |
| S3 | [Hacktoberfest participation reference](https://hacktoberfest.com/participation/) | Candidate location for qualification rules; confirm that the page exists and applies to the relevant edition. | Fetch attempted during continuation; hostname resolution failed. Current path and contents remain unverified. |
| S4 | [MLH code of conduct reference](https://mlh.io/code-of-conduct) | Check conduct expectations if the event listing adopts this policy. | Not retrieved; applicability to this event unverified. |
| S5 | [SRM University AP website](https://srmap.edu.in/) | Possible institutional corroboration if the listing identifies this institution as host. | Not retrieved; host relationship unverified. |
| S6 | [Gemma category](https://www.mlh.com/events/hacktoberfest-hack-day-amaravati-x-foss-srm-ap/challenges/01a03b87-be22-9180-5e2d-b3beeb66666d) | Gemma-specific scope and multiple-category entry. | Inspected on 2026-10-10. |
| S7 | [Open-source AI category](https://www.mlh.com/events/hacktoberfest-hack-day-amaravati-x-foss-srm-ap/challenges/01a0d987-0c41-12ea-13ac-5b85755dc2f3) | Original work, open AI, repository/license, skills/harness requirements. | Inspected on 2026-10-10. |
| S8 | [DigitalOcean partner](https://www.mlh.com/partners/digitalocean) | Cloud/inference products and generic credit offer. | Inspected; published offer differs from the participant's reported $5 balance. |
| S9 | [Gemma partner](https://www.mlh.com/partners/gemma) | Gemma 4 resources and API access. | Inspected on 2026-10-10. |
| S10 | [ElevenLabs partner](https://www.mlh.com/partners/elevenlabs) | Voice capabilities and generic subscription offer. | Inspected; venue grant is participant-reported and differs from generic offer. |
| S11 | [Gemma API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api) | Hosted Gemma 4 IDs, image input, and function calling. | Inspected; account access not tested. |
| S12 | [Agent-Reach](https://github.com/Panniantong/Agent-Reach) | Research access layer, upstream tools, and license. | README, MIT license, CLI and selected channels inspected; integrations not installed or queried. |
| S13 | [brag](https://github.com/latent-spaces/brag) | Launch-video workflow reference. | README, MIT license, and skill text inspected as reference data. Not installed or invoked. |
| S14 | [Nebius quickstart](https://docs.tokenfactory.nebius.com/quickstart) | Current endpoint and OpenAI-compatible integration. | Inspected; model list endpoint requires authentication. |
| S15 | [GLM-5.3-Flash model](https://huggingface.co/zai-org/GLM-5.3-Flash) | Model identity and MIT license metadata. | Model card/metadata inspected; exact Nebius catalog ID and availability not verified. |
| S16 | [DigitalOcean App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/) | Static free tier and service pricing. | Inspected; account eligibility/balance and deployment not tested. |

## Deployment/security review sources

The official Vercel token, deployment API, deploy-button, integration, and Hobby
pages; DigitalOcean OAuth, scoped-token, and deploy-button pages; and OWASP
secrets/SSRF guidance were retrieved and inspected on 2026-10-10. Links and
resulting requirements are in [deployment and security](deployment-and-security.md).
Documentation establishes available mechanisms, not functioning integrations:
no token, OAuth flow, credential isolation, or target deployment has been tested.

## Initial access limitation

A direct HTTPS fetch of S1 using `curl` failed with:

```text
curl: (6) Could not resolve host: www.mlh.com
```

The initial session had restricted network access, no available web-search/browser
tool, and no exposed MCP resources or resource templates containing source
material. This failure says nothing about whether the event page works elsewhere.

On continuation on 2026-10-10 (UTC), direct HTTPS fetches of both S1 and S3
were attempted again. Both failed with `curl: (6) Could not resolve host`
for their respective hostnames. No additional source content was obtained;
event logistics and current participation rules remain unverified.

Further diagnosis on 2026-10-10 confirmed that the execution sandbox sets
`CODEX_SANDBOX_NETWORK_DISABLED=1` and denies socket connections to both the
configured DNS server and a numeric public IP with `PermissionError: [Errno 1]
Operation not permitted`. The failure is attributable to session network
restrictions; these tests do not establish whether host-side WSL networking
works. See [network troubleshooting](../network-troubleshooting.md).

The participant subsequently enabled session network access on 2026-10-10.
GitHub and the event listing then returned HTTP 200, and Git remote inspection
and cloning succeeded. The access limitation is resolved.

## Remaining verification

1. Confirm ElevenLabs venue-specific rules and any submission/deadline changes.
2. Verify exact provider model IDs, access, quotas, and optional capabilities when
   credentials are connected; documentation alone does not establish access.
3. Verify the selected demo project's build and real interaction before treating
   its listed capabilities as demonstrated behavior.
4. Consult current official global Hacktoberfest participation rules separately
   if global qualification becomes part of the participant's goal.

## Evidence conventions

- **Participant-provided:** a statement or source supplied by the user.
- **Verified:** directly supported by inspected source content, with a source reference.
- **Inferred:** a conclusion drawn from limited evidence, such as the event title inferred from its URL.
- **General background:** contextual knowledge that does not establish this edition's rules.
- **Unverified:** information still needing a source.

Verified event details are recorded in [the event brief](event-brief.md).
Current product decisions are recorded in [the Sudo Launch overview](ideation.md).
