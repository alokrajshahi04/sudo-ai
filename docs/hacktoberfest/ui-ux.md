# Sudo Launch — UI/UX implementation spec

Current increment: a local Node backend is connected to the terminal frontend.
See [development status](../development.md) for implemented capabilities and
verification. Remaining requirements below are targets, not blanket completion
claims. Hosted keys/automation and automatic capture remain disabled.


Status: frontend and real local jobs implemented, 2026-10-10. Remaining hosted
features and automatic capture are pending. Requirements: [PRD](prd.md), [security review](deployment-and-security.md).

## Direction and rationale

A terminal-inspired launch console: near-black canvas, monospace typography,
fine borders, restrained red highlights, short precise copy, and a persistent
command area. The supplied cyber.fund screenshot is the visual reference. The
live page was fetched but returns a JavaScript-required shell; the screenshot
supplies the observed layout. Inspiration does not imply copying its assets/code.

Direction rating: **9/10 for this developer audience**. The concept fits “sudo”
and shipping a project. The main usability risk is hiding the workflow behind
commands. Pair slash commands with visible buttons and a staged workspace.
Use forms/selectors for structured choices and credentials, never chat text.

## Information architecture

- Home: value proposition, supported inputs/outputs, start action, sample action.
- Launch workspace: Inspect → Position → Deploy → Demo → Launch pack.
- Preferences: explicit model/provider choice, later validated connection status.
- Help: discoverable commands and their equivalent actions.
- New launch: repository + audience brief; existing-site input added with backend.

The workspace is a staged inspector, not an unrestricted shell. No terminal
commands execute. Freeform requests will need bounded intent routing if added
later; the preview only supports listed slash commands.

## Layout and visual tokens

| Token | Value / use |
| --- | --- |
| Canvas | `#0a0a0a` |
| Panel | `#101010`; selected area `#17110f` |
| Text | `#e6e5e2` |
| Secondary | `#9c9c96` |
| Borders | `#2c2c2c`; form borders use a brighter gray |
| Accent | `#ff433c`; primary filled button `#de332c` with white text |
| Caution | `#d7b575`, accompanied by a text status |
| Typeface | IBM Plex Mono; system monospace fallback |
| Type sizes | 10px metadata, 12–13px body, 20–23px section, 37–46px hero |
| Spacing | Predominantly 8/12/16/24/32px |
| Shape | Rectangular panels and controls; no pill-heavy card grid |
| Width | 1080px max, 18–32px narrow-screen margins |

Home: full-width slim masthead; compact eyebrow; two-column framed hero;
left identity/headline/action, right input/output explanation; workflow strip;
command footer and quick actions. The red orb is a CSS visual, not a generated
image, and is decorative. It is secondary to the product's main action.

Workspace: project heading and provenance label; visible stage navigation;
main stage panel with a narrower context sidebar; bottom command bar.
Avoid burying evidence in a streaming log. Logs can be collapsible once real
jobs exist; stage outcomes and recovery actions remain visible.

## Screen contracts

| Screen | Content and actions |
| --- | --- |
| Home | “Ship what you started.” Start a launch; open sample; show supported framework and preview status. |
| New launch | Public repo URL, intended audience/goal, explicit save/start action. Preview saves only an in-memory brief. Future controller returns job/inspection status. |
| Inspect | Profile, source revision, build settings, dependencies, individual findings and blockers; source links. Never label source context as runtime-verified. |
| Position | Research coverage/sources and prior-launch confidence; two selectable angle cards; corrections/review. Preview marks research as not run. |
| Deploy | Vercel/DO selection, account/project, commit, build/output/routing, plan/cost review, guided versus API path. Mutation remains disabled until validated. |
| Demo | Capture preview, user-selected interaction, timed storyboard, narration/caption choice, generate/cancel controls. Empty state shows no recording. |
| Launch pack | Draft copy, assets with availability/provenance, check summary, receipt and complete-pack downloads. Only actual artifacts are downloadable. |
| Settings | Model preference versus actual connection; model IDs/capabilities verified by backend. Hosted key entry hidden until security gate passes. |
| Help | Listed command names and direct clickable actions. |

## Interaction details

Preview commands: `/demo`, `/new`, `/research`, `/deploy`, `/studio`, `/pack`,
`/settings`, `/help`. Press `/` outside an input to focus the command bar. Enter
runs the command. Suggestions filter by prefix and are ordinary focusable buttons.
Unknown text returns a plain explanation, not fabricated agent activity.

