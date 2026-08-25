package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/Wei-Shaw/sub2api/internal/pkg/openai"
	"github.com/gin-gonic/gin"
)

// testCNProviderResponsesConnection 探测 api_protocol 固定为 responses 的国产
// 供应商账号（目前只有 DeepSeek 提供原生 /responses 端点）。
//
// Fork 补丁（v0.1.182 起大幅收窄，勿照旧描述理解）。
//
// 本函数最初是为了补上游 v0.1.179 CN 分发的空洞：固定 responses 协议的账号会掉到
// TestAccountConnection 末尾的 Claude 探测、被以 {base}/v1/messages 误探而 404。
// 上游 v0.1.182（01a008394，PR #5913）已把该分支收编，并投给通用 OpenAI 探测
// testOpenAIAccountConnection；配套的 f75c4161f 也让 URL 拼接变成平台感知
// （buildOpenAIResponsesURLForPlatform），因此 URL、请求头、TLS profile、429 的
// reconcileOpenAI429State 现在上游都已对齐——原注释列举的那几条差异均已失效。
//
// 仍然改投本函数的**唯一**理由是请求体与转发路径的同构：
//   - 上游探测不过 normalizeDeepSeekResponsesRequestBody，body 里根本没有 store
//     字段；而真实转发（openai_gateway_forward.go:1284 与
//     openai_gateway_passthrough.go:606）对 DeepSeek 恒发 store=false。DeepSeek 的
//     原生 /responses 无状态，探测与转发在这一点上必须一致，否则探测绿、真实流量
//     仍可能被拒。
//   - 上游探测还留了一个逃生口：extra.openai_responses_supported 为假时改打
//     /v1/chat/completions（account_test_service.go 的 ShouldUseResponsesAPI 分支），
//     而真实转发对固定 responses 协议明确拒绝被该探针旧值覆盖
//     （shouldForwardOpenAIResponsesViaRawChatCompletions）。陈旧 extra 会让探测
//     打到一个转发根本不会用的端点。
//
// 退场条件：上游给 testOpenAIAccountConnection 接上 body 归一（并去掉上面那个
// 逃生口）后，本文件连同 CN switch 里的 responses 分支一并退场。
func (s *AccountTestService) testCNProviderResponsesConnection(c *gin.Context, account *Account, modelID string, prompt string) error {
	ctx := c.Request.Context()

	testModelID := strings.TrimSpace(modelID)
	if testModelID == "" {
		testModelID = openai.DefaultTestModel
	}
	testModelID = account.GetMappedModel(testModelID)

	authToken := strings.TrimSpace(account.GetOpenAIProtocolAPIKey())
	if authToken == "" {
		return s.sendErrorAndEnd(c, "No API key available")
	}

	normalizedBaseURL, err := s.validateUpstreamBaseURL(account.GetOpenAIBaseURL())
	if err != nil {
		return s.sendErrorAndEnd(c, fmt.Sprintf("Invalid base URL: %s", err.Error()))
	}
	apiURL := buildOpenAIResponsesURLForPlatform(account.Platform, normalizedBaseURL)

	payload := createOpenAITestPayload(testModelID, false)
	// DeepSeek 的原生 Responses 端点无状态，不需要 OpenAI 探测的合成 instructions。
	delete(payload, "instructions")
	payloadBytes, _ := json.Marshal(payload)
	payloadBytes = normalizeDeepSeekResponsesRequestBody(account, payloadBytes)

	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("X-Accel-Buffering", "no")
	c.Writer.Flush()

	s.sendEvent(c, TestEvent{Type: "test_start", Model: testModelID})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return s.sendErrorAndEnd(c, "Failed to create request")
	}
	req = req.WithContext(WithHTTPUpstreamProfile(req.Context(), HTTPUpstreamProfileOpenAI))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+authToken)
	applyOpenAICodexProbeHeaders(req.Header)
	account.ApplyHeaderOverrides(req.Header)

	proxyURL := ""
	if account.ProxyID != nil && account.Proxy != nil {
		proxyURL = account.Proxy.URL()
	}
	resp, err := s.httpUpstream.DoWithTLS(req, proxyURL, account.ID, account.Concurrency, s.tlsFPProfileService.ResolveTLSProfile(account))
	if err != nil {
		return s.sendErrorAndEnd(c, fmt.Sprintf("Request failed: %s", err.Error()))
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		if resp.StatusCode == http.StatusTooManyRequests {
			s.reconcileOpenAI429State(ctx, account, resp.Header, body)
		}
		if resp.StatusCode == http.StatusUnauthorized && s.accountRepo != nil {
			_ = s.accountRepo.SetError(ctx, account.ID, fmt.Sprintf("Authentication failed (401): %s", string(body)))
		}
		return s.sendErrorAndEnd(c, fmt.Sprintf("API returned %d: %s", resp.StatusCode, string(body)))
	}

	return s.processOpenAIStream(c, resp.Body)
}
