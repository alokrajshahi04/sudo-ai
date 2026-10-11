import { useEffect, useRef, useState } from "react";
import LiveWorkspace, { type Stage } from "./LiveWorkspace";
import { api, getCapabilities, getJob } from "./api";
import type {
  Job,
  Capabilities,
  ModelProvider,
  ProfileDiscovery,
  ProjectCandidate,
} from "../shared/types";
type Panel =
  | "new"
  | "discover"
  | "settings"
  | "help"
  | "about"
  | "welcome"
  | null;
const stages: { id: Stage; number: string; label: string }[] = [
  { id: "overview", number: "01", label: "Project brief" },
  { id: "research", number: "02", label: "Launch story" },
  { id: "pack", number: "03", label: "Launch pack" },
];
const commands = [
  ["/discover", "Find projects on a GitHub profile"],
  ["/new", "Start with a GitHub repository"],
  ["/inspect", "Refresh source evidence"],
  ["/status", "Show current job progress"],
  ["/next", "Continue to the next step"],
  ["/back", "Return to the previous step"],
  ["/research", "Research and audience positioning"],
  ["/strategy", "Plan a marketing launch"],
  ["/studio", "Open optional recording and narration in your pack"],
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
function savedModel(): ModelProvider | null {
  try {
    const provider = localStorage.getItem("sudo-model-provider");
    return provider === "google" ||
      provider === "nebius" ||
      provider === "custom"
      ? provider
      : null;
  } catch {
    return null;
  }
}
export default function App() {
  const [job, setJob] = useState<Job | null>(null),
    [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [apiError, setApiError] = useState("");
  const [apiConnecting, setApiConnecting] = useState(true);
  const reconnectRef = useRef<() => void>(() => {});
  const [stage, setStage] = useState<Stage>("overview"),
    [panel, setPanel] = useState<Panel>(() => {
      try {
        return localStorage.getItem("sudo-welcome-v1") ? null : "welcome";
      } catch {
        return "welcome";
      }
    }),
    [command, setCommand] = useState(""),
    [notice, setNotice] = useState("");
  const [model, setModel] = useState<ModelProvider>(
      () => savedModel() || "google",
    ),
    [repo, setRepo] = useState(""),
    [demoUrl,setDemoUrl]=useState(""),
    [privateConsent, setPrivateConsent] = useState(false),
    [formError, setFormError] = useState(""),
    [creating, setCreating] = useState(false);
  const modelChosenRef = useRef(!!savedModel());
  function chooseModel(provider: ModelProvider) {
    modelChosenRef.current = true;
    setModel(provider);
    try {
      localStorage.setItem("sudo-model-provider", provider);
    } catch {}
  }
  const [username, setUsername] = useState(""),
    [discovery, setDiscovery] = useState<ProfileDiscovery | null>(null),
    [discovering, setDiscovering] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false),
    [activeCommand, setActiveCommand] = useState(0);
  const matching = commands.filter(([c]) => c.startsWith(command));
  const commandRef = useRef<HTMLInputElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null),
    stageRef = useRef<HTMLElement | null>(null);
  const workspace = !!job;
  function dismissPanel() {
    if (panel === "welcome") {
      try {
        localStorage.setItem("sudo-welcome-v1", "seen");
      } catch {}
    }
    setPanel(null);
  }
  async function connectGithub(local = false) {
    setFormError("");
    try {
      if (local) {
        await api("/auth/github/local", {});
        setCapabilities(await getCapabilities());
      } else {
        const response = await api<{ url: string }>("/auth/github/start", {});
        window.location.assign(response.url);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Connection failed.");
    }
  }
  async function disconnectGithub() {
    try {
      await api("/auth/github/disconnect", {});
      setCapabilities(await getCapabilities());
      setSavedJobs(await api<Job[]>("/jobs"));
      if (job?.inspection?.private) setJob(null);
      setDiscovery(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Disconnect failed.");
    }
  }
  async function discoverMine() {
    setDiscovering(true);
    setFormError("");
    try {
      setDiscovery(await api<ProfileDiscovery>("/discover/connected", {}));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }
  const currentStep: Stage =
    stage === "strategy" || stage === "studio" ? "pack" : stage;
  function updateJob(next: Job) {
    setJob(next);
    setSavedJobs((previous) => [
      ...previous.filter((j) => j.id !== next.id),
      next,
    ]);
  }
  function showCommands() {
    setCommandOpen(true);
    setCommand("/");
    setPaletteOpen(true);
    setActiveCommand(0);
  }
  useEffect(() => {
    if (commandOpen) commandRef.current?.focus();
  }, [commandOpen]);
  useEffect(() => {
    let alive = true;
    const authResult = new URLSearchParams(location.search).get("github");
    if (authResult) {
      setNotice(
        authResult === "connected"
          ? "GitHub connected. Your token stays on the server for this session."
          : "GitHub sign-in failed or expired. Open Settings and reconnect; public profile discovery still works.",
      );
      history.replaceState(null, "", location.pathname);
    }
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let checking = false;
    let restored = false;
    async function reconnect() {
      if (!alive || checking) return;
      checking = true;
      clearTimeout(retryTimer);
      setApiConnecting(true);
      try {
        const next = await getCapabilities();
        if (!alive) return;
        setCapabilities(next);
        setApiError("");
        if (!restored) {
          restored = true;
          if (!modelChosenRef.current && next.defaultModelProvider)
            setModel(next.defaultModelProvider);
          try {
            const previousJobs = await api<Job[]>("/jobs");
            if (!alive) return;
            setSavedJobs(previousJobs);
            if (previousJobs.length) {
              const latest = previousJobs[previousJobs.length - 1];
              setJob(latest);
              if (!modelChosenRef.current && !next.defaultModelProvider)
                setModel(latest.modelPreference);
              setStage(
                latest.positioning && latest.launchStrategy
                  ? "pack"
                  : "overview",
              );
            }
          } catch {
            if (alive)
              setNotice(
                "The API is connected, but previous jobs could not be restored. You can start a new project.",
              );
          }
        }
      } catch {
        if (alive) {
          setCapabilities(null);
          setApiError(
            "The local API is unavailable. Public GitHub discovery needs the backend, but does not need GitHub sign-in. Run npm run dev to start both services.",
          );
          retryTimer = setTimeout(() => void reconnect(), 4000);
        }
      } finally {
        checking = false;
        if (alive) setApiConnecting(false);
      }
    }
    reconnectRef.current = () => {
      void reconnect();
    };
    window.addEventListener("online", reconnectRef.current);
    void reconnect();
    return () => {
      alive = false;
      clearTimeout(retryTimer);
      window.removeEventListener("online", reconnectRef.current);
    };
  }, []);
  useEffect(() => {
    if (!job || !Object.values(job.phases).some((p) => p.state === "running"))
      return;
    const id = setInterval(
      () =>
        getJob(job.id)
          .then(updateJob)
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
    const heading =
      stageRef.current?.querySelector<HTMLElement>(".flow-heading h2");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [stage, job?.id]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (
        !panel &&
        (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") ||
          (e.key === "/" &&
            !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)))
      ) {
        e.preventDefault();
        showCommands();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panel]);
  function open(p: Panel) {
    setFormError("");
    setPanel(p);
  }
  function home() {
    setJob(null);
    setNotice("");
  }
  function run(value: string) {
    const c = value.trim().toLowerCase();
    setCommand("");
    setPaletteOpen(false);
    setCommandOpen(false);
    setActiveCommand(0);
    if (c === "/next" || c === "/back") {
      if (!workspace) return open("new");
      const index = stages.findIndex((s) => s.id === currentStep);
      const target =
        stages[
          Math.max(
            0,
            Math.min(stages.length - 1, index + (c === "/next" ? 1 : -1)),
          )
        ].id;
      if (target === "research" && !job?.launchBrief) {
        setNotice("Add your audience and launch goal before continuing.");
        return;
      }
      if (target === "pack" && !job?.positioning) {
        setNotice("Generate and choose a launch story first.");
        return;
      }
      setStage(target);
      return;
    }
    if (c === "/status") {
      setNotice(
        job
          ? Object.entries(job.phases)
              .map(([name, phase]) => `${name}: ${phase.state}`)
              .join(" · ")
          : "No active job. Start with /discover or /new.",
      );
      return;
    }
    if (c === "/inspect") {
      if (!job) return open("new");
      if (Object.values(job.phases).some((p) => p.state === "running")) {
        setNotice("An operation is already running. Wait for it to finish.");
        return;
      }
      setStage("overview");
      void api<Job>(`/jobs/${job.id}/inspect`, {})
        .then(updateJob)
        .catch((e) => setNotice(e.message));
      return;
    }
    if (c === "/clear") return home();
    if (["/new", "/discover", "/settings", "/about", "/help"].includes(c))
      return open(c.slice(1) as Panel);
    const target = (
      {
        "/research": "research",
        "/strategy": "pack",
        "/studio": "studio",
        "/pack": "pack",
      } as Record<string, Stage>
    )[c];
    if (target) {
      if (workspace) setStage(target);
      else setNotice("Start with /discover or /new, to begin.");
      return;
    }
    setNotice("Use /help to see available commands.");
  }
  async function startLaunch() {
    setCreating(true);
    setFormError("");
    try {
      const next = await api<Job>("/jobs", {
        repository: repo,
        model,
        privateConsent,
        ...(demoUrl.trim() ? {demoUrl:demoUrl.trim()} : {}),
      });
      updateJob(next);
      setStage("overview");
      setPanel(null);
      setNotice(
        "Reading the source and preparing launch context.",
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
    setDemoUrl(project.homepage || "");
    setPrivateConsent(false);
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
              ? capabilities?.mode === "hosted-demo"
                ? "Saved launch"
                : "Local job"
              : capabilities
                ? capabilities.mode === "hosted-demo"
                  ? "Live demo"
                  : "Local mode"
                : apiError
                  ? "API unavailable"
                  : "Connecting…"}
          </span>
          <a
            href="https://github.com/alokrajshahi04/sudo-ai"
            target="_blank"
            rel="noreferrer"
          >
            Source ↗
          </a>
          <button className="commands-toggle" onClick={showCommands}>
            Commands <kbd>/</kbd>
          </button>
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
                    Scan your GitHub. Pick a project.
                    <br />
                    Review its brief. Turn the source into a clear story.
                  </p>
                  <div className="code-line">
                    <span className="red">&gt;</span> public profile → your
                    shortlist
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
                      <span>▷</span> Launch video + optional voice and music
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
            <div className="home-journey" aria-label="How it works">
              <span>01 · Pick a project</span>
              <span>02 · Choose a launch story</span>
              <span>03 · Review & download your pack</span>
            </div>
            {!!savedJobs.length && (
              <section className="resume-projects">
                <span className="micro">RECENT LAUNCHES / THIS SESSION</span>
                {savedJobs.map((saved) => (
                  <button
                    key={saved.id}
                    onClick={() => {
                      setJob(saved);
                      if (
                        !modelChosenRef.current &&
                        !capabilities?.defaultModelProvider
                      )
                        setModel(saved.modelPreference);
                      setStage(
                        saved.positioning && saved.launchStrategy
                          ? "pack"
                          : "overview",
                      );
                    }}
                  >
                    <strong>{saved.name}</strong>
                    <span>
                      {saved.positioning
                        ? "Continue your launch"
                        : "Continue your brief"}{" "}
                      →
                    </span>
                  </button>
                ))}
              </section>
            )}
          </>
        ) : (
          <>
            <section className="workspace-heading">
              <div className="project-identity">
                <span className="micro">YOUR PROJECT</span>
                <h1>{job?.name}</h1>
                {job && (
                  <a
                    className="repo-link"
                    href={job.repository}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub ↗
                  </a>
                )}
              </div>
              <button className="outline" onClick={home}>
                Change project
              </button>
            </section>
            <nav className="guided-steps" aria-label="Launch progress">
              {stages.map((step, index) => (
                <button
                  key={step.id}
                  aria-current={currentStep === step.id ? "step" : undefined}
                  disabled={
                    (step.id === "research" && !job?.launchBrief) ||
                    (step.id === "pack" && !job?.positioning)
                  }
                  onClick={() => setStage(step.id)}
                >
                  <span className="step-number">{index + 1}</span>
                  <span>{step.label}</span>
                  <span className="step-state">
                    {step.id === "overview" &&
                    job?.launchBrief &&
                    job.inspection
                      ? "✓"
                      : step.id === "research" && job?.positioning
                        ? "✓"
                        : ""}
                  </span>
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
                  key={job.id}
                  job={job}
                  stage={stage}
                  capabilities={capabilities}
                  model={model}
                  onJob={updateJob}
                  onDeleted={() => {
                    setSavedJobs((previous) =>
                      previous.filter((j) => j.id !== job.id),
                    );
                    setJob(null);
                    setNotice("Local job and artifacts deleted.");
                  }}
                  onNotice={setNotice}
                  onStage={setStage}
                  onSettings={() => open("settings")}
                />
              ) : null}
            </section>
          </>
        )}
        <div className="notice" role="status" aria-live="polite">
          {notice}
        </div>
      </main>
      {commandOpen && (
        <footer
          className="command-footer command-popup"
          aria-label="Command shortcuts"
        >
          <div className="command-popup-heading">
            <span className="micro">
              SHORTCUTS / USE THE GUIDED FLOW OR A COMMAND
            </span>
            <button
              aria-label="Close commands"
              onClick={() => setCommandOpen(false)}
            >
              ×
            </button>
          </div>
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
                  setCommandOpen(false);
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
              Go ↵
            </button>
          </form>
        </footer>
      )}
      {!workspace && (
        <footer className="home-footer">
          <span>Open source. Your models. Your launch.</span>
          <button onClick={() => open("about")}>
            What does Sudo Launch do? ↗
          </button>
        </footer>
      )}
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
                  : panel === "welcome"
                    ? "Welcome to Sudo Launch"
                    : "Command help"
        }
        onCancel={dismissPanel}
        onClick={(e) => {
          if (e.target === e.currentTarget) dismissPanel();
        }}
      >
        <div className="dialog-head">
          <span className="micro">SUDO / {panel?.toUpperCase()}</span>
          <button onClick={dismissPanel} aria-label="Close dialog">
            ×
          </button>
        </div>
        {!capabilities && (
          <div className="api-connection-warning" role="status">
            <strong>
              {apiError
                ? "Backend connection needed"
                : "Connecting to the local API…"}
            </strong>
            {apiError && (
              <>
                <p>{apiError}</p>
                <button
                  className="outline"
                  disabled={apiConnecting}
                  onClick={() => reconnectRef.current()}
                >
                  {apiConnecting ? "Reconnecting…" : "Retry API connection"}
                </button>
              </>
            )}
          </div>
        )}
        {panel === "welcome" && (
          <div className="welcome-content">
            <span className="micro red">
              YOU BUILT IT. NOW HELP PEOPLE GET IT.
            </span>
            <h2>Your project deserves a clear launch.</h2>
            <p>
              Sudo Launch reads your GitHub project, suggests who it is for, and
              prepares a story, posts, and a short promo video. You review every
              claim and publish the pack yourself.
            </p>
            <div className="welcome-steps">
              <span>01 / Pick a repo</span>
              <span>02 / Confirm its story</span>
              <span>03 / Take your launch pack</span>
            </div>
            <p className="shortcut-hint">
              Use the buttons, or press <kbd>/</kbd> anywhere outside a text
              field to open commands. <kbd>Ctrl / ⌘ K</kbd> works too.
            </p>
            <button
              className="primary"
              onClick={() => {
                dismissPanel();
                open("new");
              }}
            >
              Start with my project →
            </button>
            <button className="text-button" onClick={dismissPanel}>
              Explore first →
            </button>
          </div>
        )}
        {panel === "discover" && (
          <>
            <h2>Find a project worth sharing.</h2>
            <p>
              Scan a public GitHub profile. Metadata helps shortlist projects;
              your choice and source inspection come next.
            </p>
            {capabilities?.githubAuth?.connected ? (
              <div className="github-connect">
                <span>
                  Connected as <strong>{capabilities.githubAuth.login}</strong>
                </span>
                <button
                  className="outline"
                  disabled={discovering}
                  onClick={() => void discoverMine()}
                >
                  Find my public & private projects →
                </button>
              </div>
            ) : (
              <div className="github-connect">
                <span>Looking for private projects?</span>
                <button
                  className="text-button"
                  onClick={() => open("settings")}
                >
                  Connect GitHub →
                </button>
              </div>
            )}
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
                disabled={discovering}
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
                          {project.private ? "Private · " : ""}
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
            <h2>Let’s prepare your project’s launch.</h2>
            <p>
              Start with the repository. We’ll read selected source and help
              you prepare launch content for your audience.
            </p>
            <label htmlFor="repo">GitHub repository</label>
            <input
              id="repo"
              type="url"
              required
              value={repo}
              aria-invalid={!!formError}
              placeholder="https://github.com/you/project"
              onChange={(e) => setRepo(e.target.value)}
            />
            <label htmlFor="demo-url">Deployed project URL <span className="dim">Optional · add it if available</span></label>
            <input id="demo-url" type="url" value={demoUrl} maxLength={1000} placeholder="https://your-project.example" onChange={e=>setDemoUrl(e.target.value)}/>
            <p className="footnote">A demo link is optional. You can create launch content directly from your repository.</p>
            <div className="dialog-info">
              {capabilities?.models.find((m) => m.provider === model)
                ?.configured
                ? `Brief suggestions use ${capabilities.models.find((m) => m.provider === model)?.model}. This uses your configured model quota.`
                : "Source review works without a model. Configure one in Settings for brief suggestions, or fill the brief yourself."}
            </div>
            {capabilities?.githubAuth?.connected && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={privateConsent}
                  onChange={(e) => setPrivateConsent(e.target.checked)}
                />
                If this repo is private, I approve reading selected files and
                sending redacted excerpts to my chosen model provider. Research
                queries are public; I will review them separately.
              </label>
            )}
            <button className="primary" disabled={creating || !capabilities}>
              {creating ? "Starting source review…" : "Read my project →"}
            </button>
            <p className="footnote">
              We don’t run repository code. Your work is saved on this computer
              in SQLite and survives server restarts.
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
              onChange={(e) => chooseModel(e.target.value as ModelProvider)}
            >
              {(["google", "nebius", "custom"] as ModelProvider[]).map(
                (provider) => (
                  <option key={provider} value={provider}>
                    {provider === "google"
                      ? "Google AI Studio"
                      : provider === "nebius"
                        ? "Nebius"
                        : "OpenAI-compatible"}{" "}
                    ·{" "}
                    {capabilities?.models.find((m) => m.provider === provider)
                      ?.model || "Model not set"}
                  </option>
                ),
              )}
            </select>
            <div className="dialog-info">
              {capabilities?.mode === "hosted-demo"
                ? "This restricted demo uses the owner's configured providers and quota."
                : "Configure keys in your local .env and restart the API."}{" "}
              Never paste credentials into the command bar.
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
            <p className="footnote">
              {capabilities?.mode === "hosted-demo"
                ? "The demo owner manages credentials on the server. See the"
                : "This local app reads credentials from the server’s .env. See the"}{" "}
              <a
                href="https://github.com/alokrajshahi04/sudo-ai/blob/main/docs/development.md"
                target="_blank"
                rel="noreferrer"
              >
                setup guide ↗
              </a>{" "}
              for provider configuration.
            </p>
            <section className="github-settings">
              <h3>GitHub connection</h3>
              {capabilities?.githubAuth?.connected ? (
                <>
                  <p>
                    Connected as {capabilities.githubAuth.login}. Private
                    repositories are available to this browser session.
                  </p>
                  <button
                    className="outline"
                    onClick={() => void disconnectGithub()}
                  >
                    Disconnect & clear private jobs
                  </button>
                </>
              ) : (
                <>
                  <p>
                    OAuth uses GitHub’s broad <code>repo</code> permission,
                    which includes write access. Sudo Launch only reads
                    repositories. Tokens stay in local server memory and expire
                    with the session.
                  </p>
                  <button
                    className="outline"
                    disabled={!capabilities?.githubAuth?.configured}
                    onClick={() => void connectGithub()}
                  >
                    Sign in with GitHub →
                  </button>
                  {capabilities?.githubAuth?.localTokenAvailable && (
                    <button
                      className="outline"
                      onClick={() => void connectGithub(true)}
                    >
                      Connect local read-only token →
                    </button>
                  )}
                  {!capabilities?.githubAuth?.configured && (
                    <p className="footnote">
                      OAuth app setup is pending. See todo.md; Developer Program
                      membership does not create OAuth credentials.
                    </p>
                  )}
                </>
              )}
            </section>
            <button
              className="outline"
              onClick={() => {
                void getCapabilities()
                  .then(setCapabilities)
                  .catch((e) => setFormError(e.message));
              }}
            >
              Refresh connection status
            </button>
            <button className="primary" onClick={() => setPanel(null)}>
              Use this model →
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
              <li>
                Discover public projects, connect private access, or paste a
                repository.
              </li>
              <li>
                Read source and distinguish implemented features from plans.
              </li>
              <li>
                Research alternatives and choose an audience-specific angle.
              </li>
              <li>
                Review source readiness and prepare a launch checklist, promo,
                and optional audio.
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
            <p>
              Use ↑ / ↓ and Enter. Commands open steps or run the action
              described below.
            </p>
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
