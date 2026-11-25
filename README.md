# BharatCode PR Reviewer (`bharatcode-review-action`)

[![CI](https://github.com/BharatCode-ai/bharatcode-review-action/actions/workflows/ci.yml/badge.svg)](https://github.com/BharatCode-ai/bharatcode-review-action/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/BharatCode-ai/bharatcode-review-action?style=flat-square)](https://github.com/BharatCode-ai/bharatcode-review-action/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Enterprise-grade, automated pull request code review bot powered by **BharatCode AI**. Features inline comments with code suggestions, structured markdown summaries, severity label syncing, local regex rules, commit-SHA caching, and strict cost controls.

---

## ⚡ 30-Second Quickstart

Add this 3-line step to your repository's `.github/workflows/review.yml`:

```yaml
name: BharatCode Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write
  checks: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: BharatCode-ai/bharatcode-review-action@v1
        with:
          bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📋 Full Input Reference

| Input | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `bharatcode-api-key` | **Yes** | — | BharatCode API key (`secrets.BHARATCODE_API_KEY`) |
| `github-token` | **Yes** | — | GitHub token with `pull-requests: write`, `issues: write` |
| `bharatcode-base-url` | No | `https://api.bharatcode.ai/v1` | BharatCode API base endpoint |
| `model` | No | `deepseek-v4.1-flash` | LLM model for review |
| `max-diff-chars` | No | `24000` | Max character diff threshold before aggressive filtering |
| `max-input-tokens` | No | `60000` | Maximum token limit per API chunk |
| `chunk-strategy` | No | `file` | Chunking mode: `file`, `hunk`, or `token` |
| `ignore-globs` | No | `**/*.lock,**/dist/**,...` | Comma-separated glob patterns to ignore |
| `include-globs` | No | `""` | Comma-separated glob patterns to include exclusively |
| `mode` | No | `summary+inline` | Review mode: `summary`, `inline`, `summary+inline`, `gate` |
| `severity-threshold` | No | `warning` | Minimum severity to report: `info`, `warning`, `error` |
| `fail-on-severity` | No | `none` | Fails workflow or gate if reached: `none`, `error`, `warning` |
| `post-labels` | No | `true` | Whether to automatically apply severity labels on PR |
| `label-map` | No | `error:bug,warning:needs-review,info:nit` | Mapping of findings severity to GitHub PR labels |
| `max-retries` | No | `3` | Maximum API retries on 429/5xx status codes |
| `request-timeout-ms` | No | `60000` | HTTP request timeout in milliseconds |
| `concurrency` | No | `3` | Parallel API chunk evaluation concurrency |
| `max-usd-budget` | No | `0` | Max USD spend cap per PR run (`0` = unlimited) |
| `dryRun` / `dry-run` | No | `false` | Run full analysis and print to stdout without write API calls |
| `cache-enabled` | No | `true` | Enable commit-SHA & model review caching |
| `allow-forks` | No | `false` | Allow execution on PRs originating from forks |
| `config-path` | No | `.bharatcode-review.yml` | Path to repository-level configuration file |

### Outputs

| Output | Description |
| :--- | :--- |
| `findings-count` | Total findings identified |
| `error-count` | Number of findings with `error` severity |
| `est-usd` | Total estimated API spend in USD |
| `review-url` | URL of the posted comment or inline review |

---

## ⚙️ Repository Configuration (`.bharatcode-review.yml`)

Configure repo-wide rules, custom local regex patterns (zero API spend), and path-specific overrides:

```yaml
model: deepseek-v4.1-flash
severity-threshold: warning
ignore-globs:
  - "docs/**"
  - "**/*.lock"

# Zero-cost local regex checks evaluated before LLM pass
rules:
  - name: "no-console-log"
    pattern: "console\\.log"
    severity: warning
    message: "Remove console.log before merging."
  - name: "no-todo"
    pattern: "TODO|FIXME"
    severity: info
    message: "Resolve remaining TODOs or track in an issue."

# Per-path severity overrides
paths:
  "src/payments/**":
    severity-threshold: error   # Strict error-only filtering for payments
  "tests/**":
    severity-threshold: info    # Relaxed rules for tests
```

---

## 📦 Structured JSON Output Schema

BharatCode models return validated structured JSON via Zod:

```json
{
  "summary": "Reviewed 3 files. Identified a SQL injection vulnerability in user lookup.",
  "findings": [
    {
      "file": "src/db/users.ts",
      "line": 42,
      "severity": "error",
      "category": "security",
      "title": "SQL Injection Vulnerability",
      "message": "User input is directly concatenated into SQL query string.",
      "suggestion": "const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);",
      "confidence": 0.95
    }
  ]
}
```

*Note: If the LLM returns unstructured output, the parser safely falls back to markdown mode without crashing.*

---

## 💰 Cost Estimation Table

Estimated pricing per 1,000 tokens:

| Model | Input / 1k Tokens | Output / 1k Tokens | Avg PR Spend (10 files) |
| :--- | :--- | :--- | :--- |
| `deepseek-v4.1-flash` | **$0.00014** | **$0.00028** | ~$0.001 - $0.004 |
| `deepseek-v4.1-pro` | **$0.00080** | **$0.00160** | ~$0.008 - $0.020 |
| *Default fallback* | $0.00020 | $0.00040 | ~$0.002 - $0.006 |

---

## 🛡️ Security & Fork Protection

- **Fork PRs**: By default, `allow-forks: false`. PRs from public forks do not execute LLM requests or expose repository secrets unless explicitly enabled.
- **Secret Masking**: All secrets and API keys are automatically masked in workflow logs via `@actions/core`.
- **Zero-Auto-Commit**: The action never pushes git commits directly to author branches.

---

## 🔍 Troubleshooting

- **Rate Limits (HTTP 429)**: The action automatically retries up to `max-retries` times with exponential backoff, jitter, and honors the `Retry-After` header.
- **Oversized Diffs**: Individual files > 50 KB are skipped automatically. Adjust `chunk-strategy: hunk` or `token` for large files.
- **Dropped Inline Comments**: GitHub's API only allows comments on lines included in modified diff hunks. Out-of-hunk findings are retained in the markdown summary table and skipped inline.

---

## ⚖️ Comparison vs. Lightweight V1

| Feature | Lightweight v1 | BharatCode Review Action |
| :--- | :--- | :--- |
| **Output Format** | Unstructured text | Structured JSON validated by Zod |
| **Inline Comments** | Basic file comments | Exact diff-position mapped inline comments |
| **Suggested Code Fixes** | ❌ No | ✅ Yes (`suggestion` markdown blocks) |
| **Local Pre-Flight Rules** | ❌ No | ✅ Yes (Regex-based, $0 API spend) |
| **Diff Chunking** | Simple naive split | File, Hunk, and Token-packing strategies |
| **Commit-SHA Caching** | ❌ No | ✅ Yes (Skips repeated runs on same SHA) |
| **Budget & Cost Controls** | ❌ No | ✅ Yes (`max-usd-budget` hard caps) |
| **Severity PR Labels** | ❌ No | ✅ Yes (Auto-syncs labels) |
| **Check Run Gate Mode** | ❌ No | ✅ Yes (Blocks PR merges) |
| **Telemetry** | Basic console | OTLP OpenTelemetry + Action Summary |
