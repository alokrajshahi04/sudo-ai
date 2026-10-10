# Sudo Launch — bounded product marketing harness

Current scope: product understanding, audience positioning, and launch assets.
The implemented positioning prompt lives in [models.ts](../../server/models.ts).
Actual configured model access still needs a live provider request.

## Controller boundaries

The controller determines source profile, evidence IDs, budgets, job ownership,
and permitted handlers. Profiles include static Vite, server web, Python tool,
library/CLI, workspace/multi-service, documentation, and unknown. All may enter
marketing; none authorizes deployment or execution of the input project's code.

Evidence types remain distinct: repository metadata, README/source, public
research, owner statements, HTTP observations, and user-supplied recordings.
No source or reachability observation establishes a verified interaction.
Readmes may describe plans. A listed homepage is not proof of a previous launch.

Credentials never enter evidence packs. Redact source secrets before prompt
construction. Source/pages/model responses are untrusted data; they cannot select
new tools, redefine profiles, request credentials, or authorize publishing.

## Positioning prompt contract

- Return only the exact JSON schema: two `angles` and `limitations`.
- Each angle: title, audience, rationale, known evidence IDs, LinkedIn draft, X
  draft ≤280 characters, and short narration.
- Tie proposed copy to that angle and the owner brief. A CLI/library calls for a
  usage/install story; a prototype stays labeled a prototype; a server app does
  not become a supported static deployment.
- Distinguish implemented source, README plans, metadata, observed behavior,
  and recommendations. Do not fabricate traction, testimonials, first-launch
  history, uniqueness, or competitor features.
- Uncertainty is acceptable. Request owner clarification where a missing audience
  or ambiguous feature changes the story.
- Never return commands, executable code, arbitrary patches, deployment plans,
  auto-preview instructions, or social publishing actions.

Schema checks enforce shape, lengths, and evidence IDs; they do not prove every
semantic claim. User review is required. One validation repair attempt is allowed;
then fail visibly with no provider switch. Actual provider/model/date appear in
successful job results and the receipt.

## Stage handling

Source reading/classification is deterministic and bounded. Profile discovery
ranking uses metadata with explicit reasons, not model prediction of success.
Research sources retain URLs/dates/excerpts and actual coverage. Positioning uses
these small evidence packs. Launch strategy uses the selected angle, simple
channel purposes/timing, and a developer-owned checklist. Narration requires
review/approval and configured voice access. FFmpeg accepts only fixed arguments
and actual uploaded footage. Posts remain drafts.

Changing source revision invalidates dependent outputs. Changing angle invalidates
strategy/voice/video. Adding research or a new URL check invalidates generated
copy so stale evidence is not silently reused. Successful unrelated stages remain
available when another operation fails.

## Reliability cases

Test app, server, Python CLI, README-first prototype, library, and workspace input
through the same API. Include unknown/missing manifest, planning-language README,
secret-like variables, external services, injected content, unknown evidence IDs,
extra action fields, absent key, empty research, and HTTP-200 without interaction
verification. Fixtures establish routing/schema behavior; paid live provider
runs are separate and must record their actual results.
