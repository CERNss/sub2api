# Fork Overlay

> 单一事实来源（single source of truth），列出本仓库 `develop` 相对上游 `main` 的所有客制化。
> 上游同步流程：拉取 `jhs-sub2api/main` → 更新本地 `main` → `develop` rebase 到新 `main`。
> rebase 之后，请按本文逐项核对，**新增文件**通常无冲突，**Upstream patches** 是真正可能丢失的部分。

---

## 目录

- [快速概览](#快速概览)
- [Active changes](#active-changes)
  - [1. add-admin-user-api-key-creation](#1-add-admin-user-api-key-creation)
  - [2. add-external-custom-menu-token-open](#2-add-external-custom-menu-token-open)
  - [3. control-oidc-local-email-verification](#3-control-oidc-local-email-verification)
  - [4. refine-pending-oauth-account-resolution](#4-refine-pending-oauth-account-resolution)
- [Archived changes](#archived-changes)
  - [5. support-mounted-frontend-client-templates](#5-support-mounted-frontend-client-templates)
- [未纳入 OpenSpec 的客制化](#未纳入-openspec-的客制化)
- [维护约定](#维护约定)

---

## 快速概览

| # | ID | 状态 | 一句话 | 新增文件 | 上游补丁文件 |
|---|----|------|-------|---------|-------------|
| 1 | `add-admin-user-api-key-creation`         | 🟢 active   | Admin 通过 Admin API Key 为指定用户创建 API key | 0 | 12 |
| 2 | `add-external-custom-menu-token-open`     | 🟢 active   | 自定义菜单支持以 `external` 方式新开页并透传 JWT | 2 | 11 |
| 3 | `control-oidc-local-email-verification`   | 🟢 active   | OIDC 专用开关跳过二次本地邮箱验证                | 0 | ~17 |
| 4 | `refine-pending-oauth-account-resolution` | 🟢 active   | OAuth 回调跳过 chooser、邮箱预填规则             | 0 | ~7 |
| 5 | `support-mounted-frontend-client-templates` | 📦 archived | 前端 `client-templates.json` 挂载渲染 Codex/OpenCode/CCS | 9 | ~6 |

**状态图例**

- 🟢 `active` — `openspec/changes/<id>/`，尚未 archive
- 📦 `archived` — `openspec/changes/archive/<id>/`，已归档但仍在 `develop` 上

---

## Active changes

### 1. `add-admin-user-api-key-creation`

- **Capability:** `admin-user-api-key-creation`
- **意图:** 让外部支付/开通系统以 Admin API Key 身份为目标用户创建 API key，而不需扮演该用户。
- **触发场景:** 支付完成后的自动开通、批量预置租户。
- **Spec 路径:** `openspec/changes/add-admin-user-api-key-creation/`

#### 新增文件
_无。本 change 全部为对上游文件的补丁。_

#### 上游补丁（rebase 后必须确认仍存在）
| 路径 | 改动要点 |
|------|---------|
| `backend/cmd/server/wire_gen.go` | wire 重新生成，注入新 handler 依赖 |
| `backend/internal/handler/admin/apikey_handler.go` | 新增 `AdminAPIKeyHandler.CreateForUser` 方法 + `AdminCreateUserAPIKeyRequest` DTO |
| `backend/internal/handler/admin/admin_basic_handlers_test.go` | 增加路由测试 |
| `backend/internal/handler/admin/admin_service_stub_test.go` | 测试 stub 接口扩展 `CreateUserAPIKey` |
| `backend/internal/server/routes/admin.go` | 注册 `POST /api/v1/admin/users/:id/api-keys`（在 `users.POST("/:id/api-keys", h.Admin.APIKey.CreateForUser)` 这一行） |
| `backend/internal/server/api_contract_test.go` | 契约测试新增条目 |
| `backend/internal/service/admin_service.go` | 新增 `adminServiceImpl.CreateUserAPIKey` 方法 + `CreateUserAPIKeyInput` / `CreateUserAPIKeyResult` 类型 |
| `backend/internal/service/admin_service_apikey_test.go` | service 层单测 |
| `backend/internal/service/api_key_service.go` | 暴露共享创建逻辑给 admin path |
| `docs/ADMIN_PAYMENT_INTEGRATION_API.md` | 文档新增端点说明 |
| `README.md` | 功能简述段落 |
| `README_CN.md` | 中文文档同步 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `README.md` → 也属于 #2
- `README_CN.md` → 也属于 #2

#### 关联 commits
- `1cdba671` feat(admin): create user api keys via admin api
- `138c4925` docs: mention admin user api key creation

---

### 2. `add-external-custom-menu-token-open`

- **Capability:** `custom-menu-external-open`
- **意图:** 自定义菜单除了原本的 iframe 模式外，新增 `external` 模式：点击后在新页打开绝对 URL，并把当前 JWT 以 `?token=` 透传给外部 sidecar 工具。
- **兼容性:** 原 iframe 菜单 + 嵌入页路由保持不变；新菜单不走 `/custom/:slug` 路由。
- **Spec 路径:** `openspec/changes/add-external-custom-menu-token-open/`

#### 新增文件
| 路径 | 用途 |
|------|------|
| `frontend/src/utils/external-menu-url.ts` | 构造带 token 的外部 URL |
| `frontend/src/utils/__tests__/external-menu-url.spec.ts` | 单测 |

#### 上游补丁
| 路径 | 改动要点 |
|------|---------|
| `backend/internal/handler/admin/setting_handler.go` | 透传新增 menu mode 字段 |
| `backend/internal/handler/dto/settings.go` | DTO 校验扩展 (`open_mode`) |
| `backend/internal/service/setting_service.go` | 持久化 + 校验 external 字段 |
| `frontend/src/components/layout/AppSidebar.vue` | 根据 mode 决定 iframe 路由还是 `window.open` |
| `frontend/src/components/layout/__tests__/AppSidebar.spec.ts` | 新行为测试 |
| `frontend/src/views/user/CustomPageView.vue` | 仍保留 iframe 模式入口的兜底处理 |
| `frontend/src/types/index.ts` | `CustomMenuItem` 类型扩展 |
| `frontend/src/views/admin/SettingsView.vue` | Admin 配置 UI 加 mode 选择 |
| `frontend/src/views/admin/__tests__/SettingsView.spec.ts` | UI 测试 |
| `README.md` | custom menu external 段落 |
| `README_CN.md` | 中文文档同步 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `backend/internal/handler/admin/setting_handler.go` → 也属于 #3
- `backend/internal/handler/dto/settings.go` → 也属于 #3
- `backend/internal/service/setting_service.go` → 也属于 #3
- `frontend/src/views/admin/SettingsView.vue` → 也属于 #3
- `frontend/src/types/index.ts` → 也属于 #5
- `README.md` → 也属于 #1
- `README_CN.md` → 也属于 #1

#### 关联 commits
- `423d1564` feat(settings): support external custom menu launch
- `53f84288` fix(frontend): open external custom menus without iframe route
- `d875d867` docs: add missing custom menu readme entry

---

### 3. `control-oidc-local-email-verification`

- **Capabilities:** `oidc-local-email-verification-policy`、`oidc-admin-verification-settings`
- **意图:** 当上游 OIDC provider 已验证邮箱时，跳过 Sub2API 端的二次本地邮箱验证；提供 admin 开关 `oidc_connect_require_local_email_verification`（默认 `true` 保守）。
- **安全约束:** 仅当 `compat_email` 来自可信源、非合成邮箱、且用户保留同一邮箱时才允许跳过。
- **Spec 路径:** `openspec/changes/control-oidc-local-email-verification/`

#### 新增文件
_无。_

#### 上游补丁
| 路径 | 改动要点 |
|------|---------|
| `backend/internal/handler/auth_oidc_oauth.go` | OIDC 回调返回 `local_email_verification_required` |
| `backend/internal/handler/auth_oidc_oauth_test.go` | 测试 |
| `backend/internal/handler/auth_oauth_pending_flow.go` | pending session 携带 verification 状态 |
| `backend/internal/handler/auth_oauth_pending_flow_test.go` | 测试 |
| `backend/internal/service/auth_oauth_email_flow.go` | `RegisterOAuthEmailAccount` 信任邮箱跳过逻辑 |
| `backend/internal/service/auth_oauth_email_flow_test.go` | 测试 |
| `backend/internal/service/settings_view.go` | 公开设置视图加入新字段 |
| `backend/internal/service/domain_constants.go` | 新增设置 key 常量 |
| `backend/internal/handler/admin/setting_handler.go` | admin setting 透传 |
| `backend/internal/handler/dto/settings.go` | DTO 字段 |
| `backend/internal/service/setting_service.go` | 持久化 |
| `frontend/src/api/admin/settings.ts` | 前端 admin API 类型 |
| `frontend/src/views/admin/SettingsView.vue` | Admin UI 增加 OIDC 开关 |
| `frontend/src/components/auth/PendingOAuthCreateAccountForm.vue` | 表单根据 flag 隐藏验证输入 |
| `frontend/src/components/auth/__tests__/PendingOAuthCreateAccountForm.spec.ts` | 测试 |
| `frontend/src/views/auth/OidcCallbackView.vue` | 消费 verification flag |
| `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` | 测试 |
| `frontend/src/api/auth.ts` | pending session typing |
| `frontend/src/i18n/locales/en.ts` | 文案 |
| `frontend/src/i18n/locales/zh.ts` | 文案 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `backend/internal/handler/admin/setting_handler.go` → 也属于 #2
- `backend/internal/handler/dto/settings.go` → 也属于 #2
- `backend/internal/service/setting_service.go` → 也属于 #2
- `frontend/src/views/admin/SettingsView.vue` → 也属于 #2
- `frontend/src/views/auth/OidcCallbackView.vue` → 也属于 #4
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` → 也属于 #4
- `frontend/src/api/auth.ts` → 也属于 #4

#### 关联 commits
- `320e10f9` fix(auth): propagate OIDC local email verification state
- `8f439bfe` feat: reapply openspec changes after develop rebase（部分内容）

---

### 4. `refine-pending-oauth-account-resolution`

- **Capabilities:** `pending-oauth-account-action-selection`、`pending-oauth-email-prefill`
- **意图:** 修正 v0.0.5 pending-auth refactor 引入的两个回归：(a) 全新 OAuth 用户被错误地丢进 chooser；(b) 创建账号表单被合成/fallback 邮箱预填。
- **Spec 路径:** `openspec/changes/refine-pending-oauth-account-resolution/`

#### 新增文件
_无。_

#### 上游补丁
| 路径 | 改动要点 |
|------|---------|
| `frontend/src/views/auth/OidcCallbackView.vue` | chooser bypass + 邮箱预填顺序 |
| `frontend/src/views/auth/LinuxDoCallbackView.vue` | 同上规则 |
| `frontend/src/views/auth/WechatCallbackView.vue` | 同上规则 |
| `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` | 回归测试 |
| `frontend/src/views/auth/__tests__/LinuxDoCallbackView.spec.ts` | 回归测试 |
| `frontend/src/views/auth/__tests__/WechatCallbackView.spec.ts` | 回归测试 |
| `frontend/src/api/auth.ts` | `PendingOAuthResponse` 字段 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `frontend/src/views/auth/OidcCallbackView.vue` → 也属于 #3
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` → 也属于 #3
- `frontend/src/api/auth.ts` → 也属于 #3

#### 关联 commits
- `8f439bfe` feat: reapply openspec changes after develop rebase（部分内容）

---

## Archived changes

> 已 archive 的 change 也仍然存在于 `develop` 上，上游 rebase 同样会冲突。在彻底进入上游之前必须照顾。

### 5. `support-mounted-frontend-client-templates`

- **Capabilities:** `frontend-client-template-loading`、`key-client-template-rendering`
- **意图:** 让前端无需后端配合就能加载 mount 在 `/client-templates.json` 的运行时模板，并据此渲染 Codex / Codex WS / OpenCode / CCS 导入。
- **Spec 路径:** `openspec/changes/archive/2026-04-28-support-mounted-frontend-client-templates/`
- **Main specs:** `openspec/specs/frontend-client-template-loading/`、`openspec/specs/key-client-template-rendering/`

#### 新增文件
| 路径 | 用途 |
|------|------|
| `frontend/public/client-templates.json` | 运行时模板默认 fallback |
| `frontend/src/utils/clientTemplates.ts` | 加载/归一化/兜底 |
| `frontend/src/utils/__tests__/clientTemplates.spec.ts` | 单测 |
| `template/README.md` | 模板使用文档 |
| `template/client-templates.json` | 模板主入口示例 |
| `template/client-templates.bundle.example.json` | 全套示例 |
| `template/client-templates.ccs-import.example.json` | CCS 导入示例 |
| `template/client-templates.codex.example.json` | Codex 示例 |
| `template/client-templates.opencode.example.json` | OpenCode 示例 |

#### 上游补丁
| 路径 | 改动要点 |
|------|---------|
| `frontend/src/components/keys/UseKeyModal.vue` | 渲染走模板优先、内置回退 |
| `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts` | 测试 |
| `frontend/src/views/user/KeysView.vue` | CCS 导入流接入模板 |
| `frontend/src/types/index.ts` | `PublicSettings` 增加模板字段 |
| `deploy/docker-compose.yml` | 注释提示挂载方式 |
| `deploy/docker-compose.local.yml` | 同上 |
| `deploy/DOCKER.md` | 文档 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `frontend/src/types/index.ts` → 也属于 #2

#### 关联 commits
- `174e6e50` fix(frontend): restore client template loading（rebase 后修复）
- `8f439bfe` feat: reapply openspec changes after develop rebase（部分内容）

---

## 未纳入 OpenSpec 的客制化

以下属于基础设施/构建/CI 层面的 fork，本身不适合走 OpenSpec change（无可验证的功能行为），但**同样会在 rebase 中丢失**。建议在 [维护约定](#维护约定) 里用其它机制守护（如 PR 标签、目录隔离）。

| 区域 | 路径示例 | 性质 |
|------|---------|------|
| Release 流水线 | `.github/workflows/release.yml`、`.goreleaser.yaml`、`.goreleaser.simple.yaml` | 补丁 + 新增 |
| Docker 打包 | `Dockerfile`、`Dockerfile.goreleaser` | 补丁/新增 |
| Action 镜像化 | `.github/action-mirrors/**`、`tools/sync-action-mirrors.sh`、`tools/install-goreleaser.sh`、`tools/run-goreleaser-release.sh` | 几乎全新增 |
| 默认运行参数 | `deploy/docker-compose*.yml`（与 #5 部分重叠） | 补丁 |
| 文档分支 | `DEV_GUIDE.md`；`README*.md` 中**非 OpenSpec 功能段落**（如部署/构建说明） | 补丁 |
| CLA / License | `CLA.md` | 新增 |

> 这一块文件数量大但大多是 `.github/action-mirrors/` 等"新增目录"，rebase 几乎不会冲突；真正需要看的是 `.goreleaser*.yaml`、`Dockerfile*`、`deploy/docker-compose*.yml` 三处的小补丁。

---

## 维护约定

### 新增一条 change 时
1. 在 `openspec/changes/<id>/proposal.md` 的 `## Impact` 节里清晰列出触碰的文件路径。
2. 实现完成后，**在本文 active 节追加一个条目**，区分「新增文件」与「上游补丁」。
3. 表头里更新「快速概览」一行。

### archive 一条 change 时
1. 把对应条目从 `Active changes` 移到 `Archived changes`，状态改 📦。
2. 不要删除 — archive 后该 change 仍存在于 `develop`，rebase 还要照顾。

### 上游同步流程
1. **rebase 前**：跑 `git diff main..develop --name-only > /tmp/fork-files.before`
2. rebase 完成后：跑同样命令到 `.after`，diff 两个文件，看消失了哪些。
3. 对照本文每个 change 的「上游补丁」表，逐一确认仍在。
4. 缺失的逐个手工恢复（参考 spec / tasks / design.md）。

### 共享文件
当一个文件被多个 change 触碰时，rebase 冲突解决要**把所有 change 的修改都加回来**。
- 每条 change 的「⚠ 跨 change 共享文件」小节列出了这种文件，并用 `→ 也属于 #N` 给出对面 change 编号。
- 在 FORK.md 里全文搜索某个文件路径，可以反向查到所有相关 change（同一文件会在每个相关 change 下重复出现）。

### 后续工具计划（见 [Step 3/4 of fork-overlay plan]）
- `tools/fork-snapshot.sh`：rebase 前对每个 change 生成 `change/patch.diff`
- `tools/fork-verify.sh`：rebase 后 `git apply --check` 验证每个 patch 仍可干净应用
