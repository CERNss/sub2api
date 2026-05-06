package service

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/textproto"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

const emailWebhookLogName = "service.email_webhook"

var ErrWebhookNotConfigured = infraerrors.ServiceUnavailable("WEBHOOK_NOT_CONFIGURED", "webhook delivery is not configured")

var htmlTagPattern = regexp.MustCompile(`<[^>]+>`)

type emailWebhookConfig struct {
	PayloadFormat  string
	URL            string
	AuthMode       string
	AuthHeader     string
	Secret         string
	TimeoutSeconds int
}

type WebhookTestConfig struct {
	PayloadFormat  string
	URL            string
	AuthMode       string
	AuthHeader     string
	Secret         string
	TimeoutSeconds int
}

func SendTestWebhook(ctx context.Context, cfg WebhookTestConfig, to, subject, body string) error {
	normalized := &emailWebhookConfig{
		PayloadFormat:  normalizeWebhookPayloadFormat(cfg.PayloadFormat),
		URL:            strings.TrimSpace(cfg.URL),
		AuthMode:       normalizeWebhookAuthMode(cfg.AuthMode),
		AuthHeader:     strings.TrimSpace(cfg.AuthHeader),
		Secret:         strings.TrimSpace(cfg.Secret),
		TimeoutSeconds: normalizeWebhookTimeoutSeconds(cfg.TimeoutSeconds),
	}
	if err := validateWebhookConfig(normalized); err != nil {
		return err
	}
	return sendWebhookPayload(ctx, normalized, to, subject, body)
}

func (s *EmailService) getEmailDeliveryChannel(ctx context.Context) string {
	if s == nil || s.settingRepo == nil {
		return EmailDeliveryChannelSMTP
	}
	value, err := s.settingRepo.GetValue(ctx, SettingKeyEmailDeliveryChannel)
	if err != nil {
		return EmailDeliveryChannelSMTP
	}
	return normalizeEmailDeliveryChannel(value)
}

func (s *EmailService) getWebhookConfig(ctx context.Context) (*emailWebhookConfig, error) {
	if s == nil || s.settingRepo == nil {
		return nil, ErrWebhookNotConfigured
	}
	keys := []string{
		SettingKeyWebhookPayloadFormat,
		SettingKeyWebhookURL,
		SettingKeyWebhookAuthMode,
		SettingKeyWebhookAuthHeader,
		SettingKeyWebhookSecret,
		SettingKeyWebhookTimeoutSec,
	}
	settings, err := s.settingRepo.GetMultiple(ctx, keys)
	if err != nil {
		return nil, fmt.Errorf("get webhook settings: %w", err)
	}
	timeout := defaultWebhookTimeoutSeconds
	if raw := strings.TrimSpace(settings[SettingKeyWebhookTimeoutSec]); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			timeout = normalizeWebhookTimeoutSeconds(parsed)
		}
	}
	cfg := &emailWebhookConfig{
		PayloadFormat:  normalizeWebhookPayloadFormat(settings[SettingKeyWebhookPayloadFormat]),
		URL:            strings.TrimSpace(settings[SettingKeyWebhookURL]),
		AuthMode:       normalizeWebhookAuthMode(settings[SettingKeyWebhookAuthMode]),
		AuthHeader:     strings.TrimSpace(settings[SettingKeyWebhookAuthHeader]),
		Secret:         strings.TrimSpace(settings[SettingKeyWebhookSecret]),
		TimeoutSeconds: timeout,
	}
	if err := validateWebhookConfig(cfg); err != nil {
		return nil, err
	}
	return cfg, nil
}

func validateWebhookConfig(cfg *emailWebhookConfig) error {
	if cfg == nil || strings.TrimSpace(cfg.URL) == "" {
		return ErrWebhookNotConfigured
	}
	parsed, err := url.Parse(cfg.URL)
	if err != nil || parsed == nil || parsed.Host == "" {
		return infraerrors.BadRequest("WEBHOOK_URL_INVALID", "webhook url is invalid")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http":
		if !isLocalWebhookHost(parsed.Hostname()) {
			return infraerrors.BadRequest("WEBHOOK_URL_REQUIRES_HTTPS", "webhook url must use https except for local testing")
		}
	case "https":
	default:
		return infraerrors.BadRequest("WEBHOOK_URL_INVALID_SCHEME", "webhook url must use http or https")
	}
	switch cfg.AuthMode {
	case WebhookAuthModeBearer, WebhookAuthModeSignature, WebhookAuthModeFeishuSignature:
		if strings.TrimSpace(cfg.Secret) == "" {
			return infraerrors.BadRequest("WEBHOOK_SECRET_REQUIRED", "webhook secret is required for selected auth mode")
		}
	case WebhookAuthModeHeader:
		if strings.TrimSpace(cfg.Secret) == "" {
			return infraerrors.BadRequest("WEBHOOK_SECRET_REQUIRED", "webhook secret is required for selected auth mode")
		}
		if !isSafeWebhookHeaderName(cfg.AuthHeader) {
			return infraerrors.BadRequest("WEBHOOK_AUTH_HEADER_INVALID", "webhook auth header name is invalid")
		}
	}
	return nil
}

