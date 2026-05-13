import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildCcsImportDeeplink,
  loadStaticClientTemplatesConfig,
  normalizeClientTemplatesConfig,
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

  it('loads static client templates from the built-in runtime file', async () => {
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
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
