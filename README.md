# sudo-ai

Working repository: https://github.com/alokrajshahi04/sudo-ai.

Research and planning for the MLH event linked by the participant:
[Hacktoberfest Hack Day Amaravati x FOSS SRM AP](https://www.mlh.com/events/hacktoberfest-hack-day-amaravati-x-foss-srm-ap).

Start with [the context index](docs/hacktoberfest/README.md).

The participant confirmed on 2026-10-10 that they are at the event at their
university and have officially checked in to MLH. This is participant-provided
context. Verified event details are recorded in the
[event brief](docs/hacktoberfest/event-brief.md).

The selected project is **Sudo Launch**, an open-source product marketing and
launch assistant. Discover projects on GitHub, choose an audience, research the
positioning, and prepare a launch plan, demo assets, and LinkedIn/X drafts.
Developers review and publish the result themselves.

Its [overview](docs/hacktoberfest/ideation.md), [PRD](docs/hacktoberfest/prd.md),
and [UI/UX spec](docs/hacktoberfest/ui-ux.md) define the current scope. The local
frontend/backend support public and consented private repositories across multiple project types, including web apps,
Python tools, libraries, workspaces, and README-first prototypes. There are no
user-project deployment integrations or automatic code previews.
This local directory is a Git checkout of the working repository.

See [network troubleshooting](docs/network-troubleshooting.md) for the resolved
web-access issue and verification details.

The participant reports receiving **$50 in Render credits** from the event.
Render is an available option if the chosen project needs hosting; deployment
has not been selected. See [hosting notes](docs/hosting.md).

## Run locally

Requires Node.js 22 and npm; install FFmpeg/ffprobe for media and Chromium for promo rendering.

```bash
npm install
npm run setup:browser
npm run dev
```

Open http://localhost:5173. Find a project on your public GitHub profile or paste
a repository. Review source-readiness guidance and the model-suggested brief,
confirm the audience/goal, choose a launch story, and download its pack. Video is optional: source visuals or your footage, with approved ElevenLabs voice/music. Commands or `/` opens keyboard shortcuts. Configure model and optional voice keys in your local .env using
[.env.example](.env.example), then restart the API. No keys are collected in the UI. Account setup tasks are collected in [todo.md](todo.md).

`npm run build` builds the frontend and checks TypeScript; `npm test` runs controller
and integration checks. See [development/setup](docs/development.md) for exact
capabilities, API endpoints, limits, and credential configuration. Jobs expire
in one hour and are lost on backend restart. This build binds to loopback only.
