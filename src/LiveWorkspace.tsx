import { useEffect, useState } from "react";
import type { Job, Capabilities, ModelProvider } from "../shared/types";
import { api } from "./api";
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
}: {
  job: Job;
  stage: Stage;
  capabilities: Capabilities | null;
  model: ModelProvider;
  onJob: (j: Job) => void;
  onDeleted: () => void;
  onNotice: (n: string) => void;
  onSettings: () => void;
}) {
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
    setNarration(chosen?.narration || "");
    setApproved(false);
  }, [job.positioning, job.selectedAngle]);
  useEffect(() => {
    if (job.inspection?.homepage && !site) setSite(job.inspection.homepage);
  }, [job.inspection]);
  async function act(path: string, body: unknown) {
    setPending(true);
    try {
      const next = await api<Job>(`/jobs/${job.id}/${path}`, body);
      onJob(next);
      onNotice(
        Object.values(next.phases).some((p) => p.state === "running")
          ? "Operation started. Results will update when complete."
          : "Launch job updated.",
      );
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setPending(false);
    }
  }
  async function upload(file: File) {
    if (file.size > 30_000_000) {
      onNotice("Recording must be at most 30 MB.");
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
      onNotice(e instanceof Error ? e.message : "Upload failed.");
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
        className="stage-content live-content"
        role="region"
        aria-label="Marketing stage content"
        tabIndex={0}
      >
        <div className="phase-status" role="status">
          {Object.entries(job.phases)
            .filter(([, s]) => s.state === "running" || s.state === "failed")
            .map(([name, s]) => (
              <div
                key={name}
                className={s.state === "failed" ? "amber" : "red"}
              >
                {name.toUpperCase()} / {s.state}
                {s.error ? ` — ${s.error}` : ""}
              </div>
            ))}
        </div>
        {stage === "overview" && (
          <>
            <span className="micro">01 / SOURCE INSPECTION</span>
            <h2>Know what you’re shipping.</h2>
            <p className="section-intro">
              Source is read at an immutable commit. No repository scripts
              execute on this server.
            </p>
            <button
              className="outline"
              disabled={running}
              onClick={() => void act("inspect", {})}
            >
              Reinspect source →
            </button>
            {job.inspection ? (
              <>
                <div className="facts">
                  <div>
                    <span>Project profile</span>
                    <strong>{job.inspection.profile}</strong>
                  </div>
                  <div>
                    <span>Inspected revision</span>
                    <strong>{job.inspection.revision.slice(0, 12)}</strong>
                  </div>
                  <div>
                    <span>Branch</span>
                    <strong>{job.inspection.branch}</strong>
                  </div>
                  <div>
                    <span>Build / output</span>
                    <strong>
                      {job.inspection.buildCommand || "Unknown"} /{" "}
                      {job.inspection.outputDirectory || "Unknown"}
                    </strong>
                  </div>
                  <div>
                    <span>Runtime interactions</span>
                    <strong className="amber">Not checked</strong>
                  </div>
                </div>
                {job.inspection.blockers.map((b) => (
                  <div key={b} className="finding">
                    <span className="status-label amber">BLOCKER</span>
                    <p>{b}</p>
                  </div>
                ))}
                {job.inspection.warnings.map((w) => (
                  <div key={w} className="finding">
                    <span className="status-label amber">REVIEW</span>
                    <p>{w}</p>
                  </div>
                ))}
                <h3>Evidence ({job.inspection.evidence.length})</h3>
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
              <div className="finding">
                <p>
                  {job.phases.inspect.state === "failed"
                    ? job.phases.inspect.error
                    : "Reading repository metadata, commit, manifests, and selected source files…"}
                </p>
              </div>
            )}
          </>
        )}
        {stage === "research" && (
          <>
            <span className="micro">02 / RESEARCH + POSITIONING</span>
            <h2>Find a reason to try it.</h2>
            <p className="section-intro">
              Gather sources before generation. Public repository matches do not
              prove prior launches or competitor features.
            </p>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                void act("research", {
                  query,
                  links: links
                    .split("\n")
                    .map((l) => l.trim())
                    .filter(Boolean),
                });
              }}
            >
              <label htmlFor="research-query">Repository search query</label>
              <input
                id="research-query"
                value={query}
                minLength={2}
                maxLength={120}
                onChange={(e) => setQuery(e.target.value)}
                required
              />
              <label htmlFor="research-links">
                Public research links (up to 3, one per line)
              </label>
              <textarea
                id="research-links"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="https://example.com/product"
              />
              <button className="outline" disabled={running || !job.inspection}>
                Collect public sources →
              </button>
            </form>
            {job.research && (
              <div className="finding">
                <span className="status-label">CHECKED COVERAGE</span>
                <p>{job.research.coverage}</p>
                {job.research.sources.map((s) => (
                  <details key={s.id} className="evidence-detail">
                    <summary>{s.title}</summary>
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                    <p>{s.excerpt}</p>
                    <span className="footnote">Retrieved {s.checkedAt}</span>
                  </details>
                ))}
                {!job.research.sources.length && (
                  <p>
                    No matches found in checked sources. This does not establish
                    uniqueness.
                  </p>
                )}
              </div>
            )}
            <button
              className="primary"
              disabled={
                running ||
                !job.inspection ||
                !capabilities?.models.find((m) => m.provider === model)
                  ?.configured
              }
              onClick={() => void act("position", { provider: model })}
            >
              {job.positioning
                ? "Regenerate positioning"
                : "Generate positioning"}{" "}
              →
            </button>
            <p className="footnote">
              Uses your selected provider and quota. No silent fallback. Review
              all claims.
            </p>
            {!capabilities?.models.find((m) => m.provider === model)
              ?.configured && (
              <p className="amber">
                Set the selected model’s key and exact ID in your local .env,
                then restart the API.
              </p>
            )}
            {job.positioning?.angles.map((a, i) => (
              <button
                key={a.title}
                disabled={running}
                className={`angle-card ${job.selectedAngle === i ? "selected" : ""}`}
                aria-pressed={job.selectedAngle === i}
                onClick={() => void act("angle", { index: i })}
              >
                <span className="micro">
                  ANGLE 0{i + 1} /{" "}
                  {job.selectedAngle === i ? "SELECTED" : "PROPOSED"}
                </span>
                <h3>{a.title}</h3>
                <p>{a.audience}</p>
                <p>{a.rationale}</p>
                <span className="footnote">
                  Evidence: {a.evidenceIds.join(", ")}
                </span>
              </button>
            ))}
            {job.positioning?.limitations.map((l) => (
              <p key={l} className="footnote">
                {l}
              </p>
            ))}
          </>
        )}
        {stage === "strategy" && (
          <>
            <span className="micro">03 / LAUNCH STRATEGY</span>
            <h2>Give the project a launch plan.</h2>
            <p className="section-intro">
              Turn the selected audience and angle into a practical release
              checklist. You publish the project; Sudo Launch prepares its
              marketing.
            </p>
            <button
              className="primary"
              disabled={running || !job.inspection}
              onClick={() => void act("strategy", {})}
            >
              Prepare launch strategy →
            </button>
            {job.launchStrategy && (
              <>
                <div className="facts">
                  <div>
                    <span>Launch type</span>
                    <strong>{job.launchStrategy.launchType}</strong>
                  </div>
                  <div>
                    <span>Positioning angle</span>
                    <strong>
                      {job.launchStrategy.angleTitle ||
                        "Choose an angle in Position"}
                    </strong>
                  </div>
                </div>
                {job.launchStrategy.channels.map((c) => (
                  <div key={c.name} className="finding">
                    <h3>{c.name}</h3>
                    <p>{c.purpose}</p>
                    <span className="footnote">{c.timing}</span>
                  </div>
                ))}
                <ol className="launch-checklist">
                  {job.launchStrategy.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </>
            )}
            <details className="evidence-detail">
              <summary>Add an existing live URL (optional)</summary>
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("verify", { url: site });
                }}
              >
                <label htmlFor="live-url">Public project URL</label>
                <input
                  id="live-url"
                  type="url"
                  required
                  value={site}
                  placeholder="https://your-app.example"
                  onChange={(e) => setSite(e.target.value)}
                />
                <button className="outline" disabled={running}>
                  Check public reachability →
                </button>
              </form>
              {job.site && (
                <div className="facts">
                  <div>
                    <span>HTTP status</span>
                    <strong>
                      {job.site.httpStatus} /{" "}
                      {job.site.reachable ? "reachable" : "failed"}
                    </strong>
                  </div>
                  <div>
                    <span>URL</span>
                    <strong>{job.site.finalUrl}</strong>
                  </div>
                  <div>
                    <span>Interaction</span>
                    <strong className="amber">Not checked</strong>
                  </div>
                </div>
              )}
            </details>
            <p className="footnote">
              No cloud connection, deployment, code preview, or issue execution.
              Libraries and CLI projects can launch with their repository and
              setup instructions.
            </p>
          </>
        )}
        {stage === "studio" && (
          <>
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
                I reviewed the script and approve sending it to ElevenLabs using
                my quota.
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
              Up to 30 seconds, 1280×720. Silent rendering is available. Caption
              overlays are not implemented yet. Footage is supplied by the
              owner.
            </p>
            {!capabilities?.narration && (
              <p className="footnote">
                ElevenLabs needs a local API key and voice ID.
              </p>
            )}
          </>
        )}
        {stage === "pack" && (
          <>
            <span className="micro">05 / LAUNCH PACK</span>
            <h2>A launch with receipts.</h2>
            <p className="section-intro">
              Download real artifacts and the actual source/check history. Posts
              remain unapproved drafts.
            </p>
            {chosen ? (
              <>
                <div className="draft">
                  <span className="micro">LINKEDIN / MODEL DRAFT</span>
                  <p className="preserve-lines">{chosen.linkedin}</p>
                  <button
                    className="text-button"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(chosen.linkedin)
                        .then(() =>
                          onNotice(
                            "LinkedIn draft copied. Review before posting.",
                          ),
                        )
                        .catch(() =>
                          onNotice(
                            "Clipboard unavailable. Select and copy the draft manually.",
                          ),
                        )
                    }
                  >
                    Copy draft →
                  </button>
                </div>
                <div className="draft">
                  <span className="micro">X / MODEL DRAFT</span>
                  <p className="preserve-lines">{chosen.x}</p>
                </div>
              </>
            ) : (
              <div className="finding">
                <p>
                  No copy generated. Connect a model in local configuration,
                  then generate positioning.
                </p>
              </div>
            )}
            <div className="artifact-list">
              {job.artifacts.map((a) => (
                <div key={a.type}>
                  <a href={a.url} download={`sudo-${a.type}`}>
                    {a.type} ↓
                  </a>
                  <span className="footnote">{a.provenance}</span>
                </div>
              ))}
            </div>
            <a
              className="primary"
              href={`/api/jobs/${job.id}/receipt`}
              download
            >
              Download launch receipt ↓
            </a>
            <p className="footnote">
              Actual model use, inspected commit, and HTTP checks are recorded.
              Unknown built revision and unchecked interactions stay explicit.
            </p>
          </>
        )}
      </div>
      <aside className="context-panel">
        <span className="micro">RUN CONTEXT / REAL JOB</span>
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
            Source inspected.
            <br />
            Interactions require their own evidence.
          </p>
        </div>
      </aside>
    </section>
  );
}
