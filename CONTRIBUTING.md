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
