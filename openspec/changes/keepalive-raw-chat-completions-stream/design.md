# Design

## 为什么只有 raw 路径缺保活

三条流式路径里，只有 CC 直转是「读一行、写一行」的纯透传，没有任何按时钟推进的分支：

| 路径 | 入口 | 保活 |
|------|------|------|
| `/v1/responses` | `handleStreamingResponseWithReasoning` | ✅ 已有 |
| Grok OAuth bridge（CC→Responses） | `handleChatStreamingResponse` | ✅ 已有 |
| CC 直转 | `streamRawChatCompletions` | ❌ 缺口 |

因此本 change 直接对齐 `handleChatStreamingResponse` 的结构，而不是另发明一套：同样的
「两个定时器都关闭 → 同步快路径」「否则读协程 + `select`」「`lastReadAt` 原子量判空闲、
`lastDataAt` 判保活间隔」。这样两个姊妹函数在 rebase 时容易一起对照。

## 保活为什么必须配一个空闲上限

保活会让下游连接一直活着。在此之前，**挂死的上游是靠前置代理掐断兜底的**——一旦加了保活
而不设上限，挂死上游会无限期占住账号并让客户端空等，等于把一个可见的 504 换成一个不可见的
永久挂起。所以两者必须同时落地。

口径选择：

- **Grok** 复用 `resolveGrokStreamIdleTimeout`，与 `/v1/responses` 路径完全一致（配置为 0 时回落 180s）。
- **其余上游**（DeepSeek / Kimi / GLM 等第三方 OpenAI 兼容端）用 `gateway.stream_data_interval_timeout`，
  置 0 即关闭，给慢上游留逃生阀。

注意方向：加上限**并没有变严**。此前这些流的实际生存期由前置代理的 `proxy_read_timeout`
（典型 60s）决定；现在是 180s 且连接始终被保活，对慢上游反而更宽容。

## 空闲判定为什么用周期 ticker 而不是可重置定时器

两个定时器都是 `time.NewTicker(T)` + 「醒来后再比一次 `time.Since(lastReadAt) < T` 就
`continue`」的组合，因此实际触发时刻落在 `[T, 2T)` 区间，而不是精确的 T。这是**兜底语义**
（防挂死、防前置代理判空闲），不是 SLA：偏差最多一个周期，对 keepalive（默认 10s，代理阈值
60s 起）和空闲上限（默认 180s）都远在安全裕度内。

不换成 resettable timer 的理由是同构：`handleChatStreamingResponse` 与
`handleStreamingResponseWithReasoning` 用的都是这套 ticker + 二次比较，三处保持同一形状，
rebase 时可以直接对照差异。换成 `timer.Reset` 需要处理「读协程与主循环竞争 Reset」的
额外同步，收益只是把偏差从一个周期压到零。

## 响应头的两段式提交

`newStreamHeaderWriter`（`openai_gateway_cc_pipeline.go`）一次性做两件事：透传过滤后的
上游响应头 + 写标准 SSE 头和 200。它的前提是「首次写出 = 已经确定由这个账号应答」。
保活打破了这个前提：保活先于任何语义输出发生，若照旧调用它，失败账号的 attempt 专属响应头
（`x-request-id`、`x-ratelimit-*`）会被定格，后续换号的成功账号再也换不掉——响应头已提交，
`http.ResponseWriter` 不接受第二次 `WriteHeader`。

因此本函数内部把它拆成两段（**不改共享的 `newStreamHeaderWriter`，它还有别的调用方**）：

| 闭包 | 内容 | 调用方 |
|------|------|--------|
| `commitStableSSEHeaders` | 只写 `Content-Type` / `Cache-Control` / `Connection` / `X-Accel-Buffering` + 200 | 保活分支 |
| `writeStreamHeaders` | 先 `WriteFilteredHeaders` 透传上游头，再调用上面那个 | `writeLine` 与 `finalize` 的语义输出路径 |

代价：**保活先行的流，其上游响应头不会出现在下游响应里**。这是可接受的——保活发生时本来就
还没确定最终由哪个账号应答，此时透传任何 attempt 专属的头都是错的；换号成功后客户端拿到的是
稳定 SSE 头 + 正确的响应体。

幂等判定用「本地 `headersCommitted` 标记 **或** `c.Writer.Written()`」双条件：前者保证同一
attempt 内不会重复 `WriteFilteredHeaders`（它内部是 `Add`，重复调用会写出重复头）；后者保证
跨 failover attempt 新建的闭包看到「响应已提交」也不会再写一次。

## 保活必须让开进行中的 SSE 帧

SSE 帧以空行结束，保活写的 `:\n\n` 自带一个空行。上游若发了 `event: x\n` 或多条 `data:`
之后才停顿，这一行注释会把还没写完的帧提前终结，客户端收到半截帧。因此保活分支加 `midFrame`
守卫，与 Responses 主路径 `handleStreamingResponseWithReasoning` 的 `eventInProgress`
分支同构。

