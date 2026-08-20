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
// Fork 补丁。上游 v0.1.179 的 CN 分发只覆盖 adaptive 与 chat_completions，
// 固定 responses 协议的账号会掉到 TestAccountConnection 末尾的 Claude 探测，
// 被以 {base}/v1/messages 误探而必然 404。改投通用 OpenAI 探测也不对：
// 那条路径用 buildOpenAIResponsesURL 拼 /v1/responses，且不过
// normalizeDeepSeekResponsesRequestBody，而真实网关
// （openai_gateway_forward.go 的 GetOpenAIBaseURL + buildOpenAIResponsesURLForPlatform）
// 打的是 DeepSeek 无 /v1 前缀的 /responses 且强制 store=false。本探测与网关同构。
//
// 与上游 adaptive 版 testCNProviderAdaptiveResponsesConnection 的差异：
//   - base URL 用 GetOpenAIBaseURL()（固定协议账号的自定义 base_url 生效），
//     而非只对 adaptive 有意义的 GetCNProtocolBaseURL；
//   - 自带 SSE 生命周期（test_start / processOpenAIStream 收尾 test_complete），
//     不依赖多端点自检的外层；
//   - 保留 429 的 reconcileOpenAI429State 归位（adaptive 版复制原型时漏了）。
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
