package routes

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestAuthTokenAliasRoutesRegistered 锁定 fork overlay 的 token 登录别名。
//
// `/auth/token`、`/auth/token/2fa`、`/auth/token/refresh` 是面向外部自动化系统的别名，
// 语义上表达"登录换取 Bearer token"，必须与各自的规范端点复用同一个 handler。
// 上游同步时 routes/auth.go 常被整体覆盖，这三条别名会静默消失且编译不报错，
// 因此在路由注册层面锁死，而不是依赖调用方发现 404。
func TestAuthTokenAliasRoutesRegistered(t *testing.T) {
	router := newAuthRoutesTestRouter(nil)

	registered := make(map[string]string, len(router.Routes()))
	for _, route := range router.Routes() {
		registered[route.Method+" "+route.Path] = route.Handler
	}

	cases := []struct {
		alias     string
		canonical string
	}{
		{alias: "POST /api/v1/auth/token", canonical: "POST /api/v1/auth/login"},
		{alias: "POST /api/v1/auth/token/2fa", canonical: "POST /api/v1/auth/login/2fa"},
		{alias: "POST /api/v1/auth/token/refresh", canonical: "POST /api/v1/auth/refresh"},
	}

	for _, tc := range cases {
		t.Run(tc.alias, func(t *testing.T) {
			aliasHandler, ok := registered[tc.alias]
			require.Truef(t, ok, "别名路由 %s 未注册：上游 rebase 可能覆盖了 routes/auth.go", tc.alias)

			canonicalHandler, ok := registered[tc.canonical]
			require.Truef(t, ok, "规范路由 %s 未注册", tc.canonical)

			require.Equalf(t, canonicalHandler, aliasHandler,
				"%s 必须复用 %s 的 handler，否则两条路径行为会漂移", tc.alias, tc.canonical)
		})
	}
}
