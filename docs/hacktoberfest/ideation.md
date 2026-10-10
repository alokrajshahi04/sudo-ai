# Sudo Launch — product marketing and launch assistant

Current direction, 2026-10-10: help student and solo developers turn neglected projects into clear, source-grounded launch packs. The mentor recommended marketing/product launching, GitHub discovery, and clearer onboarding. The participant subsequently added repo-first suggestions, private access, source-specific readiness guidance, deployed-demo capture and launch-video composition.

## What the developer gets

Paste a repository or choose one from a GitHub shortlist. Read selected source at a pinned revision, get a suggested product brief, confirm the audience/goal, then choose between two launch stories. Download LinkedIn/X drafts, a sharing plan, a Markdown launch kit, a JSON evidence receipt, and optional 25s promo/video/audio/poster assets. The developer reviews and publishes everything.

The differentiator is source-grounded marketing with honest product status: a starter stays a prototype, a CLI gets a usage story, and a library does not need a website to be worth sharing. Readiness findings come with a portable coding-agent prompt; Sudo Launch itself does not modify the repo.

## Current features

| Feature | Scope |
| --- | --- |
| Discovery | Public profile shortlist; connected GitHub shortlist including private projects. Up to 100 recent repos checked, 30 eligible projects shown, with metadata-based reasons. |
| Source | Immutable commit, bounded tree and up to 12 selected README/manifests/entry files; no install/build/runtime execution. Secret paths excluded and common tokens redacted. |
| Repo-first brief | Gemma/Nebius/custom model suggests summary, audience, goal, context, assumptions and evidence IDs; owner confirmation is required. Manual brief entry works when the model is unavailable. |
| Readiness handoff | Deterministic checks plus up to five model findings with exact source quotes and actionable recommendations. Review acknowledgement gates positioning; web apps need a reachable demo or explicit prototype mode. Findings must be verified before an external coding agent fixes them. |
| Positioning | Two evidence-cited stories with LinkedIn/X drafts and narration; exact configured model recorded, schema/IDs checked, one targeted repair, no hidden fallback. |
| Research | Bounded public GitHub search plus up to three supplied public links. Private jobs default to research disabled. Agent-Reach/social research remains planned. |
| Launch plan | Reviewable channels/checklist; optional public URL reachability does not verify features or launch history. |
| Video | Brag-inspired storyboard; source visuals, normalized uploaded screenshots, user footage or approved deployed-URL capture. Portrait/landscape, approved ElevenLabs voice/music, aligned burned captions/SRT, Chromium + FFmpeg MP4 and poster. Brag handoff export supports the upstream skill; Hyperframes does not run here. |
| Calendar | Dated ICS reminders containing reviewed drafts; posts are published manually. |
| Local use | React terminal-inspired web app + Node API. Keys in ignored server `.env`; OAuth tokens scoped to one browser session. One-hour in-memory jobs. |

First visit explains the product and `/` shortcut. Three guided screens—Project brief → Launch story → Launch pack—keep the primary decisions visible. Source details, readiness findings and optional studio expand within one document rather than competing scroll panes.

## Boundaries and risks

No project deployment integrations, cloud provisioning, automatic execution of repository code, arbitrary tool execution, repository repair, social auto-posting or batch spending. The participant owns publication and any coding-agent fixes.

Bounded source inspection is not universal repository understanding. Citations are not proof that every generated claim is true. README plans, missing source, unknown project types, research gaps and failed provider calls stay visible. Profile ranking is not a success prediction, and absent competitors do not establish originality.

Private source requires explicit approval before reading/model transfer. Public queries can leak private topics, so private projects start with research disabled. GitHub OAuth's `repo` scope is broad; the app only reads, and a selected-repo read-only local token is available. A read-only GitHub App is preferable for future hosting.

Source-card videos are promos; approved URL captures show only the listed interactions and may block requests required by the product. Real footage is the stronger product demonstration. Model/voice/music generation uses quota only through explicit selected-project actions; user review remains necessary.

## Sponsor and open-source story

Gemma 4 powers bounded analysis and positioning through Google AI Studio. The visible default is `gemma-4-26b-a4b-it`, selected after live latency checks; 31B is configurable. Other providers are explicit choices, with exact account-catalog model IDs.

ElevenLabs provides live-verified narration and instrumental music. Brag's MIT storyboard/composition guidance is adapted with attribution; no upstream bundled media is used. DigitalOcean/Render credits can host Sudo Launch later once production storage, authentication, worker isolation and secure BYOK are implemented. Hosting users' projects is outside scope.

## Demo and verification

The same pipeline handles web apps, server projects, Python tools, libraries, workspaces and README-first prototypes. Automation uses generic source fixtures; no PokeChess-only assumptions. A mentor's repo enters through the same URL/profile flow.

Live Tolti analysis correctly identified the starter/prototype status and produced a valid two-story pack. ElevenLabs audio was mixed into a real 25s 1280×720 promo plus poster. OAuth/private ownership uses controlled integration responses until app registration. Browser tests cover three viewport sizes; they do not establish live inference.

Account tasks are collected in [todo.md](../../todo.md). Next product opportunities: richer Agent-Reach research, more specific marketing assets, stronger visual compositions, secure hosted use, then CLI/MCP.

See [PRD](prd.md), [UI/UX](ui-ux.md), [model contract](model-harness.md), [security](deployment-and-security.md), and [setup](../development.md).
