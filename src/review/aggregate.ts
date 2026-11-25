import { ChunkReview, Finding, PathConfig, RuleConfig, Severity } from "../types.js";
import picomatch from "picomatch";

const SEVERITY_LEVELS: Record<Severity, number> = {
  info: 1,
  warning: 2,
  error: 3,
};

export function runRuleBasedChecks(
  diffMap: Map<string, { hunks: { lines: { type: string; newLineNumber?: number; content: string }[] }[] }>,
  rules: RuleConfig[]
): Finding[] {
  const findings: Finding[] = [];

  for (const rule of rules) {
    const regex = new RegExp(rule.pattern);
    for (const [filePath, fileDiff] of diffMap.entries()) {
      for (const hunk of fileDiff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === "add" && regex.test(line.content)) {
            findings.push({
              file: filePath,
              line: line.newLineNumber ?? null,
              severity: rule.severity,
              category: rule.category || "style",
              title: `Rule Check: ${rule.name}`,
              message: rule.message || `Violated rule pattern: ${rule.pattern}`,
              suggestion: null,
              confidence: 1.0,
            });
          }
        }
      }
    }
  }

  return findings;
}

export function applyPathOverrides(findings: Finding[], paths: Record<string, PathConfig>): Finding[] {
  if (Object.keys(paths).length === 0) {
    return findings;
  }

  return findings.filter((finding) => {
    for (const [pattern, config] of Object.entries(paths)) {
      const isMatch = picomatch(pattern, { dot: true });
      if (isMatch(finding.file)) {
        if (config.ignore) {
          return false;
        }
        if (config["severity-threshold"]) {
          const minLevel = SEVERITY_LEVELS[config["severity-threshold"]];
          if (SEVERITY_LEVELS[finding.severity] < minLevel) {
            return false;
          }
        }
      }
    }
    return true;
  });
}

export function aggregateReviews(
  chunkReviews: ChunkReview[],
  minConfidence = 0.6,
  minSeverity: Severity = "warning"
): { summary: string; findings: Finding[] } {
  const allFindings: Finding[] = [];
  const summaries: string[] = [];

  for (const cr of chunkReviews) {
    if (cr.summary && cr.summary.trim()) {
      summaries.push(cr.summary.trim());
    }
    for (const f of cr.findings) {
      allFindings.push(f);
    }
  }

  // Deduplicate findings: same file, same line, same title/message
  const seen = new Set<string>();
  const dedupedFindings: Finding[] = [];

  const minSeverityVal = SEVERITY_LEVELS[minSeverity] || 1;

  for (const finding of allFindings) {
    // Check confidence threshold
    if (finding.confidence < minConfidence) {
      continue;
    }

    // Check severity threshold
    if (SEVERITY_LEVELS[finding.severity] < minSeverityVal) {
      continue;
    }

    const key = `${finding.file}:${finding.line ?? "root"}:${finding.title}:${finding.message.slice(0, 50)}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedFindings.push(finding);
    }
  }

  // Combine summaries
  const combinedSummary = summaries.length > 0 ? summaries.join("\n\n") : "Review completed.";

  return {
    summary: combinedSummary,
    findings: dedupedFindings,
  };
}
