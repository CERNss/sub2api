import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildCcsImportDeeplink,
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
