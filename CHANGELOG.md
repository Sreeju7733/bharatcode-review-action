# Changelog

All notable changes to `bharatcode-review-action` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-25

### Added
- Production-grade GitHub Action for automated pull request code review.
- Multi-strategy chunking pipeline: `file`, `hunk`, and `token`-based packing.
- Exact line-to-diff-position mapping for GitHub inline reviews (`pulls.createReview`).
- Local pre-flight regex rules evaluation (zero API spend).
- Repo-level configuration loader (`.bharatcode-review.yml`) with glob and path overrides.
- BharatCode API client with exponential backoff, jitter, and Retry-After header support.
- Zod-enforced JSON schema parsing with automatic fallback to markdown mode.
- Severity labels synchronization and gate check-run mode (`checks.create`).
- SHA256-based caching layer keyed by commit SHA, model, and prompt version.
- Cost and safety controls (max USD budget limits, fork PR protections, dry-run mode).
- OTLP distributed telemetry export and structured GitHub Actions summaries.
