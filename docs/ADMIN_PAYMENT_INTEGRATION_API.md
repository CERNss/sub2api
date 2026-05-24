# ADMIN_PAYMENT_INTEGRATION_API

> 单文件中英双语文档 / Single-file bilingual documentation (Chinese + English)

---

## 中文

### 目标
本文档用于对接外部支付系统（如 `sub2apipay`）与 Sub2API 的 Admin API，覆盖：
- 支付成功后充值
- 用户查询
- 人工余额修正
- 前端购买页参数透传

### 基础地址
- 生产：`https://<your-domain>`
- Beta：`http://<your-server-ip>:8084`

### 认证
推荐使用：
- `x-api-key: admin-<64hex>`
- `Content-Type: application/json`
- 幂等接口额外传：`Idempotency-Key`

说明：管理员 JWT 也可访问 admin 路由，但服务间调用建议使用 Admin API Key。

### 1) 一步完成创建并兑换
`POST /api/v1/admin/redeem-codes/create-and-redeem`

用途：原子完成“创建兑换码 + 兑换到指定用户”。

请求头：
- `x-api-key`
- `Idempotency-Key`

请求体示例：
```json
{
  "code": "s2p_cm1234567890",
  "type": "balance",
  "value": 100.0,
  "user_id": 123,
  "notes": "sub2apipay order: cm1234567890"
}
```

幂等语义：
- 同 `code` 且 `used_by` 一致：`200`
- 同 `code` 但 `used_by` 不一致：`409`
- 缺少 `Idempotency-Key`：`400`（`IDEMPOTENCY_KEY_REQUIRED`）

curl 示例：
```bash
curl -X POST "${BASE}/api/v1/admin/redeem-codes/create-and-redeem" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: pay-cm1234567890-success" \
  -H "Content-Type: application/json" \
  -d '{
    "code":"s2p_cm1234567890",
    "type":"balance",
    "value":100.00,
    "user_id":123,
    "notes":"sub2apipay order: cm1234567890"
  }'
```

### 2) 查询用户（可选前置校验）
`GET /api/v1/admin/users/:id`

```bash
curl -s "${BASE}/api/v1/admin/users/123" \
  -H "x-api-key: ${KEY}"
```

### 3) 余额调整（已有接口）
`POST /api/v1/admin/users/:id/balance`

用途：人工补偿 / 扣减，支持 `set` / `add` / `subtract`。

请求体示例（扣减）：
```json
{
  "balance": 100.0,
  "operation": "subtract",
  "notes": "manual correction"
}
```

```bash
curl -X POST "${BASE}/api/v1/admin/users/123/balance" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: balance-subtract-cm1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "balance":100.00,
    "operation":"subtract",
    "notes":"manual correction"
  }'
```

### 4) 创建用户 API Key
`POST /api/v1/admin/users/:id/api-keys`

用途：外部系统通过 Admin API Key 为指定用户创建可用于 AI 调用的 API Key。

请求头：
- `x-api-key`
- `Idempotency-Key`

请求体字段：
- `name`：必填，Key 名称
- `group_id`：可选，绑定分组 ID
- `custom_key`：可选，自定义 Key（至少 16 位，仅字母、数字、下划线、连字符）
- `quota`：可选，Key 配额（USD，`0` 或不传表示不限）
- `expires_in_days`：可选，过期天数
- `rate_limit_5h` / `rate_limit_1d` / `rate_limit_7d`：可选，滚动窗口限额（USD）
- `ip_whitelist` / `ip_blacklist`：可选，IP/CIDR 列表

响应中的 `data.api_key.key` 为完整可用 Key。若绑定专属标准分组且用户尚未被授权，接口会自动授予该分组权限并返回 `auto_granted_group_access=true`；订阅分组要求用户已有有效订阅。

```bash
curl -X POST "${BASE}/api/v1/admin/users/123/api-keys" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: create-api-key-user-123-cm1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"external-service",
    "group_id":2,
    "quota":50.00,
    "rate_limit_1d":10.00
  }'
```

### 5) 转移用户 API Key
`POST /api/v1/admin/api-keys/:id/transfer`

