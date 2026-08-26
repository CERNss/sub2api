## 1. 保活与空闲上限

- [x] 1.1 `streamRawChatCompletions` 解析 `gateway.stream_keepalive_interval`，空闲达间隔时写出 SSE 注释 `:\n\n`。
- [x] 1.2 解析上游读空闲上限：Grok 走 `resolveGrokStreamIdleTimeout`，其余走 `gateway.stream_data_interval_timeout`。
- [x] 1.3 逐行同步循环重构为「读协程 + select」；两个定时器都关闭时保留原同步快路径。
- [x] 1.4 静默拒答 failover 在写过保活注释时置 `SafeToFailoverAfterWrite`。
- [x] 1.5 响应头改为两段式提交：保活只调 `commitStableSSEHeaders`（稳定 SSE 头 + 200），
      语义输出路径才调 `writeStreamHeaders` 透传上游头；不改共享的 `newStreamHeaderWriter`。
- [x] 1.6 `midFrame` 跟踪实际写给下游的最后一行，保活只在 SSE 帧边界发出。

## 2. handler 侧闸门与计费

- [x] 2.1 `openai_chat_completions.go` 的 failover 闸门改用 `openAIForwardMayFailover`，
      放行后按 Responses 侧先例补 `SafeToFailoverAfterWrite && c.Writer.Written()` → `streamStarted = true`。
- [x] 2.2 计费入参与 `RecordUsage` 提交抽成 `submitUsageRecord` 闭包，成功路径与出错路径共用。
- [x] 2.3 非 failover 的普通错误分支在 `result` 带非零 token 时提交计费（空闲超时的部分 usage 不再丢弃）；
      failover 分支不计费，避免跨 attempt 重复。

## 3. 回归覆盖

- [x] 3.1 上游静默期间写出保活注释，且后续帧与 `[DONE]`、usage 均不受影响（`TestForwardAsRawChatCompletions_KeepaliveKeepsSilentThinkingStreamAlive`）。
- [x] 3.2 保活之后的静默拒答仍可换号，且不泄漏缓冲的语义帧（`TestForwardAsRawChatCompletions_SilentRefusalAfterKeepaliveStaysFailoverable`）。
- [x] 3.3 空闲超时返回错误的同时保留部分 usage，Grok 与非 Grok 账号各一例（`TestForwardAsRawChatCompletions_StreamIdleTimeoutKeepsPartialUsage`）。
- [x] 3.4 保活先行时只提交稳定 SSE 头、不提交上游 `x-request-id`；语义帧先行时上游头照旧透传（`TestForwardAsRawChatCompletions_KeepaliveCommitsOnlyStableSSEHeaders`）。
- [x] 3.5 帧中途停顿不插保活注释、帧边界停顿仍发保活（`TestForwardAsRawChatCompletions_KeepaliveDoesNotSplitInProgressFrame`）。
- [x] 3.6 handler 闸门口径的源码级契约（`TestOpenAIChatCompletionsFailoverGateUsesSharedWriteGuard`）；
      端到端两账号用例需要完整的账号调度器与仓储，成本远超收益，闸门行为本身由既有的
      `TestOpenAIForwardMayFailoverOnlyAfterNonSemanticWrite` 覆盖。
- [x] 3.7 上游既有用例零修改通过（`go test ./internal/service/ -tags unit`，含 `-race`；`go test ./internal/handler/`）。

## 4. Fork bookkeeping

- [x] 4.1 在 `openspec/FORK.md` 登记（目录 + 快速概览行 + Active changes 条目）。
- [x] 4.2 handler 侧两个补丁文件补登记到 `FORK.md` 上游补丁表与 proposal 的 Fork Touchpoints，快速概览计数同步为 4。
- [x] 4.3 **常设门（recurring gate，非一次性实现项）**：每轮发版/rebase 前用
      `python3 tools/fork_overlay.py snapshot --base <新基线>` 重新快照本 change 的补丁，
      并把产物同步到 `docs/fork-snapshots/keepalive-raw-chat-completions-stream/`。
      本项按「当前树是否已对齐当前基线」判定，不计入未完成实现工作——勾选状态表示
      截至最近一次同步已满足，下一轮 rebase 时重新执行即可，无需再改回未勾选。
      最近一次执行：`9c1c87cfe`，基线 `5a7d46962`（v0.1.182），
      `patch.diff` 与 `git diff 5a7d46962 HEAD -- <manifest 内 upstream_patch_files>` 逐字节一致。
