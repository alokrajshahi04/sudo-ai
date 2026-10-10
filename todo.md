# Tasks for Alok after the build

No credentials belong in Git commits, screenshots, launch copy, or the command bar.

- [ ] **GitHub sign-in:** create an OAuth app at https://github.com/settings/applications/new. Homepage: `http://localhost:5173`. Callback: `http://localhost:5173/api/auth/github/callback`. Put `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the ignored `.env`, then restart the API. The implemented OAuth flow uses state and PKCE. Test sign-in, your private shortlist, and disconnect. GitHub's OAuth `repo` permission is broad (including write); Sudo Launch only performs reads. A read-only fine-grained local token is an alternative.
- [ ] **Optional local GitHub token:** create a fine-grained token restricted to selected repositories with Contents and Metadata read access; set `GITHUB_TOKEN` in `.env`, restart, and explicitly connect it in Settings. Never give it to a hosted stranger's server.
- [ ] **Nebius demo model:** copy the exact model ID available in your account into `NEBIUS_MODEL` and set `NEBIUS_API_KEY`. Verify the requested GLM model is actually offered; we do not assume a model name or open-source license from its label.
- [ ] **ElevenLabs:** narration works with the configured voice. Only add `voices_read` if you want to list/change voices. Music API generation also passed a live check. Check quota/permissions if a future request is rejected. Voice and music generation spend credits and require an explicit click.
- [ ] **Open-source release:** choose the Sudo Launch license (MIT is a straightforward option) and add its LICENSE file with your copyright. Preserve third-party Brag notices.
- [ ] **Before judging:** use a real repo, review suggested audience/claims, copy the coding-agent handoff for any fixes you want, then generate stories and a promo. Optional real footage gives the strongest demo. Download the launch kit, receipt, storyboard, and media before the one-hour session expires or the server restarts.
- [ ] **Public hosting later:** use Render/DigitalOcean credits after adding production HTTPS, durable sessions/storage, encrypted per-user credentials, and a read-only GitHub App. This build deliberately runs on localhost with server `.env` credentials; public credential entry is not enabled. Register a separate production OAuth callback when that mode is implemented.

Already configured locally: Google/Gemma and ElevenLabs keys. Their values are excluded from this file and Git.
