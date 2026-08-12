package handler

import (
	"context"
	"testing"

	dbent "github.com/Wei-Shaw/sub2api/ent"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

// TestPendingLocalEmailVerificationConsistentAcrossStages 锁定"是否需要本地邮箱验证码"
// 在两个阶段的口径一致。
//
// 同一语义由两处产出：
//   - 回调阶段 createOIDCOAuthChoicePendingSession 尚未落库 session，直接调
//     pendingOIDCLocalEmailVerificationRequired，把期望值写进 completion payload
//     的 local_email_verification_required 交给前端；
//   - 创建账号阶段 session 已存在，走 pendingOAuthLocalEmailVerificationRequired
//     做真正的校验。
//
// 两者一旦漂移，前端拿到的期望值就和后端实际校验不符。历史上后端曾无视站点级
// email_verify_enabled 强制要码，而前端在该开关关闭时隐藏验证码控件，导致注册
// 走进"无处输入又拒绝空码"的死路。这里对两条路径做同输入同断言，防止再次漂移。
func TestPendingLocalEmailVerificationConsistentAcrossStages(t *testing.T) {
	const trustedEmail = "trusted@example.com"

	trustedClaims := map[string]any{
		"email_verified": true,
		"compat_email":   trustedEmail,
	}
	syntheticClaims := map[string]any{
		"email_verified": true,
		"compat_email":   "abc123" + service.OIDCConnectSyntheticEmailDomain,
	}
	unverifiedClaims := map[string]any{
		"email_verified": false,
		"compat_email":   trustedEmail,
	}

	cases := []struct {
		name               string
		siteEmailVerify    bool
		oidcRequireLocal   bool
		claims             map[string]any
		email              string
		wantVerifyRequired bool
	}{
		{
			name:               "站点级验证关闭时两阶段都不得要码",
			siteEmailVerify:    false,
			oidcRequireLocal:   true,
			claims:             trustedClaims,
			email:              trustedEmail,
			wantVerifyRequired: false,
		},
		{
			name:               "站点级关闭优先于 OIDC 严格策略与不可信声明",
			siteEmailVerify:    false,
			oidcRequireLocal:   true,
			claims:             unverifiedClaims,
			email:              trustedEmail,
			wantVerifyRequired: false,
		},
		{
			name:               "站点级开启且 OIDC 要求本地验证时要码",
			siteEmailVerify:    true,
			oidcRequireLocal:   true,
			claims:             trustedClaims,
			email:              trustedEmail,
			wantVerifyRequired: true,
		},
		{
			name:               "站点级开启且 OIDC 放宽且邮箱可信时跳过",
			siteEmailVerify:    true,
			oidcRequireLocal:   false,
			claims:             trustedClaims,
			email:              trustedEmail,
			wantVerifyRequired: false,
		},
		{
			name:               "OIDC 放宽但用户改用其它邮箱时仍要码",
			siteEmailVerify:    true,
			oidcRequireLocal:   false,
			claims:             trustedClaims,
			email:              "other@example.com",
			wantVerifyRequired: true,
		},
		{
			name:               "OIDC 放宽但邮箱为合成地址时仍要码",
			siteEmailVerify:    true,
			oidcRequireLocal:   false,
			claims:             syntheticClaims,
			email:              trustedEmail,
			wantVerifyRequired: true,
		},
		{
			name:               "OIDC 放宽但上游未标记邮箱已验证时仍要码",
			siteEmailVerify:    true,
			oidcRequireLocal:   false,
			claims:             unverifiedClaims,
			email:              trustedEmail,
			wantVerifyRequired: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			handler, _ := newOAuthPendingFlowTestHandlerWithDependencies(t, oauthPendingFlowTestHandlerOptions{
				emailVerifyEnabled: tc.siteEmailVerify,
				settingValues: map[string]string{
					service.SettingKeyOIDCConnectRequireLocalEmailVerification: boolSettingValue(tc.oidcRequireLocal),
				},
			})

			ctx := context.Background()

			// 回调阶段：还没有 session，只有上游声明。
			callbackStage := handler.pendingOIDCLocalEmailVerificationRequired(ctx, tc.claims, tc.email)

			// 创建账号阶段：session 已落库，携带同一份上游声明。
			session := &dbent.PendingAuthSession{
				ProviderType:           "oidc",
				UpstreamIdentityClaims: tc.claims,
			}
			pendingStage := handler.pendingOAuthLocalEmailVerificationRequired(ctx, session, tc.email)

			require.Equalf(t, tc.wantVerifyRequired, callbackStage,
				"回调阶段告知前端的 local_email_verification_required 不符预期")
			require.Equalf(t, tc.wantVerifyRequired, pendingStage,
				"创建账号阶段的实际校验口径不符预期")
			require.Equalf(t, callbackStage, pendingStage,
				"两阶段口径漂移：前端会按 %v 渲染，后端却按 %v 校验", callbackStage, pendingStage)
		})
	}
}
