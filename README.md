# CheeseCave Admin

English | [简体中文](README.zh-CN.md)

The Vue 3 administration portal for CheeseCave, with interfaces for managing users, repositories, quotas, site branding, storage, credentials, caches, dependency health and background tasks. The separate backend provides administration APIs and executes tasks.

| Repository | Responsibility |
| --- | --- |
| [cheesecave-backend](https://github.com/cheesecave/cheesecave-backend) | APIs, workers, database migrations and Compose configuration for the full deployment |
| [cheesecave-web](https://github.com/cheesecave/cheesecave-web) | Website and its container image |
| [cheesecave-admin](https://github.com/cheesecave/cheesecave-admin) | Administration portal and its container image |

## Local development

Use Node.js 20.19+ and pnpm 10.18.1. Run these commands from this repository:

```sh
corepack enable
corepack prepare pnpm@10.18.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:5174/admin/`. Start the backend separately. The Admin routing base is fixed at `/admin/`. The current Vite development configuration proxies `/admin/api`, `/api`, `/models`, `/datasets` and `/spaces` to `http://localhost:48888`. To use another backend address during development, change the proxy targets in `vite.config.js`; container runtime variables do not affect the development proxy.

Log in with the backend's configured administration token. The browser holds this token only in memory and sends it through the `X-Admin-Token` request header.

## Testing and builds

```sh
pnpm test
pnpm build
pnpm preview
```

`src/` contains pages, components and local shared helpers; `test/` contains Vitest tests. `pnpm test` also produces a coverage report, and `pnpm build` writes static assets to `dist/`. Before building, default branding assets from `images/` are copied to `public/`; historical documents retained in `docs/` may use the original project's names and paths.

Build metadata normally reads this repository's Git commit. Source archives and Docker builds can explicitly supply `VITE_GIT_COMMIT` and `VITE_GIT_DIRTY`. Inherited CI configuration was removed before the repository split; the commands above run locally.

## Containers and independent updates

Build an image from this repository. The following example uses Bash:

```sh
docker build \
  --build-arg VITE_GIT_COMMIT="$(git rev-parse HEAD)" \
  --build-arg VITE_GIT_DIRTY=false \
  -t cheesecave-admin:local .
docker run --rm --network cheesecave-net -p 8080:80 \
  -e BACKEND_UPSTREAM=http://hub-api:48888 cheesecave-admin:local
```

The image serves the administration portal at `/admin/` through nginx and listens on container port 80. The root path redirects to `/admin/`. `cheesecave-net` is the backend Compose configuration's default network; it must already exist, and the backend service must be reachable. The runtime variable `BACKEND_UPSTREAM` defaults to `http://hub-api:48888` and proxies same-origin administration APIs, public APIs and file resolve requests.

Set this variable for other networks or backend addresses. When integrating with the website, preserve `/admin/` and same-origin API routing; the administration portal's chain tester requires same-origin requests and its trace cookie.

The full deployment uses `compose.yml` in the backend repository, with no additional deployment repository needed. To update Admin, build an image with a new version tag in this repository, then set `CHEESECAVE_ADMIN_IMAGE` in the backend's `.env` to that image. Run this command from the backend repository:

```sh
docker compose up -d --no-deps hub-admin
```

This replaces only the Admin service. If you maintain your own image registry, run `docker compose pull hub-admin` first; locally built images do not need to be pulled. This repository provides build instructions and does not assume that published images are available.

## API compatibility and development history

Independent updates still require backend support for the APIs in use. The project retains `/admin/`, `/admin/api`, public API paths and the original token protocol. Coordinate backend and frontend versions when changing interfaces, and verify the affected administration operations.

The backend repository preserves the complete original Git commit history. The website and Admin start fresh Git histories, both with the first commit titled `从原仓库分叉` (forked from the original repository). See [provenance/UPSTREAM.md](provenance/UPSTREAM.md) for the source commit, split procedure and original project information.

## Attribution and licenses

CheeseCave derives from [KohakuHub by KohakuBlueLeaf](https://github.com/KohakuBlueleaf/KohakuHub) and [DeepGHS/KohakuHub](https://github.com/deepghs/KohakuHub). Original author credits, copyright notices and repository information are retained. CheeseCave is an independent derivative project.

The original [LICENSE](LICENSE) and [LICENSING.md](LICENSING.md) texts are preserved, and core code retains AGPL-3.0 terms. Refer to those files for their applicable scope. This repository does not contain the website's Dataset Viewer implementation. The original README and changelog are retained in [provenance/](provenance/).
