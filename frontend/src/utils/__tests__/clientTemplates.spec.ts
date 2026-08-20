import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildCcsImportDeeplink,
  buildClientTemplateContext,
  buildShellTemplateContext,
  loadStaticClientTemplatesConfig,
  normalizeClientTemplatesConfig,
  resolveClientTemplatesConfig,
  renderTemplateString,
  resetStaticClientTemplatesCache,
  resolveBaseUrls
} from '../clientTemplates'

describe('clientTemplates', () => {
  beforeEach(() => {
    resetStaticClientTemplatesCache()
  })

  it('renders supported placeholder styles and preserves unknown placeholders', () => {
    expect(
      renderTemplateString('base=${baseUrl}; key={{ apiKey }}; missing=${missing}', {
        baseUrl: 'https://example.com',
        apiKey: 'sk-test'
      })
    ).toBe('base=https://example.com; key=sk-test; missing=${missing}')
  })

  it('renders one env template into a pasteable command for every shell', () => {
    const envTemplate = '${envSetPrefix}SUB2API_KEY=${envQuote}${apiKey}${envQuote}'
    const pathTemplate = '${configDir}${pathSep}config.toml'
    const render = (shell: string) => {
      const context = {
        ...buildShellTemplateContext(shell),
        apiKey: 'sk-test',
        configDir: shell === 'unix' ? '~/.codex' : '%userprofile%\\.codex'
      }
      return {
        label: context.shellLabel,
        env: renderTemplateString(envTemplate, context),
        path: renderTemplateString(pathTemplate, context)
      }
    }

    expect(render('unix')).toEqual({
      label: 'Terminal',
      env: 'export SUB2API_KEY="sk-test"',
      path: '~/.codex/config.toml'
    })
    expect(render('cmd')).toEqual({
      label: 'Command Prompt',
      env: 'set SUB2API_KEY=sk-test',
      path: '%userprofile%\\.codex\\config.toml'
    })
    expect(render('powershell')).toEqual({
      label: 'PowerShell',
      env: '$env:SUB2API_KEY="sk-test"',
      path: '%userprofile%\\.codex\\config.toml'
    })
    // The Codex-style tab strip only exposes a single "Windows" tab.
    expect(render('windows')).toEqual(render('powershell'))
    // Unknown/absent shell must stay on the POSIX defaults.
    expect(buildShellTemplateContext('')).toEqual(buildShellTemplateContext('unix'))
  })

  it('exposes shell placeholders through the template context builder', () => {
    expect(buildClientTemplateContext({
      rawBaseUrl: 'https://example.com/v1',
      apiKey: 'sk-test',
      shell: 'windows'
    })).toMatchObject({
      shellLabel: 'PowerShell',
      envSetPrefix: '$env:',
      envQuote: '"',
      pathSep: '\\'
    })
  })

  it('builds ccs deeplink from template params and encodes usage script', () => {
    const { baseUrl, baseRoot, apiBase } = resolveBaseUrls('https://example.com/v1')
    const deeplink = buildCcsImportDeeplink(
      {
        params: {
          endpoint: '${apiBase}',
          usageScript: 'console.log("${apiKey}")'
        }
      },
      {
        resource: 'provider',
        app: 'codex',
        name: 'sub2api',
        homepage: baseUrl,
        endpoint: baseUrl,
        apiKey: 'sk-test',
        configFormat: 'json',
        usageEnabled: 'true',
        usageScript: 'console.log("default")',
        usageAutoInterval: '30'
      },
      {
        apiBase,
        apiKey: 'sk-test',
        baseRoot,
        baseUrl
      }
    )

    expect(deeplink.startsWith('ccswitch://v1/import?')).toBe(true)

    const params = new URLSearchParams(deeplink.split('?')[1])
    expect(params.get('endpoint')).toBe('https://example.com/v1')
    expect(params.get('usageScript')).toBe('Y29uc29sZS5sb2coInNrLXRlc3QiKQ==')
  })

  it('normalizes nested client_templates payloads from static files', () => {
    expect(
      normalizeClientTemplatesConfig({
        client_templates: {
          codex: {
            files: [{ path: 'config.toml', content: 'base_url = "${baseUrl}"' }]
          }
        }
      })
    ).toEqual({
      codex: {
        files: [{ path: 'config.toml', content: 'base_url = "${baseUrl}"' }]
      }
    })
  })

  it('accepts payloads that only define the grok_codex section', () => {
    expect(
      normalizeClientTemplatesConfig({
        client_templates: {
          grok_codex: {
            files: [{ path: '${configDir}/config.toml', content: 'model = "grok-4.6"' }]
          }
        }
      })
    ).toEqual({
      grok_codex: {
        files: [{ path: '${configDir}/config.toml', content: 'model = "grok-4.6"' }]
      }
    })
  })

  it.each(['openai_opencode', 'grok_opencode', 'zhipu_opencode'])(
    'accepts payloads that only define the %s section',
    (section) => {
      const payload = {
        [section]: {
          files: [{ path: 'opencode.json', content: '{"apiKey":"${apiKey}"}' }]
        }
      }

      expect(
        normalizeClientTemplatesConfig({ client_templates: payload })
      ).toEqual(payload)
    }
  )

  it('loads static client templates from the template runtime path', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        client_templates: {
          opencode: {
            files: [{ path: 'opencode.json', content: '{"apiKey":"${apiKey}"}' }]
          }
        }
      })
    })

    await expect(loadStaticClientTemplatesConfig(fetchImpl as typeof fetch)).resolves.toEqual({
      opencode: {
        files: [{ path: 'opencode.json', content: '{"apiKey":"${apiKey}"}' }]
      }
    })
    expect(fetchImpl).toHaveBeenCalledWith('/template/client-templates.json', { cache: 'no-store' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('falls back to the legacy runtime path when the template path is missing', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          client_templates: {
            codex: {
              files: [{ path: 'config.toml', content: 'legacy' }]
            }
          }
        })
      })

    await expect(loadStaticClientTemplatesConfig(fetchImpl as typeof fetch)).resolves.toEqual({
      codex: {
        files: [{ path: 'config.toml', content: 'legacy' }]
      }
    })
    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/template/client-templates.json', { cache: 'no-store' })
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/client-templates.json', { cache: 'no-store' })
  })

  it('prefers public settings over injected and static template sources', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        client_templates: {
          codex: {
            files: [{ path: 'static.toml', content: 'static' }]
          }
        }
      })
    })

    await expect(resolveClientTemplatesConfig({
      publicSettings: {
        client_templates: {
          opencode: {
            files: [{ path: 'public.json', content: 'public' }]
          }
        }
      },
      injectedConfig: {
        client_templates: {
          codex: {
            files: [{ path: 'injected.toml', content: 'injected' }]
          }
        }
      },
      fetchImpl: fetchImpl as typeof fetch
    })).resolves.toEqual({
      opencode: {
        files: [{ path: 'public.json', content: 'public' }]
      }
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
