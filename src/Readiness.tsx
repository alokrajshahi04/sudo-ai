import { useRef, useState } from "react";
import type { Job } from "../shared/types";
export default function Readiness({
  job,
  onCopy,
  onReview,
  onAnalyze,
  busy,
  modelReady,
  children,
}: {
  job: Job;
  onCopy: (text: string, label: string) => void;
  onReview: () => void;
  onAnalyze: () => void;
  busy: boolean;
  modelReady: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  if (!job.readiness) return null;
  const findings = [...job.readiness.findings].sort(
    (a, b) => Number(b.origin === "ai") - Number(a.origin === "ai"),
  );
  const ai = findings.filter((f) => f.origin === "ai");
  return (
    <section
      className="readiness-panel"
      ref={panel}
      aria-label="Project readiness review"
    >
      <div className="section-heading">
        <div>
          <span className="micro">BEFORE YOUR LAUNCH</span>
          <h3>Check project readiness.</h3>
        </div>
        <span className="readiness-count">
          {job.readinessReviewedAt
            ? "✓ Findings reviewed"
            : `${findings.length} suggestions to review`}
        </span>
      </div>
      <p>
        {ai.length
          ? `${ai.length} source-specific AI findings, plus launch checks. Review what to fix before sharing.`
          : "Review the source checks and ask your model for project-specific problems before writing posts."}
      </p>
      {!open && ai.length > 0 && (
        <ul className="readiness-preview">
          {ai.slice(0, 3).map((f) => (
            <li key={f.id}>{f.title}</li>
          ))}
        </ul>
      )}
      <div className="flow-actions">
        <button
          className="primary"
          disabled={busy}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? "Hide readiness details" : "Check project readiness →"}
        </button>
        <button
          className="outline"
          disabled={busy || !modelReady}
          onClick={() => {
            setOpen(true);
            onAnalyze();
          }}
        >
          Recheck with AI →
        </button>
      </div>
      {open && (
        <div className="readiness-findings">
          <p className="footnote">{job.readiness.coverage}</p>
          {findings.map((f) => (
            <article className="readiness-finding" key={f.id}>
              <span
                className={f.severity === "action" ? "amber micro" : "micro"}
              >
                {f.origin === "ai" ? "AI SUGGESTION" : "SOURCE CHECK"} ·{" "}
                {f.severity.toUpperCase()}
              </span>
              <h4>{f.title}</h4>
              <p>{f.detail}</p>
              {f.recommendation && (
                <p>
                  <strong>Next step: </strong>
                  {f.recommendation}
                </p>
              )}
              {f.evidenceQuote && (
                <blockquote className="readiness-quote">
                  {f.evidenceQuote}
                </blockquote>
              )}
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
          <details>
            <summary>One-shot coding-agent handoff</summary>
            <label htmlFor="agent-handoff">Paste into your coding agent</label>
            <textarea
              id="agent-handoff"
              readOnly
              value={job.readiness.agentPrompt}
              rows={9}
            />
          </details>
          <button
            className="outline compact-action"
            onClick={() =>
              onCopy(job.readiness!.agentPrompt, "Coding-agent fix prompt")
            }
          >
            Copy one-shot fix prompt →
          </button>
          {children}
          <p className="footnote">
            These are evidence-backed review tasks. Build/tests and every
            runtime feature have not been verified.
          </p>
          <button className="primary" disabled={busy} onClick={onReview}>
            {job.readinessReviewedAt
              ? "Review acknowledged ✓"
              : "I reviewed the findings →"}
          </button>
        </div>
      )}
    </section>
  );
}
