# Sudo Launch — guided marketing UX

Current flow, 2026-10-10. The product remains a marketing assistant as described in
[ideation](ideation.md) and [PRD](prd.md). Terminal styling supports the experience;
commands are optional shortcuts.

## First visit and project selection

The home page explains the promise and outputs: audience-specific stories,
LinkedIn/X drafts, a sharing plan and optional demo assets. Primary action:
**Find my projects**. Alternative: **Start with a repository**.

Discovery scans public GitHub metadata and shows projects with ranking reasons.
Selecting a project opens a brief form with the repository filled in. Audience
and launch goal stay empty and are required; the repository description must
never masquerade as an audience brief. Optional context describes working
features, prototype limits and useful distinctions.

Creating a brief reads source but spends no model credits. Public apps, CLI
tools, libraries and prototypes use the same flow. No fictional walkthrough or
example-product selector appears in the application.

## Three guided screens

The six logical activities in ideation are grouped into three user decisions:

| Screen | User decision | Operations |
| --- | --- | --- |
| Project brief | Who is this for and what should the launch achieve? | Review/edit the audience, goal and optional context; inspect source. |
| Launch story | Which story should introduce this project? | Optional bounded research, one explicit generation action, two selectable angles with draft previews. |
| Launch pack | What will I review, download and share? | Prepare the selected-angle launch plan, copy LinkedIn/X drafts, download the Markdown kit, optionally add media, inspect evidence. |

Project brief can be edited without creating another job or repeating inspection.
Changed briefs invalidate dependent positioning, strategy and generated media.
Saving unchanged input preserves prepared outputs. The server enforces ownership
and validation on the brief endpoint.

Generation first collects research when enabled, then calls the selected model.
It waits for each phase to finish, shows progress, and stops on failure. A failed
research step never silently falls through to a model call. Research settings
include an editable topic, up to three supplied URLs, and an optional existing
project link check. These give bounded context, not proof of uniqueness or launch
history. Missing model configuration has a nearby setup action; no fake drafts.

After generation, the UI reveals two story choices. Selecting a story updates the
job; **Use this story & prepare my pack** prepares its launch plan and opens the
pack. Media is a collapsed optional addition. A text launch does not require
footage, ElevenLabs or FFmpeg. Missing media prerequisites explain the disabled
operation. Narration still requires explicit approval and uses the user's quota.

The pack offers a Markdown kit with the selected angle, post/narration drafts,
prepared checklist/channels and cited evidence links/model provenance. Media
downloads are separate. The JSON receipt records actual source/research/model/
media use. Copy controls exist for both social drafts. Publishing stays manual.

## Navigation, context and keyboard use

Three progress buttons show the current step and completed inputs. Normal
navigation prevents jumping into an unprepared pack. Commands may open an
incomplete screen, which explains the required next action instead of inserting
placeholder content. Changing projects returns to home with recent owned jobs
available to resume.

Header and progress stay visible. One wide document scrolls; evidence and run
details expand within it. The overview's primary action fits the short desktop
and mobile viewports. Step changes reset scroll and focus the content heading.
No independently scrolling sidebar, forced horizontal tabs or always-visible
terminal footer.

**Commands**, slash, or Ctrl/Cmd+K open the shortcut panel. Arrow keys,
Enter and Escape operate the palette. /inspect refreshes source, /status
reports progress; other commands navigate or open bounded forms. No shell,
deployment or unrestricted agent runs. Navigation never starts paid generation.

Native labeled dialogs, visible keyboard focus, semantic headings, current-step
ARIA, pressed story-choice states, inline progress/errors and reduced motion
support accessible use. A complete accessibility audit remains a public-release
task.

## Visual system

Near-black canvas, mono typography, restrained red primary actions, thin neutral
borders, readable form labels and muted supporting copy. Prefer direct decisions
and practical outputs over oversized slogans or repeated dashboard cards.
Dark scrollbars and controls remain readable on Windows and narrow screens.

Implementation: [App](../../src/App.tsx) owns onboarding, resume, navigation and
shortcuts; [LiveWorkspace](../../src/LiveWorkspace.tsx) owns the guided flow and
actual operation handlers; [styles](../../src/styles.css) defines layout.

## Verification

Playwright follows two generic repository types from profile selection to kit
download without commands. It checks missing model setup, research error/retry,
legacy incomplete briefs, resume, optional media, selected-angle export content,
keyboard shortcuts and workspace geometry at desktop, short desktop and mobile
sizes. Screenshots are inspected, including brief, story and pack states.

Run npm run test:ui after installing Playwright Chromium.
PLAYWRIGHT_CHROMIUM_PATH optionally selects an existing browser.
Screenshots/traces go to ignored test-results/.

Browser model/research outputs are controlled fixtures. They verify UX and API
sequencing, not live provider account access or marketing quality. Node integration
tests separately exercise real endpoints, ownership, brief correction, source
fixtures and invalidation. Live model/voice and Agent-Reach remain separate work.