`midFrame` 跟踪的是**实际写给下游的最后一行**是否非空，所以静默拒答检测器缓冲期间
（`pendingLines` 攒着没写下游）不算 midFrame，保活照发。代价是：上游若正好卡在半截帧上，
保活会一直让路——这由 `streamInterval` 空闲上限兜底，最坏情况等同于本 change 之前的行为。

## 与静默拒答缓冲的关系

`openAIChatSilentRefusalDetector` 在请求体 ≥64KB 时启用，会把上游帧缓冲住，直到确认不是
「空回答 + `finish_reason=stop` + 无 usage」才释放；缓冲的目的是**在没写出任何字节的前提下**
还能换号。

保活写注释会把响应提交为 200，天然与这个前提冲突。姊妹函数 `handleChatStreamingResponse`
选择的是「检测器启用且未开始输出时干脆不发保活」，代价是**大请求完全没有保活**——而 OpenCode
这类带工具与历史的 agent 请求恰恰轻松超过 64KB，照抄等于对本 change 要修的场景不生效。

这里改用更晚引入、语义更准的机制：`UpstreamFailoverError.SafeToFailoverAfterWrite`
（注释「仅写出 SSE 注释等非语义字节时，仍可在同一客户端流中切换账号」）。保活时：

1. 只调用幂等的 `writeStreamHeaders()` 并写注释，**不**释放 `pendingLines`、**不**置 `clientOutputStarted`；
   缓冲与判定语义原样保留。
2. 记 `keepaliveWritten`，静默拒答 failover 据此置 `SafeToFailoverAfterWrite`，
   `openAIForwardMayFailover` 因而仍放行换号。

结果是大请求既拿到保活，又保住了换号能力。

## handler 侧必须同步的两处

`SafeToFailoverAfterWrite` 只是 service 侧的一个标记，真正决定换不换号的是 handler。

1. **failover 闸门**：`openai_chat_completions.go` 原本直接比
   `c.Writer.Size() != writerSizeBeforeForward` 就无条件走 `handleFailoverExhausted`。
   保活写过 `:\n\n` 之后这个比较必然成立，等于把上面苦心保住的换号能力又闸死了——**这是本
   change 引入的回退**（加保活之前静默拒答能正常换号）。改用同包既有的
   `openAIForwardMayFailover`（Size 相等 **或** `SafeToFailoverAfterWrite` 则放行），
   并按 Responses 侧 `openai_gateway_handler.go` 的先例，在放行后补
   `SafeToFailoverAfterWrite && c.Writer.Written()` → `streamStarted = true`，
   让后续错误按已提交的流式格式回写。
2. **空闲超时的部分 usage**：`streamRawChatCompletions` 的超时分支返回的是
   `(buildResult(), 普通 error)`，handler 的非 failover 错误分支此前一律 `return`，
   这份已被上游计量的 usage 就漏计费了。现在该分支在 `result` 带非零 token 时也提交计费，
   与同函数「`ImageCount > 0` 时出错仍计费」的既有先例同口径。
   **failover 分支（换号重试 / 客户端已断开）刻意不计费**：那里会用另一个账号重跑，
   落账即重复计费，且静默拒答本就没有 usage。
   计费入参与 `RecordUsage` 提交抽成 `submitUsageRecord` 闭包由两条路径共用，避免漂移；
   `submitOpenAIUsageRecordTask` → `wrapUsageRecordTaskContext` → `usageRecordContext`
   会把任务重新挂到后台 context（只搬运 request-id 类值），因此客户端已断开、
   `c.Request.Context()` 已取消时仍能落账。

## 遗留项（本 change 不含）

1. **bridge 的 ≥64KB 保活抑制**：`handleChatStreamingResponse` 里 `refusalDetector.Enabled() &&
   !clientOutputStarted` 的抑制条件仍在，Grok OAuth bridge 路径上 ≥64KB 的请求依旧没有保活。
   它不在本次故障链上（带 effort 的请求进不了 bridge），改动它需要单独的回归论证——
   本 change 的 `SafeToFailoverAfterWrite` 方案可以平移过去。
2. **两条 CC 回退路径的同类缺口**：`forwardResponsesViaRawChatCompletions`
   （`streamChatCompletionsAsResponses`）与 `forwardAnthropicViaRawChatCompletions`
   同样是无保活的同步透传/转换循环（两文件 keepalive 零匹配）。受影响场景是
   Responses / Messages 客户端打到仅支持 CC 的第三方上游（DeepSeek / Kimi / GLM）
   且长时间静默思考。这类模型通常持续吐 `reasoning_content`，静默窗口短，
   风险低于 Grok，故不与本 change 捆绑。
3. **Grok 空闲超时的处置深度**：`/v1/responses` 主路径在 Grok 空闲超时时会
   `tempUnscheduleGrok`（2 分钟冷却）并在未提交输出时返回可换号的
   `grokStreamIdleFailoverError`；本 change 的 raw 路径与 bridge 一致，只返回普通
   错误结束本轮。相对旧行为（无限挂起）是严格改善，但没有账号冷却与换号——
   若要对齐主路径，需连同 `keepaliveWritten` → `SafeToFailoverAfterWrite`
   一起论证，留待后续。
