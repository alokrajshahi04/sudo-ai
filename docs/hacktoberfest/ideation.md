# Sudo Launch — product marketing and launch assistant

Updated 2026-10-10 after the participant's mentor discussion. This is the current
product direction. Earlier deployment work is preserved in Git checkpoint
`dbd6d47`; it is no longer the active product scope.

## What we are building

**Sudo Launch helps developers find projects worth sharing and turn them into
clear, evidence-grounded marketing launch packs.**

A developer enters a public GitHub username or repository. We help them discover
projects, explain the product, choose an audience, research positioning, prepare
a launch plan, and create posts plus a demo asset. The developer reviews and
publishes the result.

The first audience is student and solo developers whose projects lack a clear
story or public launch. The product is a marketing assistant, not a deployment
platform. The application needs its own server for API calls; it does not
orchestrate the input project's backend or provisioning.

## Mentor feedback incorporated

Participant-provided notes recommend positioning the product as a marketer /
product launcher; discovering projects on GitHub profiles; improving first-visit
copy and guidance; avoiding deployment integrations and automatic code previews;
and considering CLI/MCP later.

Interpretation: remove Vercel/DigitalOcean deployment screens and mutation plans.
Offer a short developer-owned publishing checklist where relevant. Keep actual
marketing assets, bounded source reading, research, and reviewed narration.
Do not run a user's code, launch preview environments, fix their issues, create
cloud resources, or post to their social accounts.

## Journey

1. **Discover:** scan a public GitHub profile or paste any public repository.
2. **Understand:** read bounded relevant source at a recorded commit, distinguish
   metadata/README plans from implemented features, and collect the owner's brief.
3. **Position:** research alternatives/context and propose two audience-specific
   angles, with their own posts and narration.
4. **Launch plan:** review channels, a README/distribution checklist, and sharing
   sequence. Publishing/hosting remains the developer's task.
5. **Demo:** upload real usage footage; optionally generate reviewed ElevenLabs
   narration; render an MP4.
6. **Launch pack:** review/copy drafts and download media plus the evidence receipt.

Public apps, Next.js/backend projects, Python tools, libraries, workspaces,
documentation, and prototypes can all enter the marketing workflow. Project type
changes the story and caveats, not permission to deploy or a requirement to use
React/Vite. Unknown/large/complex projects show evidence limits and request an
owner brief; we do not claim every repository can be understood completely.

## First-version scope

| Feature | Current scope |
| --- | --- |
| GitHub discovery | Up to 100 recently pushed owned public repos; shortlist up to 30 non-empty, non-fork, non-archived projects with explicit metadata-based reasons. |
| Source context | Immutable commit, root README/manifests, selected language/framework entry files, at most ten bounded files; no code execution. |
| Product profile | Vite, server web, Python tool, library/CLI, multi-service/workspace, documentation, or unknown. All are eligible for marketing. |
| Research | Bounded public GitHub search plus up to three supplied public links, source excerpts/dates, and coverage limits. Agent-Reach bridge remains planned. |
| Positioning | Two angles with audience, reason to try, supporting evidence IDs, LinkedIn/X drafts, and narration. |
| Model choice | Gemma via Google, Nebius exact catalog model, or a locally configured OpenAI-compatible API. Explicit selection; no hidden fallback. |
| Launch strategy | Channels, sharing sequence, and developer-owned release checklist. Optional existing URL reachability check is separate from feature verification. |
| Demo assets | User-supplied MP4/WebM plus optional reviewed ElevenLabs narration and fixed FFmpeg rendering. No code preview or automatic capture. |
| Launch receipt | Actual inspected commit, research sources, executed model/checks, user-footage provenance, and limitations. |
| Local use | Terminal web UI and local Node service; credentials in ignored server `.env`; no browser key collection yet. |

Profile discovery is automatic, but the owner selects the project/audience before
paid generation. No batch spending or autonomous social publishing. Research
absence does not prove originality. A listed homepage is not a verified live app
or proof of launch history. HTTP reachability is not verified product behavior.

## UI direction

Terminal-inspired, with visible actions and a first-visit explanation:
“Give your project a launch story.” Primary action: “Find my projects”; alternate:
“Start with a repository.” The About popup explains the workflow without filling
the landing page. Slash commands overlay upward with descriptions and keyboard use.

The six logical activities are grouped into three guided screens: Project brief,
Launch story, and Launch pack. Audience and goal are required; a repository
description never counts as a completed audience brief. Research feeds an explicit
two-story generation action, and the selected story leads to a pack containing
posts and a sharing plan. Demo footage/voiceover is an optional pack addition.

Progress stays visible while one document scrolls. Source evidence and local run
details expand inside it. Commands open on request as keyboard shortcuts, rather
than occupying a permanent footer. No fictional examples enter a real project flow.
See [UI/UX](ui-ux.md) for the interaction contract.

## Evidence, risks, and differentiation

- Make positioning respond to actual product/owner/research context, not a generic
  hype template. Link claims to evidence and retain uncertainty.
- Avoid overclaiming implementations from READMEs, or equating citations with
  truth. Owner review remains necessary before posting.
- Broad repository support means partial inspection, not universal runtime
  understanding. Missing manifests should not block a README-first marketing pack.
- Keep profile ranking explainable and modest: description/homepage/recent updates
  help shortlist; they are not success forecasts or quality judgments.
- Keep external integrations bounded. Missing keys/research/voice have honest
  states; do not silently fabricate a pack.
- Keep secrets off prompts, exports, and media. Local use is the event default;
  hosted BYOK requires the security release gates.

Gemma's harness supplies small evidence packs, schema checks, known evidence IDs,
one repair attempt, and fixed handlers. It cannot decide to execute code, deploy,
change the project profile, or publish. The human owns the final marketing claims.

## Demonstration and verification

PokeChess can remain one real example; it is not a product constraint or the only
test input. Fixture-backed integration tests cover React/Vite, Next.js, Python CLI,
README-first prototype, workspace, and library projects. Browser fixtures cover
profile-to-pack flows for multiple generic repositories. Demonstrate a mentor's
public repo by entering its URL
or profile, providing an audience brief, and running the same pipeline.

Show the source/evidence limits and actual model metadata. A CLI demo is real
terminal usage footage supplied by the owner; do not claim browser gameplay checks.
Full live model/voice success still requires credentials and account access.

Later: Agent-Reach research, stronger per-category marketing templates, additional
launch asset formats, secure hosted BYOK, CLI/MCP. Deployment integrations,
automatic code/issues previews, broad source repair, and social auto-posting are
outside the current scope.

See [PRD](prd.md), [UI/UX](ui-ux.md), [model contract](model-harness.md),
[security](deployment-and-security.md), and [local development](../development.md).
