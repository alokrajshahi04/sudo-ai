import { useEffect, useRef, useState } from "react";
import LiveWorkspace from "./LiveWorkspace";
import { api, getCapabilities, getJob } from "./api";
import type { Job, Capabilities, ModelProvider } from "../shared/types";

type Stage = "overview" | "research" | "deploy" | "studio" | "pack";
type Panel = "new" | "settings" | "help" | "about" | null;
const stages: { id: Stage; number: string; label: string }[] = [
  { id: "overview", number: "01", label: "Inspect" },
  { id: "research", number: "02", label: "Position" },
  { id: "deploy", number: "03", label: "Deploy" },
  { id: "studio", number: "04", label: "Demo" },
  { id: "pack", number: "05", label: "Launch pack" },
];
const commandList = [
  "/demo",
  "/new",
  "/research",
  "/deploy",
  "/studio",
  "/pack",
  "/settings",
  "/about",
  "/clear",
  "/help",
];
const commandDescriptions: Record<string, string> = {
  "/demo": "Explore the sample workspace",
  "/new": "Inspect a public repository",
  "/research": "Research and positioning",
  "/deploy": "Prepare a deployment plan",
  "/studio": "Recording and narration",
  "/pack": "Download launch artifacts",
  "/settings": "Model and provider preferences",
  "/about": "What Sudo Launch does",
  "/clear": "Return to the launch screen",
  "/help": "All commands and shortcuts",
};

function Orb() {
  return (
    <div className="orb" aria-hidden="true">
      <div className="orbit orbit-a" />
      <div className="orbit orbit-b" />
      <div className="orbit orbit-c" />
      <div className="orb-core" />
      <span className="orb-cross cross-a">+</span>
      <span className="orb-cross cross-b">+</span>
    </div>
  );
}
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}

