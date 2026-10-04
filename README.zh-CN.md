# CheeseCave Admin

[English](README.md) | 简体中文

CheeseCave 的管理门户，基于 Vue 3，提供用户、仓库、配额、站点品牌、访客首页、页脚与主题设置、存储、凭据、缓存、依赖健康状态和后台任务等管理界面。管理 API 和任务执行由独立后端提供。

| 仓库 | 职责 |
| --- | --- |
| [cheesecave-backend](https://github.com/cheesecave/cheesecave-backend) | API、worker、数据库迁移及整体部署的 Compose 配置 |
| [cheesecave-web](https://github.com/cheesecave/cheesecave-web) | 主站界面与主站容器镜像 |
| [cheesecave-admin](https://github.com/cheesecave/cheesecave-admin) | 管理界面与 Admin 容器镜像 |

## 本地开发

使用 Node.js 20.19+ 和 pnpm 10.18.1，在本仓库目录执行：

```sh
corepack enable
corepack prepare pnpm@10.18.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

默认访问 `http://localhost:5174/admin/`，后端需要单独启动。Admin 的路由基路径固定为 `/admin/`；当前 Vite 开发配置将 `/admin/api`、`/api`、`/models`、`/datasets` 和 `/spaces` 代理到 `http://localhost:48888`。开发时如需其他后端地址，修改 `vite.config.js` 中的代理目标；运行时容器变量不影响开发代理。

登录使用后端配置的管理令牌。浏览器仅在内存中持有令牌，并通过 `X-Admin-Token` 请求头发送。

Site 页面集中提供 Branding、Homepage、Footer 和 Theme 四个设置标签。访问 `/admin/site?tab=homepage` 可编辑访客欢迎文案、链接、插画、动画和仓库发现，并查看实时预览。切换标签会保留未保存的草稿；Restore Defaults 仅修改草稿，点击 Save 后才会保存。Footer 设置可编辑链接分组和可选说明，保留受保护的项目署名、版权及许可证信息；Theme 设置控制主站默认模式与配色。这些设置需要后端支持经过认证的 `GET` 和 `PUT /admin/api/site-homepage`、`/admin/api/site-appearance` 及原有品牌 API。原 `/admin/homepage` 和 `/admin/site-branding` 地址会重定向到相应的 Site 标签。

## 测试与构建

```sh
pnpm test
pnpm build
pnpm preview
```

`src/` 包含页面、组件及本地共享工具，`test/` 包含 Vitest 测试。`pnpm test` 同时生成覆盖率报告，`pnpm build` 将静态产物写入 `dist/`。构建前会将 `images/` 中的默认品牌素材复制到 `public/`；`docs/` 中保留的历史文档可能使用原项目名称与路径。

构建信息默认读取本仓库的 Git 提交；源代码压缩包或 Docker 构建可显式提供 `VITE_GIT_COMMIT` 与 `VITE_GIT_DIRTY`。继承的 CI 配置已在分仓库前移除，以上命令可直接在本地执行。

已恢复按类别选择的[手动 CI 检查](docs/development/ci.md)，供以后另行授权执行；恢复配置本身不会触发运行。

## 容器与独立更新

在本仓库构建镜像，以下示例使用 Bash：

```sh
docker build \
  --build-arg VITE_GIT_COMMIT="$(git rev-parse HEAD)" \
  --build-arg VITE_GIT_DIRTY=false \
  -t cheesecave-admin:local .
docker run --rm --network cheesecave-net -p 8080:80 \
  -e BACKEND_UPSTREAM=http://hub-api:48888 cheesecave-admin:local
```

镜像通过 nginx 在 `/admin/` 提供管理门户，容器内监听端口 80，根路径会重定向到 `/admin/`。`cheesecave-net` 是后端 Compose 的默认网络，须已存在且后端服务可达。运行时变量 `BACKEND_UPSTREAM` 默认为 `http://hub-api:48888`，负责同源管理 API、公共 API 和文件解析请求。

使用其他部署网络或后端地址时，设置对应变量。与主站集成时保留 `/admin/` 和同源 API 路由；管理门户的链路测试功能需要同源请求与追踪 Cookie。

整体部署使用后端仓库的 `compose.yml`，无需额外的部署仓库。更新 Admin 时，先在本仓库构建带新版本标签的镜像，再将后端 `.env` 中的 `CHEESECAVE_ADMIN_IMAGE` 指向该镜像。在后端仓库执行：

```sh
docker compose up -d --no-deps hub-admin
```

该命令仅替换 Admin 服务。若使用自行维护的镜像仓库，先执行 `docker compose pull hub-admin`；本地构建的镜像无需拉取。本仓库提供构建方式，不预设已有发布镜像。

## API 兼容与开发历史

独立更新仍需后端支持所使用的 API。项目保留 `/admin/`、`/admin/api`、公共 API 路径和原有令牌协议；修改接口时需协调相应后端与前端版本，并验证相关管理操作。

后端仓库保留完整原始 Git 提交历史；主站和 Admin 使用新的 Git 历史，首次提交均为「从原仓库分叉」。来源提交、拆分方式及原项目资料见 [provenance/UPSTREAM.md](provenance/UPSTREAM.md)。

## 来源与许可证

CheeseCave 源自 [KohakuBlueLeaf 的 KohakuHub](https://github.com/KohakuBlueleaf/KohakuHub) 与 [DeepGHS/KohakuHub](https://github.com/deepghs/KohakuHub)，保留原作者署名、版权及原仓库信息。CheeseCave 是独立衍生项目。

原始 [LICENSE](LICENSE) 和 [LICENSING.md](LICENSING.md) 原文保留，核心代码沿用 AGPL-3.0，具体适用范围以这些文件为准。本仓库不包含主站的 Dataset Viewer 实现。原项目 README 和变更记录保存在 [provenance/](provenance/)。
