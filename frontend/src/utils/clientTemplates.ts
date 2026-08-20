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

interface ClientTemplatesSource {
  client_templates?: unknown
}

interface ResolveClientTemplatesOptions {
  publicSettings?: ClientTemplatesSource | null
  cachedPublicSettings?: ClientTemplatesSource | null
  injectedConfig?: ClientTemplatesSource | null
  fetchImpl?: typeof fetch
}

interface BuildTemplateContextOptions {
  rawBaseUrl: string
  apiKey: string
  configDir?: string
  endpoint?: string
  app?: string
  platform?: string
  clientType?: string
  providerName?: string
  /** Active shell tab id: 'unix' | 'cmd' | 'powershell' | 'windows'. */
  shell?: string
}

const STATIC_CLIENT_TEMPLATES_PATHS = ['/template/client-templates.json', '/client-templates.json']
let staticClientTemplatesPromise: Promise<ClientTemplatesConfig | null> | null = null

const TEMPLATE_PATTERNS = [
  /\$\{([a-zA-Z0-9_]+)\}/g,
  /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEmptyRecord(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0
}

export function normalizeClientTemplatesConfig(payload: unknown): ClientTemplatesConfig | null {
  if (!isRecord(payload)) return null

  const candidate = isRecord(payload.client_templates) ? payload.client_templates : payload
  const hasKnownSection = [
    'codex',
    'grok_codex',
    'opencode',
    'openai_opencode',
    'grok_opencode',
    'zhipu_opencode',
    'ccs_import'
  ].some((key) =>
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
    for (const path of STATIC_CLIENT_TEMPLATES_PATHS) {
      try {
        const response = await fetchImpl(path, {
          cache: 'no-store'
        })

        if (response.status === 404) {
          continue
        }
        if (!response.ok) {
          console.warn('[clientTemplates] Failed to load static templates:', path, response.status, response.statusText)
          continue
        }

        const payload = await response.json()
        const normalized = normalizeClientTemplatesConfig(payload)
        if (!normalized && payload && !isEmptyRecord(payload)) {
          console.warn('[clientTemplates] Ignoring invalid static template payload from', path)
        }
        if (normalized) {
          return normalized
        }
      } catch (error) {
        console.warn('[clientTemplates] Failed to load static templates:', path, error)
      }
    }

    return null
  })()

  return staticClientTemplatesPromise
}

export function resetStaticClientTemplatesCache(): void {
  staticClientTemplatesPromise = null
}

export async function resolveClientTemplatesConfig({
  publicSettings,
  cachedPublicSettings,
  injectedConfig,
  fetchImpl
}: ResolveClientTemplatesOptions = {}): Promise<ClientTemplatesConfig | null> {
  const preferredSources = [
    publicSettings?.client_templates,
    cachedPublicSettings?.client_templates,
    injectedConfig?.client_templates
  ]

  for (const source of preferredSources) {
    const normalized = normalizeClientTemplatesConfig(source)
    if (normalized) {
      return normalized
    }
  }

  return loadStaticClientTemplatesConfig(fetchImpl)
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

/**
 * Shell-aware placeholders.
 *
 * A template's `files` list is rendered once, for whichever shell tab is active,
 * so a hardcoded `export FOO="bar"` inside a template leaks a POSIX-only command
 * into the Windows tabs. Two alternatives were rejected: duplicating every file
 * per shell (template authors would have to repeat the whole list, and the
 * renderer would need a path-matching filter rule), and a single all-in-one
 * `${envSetCommand}` placeholder (the `${...}` syntax takes no arguments, so it
 * could not carry the variable name). Instead we expose small primitives that
 * compose into a pasteable command for any variable name:
 *
 *   `${envSetPrefix}FOO=${envQuote}bar${envQuote}`
 *     unix                -> export FOO="bar"
 *     windows/powershell  -> $env:FOO="bar"
 *     cmd                 -> set FOO=bar
 *
 * `envSetPrefix` carries the trailing space where the shell needs one; `envQuote`
 * is empty on cmd, where quotes would become part of the value.
 */
export function buildShellTemplateContext(shell: string): TemplateContext {
  switch (shell) {
    case 'cmd':
      return { shellLabel: 'Command Prompt', envSetPrefix: 'set ', envQuote: '', pathSep: '\\' }
    case 'powershell':
    case 'windows':
      // Codex-style tabs only offer a single "Windows" tab; PowerShell is its default shell.
      return { shellLabel: 'PowerShell', envSetPrefix: '$env:', envQuote: '"', pathSep: '\\' }
    default:
      return { shellLabel: 'Terminal', envSetPrefix: 'export ', envQuote: '"', pathSep: '/' }
  }
}

export function buildClientTemplateContext({
  rawBaseUrl,
  apiKey,
  configDir = '',
  endpoint,
  app = '',
  platform = '',
  clientType = '',
  providerName = '',
  shell = ''
}: BuildTemplateContextOptions): TemplateContext {
  const urls = resolveBaseUrls(rawBaseUrl)

  return {
    ...urls,
    ...buildShellTemplateContext(shell),
    apiKey,
    configDir,
    endpoint: endpoint ?? urls.apiBase,
    app,
    platform,
    clientType,
    providerName
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
