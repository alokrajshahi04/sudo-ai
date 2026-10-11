# Sudo Launch — final evaluation

**Time limit: 2 minutes 50 seconds. Aim for a 2:30 presentation, leaving 20 seconds for a question or display delay.**

Your one-line pitch: **Sudo Launch turns a GitHub project into a launch people understand.**

Present directly from the app. Show one project, one story, one video and the launch pack. Rehearse the actions along with the words; the times below include clicking and playback.

## Timed script and screen actions

| Time | Screen | Say |
| --- | --- | --- |
| 0:00–0:20 | Sudo Launch homepage | “Hi, I'm Alok, a first-year student. I've built projects that stayed on GitHub because explaining and promoting them was another job. For solo developers, finishing the code often leaves the launch unfinished.” |
| 0:20–0:35 | Homepage, point at the main promise | “Sudo Launch turns a GitHub repository into a marketing launch pack: a clear story, social posts, a carousel, and a narrated demo video. Let me show you.” |
| 0:35–0:55 | Show the repo entry briefly, then a prepared project brief | “I start with a repository. Sudo reads selected source, then I confirm who the project is for and what I want from the launch. Here, I'm preparing PokeChess to find testers.” |
| 0:55–1:15 | Prepared launch stories; point at the selected story | “It proposes two launch stories using the source and that audience. I choose and review one. That context carries into the posts and video, so the outputs explain the same product.” |
| 1:15–1:50 | Play the prepared 25-second video with audible sound | “Here is a video generated earlier. Chromium captured the public interface; ElevenLabs generated the narration and timing for these captions.” **Then let the video play.** |
| 1:50–2:15 | Launch pack: show editable posts, one carousel slide and ZIP button | “The same story becomes editable LinkedIn, X and Instagram drafts and a five-slide carousel. I can download the available assets together. The developer reviews and publishes them. We also used Sudo Launch to prepare its own launch assets.” |
| 2:15–2:30 | App homepage or launch pack | “It's open source and live on Render. Next, I'd build reusable brand voice and launch updates for new releases. Sudo Launch helps developers give the projects they've built an audience.” |
| 2:30–2:50 | Stop clicking; face the judges | Answer a question. If there is none, end cleanly; there is no need to fill every second. |

Speak naturally. The wording is a guide, not something to read from the screen. If you run late, shorten the closing to: **“It's open source, live on Render, and helps developers turn their repos into launch assets.”**

## Prepare the exact browser you will project

1. Open https://sudo-launch.onrender.com. There is no site password. Public repositories do not require GitHub sign-in.
2. Prepare a complete PokeChess project in **this browser session** before your slot: confirm its brief, choose a story, save reviewed copy, and ensure the video/carousel are available. Keep the launch pack open. Outputs created in another browser session will not automatically appear here.
3. Keep a second tab ready for the homepage. Use **Sudo Launch home / Change project** to return there if the app automatically restores the saved project.
4. Keep the generated video open in a local player as a backup. Test the external display's audio before judging. The ElevenLabs voice must be audible.
5. Keep one carousel image and the downloaded ZIP ready. Show the ZIP button or an already downloaded pack; avoid browsing every file.
6. Plug in the laptop, disable notifications and screen sleep, close private tabs, and check the app at 100% browser zoom on the actual display. Keep `.env`, dashboards and session files off screen.
7. Rehearse once with a stopwatch. A good practice target is 2:20–2:30 including the whole 25-second video.

**Do not wait for fresh voice or video generation during the timed presentation.** Show prepared outputs and identify them as generated earlier. If judges request a fresh run, start one after the main pitch when time allows.

The hosted verification job belongs to the verification browser's private cookie, not necessarily your presentation browser. Use your own prepared session or the offline files below; do not expose or copy session secrets during judging.

## Ready-to-show offline files

Only presentation assets have been copied into `.local/judge-demo/`:

- `pokechess-launch.mp4` — primary video; generated on the deployed Render service with real browser footage, ElevenLabs narration and aligned captions.
- `pokechess-launch-kit.zip` — the corresponding hosted launch pack.
- `sudo-launch-self-demo.mp4` — backup proof that we used the tool to prepare its own launch; made earlier while Sudo Launch ran locally.
- `sudo-launch-self-kit.zip` — the self-launch pack.
- `sudo-carousel-1.png` through `sudo-carousel-5.png` — self-launch carousel slides.

The PokeChess recording shows its public start/onboarding interface and Pokédex. It does not demonstrate a completed chess match or prove its AI/multiplayer works. Describe what is visible.

The self-launch assets were prepared before public hosting, so some copy refers to running locally. Present them as earlier outputs, not an updated announcement of today's hosted service.

## If something fails during the slot

**App/network stalls:** “I have the generated assets downloaded. Here is the actual output.” Play the local PokeChess video, show one carousel image, and finish the value explanation.

**Video cannot play inside the app:** switch immediately to the local player. Do not debug the player on stage.

