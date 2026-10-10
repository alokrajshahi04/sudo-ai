import { useEffect, useRef, useState } from "react";
import type { Job, Capabilities, ModelProvider } from "../shared/types";
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
  const [audience, setAudience] = useState(job.launchBrief?.audience || "");
  const [goal, setGoal] = useState(job.launchBrief?.goal || "");
  const [context, setContext] = useState(
    job.launchBrief?.context ||
      (job.launchBrief
        ? ""
        : job.brief
            .replace(/Audience and launch goal:\s*$/i, "")
            .replace(/^Product context:\s*/i, "")
            .trim()),
  );
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
  const [includeResearch, setIncludeResearch] = useState(true);
  const mounted = useRef(true);
  const mediaRef = useRef<HTMLDetailsElement>(null);
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
  const [site, setSite] = useState("");
  const [narration, setNarration] = useState("");
  const [approved, setApproved] = useState(false);
  const [useVoice, setUseVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const running =
    Object.values(job.phases).some((p) => p.state === "running") ||
    pending ||
    uploading;
  const chosen = job.positioning?.angles[job.selectedAngle];
  useEffect(() => {
    if (stage === "research" && job.positioning)
      storiesRef.current?.scrollIntoView({ block: "start" });
  }, [job.positioning?.generatedAt]);
  useEffect(() => {
    setNarration(chosen?.narration || "");
    setApproved(false);
  }, [job.positioning, job.selectedAngle]);
  useEffect(() => {
    if (job.inspection?.homepage && !site) setSite(job.inspection.homepage);
  }, [job.inspection]);
  function downloadKit() {
    if (!chosen) return;
    const sections = [
      `# ${job.name} — launch kit`,
      "Drafts for review. Verify claims before publishing.",
      `## Positioning\n${chosen.title}\n\nAudience: ${chosen.audience}\n\n${chosen.rationale}`,
      `## LinkedIn draft\n${chosen.linkedin}`,
      `## X draft\n${chosen.x}`,
      `## Narration draft\n${chosen.narration}`,
    ];
    if (job.launchStrategy) {
      sections.push(
        `## Launch checklist\n${job.launchStrategy.checklist.map((item) => `- [ ] ${item}`).join("\n")}`,
      );
      sections.push(
        `## Channels\n${job.launchStrategy.channels.map((c) => `- ${c.name}: ${c.purpose} (${c.timing})`).join("\n")}`,
      );
    }
    const evidence = [
      ...(job.inspection?.evidence || []),
      ...(job.research?.sources || []),
    ];
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
      onNotice(label + " draft copied. Review before posting.");
    } catch {
      setError(
        "Clipboard access is unavailable. Select the draft text to copy it manually.",
      );
    }
  }
  async function upload(file: File) {
    if (file.size > 30_000_000) {
      setError("Recording must be at most 30 MB.");
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/recording`, {
        method: "POST",
        headers: {
          "Content-Type":
            file.type ||
            (file.name.endsWith(".webm") ? "video/webm" : "video/mp4"),
        },
        body: file,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onJob(data);
      onNotice(
        "Recording uploaded for validation. User-supplied footage is not automatic verification.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }
  const video = job.artifacts.find((a) => a.type === "video");
  const audio = job.artifacts.find((a) => a.type === "narration");
  const recording = job.artifacts.find((a) => a.type === "recording");
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
            {progress ||
              Object.entries(job.phases)
                .filter(([, p]) => p.state === "running")
                .map(([name]) =>
                  name === "inspect"
                    ? "Reading your repository…"
                    : name === "position"
                      ? "Writing two launch stories…"
                      : "Collecting research…",
                )
                .join(" ") ||
              "Updating your launch…"}
          </div>
        )}
        {stage === "overview" && (
          <>
            <header className="flow-heading">
              <span className="micro">STEP 1 / PROJECT BRIEF</span>
              <h2>Who are we launching this for?</h2>
              <p>
                Your repository tells us what you built. Your brief tells us who
                should care.
              </p>
            </header>
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
                  onChange={(e) => setAudience(e.target.value)}
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
                  onChange={(e) => setGoal(e.target.value)}
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
                  onChange={(e) => setContext(e.target.value)}
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
                  <span>No model call yet.</span>
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
                <span className="micro">FROM YOUR REPOSITORY</span>
                <h3>{job.name}</h3>
                <p>
                  {job.inspection?.description ||
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
                  We read selected public files. README plans may differ from
                  implemented features; you review the claims.
                </span>
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
                  These sources give context. They do not prove uniqueness or
                  whether a product has already launched. Social search is not
                  connected yet.
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
                disabled={!chosen || running}
                onClick={downloadKit}
              >
                Download launch kit ↓
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
                    onClick={() => onStage("research")}
                  >
                    Change story →
                  </button>
                </div>
                <div className="pack-draft-grid">
                  {(["linkedin", "x"] as const).map((channel) => (
                    <article className="draft-card" key={channel}>
                      <div className="draft-card-head">
                        <h3>
                          {channel === "linkedin" ? "LinkedIn post" : "X post"}
                        </h3>
                        <span className="footnote">
                          Draft · review before sharing
                        </span>
                      </div>
                      <p className="preserve-lines">{chosen[channel]}</p>
                      <button
                        className="outline compact-action"
                        onClick={() =>
                          void copy(
                            chosen[channel],
                            channel === "linkedin" ? "LinkedIn" : "X",
                          )
                        }
                      >
                        Copy {channel === "linkedin" ? "LinkedIn" : "X"} draft →
                      </button>
                    </article>
                  ))}
                </div>
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
                          {job.launchStrategy.checklist.length} checklist items
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
                </section>
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
            <details className="media-addon" ref={mediaRef}>
              <summary>
                <div>
                  <span className="micro">OPTIONAL</span>
                  <strong>Add a demo video or voiceover</strong>
                </div>
                <span className="footnote">
                  {video ? "Video prepared" : "Use your own footage"} +
                </span>
              </summary>
              <div className="media-addon-body">
                {" "}
                <span className="micro">04 / DEMO STUDIO</span>
                <h2>Show it actually working.</h2>
                <p className="section-intro">
                  Upload a real usage recording. Footage retains user-supplied
                  provenance.
                </p>
                {video ? (
                  <video
                    className="video-preview"
                    src={video.url}
                    controls
                    preload="metadata"
                  />
                ) : (
                  <div className="video-placeholder">
                    <span className="play-outline">▷</span>
                    <span>
                      {recording
                        ? "Recording ready to render"
                        : "No recording uploaded"}
                    </span>
                    <span className="footnote">
                      MP4 / WebM · 3–120 seconds · up to 30 MB
                    </span>
                  </div>
                )}
                {!capabilities?.render && (
                  <p className="setup-needed">
                    Video rendering is unavailable in this local setup. Install
                    FFmpeg and restart the server to enable it. Your text launch
                    pack is ready to use separately.
                  </p>
                )}
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
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void act("narrate", { text: narration, approved: true });
                  }}
                >
                  <label htmlFor="narration">Review and edit narration</label>
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
                    I reviewed the script and approve sending it to ElevenLabs
                    using my quota.
                  </label>
                  <button
                    className="outline"
                    disabled={
                      running ||
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
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={useVoice}
                    onChange={(e) => setUseVoice(e.target.checked)}
                    disabled={!audio}
                  />
                  Include generated narration
                </label>
                <button
                  className="primary"
                  disabled={running || !recording || !capabilities?.render}
                  onClick={() => void act("render", { useNarration: useVoice })}
                >
                  Render MP4 →
                </button>
                <p className="footnote">
                  Up to 30 seconds, 1280×720. Silent rendering is available.
                  Caption overlays are not implemented yet. Footage is supplied
                  by the owner.
                </p>
                {!capabilities?.narration && (
                  <p className="footnote">
                    ElevenLabs needs a local API key and voice ID.
                  </p>
                )}
              </div>
            </details>
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
            <details className="source-disclosure">
              <summary>
                Evidence receipt & sources{" "}
                <span className="footnote">
                  Inspect what informed this pack
                </span>
              </summary>
              <div className="source-disclosure-body">
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
                  const evidence = [
                    ...(job.inspection?.evidence || []),
                    ...(job.research?.sources || []),
                  ].find((e) => e.id === id);
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
          <summary>Run details · source, model & local storage</summary>
          <div className="context-details">
            <div className="context-item">
              <span>Repository</span>
              <strong>{job.name}</strong>
            </div>
            <div className="context-item">
              <span>Mode</span>
              <strong>Local backend · public source</strong>
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
              <strong>{new Date(job.expiresAt).toLocaleTimeString()}</strong>
              <small>In-memory; lost on restart</small>
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
