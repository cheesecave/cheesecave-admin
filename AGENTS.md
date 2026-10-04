# CheeseCave Admin

This repository contains only the Vue Admin Portal. Backend APIs live in the
separate CheeseCave backend repository. Preserve upstream attribution and license
notices when changing inherited code.

- Use Node.js 20.19+ and pnpm 10.18.1. Install with `pnpm install --frozen-lockfile`.
- Run `pnpm test` and `pnpm build` after functional changes.
- Source is in `src/`, tests in `test/`, assets in `images/` and `public/`.
- Keep `/admin/`, `/admin/api`, and public API paths compatible with the backend.
- Admin authentication uses `X-Admin-Token`, retained only in memory.
- Keep changes local unless the user explicitly authorizes publishing.
- Preserve unrelated edits. Do not remove tests or relax assertions to hide errors.
