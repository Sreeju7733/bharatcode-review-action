# BharatCode PR Reviewer

[![CI](https://github.com/Sreeju7733/bharatcode-review-action/actions/workflows/ci.yml/badge.svg)](https://github.com/Sreeju7733/bharatcode-review-action/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Sreeju7733/bharatcode-review-action?color=purple&label=Release)](https://github.com/Sreeju7733/bharatcode-review-action/releases)
[![Marketplace](https://img.shields.io/badge/Marketplace-BharatCode%20Reviewer-blueviolet?logo=github-actions)](https://github.com/marketplace/actions/bharatcode-pr-reviewer)
[![Documentation](https://img.shields.io/badge/Docs-GitHub%20Pages-blue)](https://sreeju7733.github.io/bharatcode-review-action/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Automated, cost-aware AI code review for GitHub pull requests. BharatCode analyzes unified diffs, surfaces security vulnerabilities and logic bugs, posts inline comments with one-click GitHub suggestions, updates PR severity labels, and provides enforceable gate check-runs.

```yaml
- uses: BharatCode-ai/bharatcode-review-action@v1
  with:
    bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Table of Contents

- [Features](#features)
- [Single Repository Quickstart](#single-repository-quickstart)
- [Organization-Wide Rollout (All Repositories)](#organization-wide-rollout-all-repositories)
  - [1. Add Organization Secret](#1-add-organization-secret)
  - [2. Automated Bulk PR Script](#2-automated-bulk-pr-script)
  - [3. Organization Reusable Workflow](#3-organization-reusable-workflow)
- [Configuration Reference](#configuration-reference)
  - [Action Inputs](#action-inputs)
  - [Action Outputs](#action-outputs)
  - [Repository Config (.bharatcode-review.yml)](#repository-config-bharatcode-reviewyml)
- [Interactive Slash Commands](#interactive-slash-commands)
- [Weekly Spend & Cost Reports](#weekly-spend--cost-reports)
- [Static Analysis (SARIF 2.1.0)](#static-analysis-sarif-210)
- [Multi-Provider Failover](#multi-provider-failover)
- [Full Documentation Site (GitHub Pages)](#full-documentation-site-github-pages)
- [Contributing & License](#contributing--license)

---

## Features

- **Inline Review Comments & Suggestions**: Maps findings directly to modified diff lines with GitHub-native code suggestion blocks.
- **Consolidated PR Summary**: Markdown overview grouping findings by severity (errors, warnings, nits) with direct line permalinks.
- **Automated Severity Labeling**: Automatically synchronizes labels (bug, needs-review, nit) as code is pushed and resolved.
- **Quality Gate & Failure Thresholds**: Optionally fails status checks on error or warning to prevent merging flawed code (fail-on-severity).
- **Pre-Flight Regex Rules**: Executes zero-cost pattern matching (e.g., catching console.log, hardcoded keys) locally before calling LLMs.
- **Commit-SHA Caching**: Caches review payloads per commit SHA, prompt hash, and model version to prevent duplicate spend.
- **Dual-Tier Model Support**: Default lightweight glm-5.3-flash (10M free tokens/day) with seamless upgrade path to deepseek-v4.1-flash.
- **Multi-Provider Failover**: Automatically cascades to OpenAI (gpt-4o-mini) or Anthropic (claude-3-5-haiku) if primary API encounters upstream 5xx or 429 errors.
- **SARIF 2.1.0 Export**: Produces standardized reports compatible with GitHub Advanced Security Code Scanning.

---

## Single Repository Quickstart

To install BharatCode in a single repository:

1. **Add Secret**: Navigate to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - Name: `BHARATCODE_API_KEY`
   - Value: *(Your BharatCode API key from [bharatcode.ai](https://bharatcode.ai))*
2. **Add Workflow**: Create `.github/workflows/bharatcode-review.yml`:

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
    name: Review PR Changes
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
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

## Organization-Wide Rollout (All Repositories)

You can deploy BharatCode across an entire GitHub Organization (dozens or hundreds of repos) in minutes without touching repositories manually.

### 1. Add Organization Secret

Set the key once at the organization level so all repositories inherit it automatically:
1. Navigate to: `https://github.com/organizations/<YOUR_ORG>/settings/secrets/actions`
2. Click **New organization secret**.
3. Name: `BHARATCODE_API_KEY`.
4. Repository access: Select **All repositories** (or **Selected repositories**).

Alternatively, via GitHub CLI:
```bash
gh secret set BHARATCODE_API_KEY --org "<YOUR_ORG>" --body "<YOUR_API_KEY>" --visibility all
```

---

### 2. Automated Bulk PR Script

We include a production-ready rollout script: [`scripts/rollout-action.sh`](file:///home/sreeju/Projects/bharatcode-review-action/scripts/rollout-action.sh). It iterates through all non-archived repositories in your organization, creates a clean feature branch, commits the workflow, and opens an automated Pull Request for each team to review and merge:

```bash
# 1. Export your tokens
export GH_TOKEN="ghp_your_github_admin_token"
export BHARATCODE_API_KEY="bc_your_api_key"

# 2. Run rollout across your organization
./scripts/rollout-action.sh
```

**Key Safety Guarantees of the Script:**
- **Zero Direct Pushes**: Strictly creates branches and opens Pull Requests.
- **Idempotent**: Skips repositories where a rollout PR already exists or where the review workflow is already configured.
- **Non-blocking**: Skips archived or disabled repositories cleanly.

---

### 3. Organization Reusable Workflow

For enterprise governance, reference the centralized reusable workflow located at `.github/workflows/reusable-review.yml`:

In individual team repositories, simply add:
```yaml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  review:
    uses: BharatCode-ai/bharatcode-review-action/.github/workflows/reusable-review.yml@v1
    secrets:
      BHARATCODE_API_KEY: ${{ secrets.BHARATCODE_API_KEY }}
```

Any updates to model settings, security checks, or rule baselines updated in the central repository apply organization-wide immediately.

---

## Configuration Reference

### Action Inputs

| Input | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `bharatcode-api-key` | String | **Required** | BharatCode API key (`secrets.BHARATCODE_API_KEY`). |
| `github-token` | String | **Required** | GitHub token with write permissions for PRs and issues. |
| `bharatcode-base-url` | String | `https://bharatcode.ai/api/model/v1` | Official BharatCode API endpoint. |
| `model` | String | `glm-5.3-flash` | Evaluation model (`glm-5.3-flash`, `deepseek-v4.1-flash`). |
| `mode` | String | `summary+inline` | Presentation mode: `summary`, `inline`, `summary+inline`, `gate`. |
| `severity-threshold` | String | `warning` | Minimum severity reported: `info`, `warning`, `error`. |
| `fail-on-severity` | String | `none` | Fails the status check if findings reach: `none`, `warning`, `error`. |
| `post-labels` | Boolean | `true` | Automatically synchronizes severity labels on the PR. |
| `label-map` | String | `error:bug,warning:needs-review,info:nit` | Mapping of findings to GitHub label names. |
| `chunk-strategy` | String | `file` | Diff chunking strategy: `file`, `hunk`, or `token`. |
| `max-diff-chars` | Number | `24000` | Character ceiling per chunk before aggressive sub-splitting. |
| `max-input-tokens` | Number | `60000` | Maximum token ceiling per prompt request. |
| `ignore-globs` | String | `**/*.lock,**/dist/**,...` | Exclude files matching glob patterns. |
| `include-globs` | String | `""` | Restrict review strictly to matching file patterns. |
| `concurrency` | Number | `3` | Maximum simultaneous chunk review requests. |
| `max-usd-budget` | Number | `0` | Spending cap in USD per review (`0` = no limit). |
| `cache-enabled` | Boolean | `true` | Caches review results by commit SHA, model, and prompt version. |
| `allow-forks` | Boolean | `false` | Enable analysis on external PR forks. |
| `dry-run` | Boolean | `false` | Analyzes diff and prints output to logs without writing to PR. |
| `sarif-output` | Boolean | `false` | Exports static analysis findings to SARIF 2.1.0. |
| `sarif-path` | String | `bharatcode-review.sarif` | Destination path for SARIF output file. |
| `fallback-providers` | String | `""` | Comma-separated fallback providers: `openai`, `anthropic`. |
| `openai-api-key` | String | `""` | API key for OpenAI fallback requests. |
| `anthropic-api-key` | String | `""` | API key for Anthropic fallback requests. |
| `config-path` | String | `.bharatcode-review.yml` | Path to repository config file. |

### Action Outputs

| Output | Type | Description |
| :--- | :--- | :--- |
| `findings-count` | Number | Total findings detected after filtering. |
| `error-count` | Number | Number of `error`-level findings. |
| `est-usd` | String | Estimated API spend for the run formatted to 4 decimals. |
| `review-url` | String | Direct URL permalink to the created PR review/summary. |

---

### Repository Config (`.bharatcode-review.yml`)

Place `.bharatcode-review.yml` in your repo root for local rules and exclusions:

```yaml
# Model override (defaults to glm-5.3-flash)
model: glm-5.3-flash

# Filter threshold: info | warning | error
severity-threshold: warning

# Excluded paths
ignore-globs:
  - "docs/**"
  - "**/*.lock"
  - "**/generated/**"

# Zero-cost local regex rules (scanned prior to LLM analysis)
rules:
  - name: no-console-log
    pattern: 'console\.(log|debug)'
    severity: warning
    category: style
    message: "Remove debugging console statements before production merge."

  - name: avoid-hardcoded-aws-keys
    pattern: 'AKIA[0-9A-Z]{16}'
    severity: error
    category: security
    message: "Potential hardcoded AWS Access Key ID detected."
```

---

## Interactive Slash Commands

Trigger an immediate review on-demand by commenting `/bharatcode review` on any open Pull Request:

1. Add `.github/workflows/slash-command.yml`:
```yaml
name: BharatCode Slash Command Dispatch

on:
  issue_comment:
    types: [created]

jobs:
  dispatch:
    if: github.event.issue.pull_request && startsWith(github.event.comment.body, '/bharatcode review')
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Review
        uses: BharatCode-ai/bharatcode-review-action@v1
        with:
          bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Weekly Spend & Cost Reports

Track your organization's API usage every Monday with automated spend summaries.

Add `.github/workflows/weekly-cost-report.yml`:
```yaml
name: BharatCode Weekly Cost Report

on:
  schedule:
    - cron: "0 9 * * 1" # Every Monday at 09:00 UTC
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - name: Generate Spend Summary
        run: |
          echo "### 📊 Weekly BharatCode Cost Summary" >> $GITHUB_STEP_SUMMARY
          echo "Active Model: glm-5.3-flash (10M free tokens/day)" >> $GITHUB_STEP_SUMMARY
```

---

## Static Analysis (SARIF 2.1.0)

Integrate findings into **GitHub Advanced Security Code Scanning**:

```yaml
- name: Run Review with SARIF
  uses: BharatCode-ai/bharatcode-review-action@v1
  with:
    bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    sarif-output: "true"
    sarif-path: "results.sarif"

- name: Upload SARIF to GitHub Code Scanning
  uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: "results.sarif"
```

---

## Multi-Provider Failover

Ensure 99.99% review availability during upstream provider outages:

```yaml
- uses: BharatCode-ai/bharatcode-review-action@v1
  with:
    bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
    github-token: ${{ secrets.GITHUB_TOKEN }}
    fallback-providers: "openai,anthropic"
    openai-api-key: ${{ secrets.OPENAI_API_KEY }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

If BharatCode returns `429` or `5xx`, the action seamlessly completes the review using OpenAI or Anthropic without breaking your CI pipeline.

---

## Full Documentation Site (GitHub Pages)

The full interactive documentation portal is hosted via GitHub Pages in the [`docs/`](file:///home/sreeju/Projects/bharatcode-review-action/docs) directory:

- 📖 **Architecture & Security Deep Dive**
- 🚀 **Step-by-Step Multi-Repo Rollout Playbook**
- ⚙️ **Advanced Configuration & Regex Engine Reference**
- 💰 **Token Optimization & Budget Guardrails**

Visit the live documentation site:
👉 **[https://sreeju7733.github.io/bharatcode-review-action/](https://sreeju7733.github.io/bharatcode-review-action/)**

---

## Contributing & License

Contributions are welcome. Please read [CONTRIBUTING.md](file:///home/sreeju/Projects/bharatcode-review-action/CONTRIBUTING.md) and [SECURITY.md](file:///home/sreeju/Projects/bharatcode-review-action/SECURITY.md) before opening pull requests.

Created by [Sreeju S](https://github.com/Sreeju7733) & [Flovo](https://github.com/flovo-labs).

Released under the [MIT License](file:///home/sreeju/Projects/bharatcode-review-action/LICENSE). Copyright (c) 2026 BharatCode AI.
