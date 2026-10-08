# Contributing to CheeseCave Admin

Use Node.js 20.19+ and pnpm 10.18.1. Start with `pnpm install --frozen-lockfile`,
then use `pnpm dev` with a running CheeseCave backend.

Use Vue Composition API and `<script setup>`, two-space JavaScript indentation,
camelCase identifiers and PascalCase component names. Preserve responsive layouts
and light/dark themes. Format changed source with Prettier.

Run `pnpm test` and `pnpm build` before submitting a change. Add regression tests
for changed behavior; verify UI interactions in the actual page. Keep API paths,
payloads and authentication compatible with the backend, or coordinate a backend
change explicitly.

Keep commits focused and preserve unrelated edits. Use `fix:` or `feat:` commit
subjects and the pull request template. Contributions to inherited AGPL code
remain under that license; preserve original copyright notices and attribution.
See [LICENSING.md](LICENSING.md) and [LICENSE](LICENSE).

## Test and coverage scope

**What runs.** The CI workflow starts only when application code, tests or build configuration
change: `src/**` (except Markdown), `test/**`, `scripts/**`, the package and lock files, the Vite,
Vitest and UnoCSS configuration, `index.html`, `nginx.conf`, the `Dockerfile` and the workflow itself.
Documentation, images, `public/` assets and other resources do not start the test matrix.

**What coverage measures.** Coverage counts the application's runtime code under `src/`: pages,
components, stores, composables and the error model. It excludes:

- tests, scripts and tooling (`scripts/`, build helpers, deployment and CI scripts);
- generic utility modules under `src/utils/` (the coverage list omits them);
- generated declarations, documentation, images and other resources.
