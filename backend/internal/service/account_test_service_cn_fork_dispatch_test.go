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

// CN 分发回归。上游 v0.1.182（01a008394 / a749673de）已把固定 responses 与
// anthropic 两种协议补进 TestAccountConnection 顶部的 CN switch，该 switch 现在
// 对 GetAPIProtocol() 的四个取值完全穷尽，fork 原先的兜底块随之退场。
//
// 本文件保留两条守护：
//   - responses：路由收编了，但上游投的通用 OpenAI 探测不过
//     normalizeDeepSeekResponsesRequestBody。fork 把该分支改投
//     testCNProviderResponsesConnection，下面的 store / previous_response_id
//     断言就是这处剩余语义差的锁。
//   - anthropic：完全由上游实现（testCNProviderAnthropicConnection）。这里只作为
//     行为守护，钉死"打供应商官方 Anthropic 端点而非 api.anthropic.com"。注意
//     **不带** ?beta=true——那是旧的通用 Claude 探测遗留的产物，上游在
//     account_test_service_cn_adaptive.go 的注释里明确把它列为缺陷，真实转发
//     （openai_gateway_messages_anthropic_native.go 的 nativeAnthropicTargetURL，
//     "第三方端点保持朴素路径"）同样不附加。

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

// 固定 anthropic 协议的 CN 账号走上游的 testCNProviderAnthropicConnection，
// base 必须是供应商官方 Anthropic 端点，而不是 api.anthropic.com，且路径朴素
// （无 ?beta=true），与 nativeAnthropicTargetURL 的真实转发一致。
func TestAccountTestService_FixedCNAnthropicProtocolProbesVendorMessagesEndpoint(t *testing.T) {
	for index, testCase := range []struct {
		name     string
		platform string
		wantURL  string
	}{
		{
			name:     "Zhipu",
			platform: PlatformZhipu,
			wantURL:  "https://open.bigmodel.cn/api/anthropic/v1/messages",
		},
		{
			name:     "Kimi",
			platform: PlatformKimi,
			wantURL:  "https://api.moonshot.cn/anthropic/v1/messages",
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
