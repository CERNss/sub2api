//go:build unit

package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestEmailService_SendEmail_DefaultChannelUsesSMTPConfig(t *testing.T) {
	svc := NewEmailService(&settingRepoStub{values: map[string]string{}}, nil)

	err := svc.SendEmail(context.Background(), "to@example.com", "subject", "body")

	require.ErrorIs(t, err, ErrEmailNotConfigured)
}

func TestEmailService_SendEmail_WebhookGenericBearer(t *testing.T) {
	var gotAuth string
	var gotPayload map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		require.NoError(t, json.NewDecoder(r.Body).Decode(&gotPayload))
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	svc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
		SettingKeyWebhookURL:           server.URL,
		SettingKeyWebhookAuthMode:      "bearer",
		SettingKeyWebhookSecret:        "secret-token",
	}}, nil)

	err := svc.SendEmail(context.Background(), "to@example.com", "subject", "<b>body</b>")

	require.NoError(t, err)
	require.Equal(t, "Bearer secret-token", gotAuth)
	require.Equal(t, "email.message", gotPayload["event"])
	require.Equal(t, "to@example.com", gotPayload["to"])
	require.Equal(t, "subject", gotPayload["subject"])
	require.Equal(t, "<b>body</b>", gotPayload["html"])
}

func TestEmailService_SendEmail_WebhookDoesNotFallbackToSMTP(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "bad", http.StatusBadGateway)
	}))
	defer server.Close()

	svc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
		SettingKeyWebhookURL:           server.URL,
		SettingKeySMTPHost:             "smtp.example.com",
		SettingKeySMTPPort:             "587",
	}}, nil)

	err := svc.SendEmail(context.Background(), "to@example.com", "subject", "body")

	require.Error(t, err)
	require.Contains(t, err.Error(), "webhook delivery failed")
}

func TestEmailService_SendEmail_WebhookRedirectIsFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/ok", http.StatusFound)
	}))
	defer server.Close()

	svc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
		SettingKeyWebhookURL:           server.URL,
	}}, nil)

	err := svc.SendEmail(context.Background(), "to@example.com", "subject", "body")

	require.Error(t, err)
	require.Contains(t, err.Error(), "status 302")
}

func TestEmailService_SendEmail_WebhookMissingURL(t *testing.T) {
	svc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
	}}, nil)

	err := svc.SendEmail(context.Background(), "to@example.com", "subject", "body")

	require.ErrorIs(t, err, ErrWebhookNotConfigured)
}

func TestEmailService_SendEmail_WebhookTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(50 * time.Millisecond)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()
	svc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
		SettingKeyWebhookURL:           server.URL,
		SettingKeyWebhookTimeoutSec:    "1",
	}}, nil)

	err := svc.SendEmail(ctx, "to@example.com", "subject", "body")

	require.Error(t, err)
	require.Contains(t, err.Error(), "webhook delivery failed")
}

func TestValidateWebhookConfigRejectsNonLocalHTTP(t *testing.T) {
	err := validateWebhookConfig(&emailWebhookConfig{
		URL:            "http://example.com/webhook",
		PayloadFormat:  WebhookPayloadFormatGeneric,
		AuthMode:       WebhookAuthModeNone,
		TimeoutSeconds: 10,
	})

	require.Error(t, err)
	require.Contains(t, err.Error(), "https")
}

func TestValidateWebhookConfigAllowsLocalHTTP(t *testing.T) {
	err := validateWebhookConfig(&emailWebhookConfig{
		URL:            "http://127.0.0.1:9000/webhook",
		PayloadFormat:  WebhookPayloadFormatGeneric,
		AuthMode:       WebhookAuthModeNone,
		TimeoutSeconds: 10,
	})

	require.NoError(t, err)
}

