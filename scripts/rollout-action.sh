#!/usr/bin/env bash
# ==============================================================================
# rollout-action.sh
# 
# Roll out bharatcode-review-action across all repositories in the BharatCode-ai org.
# Automates:
#   1. Org-wide secret propagation (BHARATCODE_API_KEY)
#   2. Org-wide action permissions (allow internal action across org repos)
#   3. Creating PR or pushing workflow file directly to default branch
#
# Usage:
#   export GH_TOKEN="ghp_your_org_admin_token"
#   ./scripts/rollout-action.sh [--direct-push | --create-pr]
# ==============================================================================

set -euo pipefail

ORG_NAME="BharatCode-ai"
ACTION_REPO="bharatcode-review-action"
WORKFLOW_PATH=".github/workflows/bharatcode-review.yml"
BRANCH_NAME="chore/enable-bharatcode-review"
MODE="${1:---create-pr}"

echo "========================================================"
echo "🚀 Starting BharatCode Review Action Organization Rollout"
echo "Org: ${ORG_NAME}"
echo "Mode: ${MODE}"
echo "========================================================"

# Verify gh CLI is authenticated
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Error: 'gh' CLI is not authenticated. Please run 'gh auth login' or export GH_TOKEN."
  exit 1
fi

echo "📦 1. Checking / Setting Org Secret BHARATCODE_API_KEY..."
if [ -n "${BHARATCODE_API_KEY:-}" ]; then
  echo "${BHARATCODE_API_KEY}" | gh secret set BHARATCODE_API_KEY --org "${ORG_NAME}" --visibility all
  echo "✅ Org-wide secret BHARATCODE_API_KEY configured."
else
  echo "ℹ️ BHARATCODE_API_KEY environment variable not provided. Assuming secret is already set in ${ORG_NAME} settings."
fi

echo "📦 2. Ensuring Action permissions allow internal sharing..."
# Set action access to organization for internal use
gh api -X PUT "repos/${ORG_NAME}/${ACTION_REPO}/actions/permissions/access" \
  -f access_level="organization" 2>/dev/null || echo "ℹ️ Action permissions set or managed at enterprise/org level."

# Template content for consumer repositories
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

echo "🔍 3. Fetching list of all non-archived repositories in ${ORG_NAME}..."
REPOS=$(gh repo list "${ORG_NAME}" --limit 500 --json name,isArchived,isFork --jq '.[] | select(.isArchived == false) | .name')

for REPO in ${REPOS}; do
  if [ "${REPO}" == "${ACTION_REPO}" ] || [ "${REPO}" == ".github" ]; then
    echo "⏭️ Skipping ${REPO} (action repository / special repo)"
    continue
  fi

  echo "--------------------------------------------------------"
  echo "📂 Processing repository: ${ORG_NAME}/${REPO}"

  # Get default branch
  DEFAULT_BRANCH=$(gh repo view "${ORG_NAME}/${REPO}" --json defaultBranchRef --jq .defaultBranchRef.name)

  # Check if workflow already exists in the repo
  WORKFLOW_EXISTS=$(gh api "repos/${ORG_NAME}/${REPO}/contents/${WORKFLOW_PATH}?ref=${DEFAULT_BRANCH}" --jq .name 2>/dev/null || echo "")

  if [ -n "${WORKFLOW_EXISTS}" ]; then
    echo "✅ Workflow already exists in ${REPO}. Skipping."
    continue
  fi

  if [ "${MODE}" == "--direct-push" ]; then
    echo "🚀 Pushing workflow directly to ${DEFAULT_BRANCH}..."
    gh api -X PUT "repos/${ORG_NAME}/${REPO}/contents/${WORKFLOW_PATH}" \
      -f message="ci: enable automated BharatCode PR reviewer" \
      -f content="${WORKFLOW_B64}" \
      -f branch="${DEFAULT_BRANCH}" >/dev/null
    echo "✅ Successfully committed workflow to ${REPO}:${DEFAULT_BRANCH}"
  else
    echo "🌿 Creating rollout PR in ${REPO}..."
    # 1. Get SHA of default branch
    REF_SHA=$(gh api "repos/${ORG_NAME}/${REPO}/git/ref/heads/${DEFAULT_BRANCH}" --jq .object.sha)

    # 2. Create feature branch
    gh api -X POST "repos/${ORG_NAME}/${REPO}/git/refs" \
      -f ref="refs/heads/${BRANCH_NAME}" \
      -f sha="${REF_SHA}" >/dev/null 2>&1 || true

    # 3. Commit file to feature branch
    gh api -X PUT "repos/${ORG_NAME}/${REPO}/contents/${WORKFLOW_PATH}" \
      -f message="ci: add automated BharatCode PR review workflow" \
      -f content="${WORKFLOW_B64}" \
      -f branch="${BRANCH_NAME}" >/dev/null

    # 4. Open PR
    PR_URL=$(gh pr create --repo "${ORG_NAME}/${REPO}" \
      --base "${DEFAULT_BRANCH}" \
      --head "${BRANCH_NAME}" \
      --title "ci: enable automated BharatCode PR reviewer" \
      --body "This PR enables the organization-wide automated code review bot powered by \`BharatCode-ai/bharatcode-review-action@v1\`.

### Features Enabled:
- 👁️ Automated inline review comments with one-click fix suggestions
- 📊 PR markdown overview table grouped by severity (Error / Warning / Info)
- 🏷️ Automatic severity label synchronization
- ⚡ Commit-SHA review caching to eliminate redundant API spend
" || echo "")

    echo "✅ Pull request created: ${PR_URL}"
  fi
done

echo "========================================================"
echo "🎉 BharatCode Review Action rollout completed successfully!"
echo "========================================================"
