# Sudo Launch — bounded product marketing harness

Current scope: product understanding, audience positioning, and launch assets.
The implemented positioning prompt lives in [models.ts](../../server/models.ts).
The repo-analysis prompt lives in [analysis.ts](../../server/analysis.ts). Gemma 4 analysis and positioning previously passed live checks on Tolti; a later PokeChess positioning check timed out after 60 seconds. Nebius GLM-5.3-Flash is now configured as the local demo provider. Runtime proof still comes from independent checks.

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
review/approval and configured voice access. Chromium renders escaped app-generated SVG with network/scripts denied; FFmpeg accepts only fixed arguments and source cards or validated uploaded footage. Posts remain drafts.

Changing source revision invalidates dependent outputs. Changing angle invalidates
strategy/voice/music/video/poster/storyboard. Adding research or a new URL check invalidates generated
copy so stale evidence is not silently reused. Successful unrelated stages remain
available when another operation fails.

## Reliability cases

Test app, server, Python CLI, README-first prototype, library, and workspace input
through the same API. Include unknown/missing manifest, planning-language README,
secret-like variables, external services, injected content, unknown evidence IDs,
extra action fields, absent key, empty research, and HTTP-200 without interaction
verification. Fixtures establish routing/schema behavior; paid live provider
runs are separate and must record their actual results.

## Repo-first analysis and readiness

Analysis has its own strict schema: summary, proposed audience/goal/context, assumptions and known evidence IDs. It cannot mark the brief confirmed, change source profile, run commands or certify readiness. Suggestions are user-editable and require confirmation. Configured model ID, date and actual result remain visible.

Readiness is deterministic and bounded. Missing README/license/test paths, recognizable starter copy, browser-public credential names and absent runtime proof produce review tasks. Missing paths are not definitive absence; some public keys are intentionally publishable. A fixed coding-agent handoff includes repository/revision, verify-first instructions, source files, no deploy/posting, owner decisions and truthful verification. The model does not generate executable fixes.

Validation repairs identify failing field paths/lengths or invalid evidence IDs without echoing raw provider output. X drafts target under 220 characters for headroom below the hard 280 limit; narration targets 40–50 words for the 25s storyboard. Provider timeout/rejection stops the phase with no automatic provider switch. Private projects require consent and default to no public research.

Both prompts state every array and character limit explicitly. Nebius uses JSON mode, the supplied US North 1 endpoint, and exact model ID `zai-org/GLM-5.3-Flash`. GLM's reasoning setting is `low` (its supported values are `low`, `high`, and `max`; `none` reverts to `max`). An 8,192-token budget includes reasoning and the final JSON. Truncated responses are rejected even if their text parses, and one concise repair is permitted. The initial default-reasoning live test exhausted its budget entirely on reasoning; analysis also once exceeded six assumptions and was repaired.

With explicit limits and low reasoning, the final live browser run on PokeChess completed analysis in 6.4 seconds and two-story positioning in 9.4 seconds, both on their first attempt. All cited evidence IDs and schema lengths passed validation; the browser reported no JavaScript errors. These are observed timings for one run, not a latency guarantee or runtime certification of PokeChess.

Safe attempt metadata persists in ignored `.local/model-calls.jsonl` and the API terminal: task, model/provider, attempt, time, status, finish reason, available token counts and schema error paths. No source, generated text, error bodies, headers or keys are logged. The original Gemma validation failure predates these diagnostics, so its precise field-level cause cannot be recovered. Local logs are bounded and survive watcher restarts. A browser's explicit model selection is remembered independently of a job's previous successful model.
