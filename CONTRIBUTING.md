# Contributing to BharatCode PR Reviewer

Thank you for your interest in contributing to `bharatcode-review-action`!

## Development Setup

1. **Prerequisites**:
   - Node.js 20+
   - npm 10+

2. **Clone & Install**:
   ```bash
   git clone https://github.com/BharatCode-ai/bharatcode-review-action.git
   cd bharatcode-review-action
   npm install
   ```

## Development Workflow

- Run tests in watch mode:
  ```bash
  npm run test:watch
  ```
- Typecheck:
  ```bash
  npm run typecheck
  ```
- Linting:
  ```bash
  npm run lint
  ```
- Coverage validation:
  ```bash
  npm run test:coverage
  ```

## Critical Build Requirement: `dist/index.js`

GitHub Actions run directly from the repository without running `npm install` on the user's runner. Therefore, `dist/index.js` must be bundled and committed into the repository.

Before submitting a PR or cutting a release, make sure to rebuild:
```bash
npm run build
npm run size-check
git add dist/
```

We recommend installing a git pre-commit hook (or husky):
```bash
npx husky init
echo "npm run build && npm run size-check && git add dist/" > .husky/pre-commit
```
