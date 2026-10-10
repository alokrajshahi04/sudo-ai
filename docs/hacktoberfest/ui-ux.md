# Sudo Launch — product marketing UI/UX

Current direction after mentor feedback, 2026-10-10. Preserve the terminal visual
language; shift the product from deployment to marketing. Requirements in
[PRD](prd.md), setup/status in [development](../development.md).

## First visit

Hero: **Give your project a launch story.** Supporting copy: “Find the audience.
Explain the value. Create the demo and posts to launch it.” Primary action:
**Find my projects**. Alternate: **Start with a repository**.

About popup gives a short five-step explanation. Discovery modal accepts a public
GitHub username, shows bounded ranked metadata with reasons, and lets the user
choose a project. Selection opens the brief form; the user provides audience/goal.
Source inspection and generation remain explicit actions.

## Workspace

Tabs: Understand, Position, Launch plan, Demo, Launch pack.

Desktop workspace occupies the available viewport. Header, project identity,
stage navigation, status line, and command input remain visible. Main content
and context sidebar scroll internally with contained overscroll. Switching stages
resets content scroll. At smaller widths, hide the secondary context pane and
use one internally scrolling content panel. Long evidence/optional existing-URL
checks use disclosure controls. Do not shrink all text to fit every artifact.

Home remains responsive with short-height compact spacing. At mobile/extreme zoom,
allow natural home scrolling; workspace retains usable stage/command controls.
Metadata/context stay available in the primary content when needed.

## Interaction and accessibility

Slash commands overlay upward; descriptions, arrow-key navigation, visible active
selection, Enter execution, and Escape close. Commands navigate bounded UI paths;
no shell or unrestricted agent runs. Every action has a visible button.

Current commands: `/discover`, `/new`, `/demo`, `/research`, `/strategy`, `/studio`,
`/pack`, `/settings`, `/about`, `/clear`, `/help`. `/deploy` is removed.

Native labeled dialogs, visible focus, semantic headings, form labels, selected
states with text/ARIA, polite progress/error announcements, and reduced motion.
Ensure internally scrolling panes remain keyboard-scrollable and narrow layouts
have no page-wide overflow. Public release still needs a full accessibility audit.

## Samples and real jobs

Sample walkthrough offers three invented examples: React/Vite app, Python CLI,
and Next.js server app. Sample metadata/copy are visibly illustrative; sample
receipt records no source/model/research execution. No PokeChess-specific production
copy or hard-coded repo assumptions.

Real projects use their own source snapshots, warnings, research, model metadata,
selected angles, assets, and receipts. Missing keys/voice/footage show actionable
states. No deployment/provider selector or fake backend-required deployment button.
The launch checklist leaves hosting/distribution with the owner.

## Visual system and implementation

Near-black canvas, IBM Plex Mono/system fallback, thin gray borders, rectangular
panels, restrained red accent, amber caution with text, and a decorative CSS orb.
Avoid terminal obscurity: visible steps and clear audience/value copy explain the
product before requiring a command.

[App.tsx](../../src/App.tsx): shell/discovery/forms/commands.
[LiveWorkspace.tsx](../../src/LiveWorkspace.tsx): real marketing stages.
[SampleWorkspace.tsx](../../src/SampleWorkspace.tsx): multi-category walkthrough.
[styles.css](../../src/styles.css): viewport/scroll/responsive behavior.

Browser verification must cover short desktop heights, desktop zoom-equivalent
viewport, mobile, all stages, long evidence content, persistent footer/nav,
profile selection, direct repo entry, and honest sample versus real status.


Current browser checks passed home at 1536×696, 1280×720, 1440×900, and 1024×768;
workspace stage switching and long-content scrolling at 1536×696 and 390×844;
actual public profile discovery/selection; direct Tolti repo entry; and real
launch-strategy preparation. Navigation and command input remained visible,
with no outer workspace page overflow or JavaScript runtime errors.
