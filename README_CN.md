# Sub2API

<div align="center">

[![Go](https://img.shields.io/badge/Go-1.25.7-00ADD8.svg)](https://golang.org/)
[![Vue](https://img.shields.io/badge/Vue-3.4+-4FC08D.svg)](https://vuejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7+-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](https://www.docker.com/)

**AI API 网关平台 - 订阅配额分发管理**

[English](README.md) | 中文

</div>

> Sub2API 官方仅使用 `sub2api.org` 与 `pincc.ai` 两个域名。其他使用 Sub2API 名义的网站可能为第三方部署或服务，与本项目无关。

## 项目概述

Sub2API 用于分发和管理 AI 产品订阅的 API 配额。用户通过平台生成的 API Key 调用上游 AI 服务，平台负责鉴权、计费、调度、并发控制、速率限制和请求转发。

## 核心功能

- **多账号管理** - 支持 OAuth、API Key 等上游账号类型。
- **API Key 分发** - 为用户生成和管理对外调用密钥。
- **精确计费** - Token 级别追踪用量和成本。
- **智能调度** - 支持上游账号选择和粘性会话。
- **并发与速率限制** - 支持用户级和账号级请求控制。
- **内置支付系统** - 支持 EasyPay 易支付、支付宝官方、微信官方、Stripe。详见 [支付配置](docs/PAYMENT_CN.md)。
- **管理后台** - 提供 Web 运维、监控、设置和外部 iframe 集成能力。

## 新增功能

### OIDC 本地邮箱验证控制

管理员可以保留默认的安全策略，即待处理 OIDC 创建账号仍要求本地邮箱验证码；也可以在上游 OIDC 已提供可信、已验证、非合成的 `compat_email` 时关闭这一步重复验证。

后端会在待处理 OIDC completion 响应中返回 `local_email_verification_required`。前端仅在当前表单邮箱仍等于可信 OIDC 邮箱时隐藏验证码控件；用户修改邮箱后，本地验证会立即恢复。

### 待处理 OAuth 账号流程优化

OIDC、LinuxDo、微信回调页现在会结合 state 与 bindability hints 解析待处理账号动作。当没有可绑定的既有账号且允许创建账号时，新用户会直接进入创建账号流程，不再展示多余的绑定/创建选择页。

### OAuth 邮箱预填优化

待处理 OAuth 的创建账号和绑定登录表单会优先使用更适合用户识别的邮箱，包括 `pending_email`、`existing_account_email` 和 `compat_email`，再回退到 provider 特定字段。当存在更好邮箱时，会避免展示合成的 provider fallback 邮箱。

## OpenSpec 参考

本 README 摘要基于以下 OpenSpec 变更：

- [OIDC 本地邮箱验证控制](openspec/changes/control-oidc-local-email-verification/proposal.md)
- [待处理 OAuth 账号解析优化](openspec/changes/refine-pending-oauth-account-resolution/proposal.md)

## 技术栈

| 组件 | 技术 |
|------|------|
| 后端 | Go 1.25.7, Gin, Ent |
| 前端 | Vue 3.4+, Vite 5+, TailwindCSS |
| 数据库 | PostgreSQL 15+ |
| 缓存/队列 | Redis 7+ |

## 许可证

本项目遵循 [LICENSE](LICENSE) 中的许可条款。