用途：外部 sidecar 通过 Admin API Key 将已存在的 API Key 转移给目标用户，并可同步改分组、改配额或清零已用配额。

请求头：
- `x-api-key`
- `Idempotency-Key`

请求体字段：
- `target_user_id`：必填，目标用户 ID
- `target_group_id`：可选；不传表示保留当前分组，`0` 表示解绑，正数表示绑定目标分组
- `quota`：可选；不传表示保留当前配额，`0` 表示不限，正数表示新配额
- `reset_quota`：可选；`true` 时将 `quota_used` 清零，并把仅因 quota 耗尽的 Key 恢复为 active

响应会在 `data.api_key.user_id`、`data.api_key.group_id`、`data.api_key.quota`、`data.api_key.quota_used` 中确认最终状态。接口会校验目标用户、目标分组、订阅分组权限；专属标准分组可自动授予目标用户并返回 `auto_granted_group_access=true`。成功后会失效 API Key 认证缓存。

```bash
curl -X POST "${BASE}/api/v1/admin/api-keys/456/transfer" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: transfer-api-key-456-cm1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "target_user_id":123,
    "target_group_id":2,
    "quota":50.00,
    "reset_quota":true
  }'
```

### 6) 购买页 / 自定义页面 URL Query 透传（iframe / 新窗口一致）
当 Sub2API 打开 `purchase_subscription_url` 或用户侧自定义页面 iframe URL 时，会统一追加：
- `user_id`
- `token`
- `theme`（`light` / `dark`）
- `lang`（例如 `zh` / `en`，用于向嵌入页传递当前界面语言）
- `ui_mode`（固定 `embedded`）

示例：
```text
https://pay.example.com/pay?user_id=123&token=<jwt>&theme=light&lang=zh&ui_mode=embedded
```

### 7) 失败处理建议
- 支付成功与充值成功分状态落库
- 回调验签成功后立即标记“支付成功”
- 支付成功但充值失败的订单允许后续重试
- 重试保持相同 `code`，并使用新的 `Idempotency-Key`

### 8) `doc_url` 配置建议
- 查看链接：`https://github.com/Wei-Shaw/sub2api/blob/main/ADMIN_PAYMENT_INTEGRATION_API.md`
- 下载链接：`https://raw.githubusercontent.com/Wei-Shaw/sub2api/main/ADMIN_PAYMENT_INTEGRATION_API.md`

---

## English

### Purpose
This document describes the minimal Sub2API Admin API surface for external payment integrations (for example, `sub2apipay`), including:
- Recharge after payment success
- User lookup
- Manual balance correction
- Purchase page query parameter forwarding

### Base URL
- Production: `https://<your-domain>`
- Beta: `http://<your-server-ip>:8084`

### Authentication
Recommended headers:
- `x-api-key: admin-<64hex>`
- `Content-Type: application/json`
- `Idempotency-Key` for idempotent endpoints

Note: Admin JWT can also access admin routes, but Admin API Key is recommended for server-to-server integration.

### 1) Create and Redeem in one step
`POST /api/v1/admin/redeem-codes/create-and-redeem`

Use case: atomically create a redeem code and redeem it to a target user.

Headers:
- `x-api-key`
- `Idempotency-Key`

Request body:
```json
{
  "code": "s2p_cm1234567890",
  "type": "balance",
  "value": 100.0,
  "user_id": 123,
  "notes": "sub2apipay order: cm1234567890"
}
```

Idempotency behavior:
- Same `code` and same `used_by`: `200`
- Same `code` but different `used_by`: `409`
- Missing `Idempotency-Key`: `400` (`IDEMPOTENCY_KEY_REQUIRED`)

curl example:
```bash
curl -X POST "${BASE}/api/v1/admin/redeem-codes/create-and-redeem" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: pay-cm1234567890-success" \
  -H "Content-Type: application/json" \
  -d '{
    "code":"s2p_cm1234567890",
    "type":"balance",
    "value":100.00,
    "user_id":123,
    "notes":"sub2apipay order: cm1234567890"
  }'
```

### 2) Query User (optional pre-check)
`GET /api/v1/admin/users/:id`

```bash
curl -s "${BASE}/api/v1/admin/users/123" \
  -H "x-api-key: ${KEY}"
```

