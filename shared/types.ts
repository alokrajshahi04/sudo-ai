export type ModelProvider = "google" | "nebius" | "custom";
export type Phase =
  | "inspect"
  | "analyze"
  | "music"
  | "research"
  | "position"
  | "verify"
  | "recording"
  | "narrate"
  | "render";
export type State = "idle" | "running" | "completed" | "failed";
export interface Evidence {
  id: string;
  kind: "source" | "repository_metadata" | "public_research" | "http";
  title: string;
  url: string;
  excerpt: string;
  checkedAt: string;
}
export interface Inspection {
  revision: string;
  private?: boolean;
  treePaths?: string[];
  branch: string;
  profile:
    | "static_vite"
    | "server_web"
    | "python_cli"
    | "library_cli"
    | "multi_service"
    | "documentation"
    | "unknown";
  buildCommand: string | null;
  outputDirectory: string | null;
  files: string[];
  blockers: string[];
  warnings: string[];
  homepage: string | null;
  description: string;
  evidence: Evidence[];
}
export interface Angle {
  title: string;
  audience: string;
  rationale: string;
  evidenceIds: string[];
  linkedin: string;
  x: string;
  narration: string;
}
export interface Positioning {
  angles: Angle[];
  limitations: string[];
  provider: ModelProvider;
  model: string;
  generatedAt: string;
}
export interface SiteCheck {
  url: string;
  finalUrl: string;
  httpStatus: number;
  reachable: boolean;
  title: string | null;
  checkedAt: string;
  builtRevision: null;
  interaction: "not_checked";
}
export interface LaunchStrategy {
  launchType: "showcase" | "relaunch";
  angleTitle: string | null;
  checklist: string[];
  channels: { name: string; purpose: string; timing: string }[];
  createdAt: string;
}
export interface ProjectCandidate {
  name: string;
  repository: string;
  description: string;
  language: string | null;
  homepage: string | null;
  updatedAt: string;
  score: number;
  reasons: string[];
  private?: boolean;
}
export interface ProfileDiscovery {
  username: string;
  projects: ProjectCandidate[];
  checkedAt: string;
  coverage: string;
}
export interface LaunchBrief {
  audience: string;
  goal: string;
  context: string;
}
export interface Job {
  id: string;
  repository: string;
  name: string;
  brief: string;
  launchBrief?: LaunchBrief;
  repoFirst?: boolean;
  privateConsent?: boolean;
  progressStep?: string;
  analysis?: ProjectAnalysis;
  readiness?: ReadinessReview;
  storyboard?: Storyboard;
  createdAt: string;
  expiresAt: string;
  phases: Record<Phase, { state: State; error?: string }>;
  inspection?: Inspection;
  research?: { sources: Evidence[]; coverage: string; query: string };
  positioning?: Positioning;
  selectedAngle: number;
  modelPreference: ModelProvider;
  launchStrategy?: LaunchStrategy;
  site?: SiteCheck;
  artifacts: {
    type: "recording" | "narration" | "music" | "video" | "poster";
    url: string;
    provenance: string;
  }[];
}
export interface Capabilities {
  mode: "local";
  models: { provider: ModelProvider; model: string; configured: boolean }[];
  narration: boolean;
  music?: boolean;
  promo?: boolean;
  githubAuth?: {
    configured: boolean;
    localTokenAvailable: boolean;
    connected: boolean;
    login?: string;
  };
  render: boolean;
  hostedCredentialEntry: false;
  research: string;
}

export interface ProjectAnalysis {
  summary: string;
  suggestedBrief: LaunchBrief;
  assumptions: string[];
  evidenceIds: string[];
  provider: ModelProvider;
  model: string;
  generatedAt: string;
}
export interface ReadinessFinding {
  id: string;
  severity: "review" | "action";
  title: string;
  detail: string;
  files: string[];
  evidenceIds: string[];
}
export interface ReadinessReview {
  findings: ReadinessFinding[];
  coverage: string;
  agentPrompt: string;
}
export interface Storyboard {
  duration: number;
  scenes: { label: string; heading: string; detail: string; seconds: number }[];
  sourceVisual: { file: string; excerpt: string };
  cta: string;
  workflow: string;
}
