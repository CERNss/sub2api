//go:build unit

package service

import (
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Fork 自有的源码级契约测试。用于锁定"没有行为可观测面、且 rebase 时不会产生
// 冲突"的 fork 差异——这类差异只有散文（openspec/FORK.md）保护时，上游一次
// 无冲突合并就能悄悄回退。风格沿用 handler 包已有的
// TestOpenAIChatCompletionsFailoverGateUsesSharedWriteGuard。

func forkStripGoComments(source string) string {
	source = regexp.MustCompile(`(?s)/\*.*?\*/`).ReplaceAllString(source, "")
	return regexp.MustCompile(`(?m)//.*$`).ReplaceAllString(source, "")
}

func forkGoFunctionSource(t *testing.T, filename, functionName string) string {
	t.Helper()
	raw, err := os.ReadFile(filename)
	require.NoError(t, err)
	files := token.NewFileSet()
	parsed, err := parser.ParseFile(files, filename, raw, 0)
	require.NoError(t, err)
	for _, declaration := range parsed.Decls {
		function, ok := declaration.(*ast.FuncDecl)
		if !ok || function.Name.Name != functionName || function.Body == nil {
			continue
		}
		start := files.Position(function.Pos()).Offset
		end := files.Position(function.End()).Offset
		require.Greater(t, end, start)
		return string(raw[start:end])
	}
	t.Fatalf("function %s not found in %s", functionName, filename)
	return ""
}

// handleOpenAIUpstreamTransportError 的 passthrough 参数语义 = "原样直通、仅换认证"，
// 只用于给 ops request_error 事件打标，没有任何行为可观测面，所以只能源码级锁定。
//
// 上游 v0.1.178 给三条 anthropic-native 路径统一传了 true，但其中两条是**协议转换**
// 路径（Chat Completions / Responses ↔ Anthropic），与全库转换路径惯例相悖；
// fork 在 7d18faa0c 改成 false。messages 是零转换直通，true 正确保留。
// 单个 bool 字面量在 rebase 时不产生冲突——本用例是该修正的唯一屏障。
func TestForkAnthropicNativePassthroughOpsTags(t *testing.T) {
	for _, testCase := range []struct {
		name     string
		file     string
		function string
		want     string
		why      string
	}{
		{
			name:     "messages_is_zero_conversion_passthrough",
			file:     "openai_gateway_messages_anthropic_native.go",
			function: "forwardAnthropicViaNativeAnthropicEndpoint",
			want:     "handleOpenAIUpstreamTransportError(ctx, c, account, err, true,",
			why:      "Messages→Anthropic 零转换直通，passthrough=true 正确",
		},
		{
			name:     "chat_completions_is_a_conversion_path",
			file:     "openai_gateway_chat_completions_anthropic_native.go",
			function: "forwardChatCompletionsViaNativeAnthropic",
			want:     "handleOpenAIUpstreamTransportError(ctx, c, account, err, false,",
			why:      "Chat Completions→Anthropic 是协议转换，passthrough 必须为 false",
		},
		{
			name:     "responses_is_a_conversion_path",
			file:     "openai_gateway_responses_anthropic_native.go",
			function: "forwardResponsesViaNativeAnthropic",
			want:     "handleOpenAIUpstreamTransportError(ctx, c, account, err, false,",
			why:      "Responses→Anthropic 是协议转换，passthrough 必须为 false",
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			source := forkStripGoComments(forkGoFunctionSource(t, testCase.file, testCase.function))
			normalized := strings.Join(strings.Fields(source), " ")
			require.Contains(t, normalized, testCase.want, testCase.why)
		})
	}
}

// 所有 handleOpenAIUpstreamTransportError 调用点都必须带第 6 个参数
// safeUpstreamURL(...)（fork 的 OpenAI ops 观测补丁）。新增调用点漏传会编译失败，
// 但"传空串"不会——这里顺带把非空要求钉死在转发路径上。
func TestForkTransportErrorCallSitesTagUpstreamURL(t *testing.T) {
	entries, err := os.ReadDir(".")
	require.NoError(t, err)

	callPattern := regexp.MustCompile(`handleOpenAIUpstreamTransportError\(\s*ctx,\s*c,\s*account,\s*[^,]+,\s*(?:true|false),\s*([^)]*)\)`)
	checked := 0
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".go") || strings.HasSuffix(name, "_test.go") {
			continue
		}
		raw, readErr := os.ReadFile(name)
		require.NoError(t, readErr)
		source := forkStripGoComments(string(raw))
		for _, match := range callPattern.FindAllStringSubmatch(strings.Join(strings.Fields(source), " "), -1) {
			checked++
			require.Contains(t, match[1], "safeUpstreamURL(", "%s: transport-error 调用点必须标注上游端点", name)
		}
	}
	require.GreaterOrEqual(t, checked, 20, "调用点扫描失效（正则或调用形态变了），不得静默通过")
}
