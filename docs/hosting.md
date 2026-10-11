# Render demo deployment

Hosted evaluation URL: https://sudo-launch.onrender.com. It requires the owner's demo access credentials; it is not an open public BYOK service.

Use the repository's `render.yaml` through Render's Blueprint dashboard. The Docker image installs Chromium, its recording encoder, system FFmpeg and the built React UI. One Node service serves both the UI and `/api`.

## Instance and cost

Select the `1c-2g` web-service instance: 1 CPU and 2 GB RAM, currently $25/month. Compute is prorated to the second; a full day is approximately $0.83. The Blueprint adds a 1 GB persistent disk ($0.25/month) mounted at `/var/data` and saves SQLite there. Account credits and their eligibility must be checked in your Render billing dashboard. A workspace subscription upgrade is not necessary for this single service.

Render's free **web service** has 512 MB RAM. The **25 MB** limit is for its free **Key Value/Redis** service, which this app does not need. Free web services also lack persistent disks and can sleep, so they are a poor fit for a reliable video demo and saved sessions. Sources: [pricing](https://render.com/pricing), [free limits](https://render.com/docs/free), [Blueprint specification](https://render.com/docs/blueprint-spec).

Hosted mode limits concurrent operations to one. Chromium finishes scene screenshots and closes before FFmpeg starts video encoding; encoding uses two threads. These bounds lower memory pressure without claiming arbitrary projects or recordings fit the instance. Uploads remain limited to 30 MB and 120 seconds; the final promo is 25 seconds.

On 2026-10-11, a local Docker run constrained to 1 CPU / 2 GB completed capture, a full 25-second 1080×1920 render using saved ElevenLabs narration and aligned captions, and five carousel slides while the API was running. Cgroup peak memory was 717,508,608 bytes (about 684 MiB), with no OOM kill. This is a representative workload check, not a guarantee for every public page. Hosted UI/API authentication, Secure cookies and Chromium/FFmpeg capability checks also passed.

## Credentials and access

Enter provider keys through Render's secret environment configuration. Never commit `.env`, upload the local SQLite database, or copy browser-session files. `RENDER_API_KEY` is only for local deployment tooling and does not belong in the hosted service.

For direct CLI/API deployment, create an API key at [Render Account Settings](https://dashboard.render.com/u/settings?add-api-key), save it privately in the local `.env` as `RENDER_API_KEY`, and never paste it into chat. Dashboard Blueprint deployment does not require an API key.

`RENDER_EXTERNAL_URL` enables HTTPS hosted mode automatically. Outside Render, set `SUDO_PUBLIC_ORIGIN` to the exact HTTPS origin. Hosted startup requires `SUDO_DEMO_USERNAME` and `SUDO_DEMO_PASSWORD` (at least 16 characters). The Blueprint generates a password; retrieve it privately from the Render dashboard. Give those access credentials only to intended demo users: their approved generation spends your configured provider quota. All UI/API/media routes require authentication except `/healthz`, which returns only status. Session cookies are HttpOnly, Secure and SameSite Strict. Mutation requests still require the application Origin.

Jobs are scoped to each browser session and retained for seven days by default. Refreshing with the same cookie restores them. Clearing cookies loses access; GitHub connections must be re-established after restarts. Deleting a job also deletes its saved media. The app is a restricted demo rather than a public multi-user credentials service.

For GitHub OAuth, register the exact hosted callback `https://YOUR-SERVICE.onrender.com/api/auth/github/callback`, then set the hosted app's client ID and secret. Use a separate OAuth app if you need local and hosted demos simultaneously. Do not copy a broad personal GitHub token into a service shared with judges.

For the current evaluation service, the callback is `https://sudo-launch.onrender.com/api/auth/github/callback`. Its separate app credentials can be saved locally as `GITHUB_RENDER_CLIENT_ID` and `GITHUB_RENDER_CLIENT_SECRET`, then securely mapped to Render's `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. The localhost OAuth app can keep its original callback.

## Deployment checks

The Docker build excludes `.env`, `.local`, databases, browser states and local videos. Automatic deployments are disabled so new GitHub commits do not replace a working evaluation demo unexpectedly. Deploy the intended main-branch commit manually.

After deployment, check `/healthz`, the authentication prompt, API capabilities, public repository discovery and a saved-session refresh. Test actual narration and video generation with a small public repo before evaluation. Local prepared launch videos remain useful offline backups; they are not automatically included on the deployed service. Monitor memory and provider quotas in their dashboards. Suspend the compute service when you no longer need it; retained disks can continue to incur storage charges.

The initial hosted verification on 2026-10-11 completed public discovery (23 eligible projects), actual Nebius positioning, bounded Chromium capture of PokeChess, reviewed copy, real ElevenLabs aligned narration, five carousel PNGs and a 25-second portrait MP4/ZIP. The capture opened the project, pressed Start, skipped onboarding and opened the Pokédex; it does not certify chess gameplay, AI or multiplayer. Verification files and the browser's session cookie remain private under `.local/render-verification/`.
