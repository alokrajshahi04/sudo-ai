import type { Job } from "../shared/types";
export default function Readiness({
  job,
  onCopy,
}: {
  job: Job;
  onCopy: (text: string, label: string) => void;
}) {
  if (!job.readiness) return null;
  return (
    <section className="readiness-panel">
      <div className="section-heading">
        <div>
          <span className="micro">
            SOURCE READINESS / REVIEW BEFORE SHARING
          </span>
          <h3>A useful next step for your coding agent.</h3>
        </div>
        <span className="readiness-count">
          {job.readiness.findings.length} review tasks
        </span>
      </div>
      <p className="footnote">{job.readiness.coverage}</p>
      <details className="readiness-findings">
        <summary>Inspect the findings & one-shot fix prompt</summary>
        <div>
          {job.readiness.findings.map((f) => (
            <article className="readiness-finding" key={f.id}>
              <span
                className={f.severity === "action" ? "amber micro" : "micro"}
              >
                {f.severity === "action" ? "ACTION" : "REVIEW"}
              </span>
              <h4>{f.title}</h4>
              <p>{f.detail}</p>
              {f.files.length > 0 && (
                <span className="footnote">{f.files.join(" · ")}</span>
              )}
              {f.evidenceIds.map((id) => {
                const e = job.inspection?.evidence.find(
                  (item) => item.id === id,
                );
                return (
                  e && (
                    <a
                      className="footnote"
                      key={id}
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {e.title} ↗
                    </a>
                  )
                );
              })}
            </article>
          ))}
          <label htmlFor="agent-handoff">Paste into your coding agent</label>
          <textarea
            id="agent-handoff"
            readOnly
            value={job.readiness.agentPrompt}
            rows={9}
          />
        </div>
      </details>
      <button
        className="outline compact-action"
        onClick={() =>
          onCopy(job.readiness!.agentPrompt, "Coding-agent fix prompt")
        }
      >
        Copy one-shot fix prompt →
      </button>
      <p className="footnote">
        The agent should verify each finding first. Sudo Launch does not edit
        your repository or certify the app works.
      </p>
    </section>
  );
}
