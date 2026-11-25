# BharatCode PR Reviewer

Automated code review for GitHub pull requests. BharatCode analyzes incoming diffs, maps findings directly to lines in your changes, provides one-click suggestions, and syncs severity labels without human intervention.

```yaml
- uses: BharatCode-ai/bharatcode-review-action@v1
  with:
    bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Overview

BharatCode PR Reviewer inspects unified diffs on pull requests to identify security vulnerabilities, logical bugs, and maintainability concerns. It operates entirely within GitHub Actions and posts results directly into the pull request conversation.

### What it does

- **Inline review comments**: Posts comments directly on modified lines via `pulls.createReview`.
- **One-click suggestions**: Emits GitHub suggestion blocks for unambiguous, single-line corrections.
- **Summary table**: Generates a consolidated markdown overview grouping findings by severity.
- **Severity labels**: Automatically synchronizes repository labels (`bug`, `needs-review`, `nit`) based on active findings.
- **Local regex rules**: Executes zero-cost pattern checks before sending diffs to language models.
- **Commit-SHA caching**: Caches review payloads to avoid duplicate API spend on re-runs against unchanged code.
- **SARIF 2.1.0 output**: Generates standard static analysis reports for GitHub Code Scanning integration.
- **On-demand triggers**: Supports `/bharatcode review` comments from authorized contributors.
- **Multi-provider failover**: Automatically fails over to OpenAI or Anthropic if the primary API is unreachable.

---

## Quickstart

Add the following workflow to `.github/workflows/review.yml`:

```yaml
name: Code Review

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
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run BharatCode Reviewer
        uses: BharatCode-ai/bharatcode-review-action@v1
        with:
          bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: "summary+inline"
          severity-threshold: "warning"
          fail-on-severity: "error"
```

---

## Configuration

BharatCode PR Reviewer supports both action inputs in your workflow file and repository-level configuration via `.bharatcode-review.yml`.

### Action inputs

| Input | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bharatcode-api-key` | String | **Required** | BharatCode API key. Pass via repository or organization secrets. |
| `github-token` | String | **Required** | GitHub token with `pull-requests: write` and `issues: write` permissions. |
| `bharatcode-base-url` | String | `https://bharatcode.ai/api/model/v1` | Custom endpoint for BharatCode API instances. |
| `model` | String | `deepseek-v4.1-flash` | Model identifier used for evaluation. |
| `mode` | String | `summary+inline` | Review presentation mode: `summary`, `inline`, `summary+inline`, or `gate`. |
| `severity-threshold` | String | `warning` | Minimum severity level to report: `info`, `warning`, or `error`. |
| `fail-on-severity` | String | `none` | Fails the action run if findings meet this threshold: `none`, `warning`, or `error`. |
| `post-labels` | Boolean | `true` | Automatically synchronizes severity labels on the pull request. |
| `label-map` | String | `error:bug,warning:needs-review,info:nit` | Comma-separated mapping between severity levels and label names. |
| `chunk-strategy` | String | `file` | Strategy for splitting diffs: `file` (default), `hunk`, or `token`. |
| `max-diff-chars` | Number | `24000` | Character threshold for diff evaluation before aggressive chunking. |
| `max-input-tokens` | Number | `60000` | Maximum token ceiling per evaluation chunk. |
| `ignore-globs` | String | `**/*.lock,**/dist/**,...` | Comma-separated glob patterns to exclude from analysis. |
| `include-globs` | String | `""` | Comma-separated glob patterns to include exclusively. |
| `concurrency` | Number | `3` | Maximum concurrent API chunk requests. |
| `max-usd-budget` | Number | `0` | Hard spending limit per review run in USD (`0` = unlimited). |
| `cache-enabled` | Boolean | `true` | Caches review results keyed by commit SHA, model, and prompt version. |
| `allow-forks` | Boolean | `false` | Allows review execution on pull requests originating from forks. |
| `dry-run` | Boolean | `false` | Runs analysis and outputs to logs without calling GitHub write endpoints. |
| `sarif-output` | Boolean | `false` | Writes findings to a SARIF 2.1.0 file. |
| `sarif-path` | String | `bharatcode-review.sarif` | Destination path for the generated SARIF file. |
| `fallback-providers` | String | `""` | Comma-separated fallback providers: `openai`, `anthropic`. |
| `openai-api-key` | String | `""` | API key for OpenAI fallback requests. |
| `anthropic-api-key` | String | `""` | API key for Anthropic fallback requests. |
| `config-path` | String | `.bharatcode-review.yml` | Path to repository configuration file. |

### Outputs

| Output | Description |
| :--- | :--- |
| `findings-count` | Total number of findings after filtering and deduplication. |
| `error-count` | Total number of findings classified as `error`. |
| `est-usd` | Total estimated API cost for the run formatted to 4 decimal places. |
| `review-url` | Direct URL to the created summary comment or inline review. |

---

## Repository configuration (`.bharatcode-review.yml`)

Place a `.bharatcode-review.yml` file in your repository root to enforce local rules and directory-specific thresholds:

```yaml
# Default model override
model: deepseek-v4.1-flash

# Global severity filter
severity-threshold: warning

# File patterns to exclude
ignore-globs:
  - "docs/**"
  - "**/*.lock"
  - "**/generated/**"

# Pre-flight regex checks (executed locally at zero API cost)
rules:
  - name: no-console-log
    pattern: 'console\.(log|debug)'
    severity: warning
    category: style
    message: "Remove console debugging statements before merging."

  - name: avoid-hardcoded-secrets
    pattern: 'AKIA[0-9A-Z]{16}'
    severity: error
    category: security
    message: "Potential AWS Access Key detected in diff."

# Path-specific threshold overrides
paths:
  "src/auth/**":
    severity-threshold: info # Report all findings in authentication code

  "tests/**":
    severity-threshold: error # Suppress non-critical findings in tests
```

---

## Advanced integrations

### GitHub Code Scanning (SARIF)

To pipe BharatCode findings into the GitHub Security tab:

```yaml
- name: Run BharatCode Reviewer
  uses: BharatCode-ai/bharatcode-review-action@v1
  with:
    bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    sarif-output: "true"

- name: Upload to GitHub Security
  uses: github/codeql-action/upload-sarif@v4
  if: always()
  with:
    sarif_file: bharatcode-review.sarif
    category: bharatcode-review
```

### Slash command re-trigger

Developers can trigger an on-demand review by commenting `/bharatcode review` on any open pull request.

```yaml
name: On-Demand Review

on:
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  issues: write
  contents: read

jobs:
  slash-review:
    if: github.event.issue.pull_request && startsWith(github.event.comment.body, '/bharatcode review')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: BharatCode-ai/bharatcode-review-action@v1
        with:
          bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Only comments authored by users with `OWNER`, `MEMBER`, or `COLLABORATOR` permissions will trigger the workflow. Unauthorized attempts are ignored.

---

## Security and privacy

- **Source Code Transit**: Diff contents are transmitted securely over TLS directly to the configured API endpoint. Code is never stored or persisted beyond the lifecycle of the Action run.
- **Secrets Protection**: API credentials and GitHub tokens are registered as sensitive strings and automatically masked in workflow logs.
- **Fork Restrictions**: By default, `allow-forks` is set to `false`. Pull requests originating from external forks will not execute API requests unless explicitly enabled in trusted environments.
- **No Direct Commits**: BharatCode PR Reviewer strictly writes comments, labels, and check runs. It never commits or pushes changes to repository branches.

---

## License

This project is licensed under the [MIT License](LICENSE).
