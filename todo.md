# Tasks for Alok after the build

No credentials belong in Git commits, screenshots, launch copy, or the command bar.

- [ ] **GitHub sign-in:** create an OAuth app at https://github.com/settings/applications/new. Homepage: `http://localhost:5173`. Callback: `http://localhost:5173/api/auth/github/callback`. Put `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the ignored `.env`, then restart the API. The implemented OAuth flow uses state and PKCE. Test sign-in, your private shortlist, and disconnect. GitHub's OAuth `repo` permission is broad (including write); Sudo Launch only performs reads. A read-only fine-grained local token is an alternative.
- [ ] **Optional local GitHub token:** create a fine-grained token restricted to selected repositories with Contents and Metadata read access; set `GITHUB_TOKEN` in `.env`, restart, and explicitly connect it in Settings. Never give it to a hosted stranger's server.
- [x] **Nebius demo model:** configured `zai-org/GLM-5.3-Flash` at the supplied US North 1 endpoint with the ignored `.env` key. Live browser verification passed for both brief suggestions and two launch stories on PokeChess. Low reasoning avoids exhausting the output budget; Settings remembers your chosen provider. Model access is verified, not a license review.
- [x] **ElevenLabs:** timestamped narration, aligned SRT/burned captions and a portrait video passed a live run with the configured voice. Only add `voices_read` if you want to list/change voices. Music API generation also passed a live check. Check quota/permissions if a future request is rejected. Voice and music generation spend credits and require an explicit click.
- [x] **Open-source license:** GNU GPL v3.0 (GPL-3.0-only) added with your copyright attribution. Third-party Brag MIT notices remain intact.
- [ ] **Before judging:** follow [the demo guide](docs/demo-guide.md), keep the downloaded `.local/evaluation/video.mp4` ready as backup, and rehearse a five-minute pitch. Use a real repo, review suggested audience/claims, copy the coding-agent handoff for any fixes you want, then generate stories and a promo. Approved public URL capture or your own footage gives the strongest demo. Review claims and unresolved source findings; do not demonstrate prototype flows as certified features. Keep the downloaded ZIP and video ready as an offline backup. SQLite retains local jobs and media across restarts for seven days by default.
- [x] **Render evaluation demo:** deployed at https://sudo-launch.onrender.com with 2 GB RAM, a persistent SQLite disk, HTTPS and demo access protection. Public discovery, generated posts, actual Chromium capture, ElevenLabs narration, carousel, video and ZIP passed a hosted workflow. Access credentials are in the ignored `.local/render-demo-access.md`. Confirm credit application in the billing dashboard; public BYOK and isolated multi-user workers remain future work.
- [x] **Hosted GitHub configuration:** the separate OAuth app credentials were securely transferred to Render and applied by deployment. The sign-in start check passed with the exact hosted callback, matching client ID, state, PKCE and Secure/HttpOnly nonce cookie. Localhost credentials remain unchanged; secrets are excluded from Git.
- [ ] **Hosted GitHub authorization:** open https://sudo-launch.onrender.com, use the private demo access credentials, and connect GitHub in your browser. Complete consent, check your project shortlist, then disconnect. The authorization start was verified; account consent and the successful callback require your browser.

Already configured locally: Google/Gemma, Nebius and ElevenLabs keys. Their values are excluded from this file and Git. A recent Google positioning request timed out; Nebius is the local demo default, with no automatic provider fallback.

## Completed launch-pack checkpoint

- [x] Save reviewed four-channel edits with stale-version guards; use them in exports and reminders.
- [x] Download one bounded ZIP with current available media and a missing/stale manifest.
- [x] Create and review five real Instagram carousel PNGs and an editable caption.
- [x] Persist local jobs, edits and media in SQLite across restarts; never persist provider/GitHub keys.
- [x] Create Sudo Launch's own reviewed copy, genuine footage, narrated 25s reel and five carousel slides in one ZIP. Restart/download checks passed. Prepared outputs are in `.local/sudo-launch-demo/`; review the final ZIP/reel before publishing.
- [ ] Choose your actual posting date, review Sudo's copy/media, then publish manually. Sample calendar reminders do not publish anything.
