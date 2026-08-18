# Keep raw Chat Completions streams alive during long upstream thinking

## Why

CC 直转路径 `streamRawChatCompletions` 是纯逐行透传：上游沉默时网关一个字节都不写给下游。网关前的反向代理会把这种空闲连接判死（nginx `proxy_read_timeout` 默认 60s、Cloudflare 100s），客户端因此看到 **504**——而 sub2api 自身从不产生 504（`mapUpstreamError` 把上游 5xx 统一映射为 502），所以这个状态码本身就指向前置代理。

Grok 的长思考请求**必定**落在这条路径：`grokChatResponsesBridgeEligibility` 对非 null 的 `reasoning_effort` 直接判 `unsupported_reasoning_effort` 并回落 raw（`openai_gateway_grok_chat_bridge.go`）。effort 越高思考越久、静默越长，命中概率越大。实测 OpenCode → sub2api 的 grok-4.6：medium 挂 1 次、xhigh 挂 2 次；不支持 effort 的 grok-4.3 走 bridge 因而不受影响。

另外两条主流式路径早已有保活，raw 是本故障链上的缺口：

- `/v1/responses`：`handleStreamingResponseWithReasoning` 有 keepalive（Codex CLI 因此不受影响）
- Grok OAuth bridge：`handleChatStreamingResponse` 有 keepalive，且与本函数同在 CC 家族

（Responses→CC / Messages→CC 两条回退路径存在同类缺口，不在本 change 范围，见 design.md 遗留项。）

## What Changes

- `streamRawChatCompletions` 在下游空闲达 `gateway.stream_keepalive_interval`（默认 10s）时写出 SSE 注释 `:\n\n`，与 `handleChatStreamingResponse` 同构。
- 同时引入上游读空闲上限：Grok 复用全局 Grok 口径 `resolveGrokStreamIdleTimeout`（默认 180s），其余上游沿用 `gateway.stream_data_interval_timeout`（置 0 可关闭）。没有这个上限，keepalive 会把挂死的上游无限期拖住——此前是靠前置代理掐断兜底的。
- keepalive 与空闲上限都关闭时保留原同步快路径，行为零变化。
- 静默拒答 failover 在只写出保活注释时标记 `SafeToFailoverAfterWrite`，避免新增的保活把既有的换号能力堵死；`ChatCompletions` handler 的 failover 闸门同步改用 `openAIForwardMayFailover`，否则保活写出的字节会把这个标记闸死。
- 保活只提交稳定 SSE 头，不再连带提交上游 attempt 专属响应头（`x-request-id` / `x-ratelimit-*`），避免失败账号的头被定格后换号无法替换。
- 保活只在 SSE 帧边界发出：帧发到一半的停顿由空闲上限兜底，注释自带的空行不得把进行中的多行帧劈开。
- 空闲超时返回的部分 usage 在 handler 侧落账（非 failover 错误分支），不再随错误一起丢弃。

## Capabilities

### New Capabilities
- `raw-chat-completions-stream-keepalive`：CC 直转流式响应的下游保活与上游空闲上限。

### Modified Capabilities
- None.

## Impact

- `backend/internal/service/openai_gateway_chat_completions_raw.go` — 保活 + 空闲上限 + failover 标记 + 响应头两段式提交 + 帧边界保活
- `backend/internal/service/openai_gateway_chat_completions_raw_test.go` — 回归覆盖
- `backend/internal/handler/openai_chat_completions.go` — failover 闸门改用 `openAIForwardMayFailover`；空闲超时的部分 usage 落账
- `backend/internal/handler/openai_gateway_first_output_timeout_test.go` — 闸门口径的回归覆盖
- 退场条件：上游在 `streamRawChatCompletions` 自行补上 keepalive 后，本 change 转 ⬆️ upstreamed。

## Fork Touchpoints

### New Files
- _None._

### Upstream Patch Files
- `backend/internal/service/openai_gateway_chat_completions_raw.go`: 逐行同步循环重构为「读协程 + select」，新增 `keepaliveInterval` / `streamInterval` 解析、`keepaliveWritten` / `midFrame` 标记、`processLine` / `buildResult` / `finalize` 三个闭包；`newStreamHeaderWriter` 的用法换成本地两段式提交（`commitStableSSEHeaders` / `writeStreamHeaders`）；两者均关闭时走原同步快路径。
- `backend/internal/service/openai_gateway_chat_completions_raw_test.go`: fork 自有测试 `TestForwardAsRawChatCompletions_KeepaliveKeepsSilentThinkingStreamAlive`、`..._SilentRefusalAfterKeepaliveStaysFailoverable`、`..._StreamIdleTimeoutKeepsPartialUsage`、`..._KeepaliveCommitsOnlyStableSSEHeaders`、`..._KeepaliveDoesNotSplitInProgressFrame` 与 `grokRawChatCompletionsTestAccount` 辅助函数（上游既有用例不动——它们的上游体是 `strings.Reader`，一次性返回，仍走同步快路径）。
- `backend/internal/handler/openai_chat_completions.go`: `ChatCompletions` 的 failover 闸门由 `c.Writer.Size() != writerSizeBeforeForward` 改为 `openAIForwardMayFailover(c, writerSizeBeforeForward, failoverErr)`，放行后按 Responses 侧先例补 `SafeToFailoverAfterWrite && c.Writer.Written()` → `streamStarted = true`。（原「计费闭包 + 非零 token 门槛」半边已于 v0.1.178 被上游 #5730 收编为 `submitChatUsage`，不再是本 change 的补丁面，见 FORK.md #10。）
- `backend/internal/handler/openai_gateway_first_output_timeout_test.go`: fork 自有测试 `TestOpenAIChatCompletionsFailoverGateUsesSharedWriteGuard`（源码级契约，锁定闸门口径不回退）。

### Shared Touchpoints
- _None._

### Non-OpenSpec Overlap
- _None._ 这四个文件在本 change 之前与上游 `main` 零差异。
