import { useEffect, useRef, useState } from "react";
import LiveWorkspace, { type Stage } from "./LiveWorkspace";
import SampleWorkspace from "./SampleWorkspace";
import { api, getCapabilities, getJob } from "./api";
import type {
  Job,
  Capabilities,
  ModelProvider,
  ProfileDiscovery,
  ProjectCandidate,
} from "../shared/types";
type Panel = "new" | "discover" | "settings" | "help" | "about" | null;
const stages: { id: Stage; number: string; label: string }[] = [
  { id: "overview", number: "01", label: "Understand" },
  { id: "research", number: "02", label: "Position" },
  { id: "strategy", number: "03", label: "Launch plan" },
  { id: "studio", number: "04", label: "Demo" },
  { id: "pack", number: "05", label: "Launch pack" },
];
const commands = [
  ["/discover", "Find projects on a GitHub profile"],
  ["/new", "Start with a public repository"],
  ["/demo", "Explore three example project types"],
  ["/research", "Research and audience positioning"],
  ["/strategy", "Plan a marketing launch"],
  ["/studio", "Recording and narration"],
  ["/pack", "Download your launch assets"],
  ["/settings", "Choose your model"],
  ["/about", "What Sudo Launch does"],
  ["/clear", "Return to the launch screen"],
  ["/help", "All commands and shortcuts"],
];
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
export default function App() {
  const [sample, setSample] = useState(false),
    [job, setJob] = useState<Job | null>(null),
    [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [stage, setStage] = useState<Stage>("overview"),
    [panel, setPanel] = useState<Panel>(null),
    [command, setCommand] = useState(""),
    [notice, setNotice] = useState("");
  const [model, setModel] = useState<ModelProvider>("google"),
    [repo, setRepo] = useState(""),
    [brief, setBrief] = useState(""),
    [formError, setFormError] = useState(""),
    [creating, setCreating] = useState(false);
  const [username, setUsername] = useState(""),
    [discovery, setDiscovery] = useState<ProfileDiscovery | null>(null),
    [discovering, setDiscovering] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false),
    [activeCommand, setActiveCommand] = useState(0);
  const matching = commands.filter(([c]) => c.startsWith(command));
  const commandRef = useRef<HTMLInputElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null),
    stageRef = useRef<HTMLElement | null>(null);
  const workspace = !!(job || sample);
  useEffect(() => {
    let alive = true;
    getCapabilities()
      .then((c) => {
        if (alive) setCapabilities(c);
        return api<Job[]>("/jobs");
      })
      .then((j) => {
        if (alive && j.length) setJob(j[j.length - 1]);
      })
      .catch(() => {
        if (alive)
          setNotice(
            "Local API unavailable. Run npm run dev to start both services.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!job || !Object.values(job.phases).some((p) => p.state === "running"))
      return;
    const id = setInterval(
      () =>
        getJob(job.id)
          .then(setJob)
          .catch((e) => {
            setNotice(e.message);
            setJob(null);
          }),
      1200,
    );
    return () => clearInterval(id);
  }, [job]);
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
    if (paletteOpen && command.startsWith("/"))
      document
        .getElementById(`command-option-${activeCommand}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [activeCommand, paletteOpen, command]);
  useEffect(() => {
    stageRef.current?.querySelector(".stage-content")?.scrollTo({ top: 0 });
  }, [stage, job?.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panel]);
  function open(p: Panel) {
    setFormError("");
    setPanel(p);
  }
  function demo() {
    setJob(null);
    setSample(true);
    setStage("overview");
    setPanel(null);
    setNotice(
      "Illustrative walkthrough. Try an app, CLI, or server project example.",
    );
  }
  function home() {
    setJob(null);
    setSample(false);
    setNotice("Local jobs remain available until expiry.");
  }
  function run(value: string) {
    const c = value.trim().toLowerCase();
    setCommand("");
    setPaletteOpen(false);
    setActiveCommand(0);
    if (c === "/demo") return demo();
    if (c === "/clear") return home();
    if (["/new", "/discover", "/settings", "/about", "/help"].includes(c))
      return open(c.slice(1) as Panel);
    const target = (
      {
        "/research": "research",
        "/strategy": "strategy",
        "/studio": "studio",
        "/pack": "pack",
      } as Record<string, Stage>
    )[c];
    if (target) {
      if (workspace) setStage(target);
      else setNotice("Start with /discover or /new, or explore /demo.");
      return;
    }
    setNotice("Use /help to see available commands.");
  }
  async function startLaunch() {
    setCreating(true);
    setFormError("");
    try {
      const next = await api<Job>("/jobs", { repository: repo, brief, model });
      setJob(next);
      setSample(false);
      setStage("overview");
      setPanel(null);
      setNotice(
        "Reading public source at a recorded commit. Marketing claims remain subject to review.",
      );
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not start launch.");
    } finally {
      setCreating(false);
    }
  }
  async function discover() {
    setDiscovering(true);
    setFormError("");
    try {
      setDiscovery(
        await api<ProfileDiscovery>("/discover", { username: username.trim() }),
      );
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Profile discovery failed.",
      );
    } finally {
      setDiscovering(false);
    }
  }
  function chooseProject(project: ProjectCandidate) {
    setRepo(project.repository);
    setBrief(
      project.description
        ? `Product context: ${project.description}\nAudience and launch goal: `
        : "",
    );
    open("new");
  }
  return (
    <div className={`app ${workspace ? "workspace" : "home"}`}>
      <header className="topbar">
        <button className="brand" onClick={home} aria-label="Sudo Launch home">
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
            Source ↗
          </a>
          <button className="settings-button" onClick={() => open("settings")}>
            Settings <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </header>
      <main id="main">
        <div className="eyebrow">
          <span>OPEN SOURCE / YOUR PROJECT DESERVES AN AUDIENCE</span>
          <span className="eyebrow-right">
            {workspace
              ? "PRODUCT MARKETING WORKSPACE"
              : "FROM GITHUB TO A LAUNCH STORY"}
          </span>
        </div>
        {!workspace ? (
          <>
            <section className="landing-grid" aria-labelledby="hero-title">
              <div className="hero-panel">
                <div className="panel-label">
                  <span className="red">●</span> PRODUCT LAUNCH CONTROL
                </div>
                <Orb />
                <div className="hero-copy">
                  <span className="micro">
                    YOU BUILT IT. HELP PEOPLE GET IT.
                  </span>
                  <h1 id="hero-title">
                    Give your project
                    <br />a launch story<span className="red">.</span>
                  </h1>
                  <p>
                    Find the audience. Explain the value.
                    <br />
                    Create the demo and posts to launch it.
                  </p>
                  <button className="primary" onClick={() => open("discover")}>
                    Find my projects ↗
                  </button>
                  <button className="text-button" onClick={() => open("new")}>
                    or start with a repository →
                  </button>
                </div>
                <span className="coordinate">SUDO / 001</span>
              </div>
              <div className="intro-side">
                <section className="intro-block">
                  <span className="micro">01 / DISCOVER</span>
                  <h2>Your GitHub has stories to tell.</h2>
                  <p>
                    Scan a public profile. Pick a project.
                    <br />
                    Turn its source and your brief into a clear story.
                  </p>
                  <div className="code-line">
                    <span className="red">&gt;</span> /discover
                    your-github-username
                  </div>
                  <span className="footnote">
                    Web apps, CLI tools, libraries, and prototypes.
                  </span>
                </section>
                <section className="intro-block">
                  <span className="micro">02 / LAUNCH PACK</span>
                  <h2>Make the value easy to see.</h2>
                  <ul className="output-list">
                    <li>
                      <span>⌕</span> Audience + researched positioning
                    </li>
                    <li>
                      <span>≡</span> A practical launch plan
                    </li>
                    <li>
                      <span>▷</span> Demo assets + optional narration
                    </li>
                    <li>
                      <span>↗</span> LinkedIn / X drafts with an evidence
                      receipt
                    </li>
                  </ul>
                  <span className="footnote">
                    You review and publish. Sudo Launch prepares the marketing.
                  </span>
                </section>
              </div>
            </section>
            <div className="principles">
              <span>YOUR PROJECT.</span>
              <span>YOUR AUDIENCE.</span>
              <span>YOUR MODELS.</span>
              <span className="dim">YOUR LAUNCH.</span>
            </div>
            <section className="workflow-strip" aria-label="Marketing workflow">
              {stages.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    demo();
                    setStage(s.id);
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
                  {job
                    ? `PROJECT / ${job.name.toUpperCase()}`
                    : "WORKFLOW / THREE PROJECT TYPES"}
                </span>
                <h1>
                  {job ? job.name : "A project. An audience. A launch."}
                  <span className="red">.</span>
                </h1>
                {job ? (
                  <a
                    className="repo-link"
                    href={job.repository}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {job.repository.replace("https://github.com/", "")} ↗
                  </a>
                ) : (
                  <span className="repo-link">
                    Explore an app, a CLI tool, or a server project.
                  </span>
                )}
              </div>
              <span className="sample-tag">
                {job ? "REAL SOURCE / LOCAL" : "ILLUSTRATIVE SAMPLE"}
              </span>
            </section>
            <div className="sample-warning">
              {job
                ? "Source evidence informs marketing. Review claims; code and issues are not executed."
                : "Illustrative examples only. No source, model, research, or publishing operation ran."}
            </div>
            <nav className="stage-nav" aria-label="Marketing stages">
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
            <section
              className="workspace-body"
              ref={stageRef}
              aria-label="Current marketing stage"
            >
              {job ? (
                <LiveWorkspace
                  job={job}
                  stage={stage}
                  capabilities={capabilities}
                  model={model}
                  onJob={setJob}
                  onDeleted={() => {
                    setJob(null);
                    setNotice("Local job and artifacts deleted.");
                  }}
                  onNotice={setNotice}
                  onSettings={() => open("settings")}
                />
              ) : (
                <SampleWorkspace stage={stage} onStart={() => open("new")} />
              )}
            </section>
          </>
        )}
        <div className="notice" role="status" aria-live="polite">
          {notice ||
            "Discover → understand → position → prepare your launch pack. Review before publishing."}
        </div>
      </main>
      <footer className="command-footer">
        {paletteOpen && command.startsWith("/") && matching.length > 0 && (
          <div
            id="command-menu"
            className="command-suggestions"
            role="listbox"
            aria-label="Available commands"
          >
            {matching.map(([c, description], i) => (
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
                <span>{description}</span>
              </button>
            ))}
          </div>
        )}
        <form
          className="command-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              paletteOpen && command.startsWith("/") && matching.length
                ? matching[activeCommand]?.[0] || command
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
            aria-label="Launch command"
            aria-autocomplete="list"
            aria-controls="command-menu"
            aria-expanded={
              paletteOpen && command.startsWith("/") && matching.length > 0
            }
            aria-activedescendant={
              paletteOpen && matching.length
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
                matching.length &&
                ["ArrowDown", "ArrowUp"].includes(e.key)
              ) {
                e.preventDefault();
                setPaletteOpen(true);
                setActiveCommand(
                  (i) =>
                    (i + (e.key === "ArrowDown" ? 1 : -1) + matching.length) %
                    matching.length,
                );
              }
            }}
            placeholder="Type / for commands"
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
          <button onClick={() => open("discover")}>discover</button>
          <button onClick={() => open("new")}>new launch</button>
          <button onClick={demo}>sample</button>
          <button onClick={() => open("about")}>about</button>
          <button onClick={() => open("help")}>help</button>
          <span className="footer-note">Make what you built understood.</span>
        </div>
      </footer>
      <dialog
        ref={dialogRef}
        aria-label={
          panel === "new"
            ? "New launch"
            : panel === "discover"
              ? "Discover projects"
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
        {panel === "discover" && (
          <>
            <h2>Find a project worth sharing.</h2>
            <p>
              Scan a public GitHub profile. Metadata helps shortlist projects;
              your choice and source inspection come next.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void discover();
              }}
            >
              <label htmlFor="github-user">GitHub username</label>
              <input
                id="github-user"
                required
                value={username}
                maxLength={39}
                placeholder="your-username"
                onChange={(e) => setUsername(e.target.value)}
              />
              <button
                className="primary discover-submit"
                disabled={discovering || !capabilities}
              >
                {discovering
                  ? "Scanning public repositories…"
                  : "Find projects →"}
              </button>
            </form>
            {discovery && (
              <>
                <p className="footnote">{discovery.coverage}</p>
                <div className="project-results">
                  {discovery.projects.map((project) => (
                    <article
                      key={project.repository}
                      className="project-candidate"
                    >
                      <div>
                        <h3>{project.name}</h3>
                        <span className="footnote">
                          {project.language || "Language unspecified"}
                        </span>
                      </div>
                      <p>
                        {project.description ||
                          "No description supplied. Add a brief when starting."}
                      </p>
                      <span className="footnote">
                        {project.reasons.join(" · ")}
                      </span>
                      <button
                        className="outline"
                        onClick={() => chooseProject(project)}
                      >
                        Prepare this project’s launch →
                      </button>
                    </article>
                  ))}
                </div>
                {!discovery.projects.length && (
                  <p>
                    No eligible public projects found in the checked
                    repositories.
                  </p>
                )}
              </>
            )}
          </>
        )}
        {panel === "new" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void startLaunch();
            }}
          >
            <h2>What did you build? Who needs it?</h2>
            <p>
              Any public repository can enter this workflow. Source coverage and
              uncertain claims stay visible.
            </p>
            <label htmlFor="repo">Public GitHub repository</label>
            <input
              id="repo"
              type="url"
              required
              value={repo}
              aria-invalid={!!formError}
              placeholder="https://github.com/you/project"
              onChange={(e) => setRepo(e.target.value)}
            />
            <label htmlFor="brief">Audience and launch goal</label>
            <textarea
              id="brief"
              required
              minLength={3}
              maxLength={1200}
              value={brief}
              placeholder="Who is this for, what does it do, and what do you want the launch to achieve?"
              onChange={(e) => setBrief(e.target.value)}
            />
            <div className="dialog-info">
              No code runs. No deployment credentials are needed. This reads
              public source and prepares marketing.
            </div>
            <button className="primary" disabled={creating || !capabilities}>
              {creating
                ? "Starting source inspection…"
                : "Understand this project →"}
            </button>
            <p className="footnote">
              Local job lasts one hour; restarting the backend clears it.
            </p>
          </form>
        )}
        {panel === "settings" && (
          <>
            <h2>Your model. Your launch.</h2>
            <p>
              Generation uses the selected configured provider and its quota. It
              never silently switches models.
            </p>
            <label htmlFor="model">Model provider</label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value as ModelProvider)}
            >
              <option value="google">Gemma 4 · Google AI Studio</option>
              <option value="nebius">GLM-5.3-Flash · Nebius</option>
              <option value="custom">
                Other OpenAI-compatible · local setup
              </option>
            </select>
            <div className="dialog-info">
              Configure keys in your local .env and restart the API. Never paste
              credentials into the command bar.
            </div>
            <div className="facts">
              <div>
                <span>Selected provider</span>
                <strong>
                  {capabilities?.models.find((m) => m.provider === model)
                    ?.configured
                    ? "Configured · access checked on use"
                    : "Not configured"}
                </strong>
              </div>
              <div>
                <span>Public research</span>
                <strong>Bounded GitHub + supplied links</strong>
              </div>
            </div>
            <button className="primary" onClick={() => setPanel(null)}>
              Use this preference →
            </button>
          </>
        )}
        {panel === "about" && (
          <>
            <h2>You build. Sudo Launch helps you market.</h2>
            <p>
              Find projects on your GitHub, choose an audience, sharpen the
              positioning, and prepare a launch pack with posts and a demo.
            </p>
            <ol className="launch-checklist">
              <li>Discover public projects or paste a repository.</li>
              <li>
                Read source and distinguish implemented features from plans.
              </li>
              <li>
                Research alternatives and choose an audience-specific angle.
              </li>
              <li>
                Prepare a launch checklist, recording, and optional narration.
              </li>
              <li>Review and share the pack yourself.</li>
            </ol>
            <p className="footnote">
              Web apps, tools, libraries, and prototypes are welcome. No
              deployments, automatic code previews, or social publishing.
            </p>
            <button className="primary" onClick={() => open("discover")}>
              Find my projects →
            </button>
          </>
        )}
        {panel === "help" && (
          <>
            <h2>A command bar, not a guessing game.</h2>
            <p>Use ↑ / ↓ and Enter. Every command also has a visible button.</p>
            <div className="help-list">
              {commands.map(([c, d]) => (
                <button
                  key={c}
                  onClick={() => {
                    setPanel(null);
                    run(c);
                  }}
                >
                  <span className="red">{c}</span>
                  <span>{d}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {formError && (
          <p className="amber" role="alert">
            {formError}
          </p>
        )}
      </dialog>
    </div>
  );
}
