package service

import (
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestSanitizeGrokResponsesModelInputNormalizesReplayHistory(t *testing.T) {
	body := []byte(`{
		"input":[
			{"role":"system","content":"rules"},
			{"type":"message","role":"assistant","id":"msg_partial","content":[{"type":"output_text","text":"done"}]},
			{"type":"reasoning","id":"rs_1","status":"completed","content":null,"summary":[{"type":"summary_text","text":"keep"}]},
			{"type":"message","role":"assistant","id":"msg_complete","status":"completed","content":[{"type":"output_text","text":"kept"}]}
		]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)
	require.Equal(t, "message", gjson.GetBytes(patched, "input.0.type").String())
	require.Equal(t, "done", gjson.GetBytes(patched, "input.1.content").String())
	require.False(t, gjson.GetBytes(patched, "input.1.id").Exists())
	require.False(t, gjson.GetBytes(patched, "input.2.status").Exists())
	require.False(t, gjson.GetBytes(patched, "input.2.content").Exists())
	require.Equal(t, "keep", gjson.GetBytes(patched, "input.2.summary.0.text").String())
	require.Equal(t, "msg_complete", gjson.GetBytes(patched, "input.3.id").String())
	require.Equal(t, "completed", gjson.GetBytes(patched, "input.3.status").String())
}

func TestSanitizeGrokResponsesModelInputStripsOnlyNonPairCallIDs(t *testing.T) {
	body := []byte(`{"input":[
		{"type":"message","role":"user","call_id":"remove_message","content":"continue"},
		{"type":"reasoning","call_id":"remove_reasoning","summary":[]},
		{"type":"image_generation_call","call_id":"remove_image","id":"ig_1","status":"completed"},
		{"type":"function_call","call_id":"keep_function","name":"lookup","arguments":"{}"},
		{"type":"function_call_output","call_id":"keep_function","output":"ok"}
	]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)
	for i := 0; i < 3; i++ {
		require.False(t, gjson.GetBytes(patched, "input."+strconv.Itoa(i)+".call_id").Exists())
	}
	require.Equal(t, "keep_function", gjson.GetBytes(patched, "input.3.call_id").String())
	require.Equal(t, "keep_function", gjson.GetBytes(patched, "input.4.call_id").String())
}

func TestSanitizeGrokResponsesModelInputPairsCallsInTwoPasses(t *testing.T) {
	body := []byte(`{
		"input":[
			{"type":"function_call_output","output":{"before":true,"large_id":9007199254740993}},
			{"type":"function_call","function":{"name":"lookup","arguments":{"query":"x","large_id":9007199254740993}}},
			{"type":"custom_tool_call","id":"custom_1","name":"apply_patch","input":"patch"},
			{"type":"custom_tool_call_output","tool_call_id":"custom_1","output":["ok"]},
			{"type":"tool_search_call","id":"search_1","arguments":{"query":"repo"}},
			{"type":"tool_search_output","call_id":"search_1","results":{"groups":["repo"]}},
			{"role":"tool","tool_call_id":"orphan","content":{"value":1}}
		]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)
	generated := gjson.GetBytes(patched, "input.1.call_id").String()
	require.NotEmpty(t, generated)
	require.Equal(t, generated, gjson.GetBytes(patched, "input.0.call_id").String())
	require.JSONEq(t, `{"before":true,"large_id":9007199254740993}`, gjson.GetBytes(patched, "input.0.output").String())
	require.Equal(t, "9007199254740993", gjson.Get(gjson.GetBytes(patched, "input.0.output").String(), "large_id").Raw)
	require.Equal(t, "lookup", gjson.GetBytes(patched, "input.1.name").String())
	require.JSONEq(t, `{"query":"x","large_id":9007199254740993}`, gjson.GetBytes(patched, "input.1.arguments").String())
	require.Equal(t, "9007199254740993", gjson.Get(gjson.GetBytes(patched, "input.1.arguments").String(), "large_id").Raw)
	customCallID := gjson.GetBytes(patched, "input.2.call_id").String()
	require.NotEmpty(t, customCallID)
	require.NotEqual(t, "custom_1", customCallID)
	require.JSONEq(t, `{"input":"patch"}`, gjson.GetBytes(patched, "input.2.arguments").String())
	require.Equal(t, customCallID, gjson.GetBytes(patched, "input.3.call_id").String())
	require.JSONEq(t, `["ok"]`, gjson.GetBytes(patched, "input.3.output").String())
	require.Equal(t, "tool_search", gjson.GetBytes(patched, "input.4.name").String())
	searchCallID := gjson.GetBytes(patched, "input.4.call_id").String()
	require.NotEmpty(t, searchCallID)
	require.NotEqual(t, "search_1", searchCallID)
	require.Equal(t, searchCallID, gjson.GetBytes(patched, "input.5.call_id").String())
	require.JSONEq(t, `{"groups":["repo"]}`, gjson.GetBytes(patched, "input.5.output").String())
	require.Equal(t, "function_call_output", gjson.GetBytes(patched, "input.6.type").String())
	require.Equal(t, "orphan", gjson.GetBytes(patched, "input.6.call_id").String())
}

func TestSanitizeGrokResponsesModelInputMapsAllItemAliasesAndRejectsConflicts(t *testing.T) {
	body := []byte(`{"input":[
		{"type":"function_call","id":"fc_alias","call_id":"call_canonical","name":"one","arguments":"{}"},
		{"type":"function_call_output","id":"fc_alias","output":"ok"},
		{"type":"function_call","id":"duplicate_item","name":"two","arguments":"{}"},
		{"type":"function_call","id":"duplicate_item","name":"three","arguments":"{}"},
		{"type":"function_call_output","id":"duplicate_item","output":"ambiguous"}
	]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)
	require.Equal(t, "call_canonical", gjson.GetBytes(patched, "input.0.call_id").String())
	require.Equal(t, "call_canonical", gjson.GetBytes(patched, "input.1.call_id").String())
	require.False(t, gjson.GetBytes(patched, "input.0.id").Exists())
	secondCallID := gjson.GetBytes(patched, "input.2.call_id").String()
	thirdCallID := gjson.GetBytes(patched, "input.3.call_id").String()
	ambiguousOutputID := gjson.GetBytes(patched, "input.4.call_id").String()
	require.NotEmpty(t, secondCallID)
	require.NotEmpty(t, thirdCallID)
	require.NotEmpty(t, ambiguousOutputID)
	require.NotEqual(t, "duplicate_item", secondCallID)
	require.NotEqual(t, secondCallID, thirdCallID)
	require.NotEqual(t, secondCallID, ambiguousOutputID)
	require.NotEqual(t, thirdCallID, ambiguousOutputID)
}

func TestPatchGrokResponsesBodyCombinesAdditionalToolsAndDropsOrphanControls(t *testing.T) {
	body := []byte(`{
		"input":[{"type":"additional_tools","tools":[{"type":"function","name":"lookup"}]},{"role":"user","content":"hi"}],
		"tools":[{"type":"function","name":"lookup"}],
		"tool_choice":"auto","parallel_tool_calls":true
	}`)
	patched, err := patchGrokResponsesBody(body, "grok-4.5")
	require.NoError(t, err)
	require.Equal(t, int64(1), gjson.GetBytes(patched, "tools.#").Int())
	require.Equal(t, "lookup", gjson.GetBytes(patched, "tools.0.name").String())
	require.Equal(t, "message", gjson.GetBytes(patched, "input.0.type").String())

	withoutTools, err := patchGrokResponsesBody([]byte(`{"input":"hi","tool_choice":"auto","parallel_tool_calls":true}`), "grok-4.5")
	require.NoError(t, err)
	require.False(t, gjson.GetBytes(withoutTools, "tool_choice").Exists())
	require.False(t, gjson.GetBytes(withoutTools, "parallel_tool_calls").Exists())

	for _, malformedTools := range []string{"null", `{}`, `"invalid"`} {
		malformedBody := []byte(`{"input":"hi","tools":` + malformedTools + `,"tool_choice":"auto","parallel_tool_calls":true}`)
		patched, err := patchGrokResponsesBody(malformedBody, "grok-4.5")
		require.NoError(t, err)
		require.False(t, gjson.GetBytes(patched, "tool_choice").Exists(), string(patched))
		require.False(t, gjson.GetBytes(patched, "parallel_tool_calls").Exists(), string(patched))
	}
}

func TestSanitizeGrokCompactionReplayBodyPreservesVisibleSummary(t *testing.T) {
	body := []byte(`{
		"previous_response_id":"resp_stale",
		"input":[{"type":"compaction","encrypted_content":"opaque","summary":[{"type":"summary_text","text":"visible history"}]},{"type":"message","role":"user","content":"continue"}]
	}`)
	patched, changed, err := sanitizeGrokCompactionReplayBody(body)
	require.NoError(t, err)
	require.True(t, changed)
	require.False(t, gjson.GetBytes(patched, "previous_response_id").Exists())
	require.False(t, gjson.GetBytes(patched, `input.#(type=="reasoning")`).Exists())
	require.Contains(t, gjson.GetBytes(patched, "input.0.content.0.text").String(), "visible history")
	require.Equal(t, "continue", gjson.GetBytes(patched, "input.1.content").String())
	require.True(t, isGrokCompactionReplayDecodeError(http.StatusBadRequest, []byte(`{"error":{"message":"failed to deserialize compaction summary history"}}`)))
	require.True(t, isGrokCompactionReplayDecodeError(http.StatusBadRequest, []byte(`{"error":{"type":"invalid_request_error"},"detail":"could not decode compaction blob"}`)))
}

func TestGrokStructuredErrorCandidatesDoNotShadowTopLevelMessages(t *testing.T) {
	shadowedInvalidEncrypted := []byte(`{"code":"invalid-argument","error":{"type":"invalid_request_error"},"message":"Could not decrypt encrypted_content because it was modified"}`)
	require.True(t, isGrokInvalidEncryptedContentResponse(http.StatusBadRequest, shadowedInvalidEncrypted))
	require.True(t, isGrokCompactionReplayDecodeError(http.StatusBadRequest, []byte(`{"error":{"type":"invalid_request_error"},"message":"could not decode compaction history"}`)))
}

func TestGrokDecoderCompatibility422FailsOverWithoutCooldown(t *testing.T) {
	body := []byte(`{"detail":"data did not match any variant of untagged enum ModelInput at input[3]"}`)
	require.True(t, isGrokDecoderCompatibilityError(http.StatusUnprocessableEntity, body))
	require.True(t, isGrokDecoderCompatibilityError(http.StatusUnprocessableEntity, []byte(`{"message":"could not decode ModelInput at input.3"}`)))
	require.True(t, isGrokDecoderCompatibilityError(http.StatusUnprocessableEntity, []byte(`{"error":{"type":"invalid_request_error"},"message":"could not deserialize ModelInput at input[3]"}`)))
	require.True(t, isGrokDecoderCompatibilityError(http.StatusUnprocessableEntity, []byte(`{"error":"Failed to deserialize the JSON body into the target type: messages[1]: data did not match any variant of untagged enum Content at line 1 column 6577"}`)))
	require.True(t, (&OpenAIGatewayService{}).shouldFailoverGrokUpstreamError(http.StatusUnprocessableEntity, body))
	decision := classifyGrokUpstreamFailure(http.StatusUnprocessableEntity, body, "grok-4.5")
	require.False(t, decision.ShouldCooldown)
	require.Equal(t, GrokFailureNone, decision.Class)

	require.False(t, isGrokDecoderCompatibilityError(http.StatusUnprocessableEntity, []byte(`{"error":{"message":"invalid user parameter"}}`)))
	require.False(t, isGrokDecoderCompatibilityError(http.StatusUnprocessableEntity, []byte(`{"error":"messages[1].content is required"}`)))
	require.False(t, isGrokDecoderCompatibilityError(http.StatusBadRequest, body))
}

// xAI 对 ZDR 账号（Grok 订阅 OAuth 号）关闭了文件通道，原样转发 input_file 必得
// 400 invalid-argument: "File content is currently unsupported for ZDR customers."
// 实测：2026-08-27 直接 curl /v1/responses 打 input_file，3/3 全 400（account=41 platform=grok）。
// 降级成文字备注后整轮请求还能跑完，模型也知道附件没送到。
func TestSanitizeGrokResponsesModelInputDowngradesFileParts(t *testing.T) {
	body := []byte(`{"input":[
		{"type":"message","role":"user","content":[
			{"type":"input_text","text":"read this"},
			{"type":"input_file","filename":"probe.pdf","file_data":"data:application/pdf;base64,JVBERi0="},
			{"type":"input_image","image_url":{"url":"data:image/png;base64,iVBORw0="}}
		]}
	]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)

	parts := gjson.GetBytes(patched, "input.0.content").Array()
	require.Len(t, parts, 3)
	require.Equal(t, "read this", parts[0].Get("text").String())

	// 文件部件换成 input_text，且不能再残留任何文件字段——留着就还是 400。
	require.Equal(t, "input_text", parts[1].Get("type").String())
	require.Contains(t, parts[1].Get("text").String(), "probe.pdf")
	require.False(t, parts[1].Get("file_data").Exists())
	require.False(t, parts[1].Get("filename").Exists())

	// 图片走 input_image，是另一条上游通道，必须原样留下。
	require.Equal(t, "input_image", parts[2].Get("type").String())
	require.Equal(t,
		"data:image/png;base64,iVBORw0=",
		parts[2].Get("image_url.url").String())
}

// Chat Completions 形状的 {"type":"file","file":{...}} 也要认，别只挡 Responses 那一种。
func TestSanitizeGrokResponsesModelInputDowngradesChatShapedFileParts(t *testing.T) {
	body := []byte(`{"input":[
		{"type":"message","role":"user","content":[
			{"type":"file","file":{"filename":"spec.pdf","file_data":"data:application/pdf;base64,JVBERi0="}}
		]}
	]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)

	parts := gjson.GetBytes(patched, "input.0.content").Array()
	require.Len(t, parts, 1)
	require.Equal(t, "input_text", parts[0].Get("type").String())
	require.Contains(t, parts[0].Get("text").String(), "spec.pdf")
	require.False(t, parts[0].Get("file").Exists())
}

// 没有 filename 时不能塞出个空名字，也不能整个部件消失。
func TestSanitizeGrokResponsesModelInputDowngradesAnonymousFileParts(t *testing.T) {
	body := []byte(`{"input":[
		{"type":"message","role":"user","content":[
			{"type":"input_file","file_data":"data:application/pdf;base64,JVBERi0="}
		]}
	]}`)

	patched, err := sanitizeGrokResponsesModelInput(body)
	require.NoError(t, err)

	parts := gjson.GetBytes(patched, "input.0.content").Array()
	require.Len(t, parts, 1)
	require.Equal(t, "input_text", parts[0].Get("type").String())
	require.Contains(t, parts[0].Get("text").String(), "file")
}
