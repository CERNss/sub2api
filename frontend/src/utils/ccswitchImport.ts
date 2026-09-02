import type { GroupPlatform } from '@/types'
import { encodeBase64Utf8 } from '@/utils/clientTemplates'

export const OPENAI_CC_SWITCH_CODEX_MODEL = 'gpt-5.5'
export const GROK_CC_SWITCH_MODEL = 'grok-4.6'
export const ZHIPU_CC_SWITCH_MODEL = 'glm-5.3'
// Context window advertised to every GLM client setup (Claude Code env,
// OpenCode catalog, CC Switch import). Operator decision: the GLM group is
// served with a 1M window, so all import paths must agree on it or Claude Code
// will auto-compact at its 200k default long before the real limit.
export const ZHIPU_CONTEXT_WINDOW_TOKENS = 1_000_000

export type CcSwitchClientType = 'claude' | 'gemini'

export interface CcSwitchImportConfig {
  app: string
  endpoint: string
  model?: string
  // Extra Claude settings env carried through the deeplink's inline `config`
  // payload (base64 JSON, `configFormat=json`). CC Switch merges it under the
  // URL params and keeps non-standard keys as-is, which is the only way an
  // import can set CLAUDE_CODE_MAX_CONTEXT_TOKENS or the subagent/fable pins.
  env?: Record<string, string>
}

export interface CcSwitchImportDeeplinkInput {
  baseUrl: string
  platform?: GroupPlatform | null
  clientType: CcSwitchClientType
  providerName: string
  apiKey: string
  usageScript: string
}

// Same env the "use key" modal hands out for GLM Claude Code setups, so a
// one-click import and a pasted settings.json land on identical behavior:
// every model slot pinned to the GLM model, the 1M window, and the two
// Claude Code switches that make sense against a third-party gateway.
export function buildZhipuClaudeImportEnv(): Record<string, string> {
  return {
    ANTHROPIC_MODEL: ZHIPU_CC_SWITCH_MODEL,
    ANTHROPIC_DEFAULT_OPUS_MODEL: ZHIPU_CC_SWITCH_MODEL,
    ANTHROPIC_DEFAULT_SONNET_MODEL: ZHIPU_CC_SWITCH_MODEL,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: ZHIPU_CC_SWITCH_MODEL,
    ANTHROPIC_DEFAULT_FABLE_MODEL: ZHIPU_CC_SWITCH_MODEL,
    CLAUDE_CODE_SUBAGENT_MODEL: ZHIPU_CC_SWITCH_MODEL,
    CLAUDE_CODE_MAX_CONTEXT_TOKENS: String(ZHIPU_CONTEXT_WINDOW_TOKENS),
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0'
  }
}

// CC Switch reads `config` as base64 JSON shaped like Claude's settings.json.
export function encodeCcSwitchInlineConfig(env: Record<string, string>): string {
  return encodeBase64Utf8(JSON.stringify({ env }))
}

function withV1Endpoint(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  return normalizedBaseUrl.endsWith('/v1') ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`
}

export function resolveCcSwitchImportConfig(
  platform: GroupPlatform | undefined | null,
  clientType: CcSwitchClientType,
  baseUrl: string
): CcSwitchImportConfig {
  switch (platform || 'anthropic') {
    case 'antigravity':
      return {
        app: clientType === 'gemini' ? 'gemini' : 'claude',
        endpoint: `${baseUrl}/antigravity`
      }
    case 'openai':
      return {
        app: 'codex',
        endpoint: baseUrl,
        model: OPENAI_CC_SWITCH_CODEX_MODEL
      }
    case 'gemini':
      return {
        app: 'gemini',
        endpoint: baseUrl
      }
    case 'grok':
      return {
        app: 'grokbuild',
        endpoint: withV1Endpoint(baseUrl),
        model: GROK_CC_SWITCH_MODEL
      }
    case 'zhipu':
      // Claude-type import: model becomes ANTHROPIC_MODEL so the imported
      // provider pins its own GLM model instead of relying on upstream mapping.
      return {
        app: 'claude',
        endpoint: baseUrl,
        model: ZHIPU_CC_SWITCH_MODEL,
        env: buildZhipuClaudeImportEnv()
      }
    default:
      return {
        app: 'claude',
        endpoint: baseUrl
      }
  }
}

export function buildCcSwitchImportDeeplink(input: CcSwitchImportDeeplinkInput): string {
  const config = resolveCcSwitchImportConfig(input.platform, input.clientType, input.baseUrl)
  const entries: [string, string][] = [
    ['resource', 'provider'],
    ['app', config.app],
    ['name', input.providerName],
    ['homepage', input.baseUrl],
    ['endpoint', config.endpoint],
    ['apiKey', input.apiKey],
    ['configFormat', 'json'],
    ['usageEnabled', 'true'],
    ['usageScript', btoa(input.usageScript)],
    ['usageAutoInterval', '30']
  ]

  if (config.model) {
    entries.splice(2, 0, ['model', config.model])
  }
  if (config.env) {
    entries.push(['config', encodeCcSwitchInlineConfig(config.env)])
  }

  return `ccswitch://v1/import?${new URLSearchParams(entries).toString()}`
}