func TestBuildFeishuWebhookPayloadWithSignature(t *testing.T) {
	cfg := &emailWebhookConfig{
		PayloadFormat: WebhookPayloadFormatFeishu,
		AuthMode:      WebhookAuthModeFeishuSignature,
		Secret:        "secret",
	}

	payload, err := buildWebhookPayload(cfg, "to@example.com", "Subject", "<p>Hello</p>")

	require.NoError(t, err)
	var got map[string]any
	require.NoError(t, json.Unmarshal(payload, &got))
	require.Equal(t, "text", got["msg_type"])
	require.NotEmpty(t, got["timestamp"])
	require.NotEmpty(t, got["sign"])
	content := got["content"].(map[string]any)
	require.True(t, strings.Contains(content["text"].(string), "Subject"))
	require.True(t, strings.Contains(content["text"].(string), "Hello"))
}

func TestSendTestWebhook_CustomHeaderAuth(t *testing.T) {
	var gotHeader string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHeader = r.Header.Get("X-Webhook-Token")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	err := SendTestWebhook(context.Background(), WebhookTestConfig{
		URL:            server.URL,
		AuthMode:       WebhookAuthModeHeader,
		AuthHeader:     "X-Webhook-Token",
		Secret:         "secret-token",
		TimeoutSeconds: 10,
	}, "to@example.com", "subject", "body")

	require.NoError(t, err)
	require.Equal(t, "secret-token", gotHeader)
}

func TestSendTestWebhook_GenericSignatureAuth(t *testing.T) {
	var gotTimestamp string
	var gotSignature string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTimestamp = r.Header.Get("X-Sub2API-Timestamp")
		gotSignature = r.Header.Get("X-Sub2API-Signature")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	err := SendTestWebhook(context.Background(), WebhookTestConfig{
		URL:            server.URL,
		AuthMode:       WebhookAuthModeSignature,
		Secret:         "secret-token",
		TimeoutSeconds: 10,
	}, "to@example.com", "subject", "body")

	require.NoError(t, err)
	require.NotEmpty(t, gotTimestamp)
	require.True(t, strings.HasPrefix(gotSignature, "sha256="))
}

func TestSendTestWebhook_FeishuApplicationFailure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":19021,"msg":"sign invalid"}`))
	}))
	defer server.Close()

	err := SendTestWebhook(context.Background(), WebhookTestConfig{
		PayloadFormat:  WebhookPayloadFormatFeishu,
		URL:            server.URL,
		AuthMode:       WebhookAuthModeNone,
		TimeoutSeconds: 10,
	}, "to@example.com", "subject", "body")

	require.Error(t, err)
	require.Contains(t, err.Error(), "feishu webhook delivery failed")
}

func TestEmailService_SendVerifyCode_UsesWebhookWithoutSMTP(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		var payload map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		require.Equal(t, "user@example.com", payload["to"])
		require.Contains(t, payload["subject"], "Email Verification Code")
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	svc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
		SettingKeyWebhookURL:           server.URL,
	}}, &emailCacheStub{})

	err := svc.SendVerifyCode(context.Background(), "user@example.com", "Sub2API")

	require.NoError(t, err)
	require.Equal(t, int32(1), atomic.LoadInt32(&calls))
}

func TestEmailQueueService_ProcessTaskUsesWebhookWithoutSMTP(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		var payload map[string]any
		require.NoError(t, json.NewDecoder(r.Body).Decode(&payload))
		require.Equal(t, "queued@example.com", payload["to"])
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	emailSvc := NewEmailService(&settingRepoStub{values: map[string]string{
		SettingKeyEmailDeliveryChannel: "webhook",
		SettingKeyWebhookURL:           server.URL,
	}}, &emailCacheStub{})
	queue := &EmailQueueService{emailService: emailSvc}

	queue.processTask(0, EmailTask{
		Email:    "queued@example.com",
		SiteName: "Sub2API",
		TaskType: TaskTypeVerifyCode,
	})

	require.Equal(t, int32(1), atomic.LoadInt32(&calls))
}
