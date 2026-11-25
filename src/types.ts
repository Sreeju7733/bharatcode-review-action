export type Severity = "info" | "warning" | "error";
export type Category = "bug" | "security" | "performance" | "style" | "test" | "docs" | "other";
export type ChunkStrategy = "file" | "hunk" | "token";
export type ReviewMode = "summary" | "inline" | "summary+inline" | "gate";
export type FailOnSeverity = "none" | "error" | "warning";

export interface Finding {
  file: string;
  line: number | null; // null = file-level
  severity: Severity;
  category: Category;
  title: string;
  message: string;
  suggestion: string | null;
  confidence: number;
}

export interface ChunkReview {
  summary: string;
  findings: Finding[];
}

export interface ActionInputs {
  bharatcodeApiKey: string;
  bharatcodeBaseUrl: string;
  model: string;
  githubToken: string;
  maxDiffChars: number;
  maxInputTokens: number;
  chunkStrategy: ChunkStrategy;
  ignoreGlobs: string[];
  includeGlobs: string[];
  mode: ReviewMode;
  severityThreshold: Severity;
  failOnSeverity: FailOnSeverity;
  postLabels: boolean;
  labelMap: Record<Severity, string>;
  maxRetries: number;
  requestTimeoutMs: number;
  concurrency: number;
  maxUsdBudget: number;
  dryRun: boolean;
  cacheEnabled: boolean;
  allowForks: boolean;
  configPath: string;
  sarifOutput: boolean;
  sarifPath: string;
  fallbackProviders: string[];
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface RuleConfig {
  name: string;
  pattern: string;
  severity: Severity;
  message?: string;
  category?: Category;
}

export interface PathConfig {
  "severity-threshold"?: Severity;
  "fail-on-severity"?: FailOnSeverity;
  ignore?: boolean;
}

export interface RepoConfigFile {
  model?: string;
  "severity-threshold"?: Severity;
  "fail-on-severity"?: FailOnSeverity;
  "ignore-globs"?: string[];
  "include-globs"?: string[];
  rules?: RuleConfig[];
  paths?: Record<string, PathConfig>;
}

export interface DiffLine {
  type: "add" | "del" | "normal";
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
  position: number; // 1-based index within the diff hunk/file for GitHub inline reviews
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
  isBinary: boolean;
  hunks: DiffHunk[];
  // Map of new line number -> GitHub diff position (or comment target)
  lineMap: Map<number, number>;
}

export interface Chunk {
  chunkId: string;
  files: {
    path: string;
    hunkIndices: number[];
  }[];
  content: string;
  estimatedTokens: number;
}

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
}
