#!/usr/bin/env bash
# ==============================================================================
# rollout-action.sh
# 
# Roll out bharatcode-review-action across all non-archived repositories in the
# BharatCode-ai organization strictly via Pull Requests (no direct pushes).
#
# Usage:
#   export GH_TOKEN="ghp_your_org_admin_token"
#   export BHARATCODE_API_KEY="bc_your_api_key"
#   ./scripts/rollout-action.sh
# ==============================================================================

set -euo pipefail

ORG_NAME="BharatCode-ai"
ACTION_REPO="bharatcode-review-action"
WORKFLOW_PATH=".github/workflows/bharatcode-review.yml"
BRANCH_NAME="chore/enable-bharatcode-review"

echo "========================================================"
echo "🚀 Starting BharatCode Review Action Bulk PR Rollout"
echo "Org: ${ORG_NAME}"
echo "Policy: Pull Requests Only (No Direct Pushes)"
echo "Action: Public / Marketplace Ready"
echo "========================================================"

# Verify gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Error: 'gh' CLI is not authenticated. Please run 'gh auth login' or export GH_TOKEN."
  exit 1
fi

echo "📦 1. Configuring Organization Secret BHARATCODE_API_KEY..."
if [ -n "${BHARATCODE_API_KEY:-}" ]; then
  # For GitHub Free plan orgs with public repos, visibility is set to public (or selected if private)
  echo "${BHARATCODE_API_KEY}" | gh secret set BHARATCODE_API_KEY --org "${ORG_NAME}" --visibility public || \
  echo "${BHARATCODE_API_KEY}" | gh secret set BHARATCODE_API_KEY --org "${ORG_NAME}" --visibility all 2>/dev/null || true
  echo "✅ Org-level secret BHARATCODE_API_KEY configured."
else
  echo "ℹ️ BHARATCODE_API_KEY env var not provided. Ensure it is already set in https://github.com/organizations/${ORG_NAME}/settings/secrets/actions"
fi

# Template content for consumer repositories calling the public action
WORKFLOW_CONTENT=$(cat <<'EOF'
name: BharatCode PR Review

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
    name: Automated Review
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: BharatCode-ai/bharatcode-review-action@v1
        with:
          bharatcode-api-key: ${{ secrets.BHARATCODE_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          mode: "summary+inline"
          severity-threshold: "warning"
          fail-on-severity: "error"
          cache-enabled: "true"
EOF
)

WORKFLOW_B64=$(echo "${WORKFLOW_CONTENT}" | base64 -w 0)

echo "🔍 2. Fetching list of non-archived repositories in ${ORG_NAME}..."
REPOS=$(gh repo list "${ORG_NAME}" --limit 500 --json name,isArchived --jq '.[] | select(.isArchived == false) | .name')

TOTAL_REPOS=0
PROCESSED_PRS=0
SKIPPED_REPOS=0

for REPO in ${REPOS}; do
  TOTAL_REPOS=$((TOTAL_REPOS + 1))

  # Skip the action repository itself and special .github config repo
  if [ "${REPO}" == "${ACTION_REPO}" ] || [ "${REPO}" == ".github" ]; then
    echo "⏭️ Skipping ${REPO} (action repository / special repo)"
    SKIPPED_REPOS=$((SKIPPED_REPOS + 1))
    continue
  fi

  echo "--------------------------------------------------------"
  echo "📂 Processing repository: ${ORG_NAME}/${REPO}"

  # Get default branch name
  DEFAULT_BRANCH=$(gh repo view "${ORG_NAME}/${REPO}" --json defaultBranchRef --jq .defaultBranchRef.name)
  if [ -z "${DEFAULT_BRANCH}" ] || [ "${DEFAULT_BRANCH}" == "null" ]; then
    echo "⚠️ Repo ${REPO} has no default branch (empty repo). Skipping."
    SKIPPED_REPOS=$((SKIPPED_REPOS + 1))
    continue
  fi

  # Check if workflow already exists in default branch
  WORKFLOW_EXISTS=$(gh api "repos/${ORG_NAME}/${REPO}/contents/${WORKFLOW_PATH}?ref=${DEFAULT_BRANCH}" --jq .name 2>/dev/null || echo "")
  if [ -n "${WORKFLOW_EXISTS}" ]; then
    echo "✅ Workflow already exists on ${DEFAULT_BRANCH} in ${REPO}. Skipping."
    SKIPPED_REPOS=$((SKIPPED_REPOS + 1))
    continue
  fi

  # Check if a PR already exists for this branch
  EXISTING_PR=$(gh pr list --repo "${ORG_NAME}/${REPO}" --head "${BRANCH_NAME}" --state open --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [ -n "${EXISTING_PR}" ]; then
    echo "ℹ️ Pull request #${EXISTING_PR} already open on ${REPO}. Skipping duplicate PR creation."
    SKIPPED_REPOS=$((SKIPPED_REPOS + 1))
    continue
  fi

  echo "🌿 Creating branch '${BRANCH_NAME}' and Pull Request on ${REPO}..."

  # 1. Get HEAD SHA of default branch
  REF_SHA=$(gh api "repos/${ORG_NAME}/${REPO}/git/ref/heads/${DEFAULT_BRANCH}" --jq .object.sha)

  # 2. Create or reset feature branch
  gh api -X POST "repos/${ORG_NAME}/${REPO}/git/refs" \
    -f ref="refs/heads/${BRANCH_NAME}" \
    -f sha="${REF_SHA}" >/dev/null 2>&1 || \
  gh api -X PATCH "repos/${ORG_NAME}/${REPO}/git/refs/heads/${BRANCH_NAME}" \
    -f sha="${REF_SHA}" -F force=true >/dev/null 2>&1 || true

  # 3. Commit workflow file to feature branch
  gh api -X PUT "repos/${ORG_NAME}/${REPO}/contents/${WORKFLOW_PATH}" \
    -f message="ci: add automated BharatCode PR review workflow" \
    -f content="${WORKFLOW_B64}" \
    -f branch="${BRANCH_NAME}" >/dev/null

  # 4. Open Pull Request
  PR_URL=$(gh pr create --repo "${ORG_NAME}/${REPO}" \
    --base "${DEFAULT_BRANCH}" \
    --head "${BRANCH_NAME}" \
    --title "ci: enable automated BharatCode PR reviewer" \
    --body "This PR enables the organization-wide automated code review bot powered by [\`BharatCode-ai/bharatcode-review-action@v1\`](https://github.com/BharatCode-ai/bharatcode-review-action).

### Features:
- 👁️ **Inline Code Reviews**: Actionable comments and one-click \`suggestion\` blocks
- 📊 **PR Diagnostics**: Markdown overview table grouped by severity
- 🏷️ **Severity Labels**: Automatically syncs labels based on findings
- ⚡ **Commit-SHA Cache**: Eliminates redundant spend on re-runs
- 🛡️ **Zero Direct Pushes**: All changes are tracked through pull requests

Once merged, every new pull request opened in this repository will automatically receive AI code reviews." || echo "")

  echo "✅ Pull request created: ${PR_URL}"
  PROCESSED_PRS=$((PROCESSED_PRS + 1))
done

echo "========================================================"
echo "🎉 Bulk PR Rollout Completed!"
echo "Total Repositories: ${TOTAL_REPOS}"
echo "PRs Created:        ${PROCESSED_PRS}"
echo "Skipped:            ${SKIPPED_REPOS}"
echo "========================================================"