**Audio fails:** say “This includes ElevenLabs narration; the captions use its generated timestamps.” Show the captions, use laptop speakers if available, and continue. Check sound before the slot to avoid this.

**A judge supplies a different repo:** “Yes, public repo URLs are supported. We also verified a library, `chess.js`, on the deployed service. I can run yours after this walkthrough.” Enter it when invited. Generation takes time; do not claim its result before the request finishes.

**The hosted worker is busy:** explain that this demo instance processes one heavy operation at a time. Show the completed assets while the current operation finishes.

## Likely judge questions: short answers

**What did ElevenLabs contribute?**

“It generates the approved narration and character-level timing. We convert that timing into subtitles and burn aligned captions into the launch video. Optional instrumental music is also integrated. The voice in the video you heard came from ElevenLabs.”

**Why is ElevenLabs useful here?**

“Developers often have something worth showing but no polished spoken explanation. The generated voice turns a reviewed product story into a narrated demo they can share, while aligned captions also make it usable without sound.”

**Is ElevenLabs generating the video itself?**

“ElevenLabs generates the audio and alignment. Playwright/Chromium captures approved product visuals, and FFmpeg combines them with the narration, scenes and captions.”

**Why not ask ChatGPT to write a launch post?**

“The useful part is the connected workflow: source context, confirmed audience, a chosen story, reviewed channel-specific drafts, actual product visuals, narration, carousel and a downloadable pack. The developer keeps control of the claims and final output.”

**What is the tech stack?**

“React, TypeScript and Vite on the frontend; Node and Express on the backend; SQLite for saved jobs and media. GitHub supplies repository context, Nebius GLM generates this demo's stories, ElevenLabs supplies voice and alignment, and Playwright plus FFmpeg handle visuals and rendering. The app runs in Docker on Render.”

**Are you using Gemma?**

“The app supports Google AI Studio/Gemma and other configured providers. This demo uses Nebius's `zai-org/GLM-5.3-Flash` after a Gemma positioning request timed out. We're presenting in the ElevenLabs track.”

**Can it work on other projects?**

“It accepts accessible GitHub repos and inspects selected source across different stacks. We tested web apps, tools and libraries, including a live hosted run for `chess.js`. A project without a public interface can use supplied visuals or a branded explainer. We don't claim every repo or website will work.”

**Where does the video footage come from?**

“The user can upload recordings/screenshots or approve capture of a public demo URL. A fresh browser records bounded interactions. The PokeChess example uses actual captured interface footage. We do not substitute raw source code for a product demo.”

**How do you stop the model inventing features?**

“We give it bounded source evidence and a confirmed audience, require structured output with allowed evidence references, and validate the result. The user reviews the copy before using it. Source evidence supports a draft; it isn't a guarantee that runtime features work.”

**Is the API key exposed to visitors? Can they see each other's work?**

“Provider keys stay in server environment variables. Each visitor gets a secure browser session; jobs and media are scoped to that session. Cross-session access was tested. For today's evaluation, visitors use my configured provider quota. Hosted entry of their own API keys is future work.”

**What happens on refresh?**

“SQLite persists jobs, edits and media, and the browser cookie restores that session. We verified persistence across a real redeployment. Default retention is seven days. Clearing the cookie loses access; GitHub connections need reconnecting after server restarts.”

**Does it automatically publish posts or deploy the user's project?**

“It prepares the launch materials. The developer reviews and publishes the posts, and handles deploying their own project. Sudo Launch itself is publicly deployed.”

**What did you build versus reuse?**

“I built the app workflow, source inspection and evidence handling, model integration, editable launch pack, persistence, and the connected capture/audio/render pipeline. Brag's storyboard and composition guidance is adapted with attribution. Agent-Reach was researched but isn't integrated.”

**What is open source?**

“Sudo Launch's code is public under GPL-3.0-only. Developers can clone it, run it locally and configure their own provider credentials. Third-party attribution is included. ElevenLabs remains an external service.”

**What would you build next?**

“Reusable audience and brand voice, then launch updates when a project releases something new. I'd validate whether developers actually publish the packs before adding more automation.”

**How would this become a business?**

“Keep the local tool open source, and test demand for a paid hosted workflow with usage-based rendering. I'd first measure whether users finish and publish a pack. There is no billing system today.”

**Can it handle lots of users?**

“Today's Render instance is a working evaluation deployment with one heavy operation at a time and bounded storage. Scaling would require a queue, isolated workers and stronger per-user quotas. I haven't load-tested a production audience.”

## What to emphasize

- A specific user: a student or solo developer with a built-but-unshared project.
- A visible output: the narrated video and coherent, editable launch pack.
- A meaningful sponsor use: real ElevenLabs speech plus timestamp-aligned captions.
- Working evidence: a public deployment, saved state, and generated downloadable assets.
- Clear ownership: you built Sudo Launch with permitted agent assistance; PokeChess is an existing input project, not a project created during this event.

Answer the question first, then add detail only if asked. You do not need to recite the stack during the main pitch. End after the product's value is clear.
