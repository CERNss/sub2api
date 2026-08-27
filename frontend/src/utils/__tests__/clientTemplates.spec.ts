import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

// 挂载用模版文件（部署产物）的形态回归。前端单测平时只喂内联 fixture，
// 真正发给运营方去挂的是 template/client-templates.json —— 它一旦和内置生成器
// 走散，就会出现「挂了模版走 Responses、没挂走 chat」的分裂。这里直接读实文件钉死。
describe('shipped template/client-templates.json', () => {
  const shipped = JSON.parse(
    // vitest 的 root 是 frontend/，模版文件在仓库根的 template/ 下。
    readFileSync(resolve(process.cwd(), '..', 'template', 'client-templates.json'), 'utf-8')
  ).client_templates

  const grokOpenCode = JSON.parse(shipped.grok_opencode.files[0].content)
  const zhipuOpenCode = JSON.parse(shipped.zhipu_opencode.files[0].content)

  it('points grok_opencode at the Responses factory', () => {
    // @ai-sdk/openai 才说 Responses；openai-compatible 会退回 chat/completions。
    expect(grokOpenCode.provider.grok.npm).toBe('@ai-sdk/openai')
    // ${endpoint} 已以 /v1 结尾，工厂再拼 /responses，落 /v1/responses，不重复 /v1。
    expect(grokOpenCode.provider.grok.options.baseURL).toBe('${endpoint}')
  })

  it('flags grok_opencode reasoning models so OpenCode injects forceReasoning', () => {
    // AI SDK 按已知模型名单门控 reasoning，grok-4.6 不在名单；不标就静默丢 reasoning。
    for (const model of ['grok-4.6', 'grok-4.5']) {
      expect(grokOpenCode.provider.grok.models[model].reasoning).toBe(true)
    }
  })

  it('pins the xhigh effort variant on grok-4.6 only', () => {
    // 与 fork #8 配套：网关认 camelCase reasoningEffort，xhigh 白名单只有 grok-4.6。
    expect(grokOpenCode.provider.grok.models['grok-4.6'].options).toEqual({
      reasoningEffort: 'xhigh'
    })
    expect(grokOpenCode.provider.grok.models['grok-4.6'].variants).toEqual({
      xhigh: { reasoningEffort: 'xhigh' }
    })
    expect(grokOpenCode.provider.grok.models['grok-4.5'].options).toBeUndefined()
  })

  it('declares image input on every grok_opencode model', () => {
    // OpenCode 门控：model.modalities?.input?.includes('image') ?? base?.capabilities.input.image。
    // base 来自 models.dev，那边没有 `grok` provider（grok 系列挂在 `xai` 下），所以漏声明就是
    // 默认 false —— stripMedia 把图片换成 `[Attached image/png: …]` 一行文本，网关根本收不到图。
    // 只写 attachment:true 不够，门控读的是 modalities。
    const models = Object.entries(grokOpenCode.provider.grok.models)
    expect(models.length).toBeGreaterThan(0)
    for (const [id, model] of models) {
      expect(`${id}:${model.attachment}`).toBe(`${id}:true`)
      expect(model.modalities.input).toContain('image')
      // pdf 靠网关兜底：xAI 对 ZDR 号（本站 grok 全是订阅 OAuth 号）关了文件通道，
      // 直转 input_file 会 400；sanitizeGrokMessageContent 已把文件部件降级成文字备注，
      // 所以声明 pdf 只是让 OpenCode 别在客户端就把它剁成 [Attached …] 再发。
      expect(model.modalities.input).toContain('pdf')
    }
  })

  it('keeps zhipu_opencode on chat/completions for the raw keepalive path', () => {
    // fork #10 的保活只在 raw chat/completions 直转路径上，换 Responses 会丢保护。
    expect(zhipuOpenCode.provider.zhipu.npm).toBe('@ai-sdk/openai-compatible')
  })

  it('keeps zhipu_opencode text-only on purpose', () => {
    // GLM-5.x 文本档在 z.ai / models.dev(zhipuai) 上都是 input:["text"]；vision 走的是
    // glm-5v-turbo / glm-5.3-flash / glm-4.6v，本模版没收。显式写死免得被"照 grok 补齐"。
    for (const [, model] of Object.entries(zhipuOpenCode.provider.zhipu.models)) {
      expect(model.modalities.input).toEqual(['text'])
    }
  })
})