Every command has a clickable path. Dialogs use native modal semantics, focus
containment, Escape-to-close, a visible close button, and focus return. Clicking
outside closes without implying save. Model/target/angle selections use visible
selected styling and `aria-pressed`; no color-only selection.

Later actual-stage states: idle, running, needs-input, completed, blocked, failed,
skipped, cancelled. Running shows real stage name, elapsed time, and cancellation;
no synthetic percentages. Failed shows a sanitized reason, affected artifacts,
and bounded recovery. Blocked shows a specific next step. Unavailable narration
allows captions; unavailable deployment allows existing URL. Stale reviewed plans
must request a fresh review before mutation.

Critical actions have an explicit review of source, account, settings, plan/cost,
and consequence. No confirmation for harmless navigation. Cloud deletion is
separate from cancellation and clearly identifies the resource.

## Responsive and accessible behavior

Desktop: two-column hero and workspace sidebar. At 800px the workspace context
moves below content. At 560px home panels stack and workflow becomes vertical;
workspace stage navigation scrolls horizontally without widening the page.
Command input flexes; keyboard hint disappears on narrow screens. No functionality
requires hover or the decorative animation.

Use semantic headings, labeled forms, native dialogs, visible keyboard focus,
polite announcement of status updates, and reduced-motion support. Primary actions
have ~42px height; dense quick links are secondary. Before public release, audit
contrast, 200% zoom, screen-reader labels/statuses, keyboard-only completion,
and narrow-screen touch targets. Increase metadata sizing if readability fails.

The current font fetch is optional with a system fallback. Self-host the font
before public credential pages and apply the planned restrictive CSP there.
No analytics, tracking, or credential controls are present in the preview.

## Initial frontend increment

Files: [App.tsx](../../src/App.tsx), [styles.css](../../src/styles.css),
[main.tsx](../../src/main.tsx). React/TypeScript + Vite; no component library. The following describes the
initial sample increment; real job components now live in
[LiveWorkspace.tsx](../../src/LiveWorkspace.tsx) and [api.ts](../../src/api.ts).

Working UI: responsive home, sample workspace, stage switching, angle/provider/
model preferences, brief form validation, help/settings dialogs, slash commands,
keyboard shortcut, and JSON sample receipt download. All state is in memory.

Sample data is visibly labeled; there are no fake loading logs, deployments,
research sources, captures, or model results. Backend-required actions are
explicitly disabled. Credential entry is absent. Receipt distinguishes preference
from execution and records empty checks/unverified revisions.

Run `npm install`, then `npm run dev`. Build using `npm run build`.
The initial sample remains a reviewable prototype. The real workspace now
connects to the local backend described in the development guide.

## Integration work

Owned LaunchJob responses and real evidence are implemented separately from the
sample. Add isolated automatic capture, hosted connection gates, deployment API
automation, caption overlays, and richer job recovery. Initial requirements: Add
existing-URL entry, per-stage progress/error recovery, safe model/voice connections,
reviewed provider handoff/local automation, captured media previews, editable
copy, artifact downloads, and deletion controls. Do not enable buttons by merely
removing `disabled`; wire each to the validated controller/adapter contract.

Verify the UI at desktop and 390px width, keyboard dialogs/command navigation,
repository validation, download payload, and blocked-action honesty. Backend
security gates and provider/model tests are separate from frontend checks.

## Verification of this increment

`npm run build` and `git diff --check` passed. Chromium browser checks passed
at 1440px desktop and 390px mobile: stage navigation, angle/provider/model
preferences, disabled deployment, receipt payload/provenance, slash shortcut,
repository validation, modal Escape behavior, reduced motion, and no horizontal
page overflow or JavaScript runtime errors. Desktop/mobile screenshots were
visually inspected. This does not establish WCAG conformance or backend security.


## Viewport and command-menu update

Desktop home uses viewport-height spacing and compact content at shorter heights.
Extra product explanation lives in the About modal. Slash commands open an
upward overlay, with descriptions, arrow-key selection, Enter to run, and Escape
to close; the menu does not shift the page. `/about` and `/clear` are added.

Browser checks confirmed home fits 1536×696, 1280×720, 1024×768, 1440×900, and
1920×1080; real workspace remains scrollable, with no mobile page overflow at
390px. The real PokeChess flow passed inspection, guided Vercel plan, actual HTTP
reachability, and receipt download. These checks do not verify gameplay.
