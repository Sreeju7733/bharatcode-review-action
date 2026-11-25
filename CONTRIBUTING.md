# Contributing to BharatCode PR Reviewer

We welcome contributions to BharatCode PR Reviewer. This guide outlines the development environment, coding standards, and verification process required for pull requests.

---

## Requirements

- **Node.js**: `20.x` or later
- **Package Manager**: `npm 10.x` or later
- **Git**

---

## Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/BharatCode-ai/bharatcode-review-action.git
   cd bharatcode-review-action
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Verify the environment**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

---

## Development Workflow

### Available Scripts

- `npm run typecheck`: Validates TypeScript types across `src/` and `tests/` without emitting code.
- `npm run lint`: Runs ESLint across all TypeScript files.
- `npm test`: Executes the test suite using Vitest.
- `npm run test:watch`: Runs tests in interactive watch mode during development.
- `npm run test:coverage`: Runs the full test suite and validates code coverage thresholds.
- `npm run build`: Bundles the action into `dist/index.js` using esbuild.
- `npm run size-check`: Asserts that `dist/index.js` does not exceed the 2.0 MB size limit.

### Test Coverage Requirements

All changes must include corresponding tests. The test suite enforces strict global coverage minimums:
- **Statements**: $\ge 85\%$
- **Branches**: $\ge 80\%$
- **Functions**: $\ge 85\%$
- **Lines**: $\ge 85\%$

Integration tests use [Mock Service Worker (MSW)](https://mswjs.io/) to mock external API responses deterministically. External network requests must not be made during test execution.

---

## Committed Bundle Policy

GitHub Actions run directly from the repository tree without installing dependencies at runtime. As a result, the compiled bundle at `dist/index.js` must be committed alongside your source code.

Before opening a pull request or pushing changes:

```bash
npm run build
npm run size-check
git add dist/
```

Continuous integration will verify that the committed `dist/index.js` is byte-identical to the build output generated from `src/`. If there is a diff, the build step will fail.

---

## Pull Request Guidelines

1. **Branch Naming**: Use descriptive prefixes such as `feat/`, `fix/`, `docs/`, or `refactor/`.
2. **Commit Messages**: Follow standard conventional commit formatting:
   - `feat: add support for custom prompt templates`
   - `fix: preserve line positions across multi-hunk diffs`
   - `docs: update input reference table`
3. **Keep Pull Requests Focused**: Submit small, reviewable changes rather than large multi-purpose patches.
