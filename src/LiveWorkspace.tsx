import { useEffect, useRef, useState } from "react";
import type { Job, Capabilities, ModelProvider } from "../shared/types";
import { launchEvidence } from "../shared/evidence";
import CaptureControls from "./CaptureControls";
import DraftEditor from "./DraftEditor";
import InstagramPack from "./InstagramPack";
import { selectedCopy, currentDrafts } from "../shared/launch-copy";
import { api, getJob } from "./api";
export type Stage = "overview" | "research" | "strategy" | "studio" | "pack";
export default function LiveWorkspace({
  job,
  stage,
  capabilities,
  model,
  onJob,
  onDeleted,
  onNotice,
  onSettings,
  onStage,
}: {
  job: Job;
  stage: Stage;
  capabilities: Capabilities | null;
  model: ModelProvider;
  onJob: (j: Job) => void;
  onDeleted: () => void;
  onNotice: (n: string) => void;
  onSettings: () => void;
  onStage: (stage: Stage) => void;
}) {
  const editedBrief = useRef(false);
  const [audience, setAudience] = useState(job.launchBrief?.audience || "");
  const [goal, setGoal] = useState(job.launchBrief?.goal || "");
  const [context, setContext] = useState(
    job.launchBrief?.context ||
      (job.launchBrief
        ? ""
        : (job.brief || "")
            .replace(/Audience and launch goal:\s*$/i, "")
            .replace(/^Product context:\s*/i, "")
            .trim()),
  );
  useEffect(() => {
    if (job.analysis && !job.launchBrief && !editedBrief.current) {
      setAudience(job.analysis.suggestedBrief.audience);
      setGoal(job.analysis.suggestedBrief.goal);
      setContext(job.analysis.suggestedBrief.context);
    }
  }, [job.analysis?.generatedAt]);
  const [error, setError] = useState("");
  const [dismissedFailure, setDismissedFailure] = useState("");
  const phaseFailure = Object.entries(job.phases)
    .filter(([, p]) => p.state === "failed")
    .map(
      ([phase, p]) =>
        phase + ": " + (p.error || "This operation did not finish."),
    )
    .join(" ");
  const displayedError =
    error || (phaseFailure !== dismissedFailure ? phaseFailure : "");
  const [progress, setProgress] = useState("");
  const [includeResearch, setIncludeResearch] = useState(!job.privateConsent);
  useEffect(() => {
    if (job.inspection?.private) setIncludeResearch(false);
  }, [job.inspection?.private]);
  const mounted = useRef(true);
  const mediaRef = useRef<HTMLDetailsElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const previousRender = useRef(job.phases.render.state);
  const storiesRef = useRef<HTMLDivElement>(null);
  const modelReady = !!capabilities?.models.find((m) => m.provider === model)
    ?.configured;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (stage === "studio" && mediaRef.current) {
      mediaRef.current.open = true;
      mediaRef.current.scrollIntoView({ block: "start" });
    }
  }, [stage]);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState(job.name);
  const [links, setLinks] = useState("");
  const [site, setSite] = useState(job.requestedDemoUrl || job.site?.url || "");
  const [narration, setNarration] = useState("");
  const [approved, setApproved] = useState(false);
  const [useVoice, setUseVoice] = useState(false);
  const [useMusic, setUseMusic] = useState(false);
  const [useRecording, setUseRecording] = useState(false);
  const [useScreenshot, setUseScreenshot] = useState(false);
  const [useCaptions, setUseCaptions] = useState(true);
  const [videoFormat, setVideoFormat] = useState<"landscape" | "portrait">(
    "portrait",
  );
  const [musicPrompt, setMusicPrompt] = useState(
    "Minimal electronic instrumental for a developer project launch. Warm synth pulse, restrained percussion, optimistic build, clean ending. No vocals.",
  );
  const [scheduleTime, setScheduleTime] = useState("");
  const [musicApproved, setMusicApproved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const running =
    Object.values(job.phases).some((p) => p.state === "running") ||
    pending ||
    uploading;
  const chosen = job.positioning?.angles[job.selectedAngle];
  const savedCopy = selectedCopy(job);
  const [draftDirty, setDraftDirty] = useState(false);
  useEffect(() => {
    if (stage === "research" && job.positioning)
      storiesRef.current?.scrollIntoView({ block: "start" });
  }, [job.positioning?.generatedAt]);
  useEffect(() => {
    setNarration(job.narrationScript || savedCopy.narration || "");
    setApproved(false);
  }, [
    job.positioning?.generatedAt,
    job.selectedAngle,
    job.narrationScript,
    currentDrafts(job)?.updatedAt,
  ]);
  useEffect(() => {
    if (job.inspection?.homepage && !site) setSite(job.inspection.homepage);
  }, [job.inspection]);
  function downloadKit() {
    if (!chosen) return;
    const sections = [
      `# ${job.name} — launch kit`,
      "Drafts for review. Verify claims before publishing.",
      `## Positioning\n${chosen.title}\n\nAudience: ${chosen.audience}\n\n${chosen.rationale}`,
      `## LinkedIn draft\n${savedCopy.linkedin}`,
      `## X draft\n${savedCopy.x}`,
      `## Instagram caption\n${savedCopy.instagram}`,
      `## ${job.narrationScript ? "Generated narration script" : "Narration draft"}\n${job.narrationScript || savedCopy.narration}`,
    ];
    if (job.launchStrategy) {
      sections.push(
        `## Launch checklist\n${job.launchStrategy.checklist.map((item) => `- [ ] ${item}`).join("\n")}`,
      );
      sections.push(
        `## Channels\n${job.launchStrategy.channels.map((c) => `- ${c.name}: ${c.purpose} (${c.timing})`).join("\n")}`,
      );
    }
    const evidence = launchEvidence(job);
    sections.push(
      `## References\nRepository: ${job.repository}\nRevision: ${job.inspection?.revision || "Not inspected"}\nModel: ${job.positioning?.provider} / ${job.positioning?.model}\n\n${evidence
        .filter((e) => chosen.evidenceIds.includes(e.id))
        .map((e) => `- ${e.id}: ${e.title} — ${e.url}`)
        .join("\n")}`,
    );
    sections.push(
      "## Media\n" +
        (job.artifacts.length
          ? job.artifacts
              .map(
                (a) =>
                  `- ${a.type}: download separately from the launch pack. ${a.provenance}`,
              )
              .join("\n")
          : "No media prepared."),
    );
    const url = URL.createObjectURL(
      new Blob([sections.join("\n\n") + "\n"], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "sudo-launch-kit.md";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotice(
      "Launch kit downloaded. Drafts still need your review; media downloads are separate.",
    );
  }
  async function downloadZip() {
    setPending(true);
    setError("");
    try {
      const calendarDate = scheduleTime ? new Date(scheduleTime) : null;
      if (
        calendarDate &&
        (!Number.isFinite(calendarDate.getTime()) ||
          calendarDate.getTime() <= Date.now())
      )
        throw new Error(
          "Choose a future launch reminder time, or clear it before downloading.",
        );
      const calendarQuery = calendarDate
        ? `?start=${encodeURIComponent(calendarDate.toISOString())}`
        : "";
      const response = await fetch(
        `/api/jobs/${job.id}/pack.zip${calendarQuery}`,
        { credentials: "same-origin", signal: AbortSignal.timeout(60000) },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Launch ZIP could not be created.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${job.name.replace(/[^a-z0-9-]/gi, "-")}-launch-kit.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotice("Complete launch kit downloaded. Review it before publishing.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ZIP download failed.");
    } finally {
      setPending(false);
    }
  }
  async function act(path: string, body: unknown) {
    setPending(true);
    setError("");
    try {
      const next = await api<Job>(`/jobs/${job.id}/${path}`, body);
      if (!mounted.current) return null;
      onJob(next);
      onNotice(
        Object.values(next.phases).some((p) => p.state === "running")
          ? "Operation started. Results will update when complete."
          : "Launch updated.",
      );
      return next;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Operation failed.";
      if (mounted.current) {
        setError(message);
        onNotice(message);
      }
      return null;
    } finally {
      if (mounted.current) setPending(false);
    }
  }
  async function pollPhase(next: Job, phase: "research" | "position") {
    const deadline = Date.now() + 180_000;
    while (next.phases[phase].state === "running") {
      if (!mounted.current) throw new Error("The workspace was closed.");
      if (Date.now() > deadline)
        throw new Error(
          "This is taking longer than expected. Check progress before retrying.",
        );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      next = await getJob(job.id);
      if (mounted.current) onJob(next);
    }
    if (next.phases[phase].state === "failed")
      throw new Error(
        next.phases[phase].error || "This step failed. Try again.",
      );
    return next;
  }
  async function saveBrief() {
    const next = await act("brief", {
      audience: audience.trim(),
      goal: goal.trim(),
      context: context.trim(),
    });
    if (next) onStage("research");
  }
  async function generateStories() {
    if (!job.launchBrief || !modelReady || running) return;
    setPending(true);
    setError("");
    try {
      if (includeResearch) {
        const urls = links
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
        if (urls.length > 3) throw new Error("Use up to three research URLs.");
        setProgress("Collecting related projects and supplied pages…");
        const researched = await api<Job>("/jobs/" + job.id + "/research", {
          query: query.trim(),
          links: urls,
        });
        onJob(researched);
        await pollPhase(researched, "research");
      }
      if (!mounted.current) return;
      setProgress("Writing two launch stories and their post drafts…");
      const positioned = await api<Job>("/jobs/" + job.id + "/position", {
        provider: model,
      });
      onJob(positioned);
      await pollPhase(positioned, "position");
      if (mounted.current)
        onNotice(
          "Two launch stories are ready. Choose one to prepare your pack.",
        );
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "Could not generate launch stories.",
        );
    } finally {
      if (mounted.current) {
        setPending(false);
        setProgress("");
      }
    }
  }
  async function preparePack() {
    const next = await act("strategy", {});
    if (next) onStage("pack");
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      onNotice(label + " copied. Review before using.");
    } catch {
      setError(
        "Clipboard access is unavailable. Select the draft text to copy it manually.",
      );
    }
  }
  async function upload(
    file: File,
    kind: "recording" | "screenshot" = "recording",
  ) {
    if (file.size > (kind === "screenshot" ? 8_000_000 : 30_000_000)) {
      setError(
        kind === "screenshot"
          ? "Screenshot must be at most 8 MB."
          : "Recording must be at most 30 MB.",
      );
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type":
            file.type ||
            (kind === "screenshot"
              ? file.name.endsWith(".png")
                ? "image/png"
                : "image/jpeg"
              : file.name.endsWith(".webm")
                ? "video/webm"
                : "video/mp4"),
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onJob(data);
      if (kind === "screenshot") setUseScreenshot(true);
      else setUseRecording(true);
      onNotice(
        "Asset uploaded for validation. User-supplied footage is not automatic verification.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  const video = job.artifacts.find((a) => a.type === "video");
  const audio = job.artifacts.find((a) => a.type === "narration");
  const music = job.artifacts.find((a) => a.type === "music");
  const recording = job.artifacts.find((a) => a.type === "recording");
  const screenshot = job.artifacts.find((a) => a.type === "screenshot");
  const captionAsset = job.artifacts.find((a) => a.type === "captions");
  useEffect(() => {
    if (
      previousRender.current === "running" &&
      job.phases.render.state === "completed" &&
      videoRef.current
    ) {
      videoRef.current.load();
      if (mediaRef.current) mediaRef.current.open = true;
      videoRef.current.scrollIntoView({ block: "center" });
      videoRef.current.focus({ preventScroll: true });
      onNotice(
        "Your launch video is ready. Preview it, then download your assets.",
      );
    }
    previousRender.current = job.phases.render.state;
  }, [job.phases.render.state]);
  useEffect(() => {
    if (job.capture) setUseRecording(true);
  }, [job.capture?.capturedAt]);
  useEffect(() => {
    if (audio) setUseVoice(true);
  }, [audio?.url, job.narrationScript]);
  return (
    <section className="workspace-grid">
      <div
        className="stage-content guided-content"
        role="region"
        aria-label="Launch workspace"
        tabIndex={0}
      >
        {displayedError && (
          <div className="flow-error" role="alert">
            <strong>That step could not finish.</strong>
            <p>{displayedError}</p>
            <button
              className="text-button"
              onClick={() => {
                setError("");
                setDismissedFailure(phaseFailure);
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        {running && (
          <div className="flow-progress" role="status">
            <i />
            {job.progressStep ||
              progress ||
              Object.entries(job.phases)
                .filter(([, p]) => p.state === "running")
                .map(([name]) =>
                  name === "inspect"
                    ? "Reading your repository…"
                    : name === "analyze"
                      ? "Suggesting your product brief…"
                      : name === "render"
                        ? "Composing your video…"
                        : name === "music"
                          ? "Generating the music bed…"
                          : name === "narrate"
                            ? "Generating narration…"
                            : name === "position"
                              ? "Writing two launch stories…"
                              : "Collecting research…",
                )
                .join(" ") ||
              "Updating your launch…"}
            <span className="progress-sweep" aria-hidden="true" />
          </div>
        )}
        {stage === "overview" && (
          <>
            <header className="flow-heading">
              <span className="micro">STEP 1 / PROJECT BRIEF</span>
              <h2>Let’s understand your project.</h2>
              <p>
                We read the source first. Review the suggested audience and
                goal, then make the brief yours.
              </p>
            </header>
            <p className="footnote launch-note">
              Review your launch claims before publishing. Reading source does
              not verify every feature.
            </p>
            <div className="brief-layout">
              <form
                className="brief-editor"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveBrief();
                }}
              >
                <label htmlFor="edit-audience">Who is it for?</label>
                <input
                  id="edit-audience"
                  value={audience}
                  onChange={(e) => {
                    editedBrief.current = true;
                    setAudience(e.target.value);
                  }}
                  required
                  minLength={3}
                  maxLength={250}
                  placeholder="e.g. student developers learning Solana"
                  disabled={running}
                />
                <label htmlFor="edit-goal">
                  What should this launch achieve?
                </label>
                <input
                  id="edit-goal"
                  value={goal}
                  onChange={(e) => {
                    editedBrief.current = true;
                    setGoal(e.target.value);
                  }}
                  required
                  minLength={3}
                  maxLength={250}
                  placeholder="e.g. find five testers and collect feedback"
                  disabled={running}
                />
                <label htmlFor="edit-context">
                  Anything we should know? <span className="dim">Optional</span>
                </label>
                <textarea
                  id="edit-context"
                  value={context}
                  onChange={(e) => {
                    editedBrief.current = true;
                    setContext(e.target.value);
                  }}
                  maxLength={600}
                  placeholder="What works today, what is still a prototype, and what makes it useful."
                  disabled={running}
                />
                {job.positioning && (
                  <p className="footnote">
                    Changing this brief clears the previous stories, plan and
                    generated media. Your source and uploaded recording stay
                    available.
                  </p>
                )}
                <div className="flow-actions">
                  <button
                    className="primary"
                    disabled={running || !job.inspection}
                  >
                    Continue to launch stories →
                  </button>
                  <span>
                    {job.analysis
                      ? "Suggestions need your confirmation."
                      : "You can write the brief yourself."}
                  </span>
                </div>
                {!job.inspection && !running && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => void act("inspect", {})}
                  >
                    Retry reading the repository →
                  </button>
                )}
              </form>
              <aside className="brief-preview">
                <span className="micro">
                  {job.analysis
                    ? "SOURCE-BASED PRODUCT SUMMARY"
                    : "FROM YOUR REPOSITORY"}
                </span>
                <h3>{job.name}</h3>
                <p>
                  {job.analysis?.summary ||
                    job.inspection?.description ||
                    "No repository description available. Add useful context to your brief."}
                </p>
                <div className="brief-source-summary">
                  <span>
                    {job.inspection
                      ? job.inspection.files.length + " files read"
                      : "Reading source…"}
                  </span>
                  <span>
                    {job.inspection
                      ? job.inspection.evidence.length + " source references"
                      : "References pending"}
                  </span>
                </div>
                <span className="footnote">
                  We read selected files with your permission. README plans may
                  differ from implemented features; you review the claims.
                </span>
                {job.analysis && (
                  <>
                    <h4>Assumptions to confirm</h4>
                    <ul className="assumption-list">
                      {job.analysis.assumptions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                    <span className="footnote">
                      Suggested by {job.analysis.model} ·{" "}
                      {job.analysis.evidenceIds.length} source references
                    </span>
                  </>
                )}
                {job.inspection && !job.analysis && !running && (
                  <button
                    className="text-button"
                    disabled={!modelReady}
                    onClick={() => void act("analyze", { provider: model })}
                  >
                    {modelReady
                      ? "Suggest my brief with the model →"
                      : "Model suggestions need a configured provider"}
                  </button>
                )}
                <h4>What you’ll get</h4>
                <ul className="included-list">
                  <li>Two audience-specific launch stories</li>
                  <li>LinkedIn and X post drafts</li>
                  <li>A sharing plan and launch checklist</li>
                  <li>Optional recording and voiceover</li>
                </ul>
              </aside>
            </div>

            <details className="source-disclosure">
              <summary>
                <span>Source evidence & review notes</span>
                <span className="footnote">
                  {job.inspection
                    ? `${job.inspection.evidence.length} references · ${job.inspection.warnings.length + job.inspection.blockers.length} notes`
                    : "Inspection pending"}
                </span>
              </summary>
              <div className="source-disclosure-body">
                <p className="footnote">
                  Public source is read at a recorded commit. Scripts and
                  runtime interactions are not executed.
                </p>
                <button
                  className="outline compact-action"
                  disabled={running}
                  onClick={() => void act("inspect", {})}
                >
                  Refresh source →
                </button>
                {job.inspection ? (
                  <>
                    <div className="source-metadata">
                      <span>
                        Profile{" "}
                        <strong>
                          {job.inspection.profile.replaceAll("_", " ")}
                        </strong>
                      </span>
                      <span>
                        Revision{" "}
                        <strong>{job.inspection.revision.slice(0, 12)}</strong>
                      </span>
                      <span>
                        Branch <strong>{job.inspection.branch}</strong>
                      </span>
                    </div>
                    {[
                      ...job.inspection.blockers,
                      ...job.inspection.warnings,
                    ].map((note, i) => (
                      <p className="review-note" key={i}>
                        <span className="amber">Review / </span>
                        {note}
                      </p>
                    ))}
                    {job.inspection.evidence.map((e) => (
                      <details key={e.id} className="evidence-detail">
                        <summary>
                          {e.title}
                          <span>{e.id}</span>
                        </summary>
                        <a href={e.url} target="_blank" rel="noreferrer">
                          View source ↗
                        </a>
                        <pre>{e.excerpt}</pre>
                      </details>
                    ))}
                  </>
                ) : (
                  <p>
                    {job.phases.inspect.error ||
                      "Reading repository metadata and selected source files…"}
                  </p>
                )}
              </div>
            </details>
          </>
        )}
        {stage === "research" && (
          <>
            <header className="flow-heading">
              <span className="micro">STEP 2 / LAUNCH STORY</span>
              <h2>Choose how to introduce your project.</h2>
              <p>
                We use your source and brief to draft two stories. Choose the
                one you want to launch.
              </p>
            </header>
            <div className="brief-reminder">
              <div>
                <span>Audience</span>
                <strong>
                  {job.launchBrief?.audience ||
                    "Complete your project brief first"}
                </strong>
              </div>
              <div>
                <span>Goal</span>
                <strong>{job.launchBrief?.goal || "Not set"}</strong>
              </div>
              <button
                className="text-button"
                onClick={() => onStage("overview")}
              >
                Edit brief
              </button>
            </div>
            <details className="research-options">
              <summary>
                Research settings{" "}
                <span className="footnote">
                  Optional · bounded GitHub search + supplied pages
                </span>
              </summary>
              <div className="research-options-body">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={includeResearch}
                    onChange={(e) => setIncludeResearch(e.target.checked)}
                    disabled={running}
                  />
                  Research related projects before writing
                </label>
                <p className="footnote">
                  Searches send your topic to public services; keep private
                  names and details out of the query. These sources give
                  context. They do not prove uniqueness or whether a product has
                  already launched. Social search is not connected yet.
                </p>
                {includeResearch && (
                  <>
                    <label htmlFor="research-query">Search topic</label>
                    <input
                      id="research-query"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      required
                      minLength={2}
                      maxLength={120}
                      placeholder="e.g. Solana payments chat"
                      disabled={running}
                    />
                    <label htmlFor="research-links">
                      Related product or article URLs{" "}
                      <span className="dim">Optional · up to 3</span>
                    </label>
                    <textarea
                      id="research-links"
                      value={links}
                      onChange={(e) => setLinks(e.target.value)}
                      placeholder="One https:// URL per line"
                      disabled={running}
                    />
                  </>
                )}
                <details className="project-link-options">
                  <summary>
                    Existing project URL <span className="dim">Optional</span>
                  </summary>
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act("verify", { url: site });
                    }}
                  >
                    <label htmlFor="live-url">Public HTTPS project link</label>
                    <input
                      id="live-url"
                      type="url"
                      required
                      value={site}
                      onChange={(e) => setSite(e.target.value)}
                      placeholder="https://your-project.example"
                      disabled={running}
                    />
                    <button
                      className="outline compact-action"
                      disabled={running}
                    >
                      Check link →
                    </button>
                    <p className="footnote">
                      This checks reachability, not product behavior. Checking a
                      new link clears generated stories so they can use the
                      updated context.
                    </p>
                  </form>
                  {job.site && (
                    <p className="footnote">
                      HTTP {job.site.httpStatus} ·{" "}
                      {job.site.reachable ? "Reachable" : "Not reachable"} ·
                      interactions not checked
                    </p>
                  )}
                </details>
              </div>
            </details>
            <div className="generation-controls">
              <div className="model-summary">
                <span className="micro">GENERATION MODEL</span>
                <strong>
                  {capabilities?.models.find((m) => m.provider === model)
                    ?.model || model}
                  {!modelReady && " · not connected"}
                </strong>
                <button className="text-button" onClick={onSettings}>
                  Change model
                </button>
              </div>
              {modelReady ? (
                <button
                  className={
                    job.positioning ? "outline compact-action" : "primary"
                  }
                  disabled={
                    running ||
                    !job.inspection ||
                    !job.launchBrief ||
                    (includeResearch && query.trim().length < 2)
                  }
                  onClick={() => void generateStories()}
                >
                  {job.positioning
                    ? "Regenerate both stories"
                    : "Generate two launch stories"}{" "}
                  →
                </button>
              ) : (
                <button className="primary" onClick={onSettings}>
                  Open model setup →
                </button>
              )}
            </div>
            <p className="footnote">
              {modelReady
                ? "Uses the selected model’s quota. You review the output before publishing."
                : "Connect a model to generate stories."}{" "}
              {job.positioning &&
                "Regeneration replaces the current stories, plan and generated media."}
            </p>
            {!job.launchBrief && (
              <div className="setup-needed">
                <strong>Your audience and goal are missing.</strong>
                <button
                  className="text-button"
                  onClick={() => onStage("overview")}
                >
                  Complete the brief →
                </button>
              </div>
            )}
            {job.positioning && (
              <>
                <div
                  className="story-grid"
                  ref={storiesRef}
                  role="group"
                  aria-label="Launch story choices"
                >
                  {job.positioning.angles.map((a, i) => (
                    <button
                      key={a.title}
                      className={
                        "story-card " +
                        (job.selectedAngle === i ? "selected" : "")
                      }
                      aria-pressed={job.selectedAngle === i}
                      disabled={running}
                      onClick={() => void act("angle", { index: i })}
                    >
                      <div className="story-card-top">
                        <span className="micro">STORY 0{i + 1}</span>
                        <span>
                          {job.selectedAngle === i
                            ? "✓ Selected"
                            : "Select story"}
                        </span>
                      </div>
                      <h3>{a.title}</h3>
                      <span className="story-audience">{a.audience}</span>
                      <p>{a.rationale}</p>
                      <div className="story-hook">
                        <span className="micro">X DRAFT PREVIEW</span>
                        <p>{a.x}</p>
                      </div>
                      <span className="footnote">
                        {a.evidenceIds.length} supporting references · review
                        claims
                      </span>
                    </button>
                  ))}
                </div>
                {!!job.positioning.limitations.length && (
                  <details className="source-disclosure">
                    <summary>What needs your review</summary>
                    <div className="source-disclosure-body">
                      {job.positioning.limitations.map((l) => (
                        <p className="review-note" key={l}>
                          {l}
                        </p>
                      ))}
                    </div>
                  </details>
                )}
                <div className="flow-actions story-confirm">
                  <div>
                    <span className="micro">SELECTED STORY</span>
                    <strong>{chosen?.title}</strong>
                  </div>
                  <button
                    className="primary"
                    disabled={running || !chosen}
                    onClick={() => void preparePack()}
                  >
                    Use this story & prepare my pack →
                  </button>
                </div>
              </>
            )}
            {job.research && (
              <details className="source-disclosure">
                <summary>
                  Research sources{" "}
                  <span className="footnote">
                    {job.research.sources.length} found
                  </span>
                </summary>
                <div className="source-disclosure-body">
                  <p className="footnote">{job.research.coverage}</p>
                  {job.research.sources.map((e) => (
                    <details className="evidence-detail" key={e.id}>
                      <summary>{e.title}</summary>
                      <a href={e.url} target="_blank" rel="noreferrer">
                        Open source ↗
                      </a>
                      <p>{e.excerpt}</p>
                      <span className="footnote">{e.checkedAt}</span>
                    </details>
                  ))}
                  {!job.research.sources.length && (
                    <p>
                      No matches found. That does not establish originality.
                    </p>
                  )}
                </div>
              </details>
            )}
          </>
        )}
        {["pack", "strategy", "studio"].includes(stage) && (
          <>
            <header className="flow-heading pack-heading">
              <div>
                <span className="micro">STEP 3 / LAUNCH PACK</span>
                <h2>Review it. Make it yours. Launch.</h2>
                <p>
                  Copy or download your drafts and publish them yourself. Video
                  is optional.
                </p>
              </div>
              <button
                className="primary"
                disabled={!chosen || running || draftDirty}
                onClick={() => void downloadZip()}
              >
                Download complete ZIP ↓
              </button>
            </header>
            {chosen ? (
              <>
                <div className="selected-story">
                  <div>
                    <span className="micro">YOUR LAUNCH STORY</span>
                    <h3>{chosen.title}</h3>
                    <p>{chosen.audience}</p>
                  </div>
                  <button
                    className="text-button"
                    disabled={draftDirty}
                    onClick={() => onStage("research")}
                  >
                    Change story →
                  </button>
                </div>
                <DraftEditor
                  job={job}
                  busy={running}
                  onJob={onJob}
                  onNotice={onNotice}
                  onDirtyChange={setDraftDirty}
                />
                {draftDirty && (
                  <p className="footnote" role="status">
                    Save or discard your edits to update downloads, Instagram
                    slides and reminders.
                  </p>
                )}
                <button
                  className="text-button"
                  disabled={running || draftDirty}
                  onClick={downloadKit}
                >
                  Download text draft ↓
                </button>
                <details className="pack-section" aria-label="Carousel section">
                  <summary>
                    <span>
                      <strong>Instagram carousel</strong>
                      <small>Five slides from your launch story</small>
                    </span>
                    <span className="section-status">
                      {job.carousel ? "Slides prepared" : "Optional"}
                    </span>
                  </summary>
                  <div className="pack-section-body">
                    <InstagramPack
                      job={job}
                      busy={running || draftDirty}
                      available={
                        capabilities?.carousel ?? !!capabilities?.promo
                      }
                      onGenerate={() => void act("carousel", {})}
                    />
                  </div>
                </details>
              </>
            ) : (
              <div className="setup-needed">
                <strong>Your launch pack needs a story.</strong>
                <p>
                  Generate and choose a launch story first. No placeholder
                  drafts will be inserted.
                </p>
                <button className="primary" onClick={() => onStage("research")}>
                  Choose a launch story →
                </button>
              </div>
            )}

            <details className="media-addon pack-section" ref={mediaRef}>
              <summary>
                <span>
                  <strong>Create a launch video</strong>
                  <small>Real visuals, ElevenLabs voice and captions</small>
                </span>
                <span className="section-status">
                  {video ? "Video ready" : "Optional"}
                </span>
              </summary>
              <div className="media-addon-body">
                <p className="section-intro">
                  Build a 25-second reel. Add visuals, review the voiceover,
                  then render.
                </p>
                {video && (
                  <div className="finished-video">
                    <video
                      ref={videoRef}
                      aria-label="Rendered launch video"
                      tabIndex={0}
                      className="video-preview"
                      src={video.url}
                      poster={
                        job.artifacts.find((a) => a.type === "poster")?.url
                      }
                      controls
                      preload="metadata"
                    />
                    <a
                      className="outline compact-action"
                      href={video.url}
                      download
                    >
                      Download video ↓
                    </a>
                  </div>
                )}
                <details
                  className="video-step"
                  name={`video-workflow-${job.id}`}
                  open
                >
                  <summary>
                    <span className="step-number">1</span>
                    <span>
                      <strong>Product visuals</strong>
                      <small>Upload footage or record a public demo</small>
                    </span>
                  </summary>
                  <div className="video-step-body">
                    <CaptureControls
                      job={job}
                      busy={running}
                      available={!!capabilities?.promo}
                      recorderAvailable={!!capabilities?.capture}
                      format={videoFormat}
                      onCapture={(body) => void act("capture", body)}
                      onScreenshot={(file) => void upload(file, "screenshot")}
                    />
                    <label className="upload-control">
                      Upload recording
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        disabled={running || !capabilities?.render}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void upload(f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <p className="footnote">
                      No footage? Create a branded product explainer instead of
                      a code scene. MP4/WebM uploads: 3–120 seconds, up to 30
                      MB.
                    </p>
                  </div>
                </details>
                <details
                  className="video-step"
                  name={`video-workflow-${job.id}`}
                >
                  <summary>
                    <span className="step-number">2</span>
                    <span>
                      <strong>Voice & captions</strong>
                      <small>
                        Review the script before using ElevenLabs quota
                      </small>
                    </span>
                  </summary>
                  <div className="video-step-body">
                    <form
                      className="inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void act("narrate", {
                          text: narration,
                          approved: true,
                        });
                      }}
                    >
                      <label htmlFor="narration">
                        Review and edit narration
                      </label>
                      <textarea
                        id="narration"
                        value={narration}
                        onChange={(e) => {
                          setNarration(e.target.value);
                          setApproved(false);
                        }}
                        maxLength={600}
                        placeholder="Generate positioning first, then review the proposed narration."
                      />
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={approved}
                          onChange={(e) => setApproved(e.target.checked)}
                        />
                        I reviewed the script and approve sending it to
                        ElevenLabs using my quota.
                      </label>
                      <button
                        className="outline"
                        disabled={
                          running ||
                          draftDirty ||
                          !approved ||
                          !job.positioning ||
                          !capabilities?.narration ||
                          narration.length < 10
                        }
                      >
                        Generate narration →
                      </button>
                    </form>
                    {audio && <audio src={audio.url} controls />}

                    <details className="video-advanced">
                      <summary>Optional background music</summary>
                      <div className="music-controls">
                        <label htmlFor="music-prompt">
                          Optional instrumental music
                        </label>
                        <textarea
                          id="music-prompt"
                          value={musicPrompt}
                          maxLength={500}
                          onChange={(e) => {
                            setMusicPrompt(e.target.value);
                            setMusicApproved(false);
                          }}
                        />
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={musicApproved}
                            onChange={(e) => setMusicApproved(e.target.checked)}
                          />
                          I approve sending this prompt to ElevenLabs and using
                          my music quota.
                        </label>
                        <button
                          className="outline"
                          disabled={
                            running ||
                            !musicApproved ||
                            !chosen ||
                            !capabilities?.music
                          }
                          onClick={() =>
                            void act("music", {
                              prompt: musicPrompt,
                              approved: true,
                            })
                          }
                        >
                          Generate music bed →
                        </button>
                        {music && <audio src={music.url} controls />}
                      </div>
                    </details>
                    {!capabilities?.narration && (
                      <p className="footnote">
                        Configure an ElevenLabs key and voice in Settings to
                        enable narration.
                      </p>
                    )}
                  </div>
                </details>
                <details
                  className="video-step"
                  name={`video-workflow-${job.id}`}
                >
                  <summary>
                    <span className="step-number">3</span>
                    <span>
                      <strong>Review & render</strong>
                      <small>Check the storyboard and export your reel</small>
                    </span>
                  </summary>
                  <div className="video-step-body">
                    <label htmlFor="video-format">Video format</label>
                    <select
                      id="video-format"
                      value={videoFormat}
                      disabled={running}
                      onChange={(e) =>
                        setVideoFormat(
                          e.target.value as "landscape" | "portrait",
                        )
                      }
                    >
                      <option value="portrait">
                        Portrait · 1080×1920 · Reels / Shorts
                      </option>
                      <option value="landscape">
                        Landscape · 1280×720 · LinkedIn / X
                      </option>
                    </select>
                    {!job.storyboard ? (
                      <button
                        className="outline"
                        disabled={running || !chosen}
                        onClick={() =>
                          void act("storyboard", {
                            visual:
                              useRecording && recording
                                ? "recording"
                                : useScreenshot && screenshot
                                  ? "screenshot"
                                  : "source",
                          })
                        }
                      >
                        Prepare video storyboard →
                      </button>
                    ) : (
                      <>
                        <div
                          className="storyboard-grid"
                          aria-label="Video storyboard"
                        >
                          {job.storyboard.scenes.map((scene, i) => (
                            <article
                              className="storyboard-scene"
                              key={scene.label}
                            >
                              <span className="micro">
                                0{i + 1} / {scene.seconds}s
                              </span>
                              <h4>{scene.heading}</h4>
                              <p>{scene.detail}</p>
                            </article>
                          ))}
                        </div>
                        <div className="studio-controls">
                          <button
                            className="outline"
                            disabled={running}
                            onClick={() =>
                              void act("storyboard", {
                                visual:
                                  useRecording && recording
                                    ? "recording"
                                    : useScreenshot && screenshot
                                      ? "screenshot"
                                      : "source",
                              })
                            }
                          >
                            Refresh storyboard →
                          </button>
                        </div>
                        <details className="video-advanced">
                          <summary>Storyboard exports</summary>
                          <div className="studio-controls">
                            {" "}
                            <button
                              className="text-button"
                              onClick={() => {
                                const link = document.createElement("a");
                                const url = URL.createObjectURL(
                                  new Blob(
                                    [JSON.stringify(job.storyboard, null, 2)],
                                    { type: "application/json" },
                                  ),
                                );
                                link.href = url;
                                link.download = "sudo-storyboard.json";
                                link.click();
                                setTimeout(
                                  () => URL.revokeObjectURL(url),
                                  1000,
                                );
                              }}
                            >
                              Download storyboard ↓
                            </button>
                            <a href={`/api/jobs/${job.id}/brag`} download>
                              Export to Brag ↗
                            </a>
                          </div>
                        </details>
                      </>
                    )}

                    <details className="video-advanced">
                      <summary>Audio, visuals & caption options</summary>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={useVoice}
                          onChange={(e) => setUseVoice(e.target.checked)}
                          disabled={!audio}
                        />
                        Include generated narration
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={useMusic}
                          onChange={(e) => setUseMusic(e.target.checked)}
                          disabled={!music}
                        />
                        Include generated music
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={useRecording}
                          onChange={(e) => setUseRecording(e.target.checked)}
                          disabled={!recording}
                        />
                        Use my recording in the middle scene
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={useScreenshot}
                          disabled={!screenshot || useRecording}
                          onChange={(e) => setUseScreenshot(e.target.checked)}
                        />
                        Use my screenshot in the middle scene
                      </label>
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={useCaptions}
                          disabled={!captionAsset || !useVoice}
                          onChange={(e) => setUseCaptions(e.target.checked)}
                        />
                        Burn captions aligned to my narration
                      </label>
                    </details>
                    <div className="studio-controls">
                      <button
                        className="primary"
                        disabled={
                          running ||
                          draftDirty ||
                          !job.storyboard ||
                          !capabilities?.promo
                        }
                        onClick={() =>
                          void act("promo", {
                            useNarration: useVoice && !!audio,
                            useMusic: useMusic && !!music,
                            useRecording: useRecording && !!recording,
                            useScreenshot:
                              useScreenshot && !!screenshot && !useRecording,
                            useCaptions:
                              useCaptions && !!captionAsset && useVoice,
                            format: videoFormat,
                          })
                        }
                      >
                        Render launch promo →
                      </button>
                    </div>

                    {recording && (
                      <details className="video-advanced">
                        <summary>Export footage without the storyboard</summary>
                        {recording && (
                          <button
                            className="outline"
                            disabled={running || !capabilities?.render}
                            onClick={() =>
                              void act("render", {
                                useNarration: useVoice && !!audio,
                              })
                            }
                          >
                            Render recording only →
                          </button>
                        )}
                      </details>
                    )}
                    <p className="footnote">
                      25 seconds ·{" "}
                      {videoFormat === "portrait" ? "1080×1920" : "1280×720"}{" "}
                      MP4. Review the final claims and captions before sharing.
                    </p>
                    {!capabilities?.promo && (
                      <p className="footnote">
                        Video composition requires FFmpeg and Chromium in your
                        local setup.
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </details>
            {chosen && (
              <details className="pack-section planning-section">
                <summary>
                  <span>
                    <strong>Launch plan & reminders</strong>
                    <small>Optional checklist and calendar export</small>
                  </span>
                </summary>
                <div className="pack-section-body">
                  <section className="sharing-plan">
                    <div className="section-heading">
                      <h3>Your launch plan</h3>
                      {!job.launchStrategy && (
                        <button
                          className="outline compact-action"
                          disabled={running}
                          onClick={() => void act("strategy", {})}
                        >
                          Prepare launch plan →
                        </button>
                      )}
                    </div>
                    {job.launchStrategy ? (
                      <>
                        <div className="channel-grid">
                          {job.launchStrategy.channels.map((c) => (
                            <article key={c.name}>
                              <span className="micro">{c.name}</span>
                              <p>{c.purpose}</p>
                              <span className="footnote">{c.timing}</span>
                            </article>
                          ))}
                        </div>
                        <details className="launch-checklist-disclosure">
                          <summary>
                            Before you share ·{" "}
                            {job.launchStrategy.checklist.length} checklist
                            items
                          </summary>
                          <ol className="launch-checklist">
                            {job.launchStrategy.checklist.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ol>
                        </details>
                      </>
                    ) : (
                      <p className="footnote">
                        Prepare the sharing checklist for your selected story.
                      </p>
                    )}
                  </section>{" "}
                  {chosen && (
                    <section className="launch-calendar">
                      <h3>Plan your launch week.</h3>
                      <p>
                        Set reminders for LinkedIn, X, Instagram and a feedback
                        follow-up. Import the calendar into Google Calendar,
                        Apple Calendar or Outlook, then review and publish each
                        post yourself.
                      </p>
                      <label htmlFor="schedule-time">
                        First post time · your local timezone
                      </label>
                      <input
                        id="schedule-time"
                        type="datetime-local"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                      <button
                        className="outline"
                        disabled={!scheduleTime || draftDirty || running}
                        onClick={() => {
                          const date = new Date(scheduleTime);
                          if (
                            !Number.isFinite(date.getTime()) ||
                            date.getTime() <= Date.now()
                          ) {
                            setError("Choose a future post time.");
                            return;
                          }
                          const link = document.createElement("a");
                          link.href = `/api/jobs/${job.id}/calendar?start=${encodeURIComponent(date.toISOString())}`;
                          link.download = "sudo-launch-calendar.ics";
                          link.click();
                        }}
                      >
                        Download launch calendar →
                      </button>
                      <p className="footnote">
                        Calendar reminders are scheduled. Social posts are not
                        published automatically.
                      </p>
                    </section>
                  )}
                </div>
              </details>
            )}
            <details className="source-disclosure">
              <summary>
                Individual downloads & sources{" "}
                <span className="footnote">
                  Inspect what informed this pack
                </span>
              </summary>
              <div className="source-disclosure-body">
                {!!job.artifacts.length && (
                  <div className="artifact-list">
                    {job.artifacts.map((a) => (
                      <div key={a.type}>
                        <a href={a.url} download>
                          {"Download " + a.type} ↓
                        </a>
                        <span className="footnote">{a.provenance}</span>
                      </div>
                    ))}
                  </div>
                )}
                <a
                  className="outline compact-action"
                  href={"/api/jobs/" + job.id + "/receipt"}
                  download
                >
                  Download evidence receipt ↓
                </a>
                <p className="footnote">
                  The receipt records the inspected commit, actual model use,
                  research and media provenance. User footage is not independent
                  verification.
                </p>
                {chosen?.evidenceIds.map((id) => {
                  const evidence = launchEvidence(job).find((e) => e.id === id);
                  return (
                    evidence && (
                      <p key={id}>
                        <a href={evidence.url} target="_blank" rel="noreferrer">
                          {evidence.title} ↗
                        </a>
                        <span className="footnote"> · {id}</span>
                      </p>
                    )
                  );
                })}
              </div>
            </details>
          </>
        )}
        <details className="context-panel">
          <summary>Run details · source, model & saved memory</summary>
          <div className="context-details">
            <div className="context-item">
              <span>Repository</span>
              <strong>{job.name}</strong>
            </div>
            <div className="context-item">
              <span>Mode</span>
              <strong>
                {capabilities?.mode === "hosted-demo" ? "Hosted demo" : "Local backend"} ·{" "}
                {job.inspection?.private ? "private source" : "public source"}
              </strong>
            </div>
            <div className="context-item">
              <span>Actual model use</span>
              <strong>
                {job.positioning
                  ? `${job.positioning.provider} / ${job.positioning.model}`
                  : "Not run"}
              </strong>
            </div>
            <div className="context-item">
              <span>Source revision</span>
              <strong>
                {job.inspection?.revision.slice(0, 12) || "Pending inspection"}
              </strong>
            </div>
            <div className="context-item">
              <span>Job expiry</span>
              <strong>{new Date(job.expiresAt).toLocaleString()}</strong>
              <small>
                {capabilities?.storage
                  ? `Saved in SQLite · ${capabilities.storage.retentionDays}-day retention`
                  : "Local job storage"}
              </small>
            </div>
            <button className="outline" onClick={onSettings}>
              Configure preferences ↗
            </button>
            <button
              className="outline"
              disabled={running}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete local job ${job.name} and its stored artifacts?`,
                  )
                ) {
                  void api<void>(`/jobs/${job.id}`, undefined, "DELETE")
                    .then(onDeleted)
                    .catch((e) => onNotice(e.message));
                }
              }}
            >
              Delete local job
            </button>
            <div className="context-note">
              <span className="red">&gt;</span>
              <p>
                {job.inspection
                  ? "Source inspected."
                  : "Source inspection incomplete."}
                <br />
                Interactions require their own evidence.
              </p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
