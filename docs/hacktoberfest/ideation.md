# Sudo Launch — product overview

Current increment: a local Node backend is connected to the terminal frontend.
See [development status](../development.md) for implemented capabilities and
verification. Remaining requirements below are targets, not blanket completion
claims. Hosted keys/automation and automatic capture remain disabled.


Status: product plan with a working terminal frontend and local backend.
Source inspection, guided plans, HTTP checks, and media rendering work; live
model/voice calls require configured account access. See the [PRD](prd.md) and [UI/UX spec](ui-ux.md)
for requirements and the current increment.

## Product and audience

**Sudo Launch helps a developer turn an existing web project into a verified
live app and a launch pack tailored to the product and its audience.**

The first user is a student or solo developer with a working prototype who needs
help with deployment, positioning, a demo video, and launch copy.

Input: a public GitHub repository, optionally an existing live URL, and a short
brief describing the intended user, launch goal, and preferred tone.

Output: a live URL or a documented deployment blocker, a researched positioning
brief, a 20–30 second demo video, LinkedIn/X drafts, and a downloadable launch
receipt linking the result to its source and verification evidence.

## User journey

1. Connect a model and the services needed for the chosen workflow.
2. Add the repository and brief. Inspect the project and look for an existing
   deployment or public launch.
3. Review launch readiness, relevant alternatives, and two positioning options.
4. Choose an angle and review deployment settings or proposed configuration.
5. Deploy a supported project or reuse an existing verified live URL.
6. Capture real product interactions, review the storyboard/copy, and generate
   narration and video.
7. Download the launch pack and receipt. Publish the posts manually.

## Features and integration scope

| Feature | First version |
| --- | --- |
| Repository assessment | Read relevant public source files and scripts; create a project profile, supported features, required configuration, and evidenced blockers. |
| Launch discovery | Inspect repository homepage/README links and public search results. Distinguish a confirmed earlier launch, a possible match, and insufficient evidence. |
| Product research | Agent-Reach-backed public web/search/GitHub access; collect up to three relevant alternatives and useful audience context, with URLs and retrieval dates. |
| Positioning | Generate two audience-specific angles from the brief, implemented features, and retrieved evidence. Include a clear difference and a reason to try the product. |
| Deployment | React/Vite static apps on Vercel and DigitalOcean App Platform. Guided provider-hosted deployment and planned local API adapters; hosted automation requires security gates. Other project types remain unsupported for automation. |
| Existing-site workflow | Verify a supplied/discovered URL and create a relaunch or showcase pack. Reuse a suitable existing deployment when the user selects it. |
| Product capture | Bounded browser capture of real UI and one selected interaction, with preview before rendering. |
| Narrated demo | Gemma or the selected model creates a structured storyboard; ElevenLabs provides narration; a deterministic renderer produces the MP4. |
| Launch copy | One LinkedIn post, one X post, and a short launch checklist. Styles: build in public, product announcement, or technical walkthrough. |
| Launch receipt | Export repository commit, target URL, checks performed, captured evidence, research sources, model used, and generated assets. |
| Bring your own model | Native Google/Gemma adapter plus an OpenAI-compatible adapter, with explicit provider/model selection and connection validation. |
| Hosted and local use | The same workflow through a hosted BYOK website or a locally run open-source application. |

These are the target first-version features. Integration preflight will decide
whether the entire set fits the remaining event time. Prioritize a genuine
repo-to-live-app-to-narrated-pack path; reduce research breadth or styling before
removing the verification step.

## Agent-Reach research

Agent-Reach manages access and diagnostics for upstream tools. Its selected
paths include Jina Reader for public pages, Exa MCP through mcporter for search,
and GitHub tools. We will wrap configured capabilities behind a small research
adapter; do not assume an `agent-reach search` command or automatic agent runtime.
Actual queries must work before a capability is shown as available.

Use bounded queries around the product name, repository owner, problem,
category, and user-supplied audience. Limit a run to three searches and five page
reads initially. Save excerpts, URLs, dates, and the relationship to each claim.
Keep same-project launch discovery separate from similar-product discovery.

A search with no matches means **no evidence found in the checked sources**.
It does not establish that the idea is unique or that the product never launched.
Surface ambiguous name matches and let the user correct them. Retrieved pages
supply evidence; they cannot direct tool execution or change instructions.

Hosted research uses public sources. Logged-in social channels can become
optional local integrations later. If a search provider is unavailable, report
that gap and accept user-provided public links; continue with a clearly labeled
research limitation.

## Model selection and harness

- **Gemma 4 through AI Studio/Gemini API:** default sponsor demonstration path.
  Its role covers meaningful project analysis, positioning, and storyboard work.
- **Nebius GLM-5.3-Flash:** desired alternate demonstration. Its published model
  metadata identifies MIT licensing. Verify the exact Nebius catalog ID, account
  access, and endpoint capabilities when credentials are connected.