export default function App() {
  const [sample, setSample] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeCommand, setActiveCommand] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("overview");
  const [panel, setPanel] = useState<Panel>(null);
  const [command, setCommand] = useState("");
  const matchingCommands = commandList.filter((c) => c.startsWith(command));
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (paletteOpen && command.startsWith("/"))
      document
        .getElementById(`command-option-${activeCommand}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [paletteOpen, command, activeCommand]);
  const [provider, setProvider] = useState("Vercel");
  const [model, setModel] = useState("Gemma 4 · Google AI Studio");
  const [angle, setAngle] = useState(0);
  const [repo, setRepo] = useState("");
  const [brief, setBrief] = useState("");
  const [repoError, setRepoError] = useState("");
  const modelProvider: ModelProvider = model.startsWith("Gemma")
    ? "google"
    : model.startsWith("GLM")
      ? "nebius"
      : "custom";
  useEffect(() => {
    getCapabilities()
      .then(setCapabilities)
      .catch(() =>
        setNotice(
          "Local API unavailable. Restart with npm run dev to run both services.",
        ),
      );
    api<Job[]>("/jobs")
      .then((jobs) => {
        if (jobs.length) setJob(jobs[jobs.length - 1]);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!job || !Object.values(job.phases).some((p) => p.state === "running"))
      return;
    const timer = setInterval(() => {
      getJob(job.id)
        .then(setJob)
        .catch((e) => {
          setNotice(e.message);
          setJob(null);
        });
    }, 1200);
    return () => clearInterval(timer);
  }, [job]);
  const commandRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (panel) {
      if (!dialogRef.current?.open)
        previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
      previousFocus.current?.focus();
    }
  }, [panel]);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) &&
        !panel
      ) {
        e.preventDefault();
        commandRef.current?.focus();
        setCommand("/");
        setActiveCommand(0);
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [panel]);
  function demo() {
    setJob(null);
    setSample(true);
    setStage("overview");
    setPanel(null);
    setNotice(
      "Sample workspace opened. All findings and artifacts are illustrative.",
    );
  }
  function run(value: string) {
    const cmd = value.trim().toLowerCase();
    setCommand("");
    setPaletteOpen(false);
    setActiveCommand(0);
    if (cmd === "/demo") return demo();
    if (cmd === "/clear") {
      setJob(null);
      setSample(false);
      setNotice(
        "Returned home. Your local jobs remain available until expiry.",
      );
      return;
    }
    if (
      cmd === "/new" ||
      cmd === "/settings" ||
      cmd === "/help" ||
      cmd === "/about"
    ) {
      setPanel(cmd.slice(1) as Panel);
      return;
    }
    const target = (
      {
        "/research": "research",
        "/deploy": "deploy",
        "/studio": "studio",
        "/pack": "pack",
      } as Record<string, Stage>
    )[cmd];
    if (target) {
      if (sample || job) setStage(target);
      else
        setNotice(
          "Open /demo to explore the sample workflow, or /new to prepare your repository.",
        );
      return;
    }
    setNotice(
      cmd
        ? "Unknown command. Use /help to see available actions."
        : "Type /demo, /new, or /help to begin.",
    );
  }
  async function startLaunch() {
    setCreating(true);
    setRepoError("");
    try {
      const url = new URL(repo);
      if (
        url.protocol !== "https:" ||
        url.hostname !== "github.com" ||
        !/^\/[\w.-]+\/[\w.-]+\/?$/.test(url.pathname) ||
        url.search ||
        url.hash ||
        url.username ||
        url.password ||
        url.port
      )
        throw new Error(
          "Use a public repository URL such as https://github.com/owner/repository.",
        );
      const next = await api<Job>("/jobs", {
        repository: repo,
        brief,
        model: modelProvider,
      });
      setJob(next);
      setSample(false);
      setStage("overview");
      setPanel(null);
      setNotice(
        "Repository inspection started. No code is executed and no cloud resources are created.",
      );
    } catch (e) {
      setRepoError(
        e instanceof Error ? e.message : "Could not create launch job.",
      );
    } finally {
      setCreating(false);
    }
  }
  function downloadReceipt() {
    const receipt = {
      kind: "illustrative_sample",
      generatedAt: new Date().toISOString(),
      project: "PokeChess",
      repository: "https://github.com/alokrajshahi04/pokechess",
      sourceRevision: null,
      builtRevision: null,
      deploymentProviderPreference: provider,
      modelPreference: model,
      modelExecuted: false,
      deploymentExecuted: false,
      researchExecuted: false,
      captureExecuted: false,
      checks: [],
      selectedPositioning:
        angle === 0
          ? "A chess break between builds"
          : "A playful board for your next match",
      note: "UI preview only. No verification, deployment, research, narration, or capture was performed.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(receipt, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sudo-launch-sample-receipt.json";
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      "Sample receipt downloaded. It explicitly records that no services or checks ran.",
    );
  }
  return (
    <div className={`app ${sample || job ? "workspace" : "home"}`}>
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setSample(false);
            setJob(null);
            setNotice("");
          }}
          aria-label="Sudo Launch home"
        >
          sudo<span className="red">.</span>launch
          <span className="brand-cursor">_</span>
        </button>
        <div className="header-right">
          <span className="preview-badge">
            <i />
            {job
              ? "Local job"
              : sample
                ? "Sample"
                : capabilities
                  ? "Local mode"
                  : "UI preview"}
          </span>
          <a
            href="https://github.com/alokrajshahi04/sudo-ai"
            target="_blank"
            rel="noreferrer"
          >
            Source <Arrow />
          </a>
          <button
            className="settings-button"
            onClick={() => setPanel("settings")}
          >
            Settings <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>
      <main id="main">
        <div className="eyebrow">
          <span>OPEN SOURCE / BUILT FOR THE UNFINISHED</span>
          <span className="eyebrow-right">
            {job
              ? "WORKSPACE / LOCAL"
              : sample
                ? "WORKSPACE 001 · SAMPLE"
                : "FROM LOCALHOST TO LAUNCH"}
          </span>
        </div>
        {!sample && !job ? (
          <>
            <section className="landing-grid" aria-labelledby="hero-title">
              <div className="hero-panel">
                <div className="panel-label">
                  <span className="red">●</span> LAUNCH CONTROL
                </div>
                <Orb />
                <div className="hero-copy">
                  <span className="micro">
                    YOUR NEXT COMMIT COULD BE A RELEASE.
                  </span>
                  <h1 id="hero-title">
                    Ship what
                    <br />
                    you started<span className="red">.</span>
                  </h1>
                  <p>
                    A live project. A story worth telling.
                    <br />A launch pack ready to share.
                  </p>
                  <button className="primary" onClick={() => setPanel("new")}>
                    Start a launch <Arrow />
                  </button>
                  <button className="text-button" onClick={demo}>
                    or explore the sample →
                  </button>
                </div>
                <span className="coordinate">SUDO / 001</span>
              </div>
              <div className="intro-side">
                <section className="intro-block">
                  <span className="micro">01 / INPUT</span>
                  <h2>Bring your repository.</h2>
                  <p>
                    That side project sitting in your dev folder?
                    <br />
                    Let’s give it a way out.
                  </p>
                  <div className="code-line">
                    <span className="red">&gt;</span>{" "}
                    github.com/you/that-project<span className="dim">_</span>
                  </div>
                  <span className="footnote">
                    React + Vite first. Existing live sites welcome.
                  </span>
                </section>
                <section className="intro-block">
                  <span className="micro">02 / OUTPUT</span>
                  <h2>Leave ready to launch.</h2>
                  <ul className="output-list">
                    <li>
                      <span>↗</span> A verified live URL
                    </li>
                    <li>
                      <span>⌕</span> Positioning grounded in research
                    </li>
                    <li>
                      <span>▷</span> A narrated product demo
                    </li>
                    <li>
                      <span>≡</span> Posts + an evidence-backed receipt
                    </li>
                  </ul>
                  <span className="footnote">
                    Local workflow. Model and voice access use your keys.
                  </span>
                </section>
              </div>
            </section>
            <div className="principles">
              <span>YOUR REPO.</span>
              <span>YOUR MODELS.</span>
              <span>YOUR CLOUD ACCOUNT.</span>
              <span className="dim">YOUR LAUNCH.</span>
            </div>
            <section className="workflow-strip" aria-label="Launch workflow">
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setJob(null);
                    setSample(true);
                    setStage(s.id);
                    setNotice(
                      "Illustrative sample. No live services have run.",
                    );
                  }}
                >
                  <span className="dim">{s.number}</span>
                  <span>{s.label}</span>
                  <span className="step-arrow">→</span>
                </button>
              ))}
            </section>
          </>
        ) : (
          <>
            <section className="workspace-heading">
              <div>
                <span className="micro">
                  PROJECT / {job ? job.name.toUpperCase() : "POKECHESS"}
                </span>
                <h1>
                  From repo to release<span className="red">.</span>
                </h1>
                <a
                  className="repo-link"
                  href={
                    job?.repository ||
                    "https://github.com/alokrajshahi04/pokechess"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  {job
                    ? job.repository.replace("https://github.com/", "")
                    : "alokrajshahi04/pokechess"}{" "}
                  <Arrow />
                </a>
              </div>
              <span className="sample-tag">
                {job ? "REAL SOURCE / LOCAL" : "ILLUSTRATIVE SAMPLE"}
              </span>
            </section>
            <div className="sample-warning">
              {job
                ? "Source inspection and individual checks are recorded separately. No automatic cloud deployment or interaction verification."
                : "Preview data only. No repository inspection, research, deployment, or capture has run."}
            </div>
            <nav className="stage-nav" aria-label="Workspace stages">
              {stages.map((s) => (
                <button
                  key={s.id}
                  aria-current={stage === s.id ? "step" : undefined}
                  className={stage === s.id ? "active" : ""}
                  onClick={() => setStage(s.id)}
                >
                  <span>{s.number}</span>
                  {s.label}
                </button>
              ))}
            </nav>
            {job ? (
              <LiveWorkspace
                job={job}
                stage={stage}
                capabilities={capabilities}
                model={modelProvider}
                provider={provider === "Vercel" ? "vercel" : "digitalocean"}
                onJob={setJob}
                onDeleted={() => {
                  setJob(null);
                  setNotice("Local job and artifacts deleted.");
                }}
                onNotice={setNotice}
                onSettings={() => setPanel("settings")}
              />
            ) : (
              <section className="workspace-grid">
                <div className="stage-content">
                  {stage === "overview" && (
                    <>
                      <span className="micro">01 / READINESS</span>
                      <h2>Know what you’re shipping.</h2>
                      <p className="section-intro">
                        Separate what exists, what needs checking, and what
                        could block launch.
                      </p>
                      <div className="facts">
                        <div>
                          <span>Project profile</span>
                          <strong>React / Vite · static frontend</strong>
                        </div>
                        <div>
                          <span>Launch type</span>
                          <strong>Relaunch / showcase</strong>
                        </div>
                        <div>
                          <span>Runtime checks</span>
                          <strong className="amber">Not performed</strong>
                        </div>
                      </div>
                      <div className="finding">
                        <span className="status-label">SOURCE CONTEXT</span>
                        <h3>Local chess is the proposed demo.</h3>
                        <p>
                          Use one local pass-and-play interaction. Source
                          context from planning suggests chess logic, themes,
                          and animations; runtime behavior still needs checking.
                        </p>
                        <a
                          href="https://github.com/alokrajshahi04/pokechess"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Review repository <Arrow />
                        </a>
                      </div>
                      <div className="finding">
                        <span className="status-label amber">NEEDS REVIEW</span>
                        <h3>Keep AI credentials out of the browser.</h3>
                        <p>
                          A static frontend cannot hide API keys. Assess the AI
                          feature separately before promoting it as ready.
                        </p>
                      </div>
                      <button
                        className="primary"
                        onClick={() => setStage("research")}
                      >
                        Explore positioning →
                      </button>
                    </>
                  )}
                  {stage === "research" && (
                    <>
                      <span className="micro">02 / POSITIONING</span>
                      <h2>Find a reason to try it.</h2>
                      <p className="section-intro">
                        Choose a demo angle. These are sample suggestions, not
                        researched competitor claims.
                      </p>
                      {[
                        "A chess break between builds",
                        "A playful board for your next match",
                      ].map((title, i) => (
                        <button
                          key={title}
                          className={`angle-card ${angle === i ? "selected" : ""}`}
                          onClick={() => setAngle(i)}
                          aria-pressed={angle === i}
                        >
                          <span className="micro">
                            ANGLE 0{i + 1}{" "}
                            <span className="red">
                              {angle === i ? " / SELECTED" : ""}
                            </span>
                          </span>
                          <h3>{title}</h3>
                          <p>
                            {i === 0
                              ? "For student developers: invite a friend to a quick local game after shipping a commit."
                              : "For casual chess players: put the board, theme, and local match at the center of the story."}
                          </p>
                          <span className="footnote">
                            Proposed copy · user review required
                          </span>
                        </button>
                      ))}
                      <div className="finding">
                        <span className="status-label amber">
                          RESEARCH NOT RUN
                        </span>
                        <p>
                          Agent-Reach will supply bounded public sources here.
                          No result does not mean no competition.
                        </p>
                      </div>
                      <button
                        className="primary"
                        onClick={() => setStage("deploy")}
                      >
                        Review deployment →
                      </button>
                    </>
                  )}
                  {stage === "deploy" && (
                    <>
                      <span className="micro">03 / DEPLOYMENT</span>
                      <h2>Your project. Your cloud.</h2>
                      <p className="section-intro">
                        Choose a target. Hosted launch starts with a guided
                        provider handoff.
                      </p>
                      <fieldset className="provider-choice">
                        <legend>Deployment provider</legend>
                        {["Vercel", "DigitalOcean"].map((p) => (
                          <button
                            key={p}
                            className={provider === p ? "selected" : ""}
                            aria-pressed={provider === p}
                            onClick={() => setProvider(p)}
                          >
                            {p}
                            <span>
                              {p === "Vercel"
                                ? "Static site / repository import"
                                : "App Platform / static site"}
                            </span>
                          </button>
                        ))}
                      </fieldset>
                      <div className="facts">
                        <div>
                          <span>Account / project</span>
                          <strong>Not connected</strong>
                        </div>
                        <div>
                          <span>Build / output</span>
                          <strong>Needs source inspection</strong>
                        </div>
                        <div>
                          <span>Plan / cost</span>
                          <strong className="amber">Review at provider</strong>
                        </div>
                        <div>
                          <span>Built revision</span>
                          <strong>Unverified</strong>
                        </div>
                      </div>
                      <div className="finding">
                        <h3>No cloud token needed for handoff.</h3>
                        <p>
                          Sign in on the provider’s own website. Return with
                          your live URL for checks once the backend is
                          connected.{" "}
                          {provider === "Vercel"
                            ? "Hobby is limited to non-commercial personal use."
                            : "Check plan eligibility and credits before creating an app."}
                        </p>
                      </div>
                      <button className="primary" disabled>
                        Prepare deployment · backend required
                      </button>
                      <p className="footnote">
                        No resources are created in this preview.
                      </p>
                    </>
                  )}
                  {stage === "studio" && (
                    <>
                      <span className="micro">04 / DEMO STUDIO</span>
                      <h2>Show it actually working.</h2>
                      <p className="section-intro">
                        One real interaction, a clear story, and a short
                        narrated clip.
                      </p>
                      <div className="video-placeholder">
                        <span className="play-outline" aria-hidden="true">
                          ▷
                        </span>
                        <span>No recording captured</span>
                        <span className="footnote">
                          20–30 seconds / landscape MP4
                        </span>
                      </div>
                      <div className="storyboard">
                        <div>
                          <span>00–05</span>
                          <p>
                            The hook:{" "}
                            {angle === 0
                              ? "A chess break between builds."
                              : "A playful board for your next match."}
                          </p>
                        </div>
                        <div>
                          <span>05–20</span>
                          <p>
                            Show a local match interaction. Capture must pass
                            before it becomes an asset.
                          </p>
                        </div>
                        <div>
                          <span>20–25</span>
                          <p>
                            Close with the project name and verified live URL.
                          </p>
                        </div>
                      </div>
                      <div className="finding">
                        <span className="status-label">
                          ELEVENLABS / OPTIONAL
                        </span>
                        <p>
                          Review narration before generation. Caption-only
                          output is available when voice is skipped.
                        </p>
                      </div>
                      <button className="primary" disabled>
                        Capture demo · backend required
                      </button>
                    </>
                  )}
                  {stage === "pack" && (
                    <>
                      <span className="micro">05 / LAUNCH PACK</span>
                      <h2>A launch with receipts.</h2>
                      <p className="section-intro">
                        Keep the story, assets, and supporting evidence
                        together.
                      </p>
                      <div className="draft">
                        <span className="micro">LINKEDIN / SAMPLE DRAFT</span>
                        <p>
                          {angle === 0
                            ? "A chess break between builds."
                            : "A playful board for your next match."}
                        </p>
                        <p>
                          I’m working on PokeChess, a chess project with local
                          play. Next up: verify a complete match, check
                          deployment, and record a demo.
                        </p>
                        <p className="dim">
                          [Add verified live URL after checks]
                        </p>
                      </div>
                      <div className="artifact-list">
                        <div>
                          <span>Narrated demo.mp4</span>
                          <span className="dim">Not generated</span>
                        </div>
                        <div>
                          <span>Research sources</span>
                          <span className="dim">Not collected</span>
                        </div>
                        <div>
                          <span>Launch receipt.json</span>
                          <span className="amber">Sample only</span>
                        </div>
                      </div>
                      <button className="primary" onClick={downloadReceipt}>
                        Download sample receipt ↓
                      </button>
                      <p className="footnote">
                        Includes explicit unverified statuses. No fabricated
                        checks.
                      </p>
                    </>
                  )}
                </div>
                <aside className="context-panel">
                  <span className="micro">RUN CONTEXT</span>
                  <div className="context-item">
                    <span>Mode</span>
                    <strong>UI preview</strong>
                  </div>
                  <div className="context-item">
                    <span>Model preference</span>
                    <strong>{model}</strong>
                    <small>No inference performed</small>
                  </div>
                  <div className="context-item">
                    <span>Target preference</span>
                    <strong>{provider}</strong>
                    <small>No account connected</small>
                  </div>
                  <div className="context-item">
                    <span>Evidence</span>
                    <strong>Planning context only</strong>
                    <small>Source revision not inspected here</small>
                  </div>
                  <button
                    className="outline"
                    onClick={() => setPanel("settings")}
                  >
                    Configure preferences <Arrow />
                  </button>
                  <div className="context-note">
                    <span className="red">&gt;</span>
                    <p>
                      Reachable ≠ verified.
                      <br />
                      Every launch claim needs its own evidence.
                    </p>
                  </div>
                </aside>
              </section>
            )}
          </>
        )}
        <div className="notice" role="status" aria-live="polite">
          {notice ||
            (capabilities
              ? "Local mode · cloud actions require explicit review. Keys stay in server configuration."
              : "Frontend preview · backend unavailable.")}
        </div>
      </main>
      <footer className="command-footer">
        {paletteOpen &&
          command.startsWith("/") &&
          matchingCommands.length > 0 && (
            <div
              id="command-menu"
              className="command-suggestions"
              role="listbox"
              aria-label="Available commands"
            >
              {matchingCommands.map((c, i) => (
                <button
                  id={`command-option-${i}`}
                  key={c}
                  role="option"
                  aria-selected={activeCommand === i}
                  className={activeCommand === i ? "active" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveCommand(i)}
                  onClick={() => run(c)}
                >
                  <strong>{c}</strong>
                  <span>{commandDescriptions[c]}</span>
                </button>
              ))}
            </div>
          )}
        <form
          className="command-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              paletteOpen && command.startsWith("/") && matchingCommands.length
                ? matchingCommands[activeCommand] || command
                : command,
            );
          }}
        >
          <label htmlFor="command" className="prompt-sign">
            &gt;
          </label>
          <input
            id="command"
            ref={commandRef}
            value={command}
            role="combobox"
            aria-autocomplete="list"
            aria-controls="command-menu"
            aria-expanded={
              paletteOpen &&
              command.startsWith("/") &&
              matchingCommands.length > 0
            }
            aria-activedescendant={
              paletteOpen && matchingCommands.length
                ? `command-option-${activeCommand}`
                : undefined
            }
            onChange={(e) => {
              setCommand(e.target.value);
              setActiveCommand(0);
              setPaletteOpen(true);
            }}
            onFocus={() => setPaletteOpen(true)}
            onBlur={() => setPaletteOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setPaletteOpen(false);
                e.preventDefault();
              } else if (
                command.startsWith("/") &&
                matchingCommands.length &&
                (e.key === "ArrowDown" || e.key === "ArrowUp")
              ) {
                e.preventDefault();
                setPaletteOpen(true);
                setActiveCommand(
                  (i) =>
                    (i +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      matchingCommands.length) %
                    matchingCommands.length,
                );
              }
            }}
            placeholder="Type / for commands"
            aria-label="Launch command"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="keyboard-hint">/ to focus</span>
          <button className="primary" type="submit">
            Run ↵
          </button>
        </form>
        <div className="quick-access">
          <span>Quick access</span>
          <button onClick={() => setPanel("new")}>new launch</button>
          <button onClick={demo}>sample</button>
          <button onClick={() => setPanel("settings")}>models</button>
          <button onClick={() => setPanel("about")}>about</button>
          <button onClick={() => setPanel("help")}>help</button>
          <span className="footer-note">Built to leave localhost.</span>
        </div>
      </footer>
      <dialog
        ref={dialogRef}
        aria-label={
          panel === "new"
            ? "New launch"
            : panel === "settings"
              ? "Model preferences"
              : panel === "about"
                ? "About Sudo Launch"
                : "Command help"
        }
        onCancel={() => setPanel(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPanel(null);
        }}
      >
        <div className="dialog-head">
          <span className="micro">SUDO / {panel?.toUpperCase()}</span>
          <button onClick={() => setPanel(null)} aria-label="Close dialog">
            ×
          </button>
        </div>
        {panel === "new" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void startLaunch();
            }}
          >
            <h2>Give your project a way out.</h2>
            <p>
              Inspect a public repository at a recorded commit. Builds and cloud
              deployment are separate steps.
            </p>
            <label htmlFor="repo">Public GitHub repository</label>
            <input
              id="repo"
              type="url"
              required
              aria-invalid={!!repoError}
              aria-describedby={repoError ? "repo-error" : undefined}
              placeholder="https://github.com/you/project"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <label htmlFor="brief">Who is it for?</label>
            <textarea
              required
              minLength={3}
              id="brief"
              placeholder="The audience, the problem, and what you want to launch."
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              maxLength={1200}
            />
            <div className="dialog-info">
              No account connection or credentials needed to prepare this brief.
            </div>
            <button
              className="primary"
              type="submit"
              disabled={creating || !capabilities}
            >
              {creating ? "Starting inspection…" : "Inspect repository →"}
            </button>
            <p className="footnote">
              Local job lasts one hour; restarting the backend clears it.
            </p>
            <p id="repo-error" className="amber" role="status">
              {repoError}
            </p>
          </form>
        )}
        {panel === "settings" && (
          <>
            <h2>Your models. Your choice.</h2>
            <p>
              Choose a model and deployment target. Keys are configured in your
              local .env; account access is checked on use.
            </p>
            <label htmlFor="model">Model provider</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option>Gemma 4 · Google AI Studio</option>
              <option>GLM-5.3-Flash · Nebius</option>
              <option>Other OpenAI-compatible · local setup</option>
            </select>
            <label htmlFor="cloud">Deployment target</label>
            <select
              id="cloud"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option>Vercel</option>
              <option>DigitalOcean</option>
            </select>
            <div className="dialog-info">
              No browser key collection. Copy .env.example to .env, add your
              provider keys locally, and restart the API. Never paste
              credentials into the command bar.
            </div>
            <div className="facts">
              <div>
                <span>Connection</span>
                <strong className="amber">
                  {capabilities?.models.find(
                    (m) => m.provider === modelProvider,
                  )?.configured
                    ? "Configured · access not yet tested"
                    : "Not configured"}
                </strong>
              </div>
              <div>
                <span>Retention</span>
                <strong>Keys in local server environment</strong>
              </div>
            </div>
            <button
              className="primary"
              onClick={() => {
                setPanel(null);
                setNotice(
                  "Provider preferences saved. Generation requires an explicit action.",
                );
              }}
            >
              Save preference →
            </button>
          </>
        )}
        {panel === "about" && (
          <>
            <h2>From a repository to a launch.</h2>
            <p>
              Sudo Launch helps student and solo developers turn existing web
              projects into a live app and a launch pack grounded in evidence.
            </p>
            <div className="facts">
              <div>
                <span>Inspect</span>
                <strong>Commit-pinned public source</strong>
              </div>
              <div>
                <span>Position</span>
                <strong>Public research + your model</strong>
              </div>
              <div>
                <span>Deploy</span>
                <strong>Vercel / DigitalOcean guided flow</strong>
              </div>
              <div>
                <span>Demo</span>
                <strong>Your recording + optional ElevenLabs</strong>
              </div>
              <div>
                <span>Export</span>
                <strong>Draft posts, MP4, and receipt</strong>
              </div>
            </div>
            <p>
              React/Vite first. Bring an existing live URL for other apps.
              Source inspection, reachability, and observed interactions are
              different kinds of evidence.
            </p>
            <p className="footnote">
              Local development build. Hosted BYOK, automatic browser capture,
              and cloud API deployment are not enabled.
            </p>
            <button className="primary" onClick={() => setPanel("new")}>
              Start a launch →
            </button>
          </>
        )}
        {panel === "help" && (
          <>
            <h2>A command bar, not a guessing game.</h2>
            <p>
              Every command also has a visible button. Commands navigate the
              workspace. Generation, source checks, and rendering have explicit
              actions.
            </p>
            <div className="help-list">
              {commandList.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setPanel(null);
                    run(c);
                  }}
                >
                  <span className="red">{c}</span>
                  <span>{commandDescriptions[c]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
