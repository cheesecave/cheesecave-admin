# CheeseCave Admin: agent guide

This repository contains only the CheeseCave Admin Portal, a Vue single-page application built with
Vite. Backend APIs live in the separate CheeseCave backend repository. This is a fork of KohakuHub;
keep the attribution in `NOTICE.md`, `LICENSE`, `LICENSING.md` and `provenance/` intact when editing
inherited code.

## Maintenance discipline

- **Branches and pull requests.** Do not commit to `main`. Work on a feature branch, open a
  pull request, and wait for its checks. Do not merge, deploy or publish without explicit
  authorization from the maintainer.
- **Commits.** Write English subjects in the imperative mood (`fix: ...`, `ci: ...`). Stage only
  the files you intend to change. Before committing, check `git status` for `node_modules/`,
  `dist/`, `coverage/`, `.env*` files and bytecode or editor leftovers.
- **Secrets.** Never commit tokens or keys, and never print their values in logs or transcripts.
  The admin token is entered by the operator and kept only in memory.
- **Tests first.** For behaviour changes, write the failing test first, then the code. Cover the
  changed runtime lines. Do not delete, skip or weaken assertions to make a run pass.
- **Test scope.** The CI workflow runs only when application code, tests, scripts, dependency or
  build configuration changes. Documentation, `public/` and `images/` must not start the full run.
  Coverage measures the admin application code under `src/` and excludes tests, `scripts/`
  tooling, generated declarations and resources. See
  [CONTRIBUTING.md](CONTRIBUTING.md#test-and-coverage-scope).
- **Compatibility.** Keep `/admin/` and `/admin/api` and the public API paths compatible with the
  backend. Do not change `X-Admin-Token` semantics. User-visible product text is CheeseCave;
  KohakuHub appears only as attribution.
- **Documentation.** Keep English as the source of repository documents. Where a Chinese
  companion exists (`*.zh-CN.md`), update both in the same change.

## Layout

- `src/pages/`: admin routes (`credentials`, `fallback-sources`, `health`, `login`, `tasks`, and others).
- `src/components/`: shared admin components, including the `tasks/` and `storage/` panels.
- `src/stores/`: admin state. `src/utils/api.js` is the single API client, and `src/utils/`
  holds helpers that the application imports.
- `test/`: Vitest suites. `scripts/` and `nginx.conf` build and serve the production image.

## Commands

Use Node.js 20.19 or newer and pnpm 10.18.1.

```sh
pnpm install --frozen-lockfile
pnpm dev        # Vite dev server
pnpm test       # Vitest with coverage
pnpm build      # production build
```

## Code conventions

- Call the backend only through `src/utils/api.js`. Add a method there rather than calling `fetch`
  from a component.
- Keep admin requests authenticated with `X-Admin-Token`, held in memory only. Never write the token
  to storage, logs or URLs.
- Keep production URLs under `/admin/`; the admin image is served by `nginx.conf` at that prefix.
- Prefer existing components and tokens over new one-off styles.
