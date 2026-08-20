//go:build unit

package service

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

// Fork 补丁的 CN 分发兜底回归。上游 v0.1.179 只按 api_protocol 分发 adaptive 与
// chat_completions；固定 responses / anthropic 协议的账号由 fork 兜底接管，
// 否则会掉到 TestAccountConnection 末尾的 Claude 探测、以 {base}/v1/messages 误探。

func fixedCNAccountTestAccount(id int64, platform string, protocol string) *Account {
	return &Account{
		ID:          id,
		Name:        "fixed-cn-test",
		Platform:    platform,
		Type:        AccountTypeAPIKey,
		Status:      StatusActive,
		Concurrency: 1,
		Credentials: map[string]any{
			"api_key":      "sk-fixed-test",
			"api_protocol": protocol,
		},
	}
}

func fixedCNResponsesTestResponse() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body: io.NopCloser(strings.NewReader(`data: {"type":"response.output_text.delta","delta":"responses ok"}

data: {"type":"response.completed"}

`)),
	}
}

func fixedCNAnthropicTestResponse() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body: io.NopCloser(strings.NewReader(`data: {"type":"content_block_delta","delta":{"text":"anthropic ok"}}

data: {"type":"message_stop"}

`)),
	}
}

// 固定 responses 协议的 DeepSeek 账号必须打供应商原生 /responses（无 /v1 前缀），
// 与 openai_gateway_forward.go 的真实转发同构；打 /v1/responses 或 /v1/messages 都是 404。
func TestAccountTestService_FixedCNResponsesProtocolProbesPlatformNativeEndpoint(t *testing.T) {
	account := fixedCNAccountTestAccount(311, PlatformDeepseek, APIProtocolResponses)
	svc, upstream := adaptiveCNAccountTestService(account, fixedCNResponsesTestResponse())
	c, recorder := newTestContext()

	err := svc.TestAccountConnection(c, account.ID, "deepseek-chat", "", AccountTestModeDefault)

	require.NoError(t, err)
	require.Len(t, upstream.requests, 1)
	require.Equal(t, "https://api.deepseek.com/responses", upstream.requests[0].URL.String())
	require.NotContains(t, upstream.requests[0].URL.String(), "/v1/responses")
	require.NotContains(t, upstream.requests[0].URL.String(), "/v1/messages")
	require.Equal(t, HTTPUpstreamProfileOpenAI, HTTPUpstreamProfileFromContext(upstream.requests[0].Context()))
	require.Equal(t, "Bearer sk-fixed-test", upstream.requests[0].Header.Get("Authorization"))
	// DeepSeek 的 /responses 无状态：必须过 normalizeDeepSeekResponsesRequestBody。
	require.False(t, gjson.GetBytes(upstream.bodies[0], "store").Bool())
	require.False(t, gjson.GetBytes(upstream.bodies[0], "instructions").Exists())
	require.False(t, gjson.GetBytes(upstream.bodies[0], "previous_response_id").Exists())
	require.Equal(t, 1, strings.Count(recorder.Body.String(), `"type":"test_start"`))
	require.Equal(t, 1, strings.Count(recorder.Body.String(), `"type":"test_complete"`))
}

// 固定协议账号的自定义 base_url 必须生效（adaptive 专用的 GetCNProtocolBaseURL
// 会忽略它、恒回落官方端点，所以这里钉死走 GetOpenAIBaseURL）。
func TestAccountTestService_FixedCNResponsesProtocolHonorsCustomBaseURL(t *testing.T) {
	account := fixedCNAccountTestAccount(312, PlatformDeepseek, APIProtocolResponses)
	account.Credentials["base_url"] = "http://fixed-responses.example"
	svc, upstream := adaptiveCNAccountTestService(account, fixedCNResponsesTestResponse())
	c, _ := newTestContext()

	err := svc.TestAccountConnection(c, account.ID, "deepseek-chat", "", AccountTestModeDefault)

	require.NoError(t, err)
	require.Len(t, upstream.requests, 1)
	require.Equal(t, "http://fixed-responses.example/responses", upstream.requests[0].URL.String())
}

// 固定 anthropic 协议的 CN 账号走 Claude 探测，但 base 必须是供应商官方
// Anthropic 端点，而不是 api.anthropic.com。
func TestAccountTestService_FixedCNAnthropicProtocolProbesVendorMessagesEndpoint(t *testing.T) {
	for index, testCase := range []struct {
		name     string
		platform string
		wantURL  string
	}{
		{
			name:     "Zhipu",
			platform: PlatformZhipu,
			wantURL:  "https://open.bigmodel.cn/api/anthropic/v1/messages?beta=true",
		},
		{
			name:     "Kimi",
			platform: PlatformKimi,
			wantURL:  "https://api.moonshot.cn/anthropic/v1/messages?beta=true",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			account := fixedCNAccountTestAccount(int64(321+index), testCase.platform, APIProtocolAnthropic)
			svc, upstream := adaptiveCNAccountTestService(account, fixedCNAnthropicTestResponse())
			c, recorder := newTestContext()

			err := svc.TestAccountConnection(c, account.ID, "", "", AccountTestModeDefault)

			require.NoError(t, err)
			require.Len(t, upstream.requests, 1)
			require.Equal(t, testCase.wantURL, upstream.requests[0].URL.String())
			require.Equal(t, "sk-fixed-test", upstream.requests[0].Header.Get("x-api-key"))
			require.Equal(t, 1, strings.Count(recorder.Body.String(), `"type":"test_complete"`))
		})
	}
}