- **Other OpenAI-compatible providers:** configure provider, endpoint, model ID,
  and key. Hosted use starts with validated provider presets; arbitrary custom
  or localhost endpoints are available in local mode.
- Validate text, structured output, and any required vision/tool capabilities.
  A text-only model uses source/DOM evidence. It cannot claim to have inspected
  screenshots. Make any additional vision-provider choice explicit.
- Record the actual provider/model for each stage. Model failures are visible;
  switching providers requires an explicit user choice. Avoid silently replacing
  Gemma in a Gemma demonstration.

The controller owns project classification, workflow state, service credentials,
allowed tools, execution, and verification. Models receive small evidence packs
and stage-specific choices. See [model instructions](model-harness.md) for the
concrete system prompt, stage rules, and enforcement requirements.

## Hosted and local developer use

| Mode | Planned experience |
| --- | --- |
| Hosted website | Open Sudo Launch, create an isolated run session, connect the desired providers, add the repo, review the plan, and download the results. |
| Local application | Clone the repo, use the documented dependency setup or single-container setup, start the same UI/controller, and connect keys through local configuration or the UI. |

Credentials are requested only for selected tasks: model access for analysis,
ElevenLabs for narration, and cloud access for API-automated deployment.
Public inspection and an existing-URL pack need no deployment token. Offer a
captioned video when voice is disabled.

Hosted deployment defaults to a guided handoff to Vercel or DigitalOcean's own
website, followed by verification of the returned URL. Local mode can automate
through scoped credentials. Hosted API automation is optional and gated on
implemented security checks; hosted model/voice key entry has its own security
gate. Backend use of a key requires trust in that backend, even when storage is
encrypted. Local mode keeps our controller and credentials on the user's machine;
selected cloud services still receive their relevant inputs.

See [deployment and security](deployment-and-security.md) for token scopes,
session ownership, retention, worker isolation, costs, adapter contracts, and
weaknesses with required fixes. Docker packages Sudo Launch itself; Vercel and
DigitalOcean host the user's target app. Provider-native builds keep repository
scripts off our shared server. Capture workers must be isolated and restricted
to public network destinations. Local builds require deliberate user action.

The proposed stack is TypeScript, a web UI, a Node controller/worker, Google and
OpenAI-compatible model adapters, a small Python/upstream-tools research bridge,
Playwright capture, and FFmpeg rendering. Confirm exact packages and commands
in the PRD. A Docker setup should bundle the non-JavaScript runtime dependencies.
Render is a candidate host for Sudo Launch; Vercel and DigitalOcean are the
planned target-app providers. No deployment has been provisioned.

## What makes the project stronger

1. **Research changes the launch:** existing launch evidence and relevant
   alternatives influence the audience, angle, and first-launch/relaunch copy.
2. **Claims have evidence:** each promoted feature links to source or observed
   behavior. Only a specifically checked interaction is called runtime-verified.
   The user reviews semantic claims; citations alone do not prove correctness.
3. **The launch is traceable:** a receipt links the inspected source, deployment,
   captured interaction, model decisions, and final assets. Failed or partial
   stages stay visible and do not erase earlier successful results. Built revision
   is recorded as unverified unless authenticated provider evidence establishes it.
4. **Model choice is portable:** demonstrate the same bounded workflow with
   Gemma and the configured Nebius model, subject to successful connection tests.

These improvements strengthen differentiation and execution. A numeric rating
cannot guarantee originality, product-market fit, or a hackathon result.

## First demonstration and boundaries

Use [PokeChess](https://github.com/alokrajshahi04/pokechess) as the preferred
input: a React/Vite app with chess logic, local play, themes, and animations.
Its listed Vercel URL responds to HTTP requests, so present a relaunch or new
verified deployment. Gameplay, a clean build, and no-key startup still need
verification. Capture local pass-and-play; public AI-mode key handling requires
separate assessment.

The hackathon contribution is Sudo Launch's new workflow and integrations.
PokeChess supplies an existing product to launch. Use the existing open-source
license and retain attribution for any reused dependency code.

Later scope: more deployment adapters, private-repo OAuth, logged-in social
research, direct social publishing, general source-code repair, complex backend
migrations, and GPU provisioning. The PRD and UI/UX spec define the next implementation steps.

## Relevant references

- [Agent-Reach](https://github.com/Panniantong/Agent-Reach)
- [/brag](https://github.com/latent-spaces/brag): reference for launch storytelling;
  its Hyperframes/Kokoro agent-skill runtime needs deliberate adaptation.
- [Gemma API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api)
- [Nebius API quickstart](https://docs.tokenfactory.nebius.com/quickstart)
- [GLM-5.3-Flash model metadata](https://huggingface.co/zai-org/GLM-5.3-Flash)
- [DigitalOcean App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/)
