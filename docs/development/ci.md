# Manual Admin CI

The workflow in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
only accepts `workflow_dispatch`. Pushing commits, opening pull requests and
changing repository visibility do not trigger it. Repository Actions remain
disabled until the owner separately authorizes enabling and running them.

| Category | Checks |
| --- | --- |
| `all` | Complete Vitest suite with coverage and a separate production-build job |
| `regression` | Complete Vitest suite with coverage, without the production-build job |
| `build` | Frozen dependency install, production build and static entry-point/bundle checks |
| `docker` | Local Docker image build, nginx syntax, packaged application and license-file checks |

Both test categories run `pnpm test` with the existing Vitest coverage
configuration. This includes Site settings, homepage previews, navigation,
branded login, user pagination/deletion, database notices, fallback-source
shared-state cleanup and the remaining regression tests. Newly added test files
are automatically included through the repository's existing Vitest patterns.
These tests do not need a running backend, database or production credentials.
The Docker smoke check does not test live API integration.

## Local equivalents

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The `regression` category uses the same complete `pnpm test` command as `all`.
Docker checks use the repository Dockerfile and a temporary local image; they do not upload an
image or deploy a service. Application build metadata uses the selected Git
commit and an explicit clean-tree flag.

## Execution policy and dependencies

No workflow has been dispatched as part of restoring this configuration.
To run it later, the owner must first authorize enabling repository Actions.
GitHub requires this dispatch workflow to exist on the default branch before
it can be run manually. After that, choose **Admin checks (manual)** in Actions,
select the branch and choose a category. Adding the configuration to the default
branch does not itself run it.

Jobs use GitHub-hosted Ubuntu, Node.js 20 (20.19+), pnpm 10.18.1 and the frozen
`pnpm-lock.yaml`. There are no deployment secrets, publishing permissions,
coverage-upload services, schedules or automatic event triggers. The token has
only `contents: read`, and checkout does not persist credentials. Dependency
caching is limited to the pnpm store.

Action revisions are pinned to commit SHAs verified against the official Git
repositories on 2026-10-04: `actions/checkout` v6, `actions/setup-node` v6 and
`pnpm/action-setup` v4. Reverify their inputs and runner compatibility when
updating pins. See the official [checkout documentation](https://github.com/actions/checkout),
[Node setup documentation](https://github.com/actions/setup-node),
[pnpm v4 action documentation](https://github.com/pnpm/action-setup/tree/v4)
and [manual workflow documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).