### 3) Balance Adjustment (existing API)
`POST /api/v1/admin/users/:id/balance`

Use case: manual correction with `set` / `add` / `subtract`.

Request body example (`subtract`):
```json
{
  "balance": 100.0,
  "operation": "subtract",
  "notes": "manual correction"
}
```

```bash
curl -X POST "${BASE}/api/v1/admin/users/123/balance" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: balance-subtract-cm1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "balance":100.00,
    "operation":"subtract",
    "notes":"manual correction"
  }'
```

### 4) Create a user API key
`POST /api/v1/admin/users/:id/api-keys`

Use this endpoint when an external service needs to create an AI-usable API key for a target user via the Admin API Key.

Headers:
- `x-api-key`
- `Idempotency-Key`

Request fields:
- `name`: required key name
- `group_id`: optional group binding
- `custom_key`: optional custom key, at least 16 characters, letters/numbers/underscore/hyphen only
- `quota`: optional key quota in USD (`0` or omitted means unlimited)
- `expires_in_days`: optional expiration in days
- `rate_limit_5h` / `rate_limit_1d` / `rate_limit_7d`: optional rolling-window USD limits
- `ip_whitelist` / `ip_blacklist`: optional IP/CIDR lists

The full usable key is returned as `data.api_key.key`. If the key is bound to an exclusive standard group and the user does not yet have access, the endpoint auto-grants that group and returns `auto_granted_group_access=true`. Subscription groups require an active subscription.

```bash
curl -X POST "${BASE}/api/v1/admin/users/123/api-keys" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: create-api-key-user-123-cm1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"external-service",
    "group_id":2,
    "quota":50.00,
    "rate_limit_1d":10.00
  }'
```

### 5) Transfer a user API key
`POST /api/v1/admin/api-keys/:id/transfer`

Use this endpoint when an external sidecar needs to move an existing API key to a target user, optionally update group binding, update quota, or clear used quota.

Headers:
- `x-api-key`
- `Idempotency-Key`

Request fields:
- `target_user_id`: required target user ID
- `target_group_id`: optional; omitted keeps the current group, `0` unbinds, positive values bind the target group
- `quota`: optional; omitted keeps the current quota, `0` means unlimited, positive values set the new quota
- `reset_quota`: optional; `true` clears `quota_used` and reactivates keys that were only disabled by quota exhaustion

The response confirms final state in `data.api_key.user_id`, `data.api_key.group_id`, `data.api_key.quota`, and `data.api_key.quota_used`. The endpoint validates the target user, target group, and subscription-group access. Exclusive standard groups can be auto-granted to the target user and return `auto_granted_group_access=true`. Successful transfer invalidates API key auth cache.

```bash
curl -X POST "${BASE}/api/v1/admin/api-keys/456/transfer" \
  -H "x-api-key: ${KEY}" \
  -H "Idempotency-Key: transfer-api-key-456-cm1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "target_user_id":123,
    "target_group_id":2,
    "quota":50.00,
    "reset_quota":true
  }'
```

### 6) Purchase / Custom Page URL query forwarding (iframe and new tab)
When Sub2API opens `purchase_subscription_url` or a user-facing custom page iframe URL, it appends:
- `user_id`
- `token`
- `theme` (`light` / `dark`)
- `lang` (for example `zh` / `en`, used to pass the current UI language to the embedded page)
- `ui_mode` (fixed: `embedded`)

Example:
```text
https://pay.example.com/pay?user_id=123&token=<jwt>&theme=light&lang=zh&ui_mode=embedded
```

### 7) Failure handling recommendations
- Persist payment success and recharge success as separate states
- Mark payment as successful immediately after verified callback
- Allow retry for orders with payment success but recharge failure
- Keep the same `code` for retry, and use a new `Idempotency-Key`

### 8) Recommended `doc_url`
- View URL: `https://github.com/Wei-Shaw/sub2api/blob/main/ADMIN_PAYMENT_INTEGRATION_API.md`
- Download URL: `https://raw.githubusercontent.com/Wei-Shaw/sub2api/main/ADMIN_PAYMENT_INTEGRATION_API.md`
