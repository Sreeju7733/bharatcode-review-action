# Changelog

All notable changes to `bharatcode-review-action` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-11-25

### Added
- **Core Pipeline**: Unified diff parser supporting added, deleted, renamed, binary, and multi-hunk files.
- **Inline Reviews**: Direct line mapping for GitHub pull request reviews with inline comments via `pulls.createReview`.
- **One-Click Suggestions**: Automatic formatting of GitHub ```` ```suggestion ```` blocks for unambiguous fixes.
- **Summary Upsert**: Marker-based persistent summary comments on pull requests (`<!-- bharatcode-review-action -->`).
- **Severity Management**: Dynamic PR label synchronization (`bug`, `needs-review`, `nit`) and gate check runs (`checks.create`).
- **Chunking Engine**: Three diff processing strategies: `file`, `hunk`, and token-packed packing.
- **Pre-Flight Rules**: Local zero-cost regex evaluation via `.bharatcode-review.yml`.
- **Deduplication & Confidence**: Confidence filtering ($\ge 0.6$) and automatic deduplication across chunks.
- **Failover Architecture**: Resilient client with exponential backoff, jitter, Retry-After header parsing, and multi-provider fallback (`openai`, `anthropic`).
- **Code Scanning**: Native SARIF 2.1.0 output generator (`sarif-output: true`).
- **Slash Commands**: On-demand `/bharatcode review` trigger with association-based authorization checks.
- **Spend & Safety Controls**: Real-time USD budget capping, external fork execution guards, and dry-run mode.
- **Committed Bundle**: Self-contained Node 20 bundle under 1 MB with zero runtime installation overhead.
