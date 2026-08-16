package handler

import (
	"context"
	"fmt"
	"net/http/httptest"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenAIForwardMayFailoverOnlyAfterNonSemanticWrite(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	before := service.OpenAICompactKeepaliveAdjustedWrittenSize(c)

	_, err := fmt.Fprint(c.Writer, ":\n\n")
	require.NoError(t, err)
	c.Writer.Flush()

	require.True(t, openAIForwardMayFailover(c, before, &service.UpstreamFailoverError{
		SafeToFailoverAfterWrite: true,
	}))
	require.False(t, openAIForwardMayFailover(c, before, &service.UpstreamFailoverError{}))
}

// CC 直转流补上 keepalive 后 Writer.Size() 必然变化，ChatCompletions 的 failover
// 闸门必须和 Responses 侧共用 openAIForwardMayFailover：直接比 Writer.Size() 会把
// SafeToFailoverAfterWrite（只写出 SSE 注释）的静默拒答换号无条件闸死。
// 端到端两账号用例需要完整的账号调度器与仓储，成本远超收益；这里锁定调用口径，
// 闸门自身的行为由上面的 TestOpenAIForwardMayFailoverOnlyAfterNonSemanticWrite 覆盖。
func TestOpenAIChatCompletionsFailoverGateUsesSharedWriteGuard(t *testing.T) {
	source := stripGoComments(goFunctionSource(t, "openai_chat_completions.go", "ChatCompletions"))

	require.Contains(t, source, "openAIForwardMayFailover(c, writerSizeBeforeForward, failoverErr)")
	require.NotContains(t, source, "c.Writer.Size() != writerSizeBeforeForward",
		"不得退回按字节数无条件闸死 failover 的旧闸门")
	require.Contains(t, source, "failoverErr.SafeToFailoverAfterWrite && c.Writer.Written()",
		"放行后必须按已提交响应改走流式错误格式")
}

func TestOpenAIFirstOutputFailoverStopsAfterOneAccountSwitch(t *testing.T) {
	failoverErr := &service.UpstreamFailoverError{SafeToFailoverAfterWrite: true}
	count := 0

	require.False(t, openAIFirstOutputFailoverExhausted(failoverErr, &count))
	require.Equal(t, 1, count)
	require.True(t, openAIFirstOutputFailoverExhausted(failoverErr, &count))
	require.Equal(t, 1, count)
}

func TestOpenAIRequestAllowsFailoverReplayStopsCanceledClient(t *testing.T) {
	require.False(t, openAIRequestAllowsFailoverReplay(nil))

	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	requestCtx, cancel := context.WithCancel(context.Background())
	c.Request = httptest.NewRequest("POST", "/v1/responses", nil).WithContext(requestCtx)

	require.True(t, openAIRequestAllowsFailoverReplay(c))
	cancel()
	require.False(t, openAIRequestAllowsFailoverReplay(c))
}
