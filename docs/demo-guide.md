# Evaluation demo: Sudo Launch

Pitch: **Developers can build fast but struggle to explain and share what they built. Sudo Launch turns a GitHub repository into a reviewed story, real demo assets and a practical launch pack.**

## Five-minute walkthrough

1. Open http://localhost:5173. Start from GitHub profile discovery or paste any accessible repository. PokeChess is the prepared hero example: `https://github.com/alokrajshahi04/pokechess`, demo `https://pokechess1.vercel.app`.
2. Show repository context and source coverage. Explain that source inspection does not certify runtime behavior.
3. Review the audience/goal, then confirm the brief and continue to launch stories. There is no readiness checklist or deployed URL requirement.
4. Generate two launch stories with the explicitly selected model. For venue resilience, skip optional research in the live walkthrough. Choose a story, edit the LinkedIn/X/Instagram/narration drafts, review the claims and save. Show that polling and reload preserve the saved copy.
5. Expand **Create a launch video**. Choose portrait, record the deployed demo with reviewed exact-label clicks (for PokeChess: `PRESS START`, `Skip`, `Local PvP Pass & Play Mode`, `Start Battle ⚔️`; turn scrolling off), prepare its storyboard, review the short narration and approve ElevenLabs generation. Render with generated voice and aligned captions. Show the MP4, generate the five-slide carousel, review its screenshot-backed proof slide, and download the complete ZIP. Choose a future launch time to include optional manual calendar reminders.

Account/quota errors are visible. Manual brief editing remains available when model suggestions fail; no fabricated fallback drafts are inserted. Never describe prerecorded output as the result of a live request.

## What to say about the technology

- The controller pins selected source to a commit, excludes secret paths, validates evidence and bounds all actions. It does not run or deploy the repository.
- Google Gemma and Nebius GLM are selectable. Nebius uses strict output schemas, allowed evidence IDs and source quote options; local validation and one repair remain mandatory. State the model actually used in your demonstration. Earlier Gemma calls worked; a later positioning request timed out. Sponsor eligibility depends on the event's actual rules, not model availability alone.
- ElevenLabs generates the approved voice and character alignment; captions use those timestamps. Optional instrumental music is supported and was separately verified.
- Playwright records only approved public-page steps. Public HTTPS requests are pinned and bounded; non-GET requests and sockets are blocked. Capture may therefore omit network-dependent behavior. Use supplied footage when needed.
- FFmpeg composes four scenes into a 25-second portrait/landscape video. The flow adapts Brag's storyboard/composition guidance, with attribution; it does not run Hyperframes.
- Agent-Reach was investigated for public research. It is not integrated and its README does not provide a native scheduling API. The app exports real ICS reminders; it does not auto-post.

## Backup and preparation

Current downloaded proof files live in ignored `.local/evaluation/`: `video.mp4`, `poster.png`, `recording.webm`, `screenshot.png`, `narration.mp3`, `captions.srt`, `receipt.json`, `launch-calendar.ics`, and UI screenshots. This folder is local verification output, not committed demo fixtures. `browser-session.json` is sensitive and must not be shared.

Jobs and media persist through API restarts in local SQLite for seven days by default. Use the same browser session to reopen them; interrupted operations need an explicit retry. Before presenting, run `npm run build`, start `npm start` for a stable built UI, create a fresh session and download its outputs. Keep the video open locally as a network-failure backup. Keep `.env`, session files and API terminal details out of screen sharing.

User setup remaining: GitHub OAuth (only needed for connected/private access), review account quotas and prepare the pitch. See [todo.md](../todo.md). Public profile discovery and public repository entry do not require OAuth.

## Product boundaries and next release

The current release runs locally with server `.env` credentials. Public hosted credential entry needs durable storage, authentication, encrypted per-user keys, read-only repository permissions and isolated media workers. Render/DigitalOcean credits can support that later. No user-project deployments, automatic repository edits or social publication are performed.

A useful post-event direction is release-to-launch: reuse a confirmed audience and tone, compare releases, draft what changed, and measure whether developers actually share the resulting pack. Viral reach and hackathon prizes are not guaranteed outcomes.

## Launch Sudo Launch with itself

The prepared self-launch uses `https://github.com/alokrajshahi04/sudo-ai` at commit `c83183d`, explicitly in prototype mode because the app runs locally. Its audience is student/solo developers with built-but-unshared projects; the call to action is to try the local app and give feedback. Review notes acknowledge that bounded source findings can be speculative and local verification happened separately.

Files are in ignored `.local/sudo-launch-demo/`: `sudo-launch-kit.zip`, `video.mp4`, all five `carousel-*.png`, the screenshot, narration, SRT, execution receipt and a calendar. The recording shows the actual app's draft editor, project brief, story and carousel review. The public capture endpoint still rejects localhost; this own-app recording is uploaded through the existing footage route. There is no hosted-user signup claim and no automatic social publication.

The demo directory also contains private browser state and job metadata for resuming verification. Share the ZIP/video/carousel only; never share the entire directory or `browser-session.json`. The ZIP includes the inspected source revision and actual approved copy/model/media provenance.
