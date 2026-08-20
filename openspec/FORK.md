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
  - [5. user-token-api-key-automation](#5-user-token-api-key-automation)
  - [8. preserve-grok-xhigh-reasoning-effort](#8-preserve-grok-xhigh-reasoning-effort)
  - [9. add-grok-codex-client-template](#9-add-grok-codex-client-template)
  - [10. keepalive-raw-chat-completions-stream](#10-keepalive-raw-chat-completions-stream)
  - [11. add-platform-opencode-templates](#11-add-platform-opencode-templates)
- [Archived changes](#archived-changes)
  - [6. support-mounted-frontend-client-templates](#6-support-mounted-frontend-client-templates)
- [未纳入 OpenSpec 的客制化](#未纳入-openspec-的客制化)
- [维护约定](#维护约定)

---

## 快速概览

| # | ID | 状态 | 一句话 | 新增文件 | 上游补丁文件 |
|---|----|------|-------|---------|-------------|
| 1 | `add-admin-user-api-key-creation`         | 🟢 active   | Admin 通过 Admin API Key 为指定用户创建/转移 API key | 0 | 20 |
| 2 | `add-external-custom-menu-token-open`     | 🟢 active   | 自定义菜单支持以 `external` 方式新开页并透传 JWT | 2 | 11 |
| 3 | `control-oidc-local-email-verification`   | 🟢 active   | OIDC 专用开关跳过二次本地邮箱验证                | 1 | 23 |
| 4 | `refine-pending-oauth-account-resolution` | 🟢 active   | OAuth 回调跳过 chooser、邮箱预填规则             | 0 | 6 |
| 5 | `user-token-api-key-automation`           | 🟢 active   | 用户登录换 JWT 后创建 API key 并安全轮换 key 分组 | 2 | 8 |
| 6 | `support-mounted-frontend-client-templates` | 📦 archived | 前端 `client-templates.json` 挂载渲染 Codex/OpenCode/CCS | 9 | 7 |
| 7 | `add-openai-compatible-prompt-audit`      | ⬆️ upstreamed | 提示词输入审计（Qwen3Guard 三态门禁 + 审计台） | 0 | 0 |
| 8 | `preserve-grok-xhigh-reasoning-effort`    | 🟢 active（主体已收编） | grok-4.6 保留 xhigh 推理档；`xhigh`/`extrahigh` 上游 v0.1.179 已收编，fork 仅剩 `max`/`ultra` 同档放行 | 0 | 2 |
| 9 | `add-grok-codex-client-template`          | 🟢 active   | Grok 组 Codex tab 支持 grok_codex 模板；CCS 默认 grok-4.6 | 0 | 5 |
| 10 | `keepalive-raw-chat-completions-stream`  | 🟢 active   | CC 直转流补下游保活 + 上游空闲上限，长思考不再被前置代理判 504 | 0 | 4 |
| 11 | `add-platform-opencode-templates`        | 🟢 active   | OpenCode tab 支持 openai/grok/zhipu 每平台模版段；内置生成器补 GLM 分支与每平台 model pin；CCS 补 zhipu | 0 | 3 |

**状态图例**

- 🟢 `active` — `openspec/changes/<id>/`，尚未 archive
- 📦 `archived` — `openspec/changes/archive/<id>/`，已归档但仍在 `develop` 上
- ⬆️ `upstreamed` — 代码已被上游整体收编，`develop` 相对上游零差异，仅剩 openspec 文档目录；rebase 无需守护（详见[未纳入 OpenSpec 的客制化](#未纳入-openspec-的客制化)末尾的收编清单）

---

## Active changes

### 1. `add-admin-user-api-key-creation`

- **Capabilities:** `admin-user-api-key-creation`、`admin-user-api-key-transfer`
- **意图:** 让外部支付/开通系统以 Admin API Key 身份为目标用户创建 API key，或把误归属的现有 API key 转移到正确用户，而不需扮演该用户。
- **触发场景:** 支付完成后的自动开通、批量预置租户、sidecar 修复 key owner/清理 quota。
- **Spec 路径:** `openspec/changes/add-admin-user-api-key-creation/`

#### 新增文件
_无。本 change 全部为对上游文件的补丁。_

#### 上游补丁（rebase 后必须确认仍存在）
| 路径 | 改动要点 |
|------|---------|
| `backend/cmd/server/wire_gen.go` | wire 重新生成，注入新 handler 依赖 |
| `backend/internal/handler/admin/apikey_handler.go` | 新增 `AdminAPIKeyHandler.CreateForUser` / `Transfer` 方法 + 创建/转移 DTO |
| `backend/internal/handler/admin/admin_basic_handlers_test.go` | 增加创建与转移路由测试 |
| `backend/internal/handler/admin/admin_service_stub_test.go` | 测试 stub 接口扩展 `CreateUserAPIKey` / `TransferAPIKey` |
| `backend/internal/repository/api_key_repo.go` | 新增显式 transfer 更新路径，可原子写 owner/group/quota/quota_used/status；`Create` 改用 `clientFromContext`，使独占组自动授权与 key 写入同事务提交/回滚 |
| `backend/internal/repository/api_key_repo_integration_test.go` | 验证普通 `Update` 仍不改 owner，transfer 路径能改 owner/quota |
| `backend/internal/server/routes/admin.go` | 注册 `POST /api/v1/admin/users/:id/api-keys` 与 `POST /api/v1/admin/api-keys/:id/transfer` |
| `backend/internal/server/api_contract_test.go` | 契约测试新增创建/转移条目 |
| `backend/internal/service/admin_service.go` | 接口声明 `CreateUserAPIKey` / `TransferAPIKey` + 输入/结果类型 + `apiKeyService` 依赖注入 |
| `backend/internal/service/admin_user.go` | 方法实现（上游把 adminServiceImpl 用户相关实现拆到此文件）；创建与转移均拒绝负数 quota（否则会被静默当作无限额）|
| `backend/internal/service/admin_service_apikey_test.go` | service 层单测覆盖创建、分组更新、转移、quota reset、缓存失效 |
| `backend/internal/service/api_key_service.go` | 暴露共享创建逻辑给 admin path，并扩展 API key repo contract |
| `backend/internal/server/middleware/api_key_auth_test.go` | repo stub 补 `TransferUpdate`（接口扩展的连带）|
| `backend/internal/server/middleware/api_key_auth_google_test.go` | 同上 |
| `backend/internal/service/api_key_service_cache_test.go` | 同上 |
| `backend/internal/service/api_key_service_delete_test.go` | 同上 |
| `backend/internal/service/api_key_service_quota_test.go` | 同上 |
| `docs/ADMIN_PAYMENT_INTEGRATION_API.md` | 文档新增创建与转移端点说明 |
| `README.md` | 功能简述段落 |
| `README_CN.md` | 中文文档同步 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `backend/internal/server/api_contract_test.go` → 也属于 #5
- `backend/internal/service/api_key_service.go` → 也属于 #5
- `README.md` → 也属于 #2、#5
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
| `backend/internal/handler/admin/setting_handler_update.go` | 校验 `open_mode`（iframe/external）、external 拒绝 `md:` slug（上游自 `setting_handler.go` 拆出）|
| `backend/internal/handler/dto/settings.go` | DTO 校验扩展 (`open_mode`) |
| `backend/internal/service/setting_public.go` | `parseCustomMenuItemURLs` 仅向 CSP frame-src 暴露 iframe 模式 URL（上游自 `setting_service.go` 拆出）|
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
- `backend/internal/handler/admin/setting_handler_update.go` → 也属于 #3
- `backend/internal/handler/dto/settings.go` → 也属于 #3
- `frontend/src/views/admin/SettingsView.vue` → 也属于 #3
- `frontend/src/types/index.ts` → 也属于 #6
- `README.md` → 也属于 #1、#5
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
| 路径 | 用途 |
|------|------|
| `backend/internal/handler/auth_oauth_pending_email_verify_consistency_test.go` | 锁定 pending OAuth 各阶段（create/send-code/bind）共用同一本地邮箱验证门控（含全局 `email_verify_enabled` 关闭时跳过）|

#### 上游补丁
| 路径 | 改动要点 |
|------|---------|
| `backend/internal/handler/auth_oidc_oauth.go` | OIDC 回调返回 `local_email_verification_required`；`email_verified` 经 `oidcVerifiedFlagForEmail` 绑定到实际采用的 `compat_email` 来源，杜绝跨邮箱误判已验证 |
| `backend/internal/handler/auth_oidc_oauth_test.go` | 测试（含 `oidcVerifiedFlagForEmail` 跨源绑定）|
| `backend/internal/handler/auth_oauth_pending_flow.go` | pending session 携带 verification 状态；`pendingOAuthLocalEmailVerificationRequired` 在全局 `email_verify_enabled` 关闭时也跳过本地验证，与前端隐藏验证码控件一致（修复 rebase 易碎的死路：前端隐藏、后端仍强制要码）|
| `backend/internal/handler/auth_oauth_pending_flow_test.go` | 测试 |
| `backend/internal/service/auth_oauth_email_flow.go` | `RegisterOAuthEmailAccount` 信任邮箱跳过逻辑 |
| `backend/internal/service/auth_oauth_email_flow_test.go` | 测试 |
| `backend/internal/service/settings_view.go` | 公开设置视图加入新字段 |
| `backend/internal/service/domain_constants.go` | 新增设置 key 常量 |
| `backend/internal/handler/admin/setting_handler.go` | GET settings payload 透传新字段 |
| `backend/internal/handler/admin/setting_handler_update.go` | update 请求 DTO 字段 + service 输入 + 响应 payload 透传（上游拆出）|
| `backend/internal/handler/admin/setting_handler_audit.go` | 设置变更审计追踪新 key（上游拆出）|
| `backend/internal/handler/dto/settings.go` | DTO 字段 |
| `backend/internal/service/setting_features.go` | `GetOIDCConnectRequireLocalEmailVerification` / `IsOIDCConnectLocalEmailVerificationRequired` getter（上游拆 `setting_service.go`）|
| `backend/internal/service/setting_parse.go` | 默认值 `true` + settings-view 解析（上游拆 `setting_service.go`）|
| `backend/internal/service/setting_update.go` | updates map 持久化（上游拆 `setting_service.go`）|
| `frontend/src/api/admin/settings.ts` | 前端 admin API 类型 |
| `frontend/src/views/admin/SettingsView.vue` | Admin UI 增加 OIDC 开关 |
| `frontend/src/components/auth/PendingOAuthCreateAccountForm.vue` | 表单根据 flag 隐藏验证输入；send-code 返回 `auth_result: pending_session`（邮箱已存在）时转入绑定流程，不再谎报"已发送" |
| `frontend/src/components/auth/__tests__/PendingOAuthCreateAccountForm.spec.ts` | 测试 |
| `frontend/src/views/auth/OidcCallbackView.vue` | 消费 verification flag |
| `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` | 测试 |
| `frontend/src/i18n/locales/en/admin/settings.ts` | 文案（上游把单体 `en.ts` 按域拆分）|
| `frontend/src/i18n/locales/zh/admin/settings.ts` | 文案（上游把单体 `zh.ts` 按域拆分）|

> ℹ️ `PendingOAuthResponse` 字段（包含 `local_email_verification_required` 等）以 inline `interface` 形式声明在各 `*CallbackView.vue` 内部，而**不在** `frontend/src/api/auth.ts`。rebase 复原时保持就地声明的形态。

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `backend/internal/handler/admin/setting_handler_update.go` → 也属于 #2
- `backend/internal/handler/dto/settings.go` → 也属于 #2
- `frontend/src/views/admin/SettingsView.vue` → 也属于 #2
- `frontend/src/views/auth/OidcCallbackView.vue` → 也属于 #4
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` → 也属于 #4

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

> ℹ️ `PendingOAuthResponse` 形状（`existing_account_bindable` / `create_account_allowed` / `compat_email`）以 inline `interface` 形式声明在各 `*CallbackView.vue` 内部，**不集中放在** `frontend/src/api/auth.ts`。

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `frontend/src/views/auth/OidcCallbackView.vue` → 也属于 #3
- `frontend/src/views/auth/__tests__/OidcCallbackView.spec.ts` → 也属于 #3

#### 关联 commits
- `8f439bfe` feat: reapply openspec changes after develop rebase（部分内容）

---

### 5. `user-token-api-key-automation`

- **Capabilities:** `user-token-api-key-automation`、`user-api-key-group-rotation`
- **意图:** 让外部用户侧 sidecar / 自助开通系统以普通用户身份登录换取 JWT，并在该用户现有权限范围内创建 API key、查询可用分组、仅轮换 key 的绑定分组。
- **触发场景:** 用户自助授权外部工具、非 admin 的自动化开通、需要拿用户 token 调用 REST API 但最终仍生成普通模型网关 API key 的集成。
- **权限边界:** 能力范围与当前登录用户一致；保留 Turnstile、TOTP 2FA、backend-mode、用户状态校验、用户可用分组校验。`PUT /api/v1/keys/:id/group` 只改 `group_id`，不改 key 值、quota、expiration、IP ACL、status、rate limit。
- **Spec 路径:** `openspec/changes/user-token-api-key-automation/`（2026-08-13 补建；此前仅有本条 FORK.md 记录，`fork_overlay.py` 快照/校验完全覆盖不到）

#### 新增文件
| 路径 | 用途 |
|------|------|
| `backend/internal/service/api_key_service_group_test.go` | 用户 key 分组轮换 service 单测 |
| `backend/internal/server/routes/auth_token_alias_routes_test.go` | 锁定三条 token 登录别名的注册，并断言其复用规范端点的 handler |

#### 上游补丁
| 路径 | 改动要点 |
|------|---------|
| `backend/internal/server/routes/auth.go` | 注册 `POST /api/v1/auth/token`、`POST /api/v1/auth/token/2fa`、`POST /api/v1/auth/token/refresh` 作为自动化友好的登录/token alias |
| `backend/internal/server/routes/user.go` | 注册 `PUT /api/v1/keys/:id/group`，用于用户侧 key 分组轮换 |
| `backend/internal/handler/api_key_handler.go` | 新增 `UpdateGroup` handler 与 `group_id` 请求 DTO |
| `backend/internal/service/api_key_service.go` | 新增 `UpdateGroup`，校验 key owner、非负 group_id、用户可用分组，并保持其它 key 字段不变 |
| `backend/internal/server/api_contract_test.go` | API 契约测试覆盖 key group rotation（`PUT /keys/:id/group`）与 `GET /groups/available`。⚠ token alias **不在**契约测试内：该 harness 的 `authService` 为 nil，跑不了 `Login` 路径；别名改由 `routes/auth_token_alias_routes_test.go` 在路由注册层锁定 |
| `frontend/src/api/auth.ts` | 新增 `exchangeToken`、`exchangeToken2FA`、`refreshTokenViaTokenEndpoint` helper |
| `frontend/src/api/keys.ts` | 新增 `updateGroup` helper |
| `README.md` | 新增用户 token 自动化流程、可用接口、创建 key 与分组轮换说明 |

#### ⚠ 跨 change 共享文件
> 以下文件本 change 修改，**同时也被其他 change 修改**。rebase 解决冲突时，必须同时核对本 change 与对方 change 的修改是否都已包含。
- `backend/internal/service/api_key_service.go` → 也属于 #1
- `backend/internal/server/api_contract_test.go` → 也属于 #1
- `README.md` → 也属于 #1、#2

#### 关联 commits
- `233474014` feat(auth): add user token api key automation
- `427fa09c4` test(routes),docs(fork): lock token login aliases and correct coverage claim

---

### 8. `preserve-grok-xhigh-reasoning-effort`

- **Capability:** `grok-xhigh-reasoning-effort-passthrough`
- **意图:** grok-4.6 起 xAI 提供 `xhigh` 推理档；上游网关仍把 `xhigh`/`extrahigh`/`max`/`ultra` 一律拍平成 `high`（写于 4.6 发布前），导致 xhigh 请求被静默降级。本补丁按模型放行：4.6 家族透传 `xhigh`，旧模型维持拍平。
- **⚠️ 2026-08-20 v0.1.179：主体已被上游收编（部分）。** 上游 `892787723 fix(grok): preserve xhigh effort for grok-4.6` 落地了与本 change 同构的实现（`normalizeGrokReasoningEffortValue` 加模型参数、`grokSupportsXHighReasoningEffort` 白名单 `grok-4.6`/`grok-4.6-latest`），rebase 到 `75f88be5f` 时按「谁覆盖面广用谁」取上游形态。**fork 仅剩一处语义差**：上游把 `max`/`ultra` 单独分支恒拍平成 `high`，只放行 `xhigh`/`extrahigh`；fork 保留原口径——`max`/`ultra` 与 `xhigh`/`extrahigh` 同属"顶档别名"，在 4.6 上一并透传 `xhigh`（上游自身在 `gateway_request.go` 的 GLM 归一里也把 `max`/`ultracode` 当顶档处理，且上游删掉了原 `max camel` 用例、没有任何测试锁定 4.6 上 `max`→`high`）。
- **退场条件:** 上游把 `max`/`ultra` 也并入顶档放行后，本 change 转 ⬆️ upstreamed。
- **Spec 路径:** `openspec/changes/preserve-grok-xhigh-reasoning-effort/`

#### 新增文件
_无。本 change 全部为对上游文件的补丁。_

#### 上游补丁（rebase 后必须确认仍存在）
| 路径 | 改动要点 |
|------|---------|
| `backend/internal/service/openai_gateway_grok.go` | 【上游已收编】`normalizeGrokReasoningEffortValue` 的模型参数（3 个调用点）与 `grokSupportsXHighReasoningEffort` 白名单。【fork 剩余】alias switch 的 `case "xhigh", "extrahigh", "max", "ultra":` 合并写法——上游拆成两支、把 `max`/`ultra` 恒拍平成 `high`，fork 保持四个别名共用白名单判定 |
| `backend/internal/service/openai_gateway_grok_test.go` | fork 自有测试 `TestPatchGrokResponsesBodyKeepsXHighForGrok46`（含 `max camel` → `xhigh`，即上面那处语义差的锁）、`TestNormalizeGrokChatReasoningEffortKeepsXHighForGrok46`；上游表驱动用例（4.5 拍平、4.6 放行）不动 |

#### ⚠ 跨 change 共享文件
_无 OpenSpec change 共享。_ 但 `openai_gateway_grok.go` 另叠加「[未纳入 OpenSpec](#未纳入-openspec-的客制化)」的 OpenAI ops 观测补丁（transport-error 调用点的 `safeUpstreamURL` 参数），rebase 时两个补丁都要保留。

#### 关联 commits
- `907eb862c` fix(grok): pass xhigh reasoning effort through for grok-4.6

---

### 9. `add-grok-codex-client-template`

- **Capability:** `grok-codex-client-template`
- **意图:** Grok 组的 Codex tab 此前无条件走内置 grok-4.5 硬编码配置，挂载的 `client-templates.json` 影响不到它。新增 `client_templates.grok_codex` 段：有模板则渲染模板（与 OpenAI 的 `codex` 段同一渲染管线和占位符），无模板回退内置；CCS deeplink 导入的 Grok 默认 model 升到 grok-4.6。2026-08-16 评审 #6 补充：渲染管线新增 shell 感知占位符 `${shellLabel}` / `${envSetPrefix}` / `${envQuote}` / `${pathSep}`（按当前 shell tab 解析），修复模板在 Windows/PowerShell/CMD tab 一律输出 POSIX `export` 与 `/` 路径的问题。注意：**旧前端 + 新模板文件**会把这些占位符渲染成字面量，模板与前端需同批升级（新前端 + 旧模板无损）。
- **依赖:** 归档 #6（模板加载与渲染管线全部来自它）；部署侧模板文件可提前加 `grok_codex` 段，旧前端忽略未知段无副作用。
- **Spec 路径:** `openspec/changes/add-grok-codex-client-template/`

#### 新增文件
_无。本 change 全部为对上游/既有 fork 文件的补丁。_

#### 上游补丁（rebase 后必须确认仍存在）
| 路径 | 改动要点 |
|------|---------|
| `frontend/src/components/keys/UseKeyModal.vue` | grok 平台 codex tab 先渲染 `clientTemplates.grok_codex.files`（shell 感知 configDir），无模板回退 `generateGrokCodexFiles`；`renderConfiguredFiles` 在占位符替换处传入 `shell: activeTab.value`（shell 感知占位符的唯一接线点，覆盖 codex/grok_codex/opencode 全部模板段） |
| `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts` | 模板优先于内置的回归测试 |
| `frontend/src/types/index.ts` | `ClientTemplatesConfig` 增加 `grok_codex` 字段 |
| `frontend/src/utils/ccswitchImport.ts` | `GROK_CC_SWITCH_MODEL` grok-4.5 → grok-4.6 |
| `frontend/src/utils/__tests__/ccswitchImport.spec.ts` | 断言同步 |

#### ⚠ 跨 change 共享文件
> 以下文件与归档 #6（`2026-04-28-support-mounted-frontend-client-templates`）共享；`types/index.ts` 同时属于 #2。rebase 时须同时保留各方的修改。
- `frontend/src/components/keys/UseKeyModal.vue` → 也属于 #6
- `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts` → 也属于 #6
- `frontend/src/types/index.ts` → 也属于 #2、#6
- `frontend/src/utils/clientTemplates.ts` → #6 的新增文件，本 change 给 normalize 白名单加 `grok_codex`，并新增 `buildShellTemplateContext(shell)`（`BuildTemplateContextOptions` 多可选 `shell` 参数、结果 spread 进上下文——上游若改该函数签名需保留这两处）
- `frontend/src/utils/__tests__/clientTemplates.spec.ts` → #6 的新增文件，本 change 加 grok_codex-only 用例与四种 shell 的占位符解析用例（含 UI 暂不可达的 cmd 分支）
- `template/client-templates.json` → #6 的新增文件，本 change 加 `grok_codex` 段并移除 `ccs_import` 写死的 model；env 文件改用 `${envSetPrefix}`/`${envQuote}`/`${shellLabel}` 组合、路径改用 `${pathSep}`
- `template/README.md` → #6 的新增文件，本 change 补 grok_codex 与 ccs_import model 说明、shell-aware placeholders 一节
- `template/client-templates.bundle.example.json` → #6 的新增文件，本 change 仅同步 `${pathSep}` 写法
- `template/client-templates.codex.example.json` → #6 的新增文件，本 change 仅同步 `${pathSep}` 写法

#### 关联 commits
- `1a41cad26` feat(frontend): template-driven grok codex tab and grok-4.6 ccs import

---

### 10. `keepalive-raw-chat-completions-stream`

- **Capability:** `raw-chat-completions-stream-keepalive`
- **意图:** CC 直转 `streamRawChatCompletions` 是纯逐行透传，上游长思考期间一个字节都不写下游，网关前的反向代理（nginx `proxy_read_timeout` 默认 60s）判空闲掐断，客户端看到 **504**（sub2api 自身从不产生 504）。带 `reasoning_effort` 的 Grok 请求**必定**落这条路径——`grokChatResponsesBridgeEligibility` 对非 null 的 `reasoning_effort` 判 `unsupported_reasoning_effort` 后回落 raw；effort 越高静默越久。`/v1/responses` 主路径与 Grok OAuth bridge 早已有保活，raw 是本故障链上的缺口；同类缺口在 Responses→CC / Messages→CC 两条回退路径仍存在（不在本 change 范围，见 design.md 遗留项）。
- **退场条件:** 上游自行给 `streamRawChatCompletions` 补上 keepalive 后，本 change 转 ⬆️ upstreamed。
- **Spec 路径:** `openspec/changes/keepalive-raw-chat-completions-stream/`

#### 新增文件
_无。本 change 全部为对上游文件的补丁。_

#### 上游补丁（rebase 后必须确认仍存在）
| 路径 | 改动要点 |
|------|---------|
| `backend/internal/service/openai_gateway_chat_completions_raw.go` | 逐行同步循环重构为「读协程 + `select`」（与姊妹函数 `handleChatStreamingResponse` 同构）；新增 `keepaliveInterval`（`gateway.stream_keepalive_interval`，空闲写 `:\n\n`）与 `streamInterval`（Grok 走 `resolveGrokStreamIdleTimeout`，其余走 `gateway.stream_data_interval_timeout`）；`keepaliveWritten` 驱动静默拒答 failover 的 `SafeToFailoverAfterWrite`；`midFrame` 让保活只发生在 SSE 帧边界；`newStreamHeaderWriter` 的用法换成本地两段式提交（`commitStableSSEHeaders` 只提交稳定 SSE 头，`writeStreamHeaders` 才透传上游响应头）；两个定时器都关闭时保留原同步快路径 |
| `backend/internal/service/openai_gateway_chat_completions_raw_test.go` | fork 自有测试 `TestForwardAsRawChatCompletions_KeepaliveKeepsSilentThinkingStreamAlive`、`..._SilentRefusalAfterKeepaliveStaysFailoverable`、`..._StreamIdleTimeoutKeepsPartialUsage`、`..._KeepaliveCommitsOnlyStableSSEHeaders`、`..._KeepaliveDoesNotSplitInProgressFrame` 与 `grokRawChatCompletionsTestAccount` 辅助函数；上游既有用例零修改（其上游体是 `strings.Reader`，一次性返回，仍走同步快路径） |
| `backend/internal/handler/openai_chat_completions.go` | `ChatCompletions` 的 failover 闸门由 `c.Writer.Size() != writerSizeBeforeForward` 改为同包既有的 `openAIForwardMayFailover(...)`（保活写出的非语义字节不再闸死换号），放行后按 Responses 侧先例补 `SafeToFailoverAfterWrite && c.Writer.Written()` → `streamStarted = true`。～2026-08-18 v0.1.178 rebase：计费闭包半边已被上游收编（`submitChatUsage`，#5148 对齐，错误分支无条件落账、闭包内 nil 守卫，覆盖面比 fork 原「非零 token 才落账」更广，按约定改用上游实现）；fork 对本文件的剩余差异只剩上述闸门与 `streamStarted` 两处 |
| `backend/internal/handler/openai_gateway_first_output_timeout_test.go` | fork 自有测试 `TestOpenAIChatCompletionsFailoverGateUsesSharedWriteGuard`（源码级契约，锁定闸门口径不回退到按字节数判定） |

#### ⚠ 跨 change 共享文件
_无。_ 这四个文件在本 change 之前与上游 `main` 零差异，也不叠加任何未纳入 OpenSpec 的补丁。

#### 关联 commits
- `d46ffcce1` fix(gateway): keep raw chat completions streams alive during long thinking

---

### 11. `add-platform-opencode-templates`

- **Capability:** `platform-opencode-client-templates`
- **意图:** OpenCode tab 原本只有一个共享 `client_templates.opencode` 段，运营方一旦在其中钉 model，就会泄漏到所有平台的 tab（Grok 组的 `opencode.json` 广播 OpenAI 模型，反之亦然）。新增 `openai_opencode` / `grok_opencode` / `zhipu_opencode` 三个每平台段，查找顺序：平台段 → 共享 `opencode` 段 → 内置生成器。同时补齐 Zhipu 的两处空白：内置生成器此前无 GLM 分支（GLM 组落到通用 OpenAI 兼容形态、广播它根本路由不了的 OpenAI 目录），CCS deeplink 导入也没有 zhipu 分支。
- **⚠ 关键不变量（回归易碎点）:** **只有 openai / grok / zhipu 三个平台查平台段**；其余平台（gemini/anthropic/antigravity/kimi/deepseek/composite…）必须直接读共享 `opencode` 段。`case 'openai'` 与 `default:` 一旦合并（WIP 阶段真的发生过），kimi/deepseek/composite 就会被喂上 `openai_opencode` 段并被内置回退钉上 `openai/gpt-5.5` —— 模型串台。同理，内置回退里复用 OpenAI 兼容形态的 `default:` 分支必须传 `pinDefaultModel: false`。由 `UseKeyModal.spec.ts` 的「keeps platforms without a dedicated section off the openai_opencode section and model pin」用例钉死。
- **依赖:** 归档 #6（模版加载与渲染管线全部来自它）；与 #9 同构（#9 对 Codex tab 做的事，本 change 对 OpenCode tab 做）。部署侧模版文件可提前加三个新段，旧前端忽略未知段无副作用。
- **Spec 路径:** `openspec/changes/add-platform-opencode-templates/`

#### 新增文件
_无。本 change 全部为对上游/既有 fork 文件的补丁。_

#### 上游补丁（rebase 后必须确认仍存在）
| 路径 | 改动要点 |
|------|---------|
| `frontend/src/utils/ccswitchImport.ts` | 新增 `ZHIPU_CC_SWITCH_MODEL = 'glm-4.6'` 与 `resolveCcSwitchImportConfig` 的 `zhipu` 分支（`app: 'claude'`，model 落到 `ANTHROPIC_MODEL`）|
| `frontend/src/utils/__tests__/ccswitchImport.spec.ts` | zhipu 导入断言 |
| `frontend/src/composables/useModelWhitelist.ts` | `zhipuModels` 补 `glm-4.7`，使本 change 在 catalog 与模版里推荐的 GLM 模型可白名单化 |

#### ⚠ 跨 change 共享文件
> 以下文件与归档 #6 共享（`types/index.ts` 同时属于 #2），且与 #9 高度重叠——#9 改 Codex tab、本 change 改 OpenCode tab，同一个 `switch` 的不同分支。rebase 时须同时保留各方的修改。
- `frontend/src/components/keys/UseKeyModal.vue` → 也属于 #6、#9
- `frontend/src/components/keys/__tests__/UseKeyModal.spec.ts` → 也属于 #6、#9
- `frontend/src/types/index.ts` → 也属于 #2、#6、#9
- `frontend/src/utils/clientTemplates.ts` → 也属于 #6、#9（normalize 白名单再加三个段）
- `frontend/src/utils/__tests__/clientTemplates.spec.ts` → 也属于 #6、#9
- `template/client-templates.json` → 也属于 #6、#9（新增三个 mount-ready 段）
- `template/README.md` → 也属于 #6、#9（记录查找顺序，并明确只有三个平台查平台段）

#### 退场条件
上游若自行给 OpenCode tab 引入每平台模版段（或把整套 client-templates 挂载机制收编），本 change 随 #6 一并转 ⬆️ upstreamed。

---

## Archived changes

> 已 archive 的 change 也仍然存在于 `develop` 上，上游 rebase 同样会冲突。在彻底进入上游之前必须照顾。

### 6. `support-mounted-frontend-client-templates`

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
| Fork 版本线 | `backend/cmd/server/VERSION`：fork 走独立的 `0.0.x` 版本线，与上游 `0.1.x` **每轮 rebase 必然冲突**（链首那条 `chore: sync VERSION to 0.0.24` 停车），取 fork 侧即可，后续 `0.0.25→…` 链会自动跟上；终态应等于 rebase 前的版本号 | 补丁 |
| OpenSpec overlay 载体 | `openspec/config.yaml`：上游只有一份全是注释的脚手架，fork 把 `context` 与 `rules` 整段填实——这是「proposal 必须写 `## Fork Touchpoints`、一条 bullet 一个路径」这条约束的**唯一强制载体**，`fork_overlay.py` 的快照/校验全靠它产出的结构。上游一旦改写这个脚手架，rebase 可能整段取上游而让 overlay 守护静默失效。<br>`openspec/FORK.md`（本文件）与 `tools/fork_overlay.py`、`docs/fork-snapshots/**` 同属纯 fork 新增，上游无对应物 | 补丁 + 新增 |
| Docker 打包 | `Dockerfile.goreleaser`（`Dockerfile` 已与上游一致，无补丁） | 补丁/新增 |
| Action 镜像化 | `.github/action-mirrors/**`、`tools/sync-action-mirrors.sh`、`tools/install-goreleaser.sh`、`tools/run-goreleaser-release.sh` | 几乎全新增 |
| 默认运行参数 | `deploy/docker-compose*.yml`（与 #5 部分重叠） | 补丁 |
| 文档分支 | `README*.md` 中**非 OpenSpec 功能段落**（如部署/构建说明） | 补丁 |
| OpenAI ops 观测 + transport-error failover（`0d1d47f17`）| **本行有三层补丁，只有第 1 层受编译器保护，第 2/3 层 rebase 时必须手工核对。**<br>**① 签名扩展（编译期可见）**：`backend/internal/service/openai_upstream_transport_error.go` 的 `handleOpenAIUpstreamTransportError` 增加第 6 参 `upstreamURL`，request_error ops 事件标注上游端点；全部调用点（`openai_*`、`grok_audio.go`、`grok_media.go`、`openai_ws_http_bridge.go`）同步传 `safeUpstreamURL(<req>.URL.String())`。上游新增调用点必编译失败，按报错逐个补即可。<br>**② 行为替换（⚠ 不产生编译错误、不产生冲突，历史上已漏声明至少一轮）**：`openai_embeddings.go:99`、`openai_images.go:632`、`openai_images_responses.go:1727` 三处，上游原本是「内联 `appendOpsUpstreamError` + 写 502/返回 `fmt.Errorf`」的死路，fork 整段（各 10+ 行）替换为 `return nil, s.handleOpenAIUpstreamTransportError(...)`，从而获得 failover 换号 + 持久故障临时摘除。上游若在这三个函数里重写错误分支，rebase 会静默合成"上游内联版"而不报任何错——**每轮 rebase 必须逐个 `git diff <base>..HEAD -- <这三个文件>` 确认 hunk 还在**。<br>**③ passthrough 标志修正（⚠ 单个 bool 字面量，不产生冲突）**：v0.1.178 新增的三条 anthropic-native 调用点里，`openai_gateway_chat_completions_anthropic_native.go` 与 `openai_gateway_responses_anthropic_native.go` 是**协议转换**路径，上游误传 `passthrough=true`，fork 改 `false`；`messages_anthropic_native` 为零转换直通，`true` 正确保留。自 2026-08-20 起由 `backend/internal/service/openai_fork_source_contract_test.go` 的 `TestForkAnthropicNativePassthroughOpsTags` 源码级钉死（同文件的 `TestForkTransportErrorCallSitesTagUpstreamURL` 兜底第 ① 层）。<br>**豁免（A5，2026-08-20 判定）**：`openai_gateway_count_tokens.go` 的 `ForwardResponsesInputTokens`（v0.1.179 净新增，服务 `POST /v1/responses/input_tokens`）与同文件既有的 sibling **有意不接入** helper，保持内联 `setOpsUpstreamError` + 直写 502。理由：这是 preflight 估算路径而非转发路径——handler 侧压根没有 failover 循环（`openai_gateway_count_tokens.go` 只 log 返回值），helper 又刻意不写响应；且该路径自带本地估算降级（`writeOpenAIResponsesInputTokensFallback`），若接入 helper 就会让一次 token 预估探测触发 `tempUnscheduleOpenAITransportError`、把健康账号从**真实流量**调度里摘掉，风险面反而放大。`0d1d47f17` 当年也未转换那个 sibling，本次维持同一口径。已知代价：这两处不产生带 `UpstreamURL`/`Passthrough`/`Kind` 的 ops request_error 事件（`setOpsUpstreamError(c, 0, …)` 仍在，状态码与消息不丢）。若日后想补 ops 对齐，应抽一个「只记事件、不 failover、不摘除」的轻量函数，不要直接复用本 helper。～2026-08-20 v0.1.179：上游未新增 transport-error 调用点（adaptive 协议路由复用既有转发路径），rebase 后零编译失败，23 个非测试调用点全部保持第 6 参 | 补丁 |
| 前端杂项补丁 | `frontend/src/vite-env.d.ts`（Airwallex SDK 类型声明兜底）、`frontend/src/composables/usePersistedPageSize.ts`（页大小来源追踪，管理员默认值优先于陈旧 localStorage） | 补丁 |
| Security Scan 分级门禁 | `.github/workflows/security-scan.yml`：govulncheck 改 `-json` 解析，仅「已有修复版的调用级漏洞」硬失败；无修复版（如 lib/pq GO-2026-616x，Fixed in: N/A）报 warning 不阻塞，修复版发布后自动恢复硬性 | 补丁 |
| Backend CI lint 确定性 | `.github/workflows/backend-ci.yml`：golangci-lint job 加 `skip-cache: true`——实测 Actions 缓存双向失真（同 commit develop push 绿 / tag push 报 7 个幻影 SA5011；本地同版本冷缓存全树 0 issues），全树冷分析仅约 1 分钟，确定性优先 | 补丁 |
| CN 账号连接测试修补 | `backend/internal/service/account_test_service.go`：`TestAccountConnection` 分发补 CN 供应商分支（anthropic 协议走 Claude 探测、其余走 OpenAI 兼容探测——上游 v0.1.178 漏改，CN 账号全落 Claude 探测致 chat_completions 协议账号 404）；openai 探测 apikey 分支换 `GetOpenAIProtocolAPIKey`；Claude 探测里 `GetAnthropicProtocolBaseURL` 非空时**无条件覆盖** `GetBaseURL()`（不是只在其为空时兜底），使 CN anthropic 账号打供应商官方端点而非 api.anthropic.com。**～2026-08-20 v0.1.179 部分收编 + fork 侧修正**：上游 `ac6208de1` + `85051616f`/`b3092145d` 已在 fork 兜底之前按 `api_protocol` 分发 `adaptive`（`account_test_service_cn_adaptive.go` 三端点自检）与 `chat_completions`（`testCNProviderChatCompletionsConnection`）；fork 兜底剩余覆盖面 = `responses` + anthropic 分支显式化，且 `responses` 分支已改走新增的 fork 自有文件 `backend/internal/service/account_test_service_cn_responses.go`（`testCNProviderResponsesConnection`：`GetOpenAIBaseURL` + `buildOpenAIResponsesURLForPlatform` + `normalizeDeepSeekResponsesRequestBody`，与 `openai_gateway_forward.go` 的真实转发同构；此前误打 `/v1/responses` 且跳过 body 归一，等于把 404 换了个端点）。另两处 hunk（`GetOpenAIProtocolAPIKey`、`GetAnthropicProtocolBaseURL`）上游未收编，仍必须保留。回归测试：`backend/internal/service/account_test_service_cn_fork_dispatch_test.go`。可上报上游；上游补齐 `responses` 分发后退场 | 补丁 + 新增 |
| 上游测试时区修补 | `backend/internal/repository/group_usage_rollup_trigger_integration_test.go`：事务 helper 钉 `SET LOCAL TIME ZONE 'Asia/Shanghai'`——触发器按会话时区取日（migration 223），测试断言却以上海锚定，容器会话默认 UTC 时在 UTC 16:00–24:00 窗口必挂（上游 cb7b03795 引入即带病）。可上报上游；上游修复后本补丁退场 | 补丁 |

> 这一块文件数量大但大多是 `.github/action-mirrors/` 等"新增目录"，rebase 几乎不会冲突；真正需要看的是 `.goreleaser*.yaml`、`Dockerfile*`、`deploy/docker-compose*.yml` 三处的小补丁。

> **已被上游收编（不再是 fork 补丁）**
> - `CLA.md`、`DEV_GUIDE.md` — 上游已自带同名同内容文件，`develop` 相对上游零差异。
> - `frontend/src/utils/billingMode.ts`、`frontend/src/components/admin/usage/UsageTable.vue` —
>   历史图片计费模式推导补丁已进入上游，且上游多加了「显式 video/token 模式优先」守卫，
>   覆盖面更广；2026-08-10 rebase 到 `10a4c6e3a` 时整段改用上游实现。
> - `add-openai-compatible-prompt-audit`（`backend/internal/securityaudit/` 全模块、
>   `frontend/src/features/prompt-audit/`、路由/侧栏/i18n 接入）— 上游已整体收编
>   （`10a4c6e3a` 与 `v0.1.176` 的 securityaudit 目录 tree hash 一致，`develop`
>   相对上游零差异）；2026-08-13 rebase 到 `e803e3851` 时确认。2026-08-20 复核：
>   `openspec/changes/add-openai-compatible-prompt-audit/` 文档目录**在上游基线上
>   同样存在**，fork 对它也是零差异——即上游连文档一并收编了，本条已不构成任何
>   fork 补丁。该 proposal 的 `## Fork Touchpoints` 是一节显式声明的空触点（补于
>   2026-08-20），只为让 `fork_overlay.py verify` 不再把它算成"零检查的已验证"。

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
1. **rebase 前**：`python3 tools/fork_overlay.py snapshot`
   会读所有 proposal 的 `## Fork Touchpoints`，把每个 change 的清单 + 当前
   `git diff main..HEAD` 写到 `tools/fork-snapshots/<change-id>/`
   （该目录已 gitignore，仅本地使用）。
2. 拉新上游 → `git rebase` develop 到新 main。
3. **rebase 后**：`python3 tools/fork_overlay.py verify`
   会逐条检查：
   - 每个 `New Files` / `Upstream Patch Files` 路径仍存在；
   - 每个 `Upstream Patch Files` 路径相对 `main` 仍非零差异（=patch 没丢）；
   - 每个 `Shared Touchpoints` 引用的 co-owner change 也列出该路径（双向闭合）。
4. **若 verify 报错**：
   - 若是 patch 丢失：参考 **`docs/fork-snapshots/<change-id>/patch.diff`**
     （随 `develop` 一起提交的上一轮已知良好快照）或 spec/tasks/design.md 手工恢复。
     不要用 `tools/fork-snapshots/`：那只是本次运行刚覆盖出来的临时产物。
   - 若是 shared touchpoint 单边声明：把对面 change 的 proposal 补全。
   - 若是 patch 已被上游收编（diff 永远为空且确认无需保留）：
     从对应 proposal 的 `## Fork Touchpoints` 中删除该路径，并同步本文表格。
5. **若 verify 报 WARN**：
   - `missing ## Fork Touchpoints section` / `unparsed bullet`：该 change 的
     校验实际是空转（"已验证"但一条也没查）。补齐段落或把 bullet 改成
     「一条一个反引号路径 + 冒号」的合规形态，别放着不管。

### 共享文件
当一个文件被多个 change 触碰时，rebase 冲突解决要**把所有 change 的修改都加回来**。
- 每条 change 的「⚠ 跨 change 共享文件」小节列出了这种文件，并用 `→ 也属于 #N` 给出对面 change 编号。
- 在 FORK.md 里全文搜索某个文件路径，可以反向查到所有相关 change（同一文件会在每个相关 change 下重复出现）。

### 工具
- `tools/fork_overlay.py snapshot` — rebase 前保存每个 change 的 manifest + patch diff
- `tools/fork_overlay.py verify` — rebase 后校验 patch 仍在 + 共享文件双向闭合
- 两者均接 `--base <ref>`（默认 `main`）

### 快照归档
- `tools/fork-snapshots/` 是本地再生成的**临时**目录：`.gitignore` 已忽略，
  且自 2026-08-20 起不再有任何文件被 git 跟踪（此前有 11 个陈旧副本因先于
  gitignore 加入而一直被跟踪，内容停在旧基线且残缺——`.gitignore` 对已跟踪
  路径无效，别再往里提交东西）。
- `docs/fork-snapshots/` 才是**可提交的权威副本**，包含 `manifest.json` 与
  `patch.diff`，用于下次 rebase 时从 `develop` 分支直接查阅/恢复。
- `patch.diff` 只含 `Upstream Patch Files` 的 diff，**不含 `New Files`**；
  新增文件的恢复靠 `manifest.json` 里的清单 + git 历史。
