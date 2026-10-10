import { useState } from "react";
import type { Stage } from "./LiveWorkspace";
const examples = [
  {
    name: "Focus Board",
    profile: "React / Vite app",
    audience: "Students planning a study session",
    feature: "A board for organizing study tasks",
    angle: "A calmer plan for your next study session",
  },
  {
    name: "Release Notes CLI",
    profile: "Python CLI tool",
    audience: "Maintainers writing release notes",
    feature: "A command-line workflow for drafting release notes",
    angle: "Spend release day shipping, not formatting",
  },
  {
    name: "Team Inbox",
    profile: "Next.js web app",
    audience: "Small teams reviewing customer feedback",
    feature: "A shared view of feedback items",
    angle: "Turn scattered feedback into a shared next step",
  },
];
export default function SampleWorkspace({
  stage,
  onStart,
}: {
  stage: Stage;
  onStart: () => void;
}) {
  const [example, setExample] = useState(0);
  const item = examples[example];
  function download() {
    const data = {
      kind: "illustrative_sample",
      project: item.name,
      profile: item.profile,
      sourceRevision: null,
      actualModel: null,
      checks: [],
      note: "UI walkthrough only. No source, research, model, capture, or publishing operation ran.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sudo-marketing-sample.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section className="workspace-grid">
      <div
        className="stage-content"
        role="region"
        aria-label="Sample stage content"
        tabIndex={0}
      >
        <label className="sample-selector" htmlFor="sample-project">
          Example project
          <select
            id="sample-project"
            value={example}
            onChange={(e) => setExample(Number(e.target.value))}
          >
            {examples.map((e, i) => (
              <option key={e.name} value={i}>
                {e.name} · {e.profile}
              </option>
            ))}
          </select>
        </label>
        {stage === "overview" && (
          <>
            <span className="micro">01 / PRODUCT CONTEXT</span>
            <h2>Understand before you promote.</h2>
            <div className="facts">
              <div>
                <span>Project</span>
                <strong>{item.name}</strong>
              </div>
              <div>
                <span>Profile</span>
                <strong>{item.profile}</strong>
              </div>
              <div>
                <span>Intended audience</span>
                <strong>{item.audience}</strong>
              </div>
              <div>
                <span>Runtime evidence</span>
                <strong className="amber">Not checked</strong>
              </div>
            </div>
            <div className="finding">
              <h3>{item.feature}</h3>
              <p>
                Illustrative feature for this walkthrough. Real projects use a
                pinned source snapshot, README claims, and the owner's brief as
                separate evidence.
              </p>
            </div>
            <p>
              Apps, tools, libraries, and documentation can all have a launch
              story. Missing deployment configuration does not block marketing.
            </p>
          </>
        )}
        {stage === "research" && (
          <>
            <span className="micro">02 / POSITIONING</span>
            <h2>Choose the user. Shape the story.</h2>
            <div className="angle-card selected">
              <span className="micro">ILLUSTRATIVE ANGLE</span>
              <h3>{item.angle}</h3>
              <p>For {item.audience.toLowerCase()}.</p>
              <span className="footnote">
                Sample copy; no market research ran.
              </span>
            </div>
            <div className="finding">
              <h3>What research adds</h3>
              <p>
                Relevant alternatives, existing launch context, and citations
                help refine the angle. Search silence does not prove uniqueness.
              </p>
            </div>
          </>
        )}
        {stage === "strategy" && (
          <>
            <span className="micro">03 / LAUNCH PLAN</span>
            <h2>A practical plan to get it seen.</h2>
            <ol className="launch-checklist">
              <li>Review the audience and evidenced feature claims.</li>
              <li>Explain the use case in the README.</li>
              <li>Record a real usage example.</li>
              <li>Prepare a LinkedIn story and a concise X post.</li>
              <li>Share a repository or existing product link.</li>
              <li>Follow up with what you learned from feedback.</li>
            </ol>
            <div className="finding">
              <h3>Publishing stays with the developer.</h3>
              <p>
                Use the hosting or distribution method appropriate for this
                project. Sudo Launch guides the launch and creates marketing
                assets.
              </p>
            </div>
          </>
        )}
        {stage === "studio" && (
          <>
            <span className="micro">04 / DEMO ASSETS</span>
            <h2>Make the value visible.</h2>
            <div className="video-placeholder">
              <span className="play-outline">▷</span>
              <span>No sample footage generated</span>
            </div>
            <div className="storyboard">
              <div>
                <span>00–05</span>
                <p>{item.angle}.</p>
              </div>
              <div>
                <span>05–20</span>
                <p>Show one real interaction or CLI usage example.</p>
              </div>
              <div>
                <span>20–25</span>
                <p>Invite the intended user to try the project.</p>
              </div>
            </div>
            <p className="footnote">
              Real jobs accept your recording and optional reviewed ElevenLabs
              narration. No automatic code preview or browser capture.
            </p>
          </>
        )}
        {stage === "pack" && (
          <>
            <span className="micro">05 / LAUNCH PACK</span>
            <h2>Leave with a story ready to review.</h2>
            <div className="draft">
              <span className="micro">SAMPLE LAUNCH COPY</span>
              <p>{item.angle}.</p>
              <p>
                I’m working on {item.name} for {item.audience.toLowerCase()}.
                Next: test the workflow with real users and share a usage demo.
              </p>
            </div>
            <div className="artifact-list">
              <div>
                <span>Posts / narration</span>
                <span className="dim">Illustrative only</span>
              </div>
              <div>
                <span>Evidence receipt</span>
                <span className="amber">Sample</span>
              </div>
            </div>
            <button className="primary" onClick={download}>
              Download sample receipt ↓
            </button>
          </>
        )}
      </div>
      <aside className="context-panel">
        <span className="micro">WALKTHROUGH / SAMPLE</span>
        <div className="context-item">
          <span>Project type</span>
          <strong>{item.profile}</strong>
        </div>
        <div className="context-item">
          <span>Model / research</span>
          <strong>Not run</strong>
        </div>
        <div className="context-item">
          <span>Evidence</span>
          <strong>Illustrative only</strong>
        </div>
        <button className="outline" onClick={onStart}>
          Use your own repository →
        </button>
        <div className="context-note">
          <span className="red">&gt;</span>
          <p>
            Choose a different example to see the same marketing workflow for
            another project type.
          </p>
        </div>
      </aside>
    </section>
  );
}
