import type { ClientTemplateFile, ClientTemplatesConfig, CcsImportTemplateConfig } from '@/types'

export interface TemplateContext {
  [key: string]: string
}

export interface ResolvedBaseUrls {
  baseUrl: string
  baseRoot: string
  apiBase: string
  geminiBase: string
  antigravityBase: string
  antigravityGeminiBase: string
}

const STATIC_CLIENT_TEMPLATES_PATH = '/client-templates.json'
let staticClientTemplatesPromise: Promise<ClientTemplatesConfig | null> | null = null

const TEMPLATE_PATTERNS = [
  /\$\{([a-zA-Z0-9_]+)\}/g,
  /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeClientTemplatesConfig(payload: unknown): ClientTemplatesConfig | null {
  if (!isRecord(payload)) return null

  const candidate = isRecord(payload.client_templates) ? payload.client_templates : payload
  const hasKnownSection = ['codex', 'opencode', 'ccs_import'].some((key) =>
    Object.prototype.hasOwnProperty.call(candidate, key)
  )

  return hasKnownSection ? candidate as ClientTemplatesConfig : null
}

export async function loadStaticClientTemplatesConfig(
  fetchImpl: typeof fetch = fetch
): Promise<ClientTemplatesConfig | null> {
  if (staticClientTemplatesPromise) {
    return staticClientTemplatesPromise
  }

  staticClientTemplatesPromise = (async () => {
    try {
      const response = await fetchImpl(STATIC_CLIENT_TEMPLATES_PATH, {
        cache: 'no-store'
      })

      if (response.status === 404) {
        return null
      }
      if (!response.ok) {
        console.warn('[clientTemplates] Failed to load static templates:', response.status, response.statusText)
        return null
      }

      const payload = await response.json()
      const normalized = normalizeClientTemplatesConfig(payload)
      if (!normalized && payload) {
        console.warn('[clientTemplates] Ignoring invalid static template payload from', STATIC_CLIENT_TEMPLATES_PATH)
      }
      return normalized
    } catch (error) {
      console.warn('[clientTemplates] Failed to load static templates:', error)
      return null
    }
  })()

  return staticClientTemplatesPromise
}

export function resetStaticClientTemplatesCache(): void {
  staticClientTemplatesPromise = null
}

function hasTemplateValue(context: TemplateContext, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(context, key)
}

export function renderTemplateString(template: string, context: TemplateContext): string {
  return TEMPLATE_PATTERNS.reduce(
    (result, pattern) =>
      result.replace(pattern, (match, key: string) => (hasTemplateValue(context, key) ? context[key] : match)),
    template
  )
}

export function renderTemplateFiles(
  files: ClientTemplateFile[] | undefined,
  context: TemplateContext
): ClientTemplateFile[] {
  if (!files?.length) return []

  return files.map((file) => ({
    path: renderTemplateString(file.path, context),
    content: renderTemplateString(file.content, context),
    hint: file.hint ? renderTemplateString(file.hint, context) : undefined
  }))
}

function ensureSuffix(value: string, suffix: string): string {
  const trimmed = value.replace(/\/+$/, '')
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`
}

export function resolveBaseUrls(rawBaseUrl: string): ResolvedBaseUrls {
  const baseUrl = rawBaseUrl || window.location.origin
  const baseRoot = baseUrl.replace(/\/v1\/?$/, '').replace(/\/+$/, '')

  return {
    baseUrl,
    baseRoot,
    apiBase: ensureSuffix(baseRoot, '/v1'),
    geminiBase: ensureSuffix(baseRoot, '/v1beta'),
    antigravityBase: ensureSuffix(`${baseRoot}/antigravity`, '/v1'),
    antigravityGeminiBase: ensureSuffix(`${baseRoot}/antigravity`, '/v1beta')
  }
}

function encodeBase64Utf8(value: string): string {
  if (typeof btoa === 'function') {
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte)
    })
    return btoa(binary)
  }

  return value
}

export function buildCcsImportDeeplink(
  template: CcsImportTemplateConfig | undefined,
  defaults: Record<string, string>,
  context: TemplateContext
): string {
  const params = new URLSearchParams()
  const renderedTemplateParams = Object.fromEntries(
    Object.entries(template?.params ?? {}).map(([key, value]) => [key, renderTemplateString(value, context)])
  )

  const mergedParams: Record<string, string> = {
    ...defaults,
    ...renderedTemplateParams
  }

  if (mergedParams.usageScript) {
    mergedParams.usageScript = encodeBase64Utf8(mergedParams.usageScript)
  }

  Object.entries(mergedParams).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, value)
    }
  })

  const deeplinkBase = renderTemplateString(template?.base || 'ccswitch://v1/import', context)
  return `${deeplinkBase}?${params.toString()}`
}