func isLocalWebhookHost(host string) bool {
	host = strings.Trim(strings.ToLower(strings.TrimSpace(host)), "[]")
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func isSafeWebhookHeaderName(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	canonical := textproto.CanonicalMIMEHeaderKey(name)
	if !httpgutsToken(name) || strings.EqualFold(canonical, "Authorization") {
		return false
	}
	return !strings.HasPrefix(strings.ToLower(name), "x-sub2api-")
}

func httpgutsToken(value string) bool {
	for _, r := range value {
		if r <= 32 || r >= 127 {
			return false
		}
		switch r {
		case '(', ')', '<', '>', '@', ',', ';', ':', '\\', '"', '/', '[', ']', '?', '=', '{', '}':
			return false
		}
	}
	return value != ""
}

func (s *EmailService) sendViaWebhook(ctx context.Context, to, subject, body string) error {
	cfg, err := s.getWebhookConfig(ctx)
	if err != nil {
		return err
	}
	return sendWebhookPayload(ctx, cfg, to, subject, body)
}

func sendWebhookPayload(ctx context.Context, cfg *emailWebhookConfig, to, subject, body string) error {
	payload, err := buildWebhookPayload(cfg, to, subject, body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, cfg.URL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if err := applyWebhookAuth(req, cfg, payload); err != nil {
		return err
	}
	client := &http.Client{
		Timeout: time.Duration(cfg.TimeoutSeconds) * time.Second,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		slog.Error("webhook delivery failed", "logger", emailWebhookLogName, "error", err)
		return fmt.Errorf("webhook delivery failed: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("webhook delivery failed: status %d", resp.StatusCode)
	}
	if cfg.PayloadFormat == WebhookPayloadFormatFeishu {
		if err := checkFeishuWebhookResponse(respBody); err != nil {
			return err
		}
	}
	return nil
}

func buildWebhookPayload(cfg *emailWebhookConfig, to, subject, body string) ([]byte, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	if cfg.PayloadFormat == WebhookPayloadFormatFeishu {
		return buildFeishuWebhookPayload(cfg, subject, body, now)
	}
	return json.Marshal(map[string]any{
		"event":     "email.message",
		"to":        to,
		"subject":   subject,
		"html":      body,
		"timestamp": now,
	})
}

func buildFeishuWebhookPayload(cfg *emailWebhookConfig, subject, body, timestamp string) ([]byte, error) {
	textBody := htmlToText(body)
	content := strings.TrimSpace(fmt.Sprintf("%s\n\n%s", subject, textBody))
	payload := map[string]any{
		"msg_type": "text",
		"content": map[string]string{
			"text": content,
		},
	}
	if cfg.AuthMode == WebhookAuthModeFeishuSignature {
		unix := strconv.FormatInt(time.Now().Unix(), 10)
		payload["timestamp"] = unix
		payload["sign"] = feishuWebhookSign(unix, cfg.Secret)
	} else {
		payload["timestamp"] = timestamp
	}
	return json.Marshal(payload)
}

func htmlToText(value string) string {
	text := htmlTagPattern.ReplaceAllString(value, " ")
	text = html.UnescapeString(text)
	return strings.Join(strings.Fields(text), " ")
}

func applyWebhookAuth(req *http.Request, cfg *emailWebhookConfig, payload []byte) error {
	switch cfg.AuthMode {
	case WebhookAuthModeBearer:
		req.Header.Set("Authorization", "Bearer "+cfg.Secret)
	case WebhookAuthModeHeader:
		req.Header.Set(cfg.AuthHeader, cfg.Secret)
	case WebhookAuthModeSignature:
		timestamp := strconv.FormatInt(time.Now().Unix(), 10)
		sig := genericWebhookSign(timestamp, payload, cfg.Secret)
		req.Header.Set("X-Sub2API-Timestamp", timestamp)
		req.Header.Set("X-Sub2API-Signature", "sha256="+sig)
	}
	return nil
}

func genericWebhookSign(timestamp string, payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	message := make([]byte, 0, len(timestamp)+1+len(payload))
	message = append(message, timestamp...)
	message = append(message, '.')
	message = append(message, payload...)
	_, _ = mac.Write(message)
	return hex.EncodeToString(mac.Sum(nil))
}

func feishuWebhookSign(timestamp string, secret string) string {
	mac := hmac.New(sha256.New, []byte(timestamp+"\n"+secret))
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}

func checkFeishuWebhookResponse(body []byte) error {
	if len(bytes.TrimSpace(body)) == 0 {
		return nil
	}
	var resp struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil
	}
	if resp.Code != 0 {
		if strings.TrimSpace(resp.Msg) != "" {
			return fmt.Errorf("feishu webhook delivery failed: code %d: %s", resp.Code, resp.Msg)
		}
		return fmt.Errorf("feishu webhook delivery failed: code %d", resp.Code)
	}
	return nil
}
