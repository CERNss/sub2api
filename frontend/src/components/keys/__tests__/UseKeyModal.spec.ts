import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const { copyToClipboardMock, saveAsMock } = vi.hoisted(() => ({
  copyToClipboardMock: vi.fn().mockResolvedValue(true),
  saveAsMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard: copyToClipboardMock
  })
}))

vi.mock('file-saver', () => ({
  saveAs: saveAsMock
}))

import UseKeyModal from '../UseKeyModal.vue'

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result || '')))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsText(blob)
  })
}

describe('UseKeyModal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    saveAsMock.mockClear()
  })

  it('omits the attribution override from every standard Claude Code setup form', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-anthropic-test',
        baseUrl: 'https://example.com/v1',
        platform: 'anthropic'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    for (const [shell, trafficSetting] of [
      ['macOS / Linux', 'export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1'],
      ['Windows CMD', 'set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1'],
      ['PowerShell', '$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1']
    ]) {
      if (shell !== 'macOS / Linux') {
        const shellTab = wrapper.findAll('button').find(
          (button) => button.text().trim() === shell
        )
        expect(shellTab).toBeDefined()
        await shellTab!.trigger('click')
        await nextTick()
      }

      const codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
      const allCode = codeBlocks.join('\n')
      const settings = JSON.parse(codeBlocks.find((content) => content.includes('"$schema"'))!)

      expect(allCode).not.toContain('CLAUDE_CODE_ATTRIBUTION_HEADER')
      expect(allCode).toContain(trafficSetting)
      expect(settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
      expect(settings.env).not.toHaveProperty('CLAUDE_CODE_ATTRIBUTION_HEADER')
    }
  })

  it('renders Grok Build and OpenCode setup for Grok groups', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const grokTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.grokCli')
    )
    expect(grokTab).toBeDefined()

    const allCode = wrapper.findAll('pre code').map((code) => code.text()).join('\n')
    expect(allCode).toContain('GROK_MODELS_BASE_URL')
    expect(allCode).toContain('XAI_API_KEY')
    expect(allCode).toContain('[model."grok-4.5"]')
    expect(allCode).toContain('[model."grok-build-0.1"]')
    expect(allCode).toContain('[model."grok-4.20-multi-agent-0309"]')
    expect(allCode).toContain('[model."grok-4.3"]')
    expect(allCode).toContain('default = "grok-4.5"')
    expect(allCode).toContain('models_base_url = "https://example.com/v1"')
    expect(allCode).toContain('models_list_url = "https://example.com/v1/models"')
    expect(allCode).toContain('xai_api_base_url = "https://example.com/v1"')
    expect(allCode).toContain('cli_chat_proxy_base_url = "https://example.com/v1"')
    expect(allCode).toContain('preferred_method = "api_key"')
    expect(allCode).toContain('image_description = "grok-4.5"')
    expect(allCode).toContain('auto_compact_threshold_percent = 80')
    expect(allCode).toContain('image_gen = true')
    expect(allCode).toContain('video_gen = true')
    expect(allCode).toContain('image_gen_model_override = "grok-imagine-image-quality"')
    expect(allCode).toContain('image_edit_model_override = "grok-imagine-edit"')
    expect(allCode).toContain('env_key = "XAI_API_KEY"')
    expect(allCode).toContain('Keep api_backend = "responses" on every model entry.')
    expect(allCode).toContain('grok-imagine-image')
    expect(allCode).toContain('grok-imagine-edit')
    expect(allCode).toMatch(/\[model\."grok-4\.5"\][\s\S]*?context_window = 500000/)
    expect(allCode).toMatch(/\[model\."grok-build-0\.1"\][\s\S]*?context_window = 256000/)
    // Prefer env_key; hardcode api_key only as commented alternative
    expect(allCode).not.toMatch(/^api_key = "sk-grok-test"$/m)

    const modelBlocks = allCode
      .split(/(?=^\[model\.)/m)
      .filter((block) => block.startsWith('[model."'))
    expect(modelBlocks.length).toBeGreaterThanOrEqual(4)
    for (const block of modelBlocks) {
      if (block.includes('# [model.')) continue
      expect(block).toContain('api_backend = "responses"')
    }

    const windowsTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'Windows'
    )
    expect(windowsTab).toBeDefined()
    await windowsTab!.trigger('click')
    await nextTick()
    expect(wrapper.text().toLowerCase()).toContain('%userprofile%\\.grok\\config.toml')

    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )
    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()

    const parsed = JSON.parse(wrapper.find('pre code').text())
    // Responses API：只有 @ai-sdk/openai 工厂说 Responses，openai-compatible 会退回
    // chat/completions 并让 grok 的 reasoning_effort 走不到 Responses 侧透传。
    expect(parsed.provider.grok.npm).toBe('@ai-sdk/openai')
    expect(parsed.provider.grok.name).toBe('Grok via Sub2API')
    expect(parsed.provider.grok.options).toEqual({
      baseURL: 'https://example.com/v1',
      apiKey: 'sk-grok-test'
    })
    expect(parsed.provider.grok.models['grok-4.5']).toBeDefined()
    expect(parsed.provider.grok.models['grok-4.5'].limit.context).toBe(500000)
    expect(parsed.provider.grok.models['grok-build-0.1']).toBeDefined()
    expect(parsed.provider.grok.models['grok-4.20-multi-agent-0309']).toBeDefined()
    expect(parsed.provider.grok.models['grok-composer-2.5-fast']).toBeDefined()
    expect(parsed.provider.grok.models['gpt-5.6']).toBeUndefined()

    // reasoning 标志：AI SDK 按已知模型名单门控 reasoning 参数，grok-4.6 不在名单，
    // OpenCode 只对显式标了 reasoning 的模型注入 forceReasoning 绕过（opencode#20815）。
    // 只标网关 grokSupportsReasoningEffort 认可的模型。
    expect(parsed.provider.grok.models['grok-4.6'].reasoning).toBe(true)
    expect(parsed.provider.grok.models['grok-4.5'].reasoning).toBe(true)
    expect(parsed.provider.grok.models['grok-4.3'].reasoning).toBe(true)
    expect(parsed.provider.grok.models['grok-4.20-multi-agent-0309'].reasoning).toBe(true)
    expect(parsed.provider.grok.models['grok-build-0.1'].reasoning).toBeUndefined()
    expect(parsed.provider.grok.models['grok-composer-2.5-fast'].reasoning).toBeUndefined()

    // fork #8 xhigh 透传配套：网关认 camelCase reasoningEffort，xhigh 白名单只有 4.6。
    expect(parsed.provider.grok.models['grok-4.6'].options).toEqual({ reasoningEffort: 'xhigh' })
    expect(parsed.provider.grok.models['grok-4.6'].variants).toEqual({
      xhigh: { reasoningEffort: 'xhigh' }
    })
    expect(parsed.provider.grok.models['grok-4.5'].options).toBeUndefined()

    // 图片输入：OpenCode 的门控是
    // model.modalities?.input?.includes('image') ?? base?.capabilities.input.image ?? false，
    // base 取自 models.dev —— 那边没有 `grok` provider（grok 系列挂 `xai` 下），
    // 不显式声明就落 false，stripMedia 会把图换成 `[Attached image/png: …]` 一行文本，
    // 网关端连图都收不到。只写 attachment:true 不管用，门控读的是 modalities。
    for (const id of [
      'grok-4.6',
      'grok-4.5',
      'grok-4.3',
      'grok-build-0.1',
      'grok-4.20-multi-agent-0309',
      'grok-composer-2.5-fast'
    ]) {
      expect(parsed.provider.grok.models[id].attachment).toBe(true)
      expect(parsed.provider.grok.models[id].modalities.input).toContain('image')
    }
  })

  it('pins every Claude Code model slot to glm-5.3 for zhipu groups', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-zhipu-claude-test',
        baseUrl: 'https://example.com/v1',
        platform: 'zhipu'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    // zhipu defaults to the Claude Code tab, so the unix shell config renders first.
    let codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    const unixConfig = codeBlocks.find((content) => content.startsWith('export ANTHROPIC_BASE_URL'))
    expect(unixConfig).toBeDefined()
    expect(unixConfig).toContain('export ANTHROPIC_BASE_URL="https://example.com"')
    expect(unixConfig).toContain('export ANTHROPIC_AUTH_TOKEN="sk-zhipu-claude-test"')
    for (const name of [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_FABLE_MODEL',
      'CLAUDE_CODE_SUBAGENT_MODEL'
    ]) {
      expect(unixConfig).toContain(`export ${name}="glm-5.3"`)
    }
    expect(unixConfig).toContain('export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"')
    // Upstream v0.2.0 (c03776604) stopped disabling the attribution header for every
    // Claude Code template; the pinned GLM template follows the same contract.
    expect(unixConfig).not.toContain('CLAUDE_CODE_ATTRIBUTION_HEADER')
    expect(unixConfig).toContain('export CLAUDE_CODE_MAX_CONTEXT_TOKENS="1000000"')

    const settingsConfig = codeBlocks.find((content) => content.includes('"$schema"'))
    expect(settingsConfig).toBeDefined()
    const parsedSettings = JSON.parse(settingsConfig!)
    expect(parsedSettings.$schema).toBe('https://json.schemastore.org/claude-code-settings.json')
    expect(parsedSettings.env.ANTHROPIC_BASE_URL).toBe('https://example.com')
    expect(parsedSettings.env.ANTHROPIC_MODEL).toBe('glm-5.3')
    expect(parsedSettings.env.ANTHROPIC_DEFAULT_HAIKU_MODEL).toBe('glm-5.3')
    expect(parsedSettings.env.CLAUDE_CODE_SUBAGENT_MODEL).toBe('glm-5.3')
    expect(parsedSettings.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS).toBe('1000000')
    expect(wrapper.text()).toContain('keys.useKeyModal.zhipu.claudeDescription')
    expect(wrapper.text()).toContain('keys.useKeyModal.zhipu.claudeNote')

    const cmdTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'Windows CMD'
    )
    expect(cmdTab).toBeDefined()
    await cmdTab!.trigger('click')
    await nextTick()
    codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    expect(codeBlocks.join('\n')).toContain('set ANTHROPIC_MODEL=glm-5.3')
    expect(codeBlocks.join('\n')).toContain('set CLAUDE_CODE_SUBAGENT_MODEL=glm-5.3')

    const powershellTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'PowerShell'
    )
    expect(powershellTab).toBeDefined()
    await powershellTab!.trigger('click')
    await nextTick()
    codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    expect(codeBlocks.join('\n')).toContain('$env:ANTHROPIC_MODEL="glm-5.3"')
    expect(codeBlocks.join('\n')).toContain('$env:ANTHROPIC_DEFAULT_FABLE_MODEL="glm-5.3"')
    expect(wrapper.text()).toContain('%USERPROFILE%\\.claude\\settings.json')
  })

  it('renders copyable Claude Code setup through the Grok Messages gateway', async () => {
    copyToClipboardMock.mockClear()
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-claude-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const claudeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.claudeCode')
    )
    expect(claudeTab).toBeDefined()
    await claudeTab!.trigger('click')
    await nextTick()

    let codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    expect(codeBlocks.join('\n')).toContain('ANTHROPIC_BASE_URL="https://example.com"')
    expect(codeBlocks.join('\n')).toContain('ANTHROPIC_AUTH_TOKEN="sk-grok-claude-test"')
    const unixConfig = codeBlocks.find((content) => content.startsWith('export ANTHROPIC_BASE_URL'))
    expect(unixConfig).toBeDefined()
    for (const name of [
      'ANTHROPIC_MODEL',
      'ANTHROPIC_DEFAULT_OPUS_MODEL',
      'ANTHROPIC_DEFAULT_SONNET_MODEL',
      'ANTHROPIC_DEFAULT_HAIKU_MODEL',
      'ANTHROPIC_DEFAULT_FABLE_MODEL',
      'CLAUDE_CODE_SUBAGENT_MODEL'
    ]) {
      expect(unixConfig).toContain(`export ${name}="grok-4.5"`)
    }
    const settingsConfig = codeBlocks.find((content) => content.includes('"$schema"'))
    expect(settingsConfig).toBeDefined()
    const parsedSettings = JSON.parse(settingsConfig!)
    expect(parsedSettings.$schema).toBe('https://json.schemastore.org/claude-code-settings.json')
    expect(parsedSettings.env.ANTHROPIC_MODEL).toBe('grok-4.5')
    expect(codeBlocks.join('\n')).not.toContain('CLAUDE_CODE_ATTRIBUTION_HEADER')
    expect(codeBlocks.join('\n')).toContain('CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')
    expect(parsedSettings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
    expect(parsedSettings.env).not.toHaveProperty('CLAUDE_CODE_ATTRIBUTION_HEADER')
    expect(parsedSettings.env.CLAUDE_CODE_MAX_CONTEXT_TOKENS).toBeUndefined()
    expect(wrapper.text()).toContain('keys.useKeyModal.claudeSettingsHint')
    expect(wrapper.text()).toContain('keys.useKeyModal.grok.claudeNote')
    expect(wrapper.find('nav[aria-label="Client"]').classes()).toContain('min-w-max')
    expect(wrapper.find('nav[aria-label="Client"]').element.parentElement?.classList.contains('overflow-x-auto')).toBe(true)

    const cmdTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'Windows CMD'
    )
    expect(cmdTab).toBeDefined()
    await cmdTab!.trigger('click')
    await nextTick()

    codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    expect(codeBlocks.join('\n')).toContain('set ANTHROPIC_MODEL=grok-4.5')
    expect(codeBlocks.join('\n')).toContain('set ANTHROPIC_DEFAULT_FABLE_MODEL=grok-4.5')
    expect(codeBlocks.join('\n')).toContain('set CLAUDE_CODE_SUBAGENT_MODEL=grok-4.5')
    expect(codeBlocks.join('\n')).toContain('set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1')
    expect(codeBlocks.join('\n')).not.toContain('CLAUDE_CODE_ATTRIBUTION_HEADER')
    const cmdSettings = JSON.parse(codeBlocks.find((content) => content.includes('"$schema"'))!)
    expect(cmdSettings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
    expect(cmdSettings.env).not.toHaveProperty('CLAUDE_CODE_ATTRIBUTION_HEADER')

    const powershellTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'PowerShell'
    )
    expect(powershellTab).toBeDefined()
    await powershellTab!.trigger('click')
    await nextTick()

    codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    expect(codeBlocks.join('\n')).toContain('$env:ANTHROPIC_BASE_URL="https://example.com"')
    expect(codeBlocks.join('\n')).toContain('$env:ANTHROPIC_MODEL="grok-4.5"')
    expect(codeBlocks.join('\n')).toContain('$env:ANTHROPIC_DEFAULT_FABLE_MODEL="grok-4.5"')
    expect(codeBlocks.join('\n')).toContain('$env:CLAUDE_CODE_SUBAGENT_MODEL="grok-4.5"')
    expect(codeBlocks.join('\n')).toContain('$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="1"')
    expect(codeBlocks.join('\n')).not.toContain('CLAUDE_CODE_ATTRIBUTION_HEADER')
    const powershellSettings = JSON.parse(codeBlocks.find((content) => content.includes('"$schema"'))!)
    expect(powershellSettings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
    expect(powershellSettings.env).not.toHaveProperty('CLAUDE_CODE_ATTRIBUTION_HEADER')
    expect(wrapper.text()).toContain('%USERPROFILE%\\.claude\\settings.json')

    const copyButton = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.copy')
    )
    expect(copyButton).toBeDefined()
    await copyButton!.trigger('click')
    expect(copyToClipboardMock).toHaveBeenCalledWith(
      expect.stringContaining('ANTHROPIC_AUTH_TOKEN="sk-grok-claude-test"'),
      'keys.copied'
    )
  })

  it('renders Codex custom provider setup through the Grok Responses gateway', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-codex-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const codexTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCli')
    )
    expect(codexTab).toBeDefined()
    await codexTab!.trigger('click')
    await nextTick()

    let codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    const configToml = codeBlocks.find((content) => content.includes('[model_providers.sub2api]'))
    expect(configToml).toBeDefined()
    expect(configToml).toContain('model_provider = "sub2api"')
    expect(configToml).toContain('model = "grok-4.5"')
    expect(configToml).toContain('base_url = "https://example.com/v1"')
    expect(configToml).toContain('env_key = "SUB2API_API_KEY"')
    expect(configToml).toContain('wire_api = "responses"')
    // API-key provider: Codex must not require a ChatGPT OAuth login.
    expect(configToml).toContain('requires_openai_auth = false')
    expect(configToml).toContain('supports_websockets = false')
    expect(configToml).toContain('grok-4.20-multi-agent-0309 (text / web_search)')
    expect(configToml).toContain('grok-imagine-image')
    expect(configToml).toContain('grok-imagine-video')
    // Hardcoded bearer is only a commented fallback when env cannot be set.
    expect(configToml).toMatch(/# experimental_bearer_token = "sk-grok-codex-test"/)
    expect(configToml).not.toContain('supports_websockets = true')
    expect(configToml).not.toContain('responses_websockets_v2')
    expect(wrapper.text()).not.toContain('auth.json')
    expect(codeBlocks.join('\n')).toContain('SUB2API_API_KEY')

    const windowsTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'Windows'
    )
    expect(windowsTab).toBeDefined()
    await windowsTab!.trigger('click')
    await nextTick()

    codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    expect(wrapper.text().toLowerCase()).toContain('%userprofile%\\.codex\\config.toml'.toLowerCase())
    expect(codeBlocks.join('\n')).toContain('experimental_bearer_token = "sk-grok-codex-test"')
  })

  it('prefers the grok_codex client template over the built-in Grok Codex config', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-tpl-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok',
        clientTemplates: {
          grok_codex: {
            files: [
              {
                path: '${configDir}/config.toml',
                content: 'model = "grok-4.6"\nmodel_reasoning_effort = "xhigh"\nbase_url = "${apiBase}"'
              },
              {
                path: 'Terminal',
                content: 'export SUB2API_KEY="${apiKey}"'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const codexTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCli')
    )
    expect(codexTab).toBeDefined()
    await codexTab!.trigger('click')
    await nextTick()

    const allCode = wrapper.findAll('pre code').map((code) => code.text()).join('\n')
    expect(allCode).toContain('model = "grok-4.6"')
    expect(allCode).toContain('model_reasoning_effort = "xhigh"')
    expect(allCode).toContain('base_url = "https://example.com/v1"')
    expect(allCode).toContain('export SUB2API_KEY="sk-grok-tpl-test"')
    expect(wrapper.text()).toContain('~/.codex/config.toml')
    // Built-in fallback must not leak through when the template is present.
    expect(allCode).not.toContain('model = "grok-4.5"')
    expect(allCode).not.toContain('SUB2API_API_KEY')
  })

  it('renders shell-aware grok_codex template placeholders per shell tab', async () => {
    // Mirrors template/client-templates.json: one env file that must stay
    // pasteable on every shell tab instead of always emitting `export`.
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-shell-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok',
        clientTemplates: {
          grok_codex: {
            files: [
              {
                path: '${shellLabel}',
                content: '${envSetPrefix}SUB2API_KEY=${envQuote}${apiKey}${envQuote}'
              },
              {
                path: '${configDir}${pathSep}config.toml',
                content: 'base_url = "${apiBase}"'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const readCode = () => wrapper.findAll('pre code').map((code) => code.text()).join('\n')
    const readPaths = () => wrapper.findAll('span.font-mono').map((label) => label.text())

    const codexTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCli')
    )
    expect(codexTab).toBeDefined()
    await codexTab!.trigger('click')
    await nextTick()

    expect(readCode()).toContain('export SUB2API_KEY="sk-grok-shell-test"')
    expect(readPaths()).toContain('Terminal')
    expect(readPaths()).toContain('~/.codex/config.toml')

    const windowsTab = wrapper.findAll('button').find(
      (button) => button.text().trim() === 'Windows'
    )
    expect(windowsTab).toBeDefined()
    await windowsTab!.trigger('click')
    await nextTick()

    // Windows tab defaults to PowerShell: no POSIX `export` may survive here.
    expect(readCode()).toContain('$env:SUB2API_KEY="sk-grok-shell-test"')
    expect(readCode()).not.toContain('export SUB2API_KEY')
    expect(readPaths()).toContain('PowerShell')
    expect(readPaths()).toContain('%userprofile%\\.codex\\config.toml')
  })

  it('keeps legacy OpenAI Codex config as the default', () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    const configToml = codeBlocks.find((content) => content.includes('model_provider = "OpenAI"'))

    expect(configToml).toBeDefined()
    expect(configToml).toContain('model = "gpt-5.5"')
    expect(configToml).toContain('review_model = "gpt-5.5"')
    expect(configToml).not.toContain('model = "gpt-5.4"')
    expect(configToml).not.toContain('model_context_window')
    expect(configToml).not.toContain('model_auto_compact_token_limit')
    expect(configToml).toContain('requires_openai_auth = true')
    expect(configToml).not.toContain('experimental_bearer_token')
    expect(configToml).not.toContain('x-openai-actor-authorization')
    expect(configToml).not.toContain('env_key')
    expect(configToml).not.toContain('image_generation')
    expect(configToml).not.toContain('supports_websockets')
    expect(configToml).not.toContain('responses_websockets_v2')
    expect(configToml).toContain('[features]\ngoals = true')
    expect(configToml).not.toContain('model_reasoning_effort = "xhigh"')
    expect(codeBlocks).toContain('{\n  "OPENAI_API_KEY": "sk-test"\n}')
    expect(wrapper.text()).toContain('auth.json')
    expect(wrapper.find('[data-testid="codex-api-key-restart-notice"]').exists()).toBe(false)
  })

  it('renders API Key Mode authorization in OpenAI Codex config', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const apiKeyMode = wrapper.get('[data-testid="codex-auth-mode-api-key"]')
    await apiKeyMode.trigger('click')
    await nextTick()

    const codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    const configToml = codeBlocks.find((content) => content.includes('model_provider = "OpenAI"'))

    expect(apiKeyMode.attributes('aria-checked')).toBe('true')
    expect(configToml).toBeDefined()
    expect(configToml).toContain('requires_openai_auth = false')
    expect(configToml).toContain('experimental_bearer_token = "sk-test"')
    expect(configToml).toContain('http_headers = { "x-openai-actor-authorization" = "local-image-extension" }')
    expect(configToml).not.toContain('env_key')
    expect(configToml).not.toContain('image_generation')
    expect(codeBlocks).not.toContain('{\n  "OPENAI_API_KEY": "sk-test"\n}')
    expect(wrapper.text()).not.toContain('auth.json')

    const restartNotice = wrapper.get('[data-testid="codex-api-key-restart-notice"]')
    expect(restartNotice.text()).toContain(
      'keys.useKeyModal.openai.authModeApiKeyRestartNotice'
    )

    await wrapper.get('[data-testid="codex-auth-mode-legacy"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="codex-api-key-restart-notice"]').exists()).toBe(false)
    expect(wrapper.findAll('pre code').map((code) => code.text()).join('\n')).not.toContain(
      'x-openai-actor-authorization'
    )
  })

  it('keeps legacy OpenAI Codex WebSocket config as the default', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const wsTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCliWs')
    )

    expect(wsTab).toBeDefined()
    await wsTab!.trigger('click')
    await nextTick()

    const codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    const configToml = codeBlocks.find((content) => content.includes('supports_websockets = true'))

    expect(configToml).toBeDefined()
    expect(configToml).toContain('model = "gpt-5.5"')
    expect(configToml).toContain('review_model = "gpt-5.5"')
    expect(configToml).not.toContain('model = "gpt-5.4"')
    expect(configToml).not.toContain('model_context_window')
    expect(configToml).not.toContain('model_auto_compact_token_limit')
    expect(configToml).toContain('requires_openai_auth = true')
    expect(configToml).not.toContain('experimental_bearer_token')
    expect(configToml).not.toContain('x-openai-actor-authorization')
    expect(configToml).not.toContain('env_key')
    expect(configToml).not.toContain('image_generation')
    expect(configToml).toContain('supports_websockets = true')
    expect(configToml).toContain('[features]\nresponses_websockets_v2 = true\ngoals = true')
    expect(codeBlocks).toContain('{\n  "OPENAI_API_KEY": "sk-test"\n}')
    expect(wrapper.text()).toContain('auth.json')
  })

  it('preserves API Key Mode when switching to OpenAI Codex WebSocket config', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const apiKeyMode = wrapper.get('[data-testid="codex-auth-mode-api-key"]')
    await apiKeyMode.trigger('click')

    const wsTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCliWs')
    )
    expect(wsTab).toBeDefined()
    await wsTab!.trigger('click')
    await nextTick()

    const codeBlocks = wrapper.findAll('pre code').map((code) => code.text())
    const configToml = codeBlocks.find((content) => content.includes('supports_websockets = true'))

    expect(wrapper.get('[data-testid="codex-auth-mode-api-key"]').attributes('aria-checked')).toBe('true')
    expect(configToml).toBeDefined()
    expect(configToml).toContain('requires_openai_auth = false')
    expect(configToml).toContain('experimental_bearer_token = "sk-test"')
    expect(configToml).toContain('http_headers = { "x-openai-actor-authorization" = "local-image-extension" }')
    expect(configToml).not.toContain('env_key')
    expect(configToml).not.toContain('image_generation')
    expect(configToml).toContain('supports_websockets = true')
    expect(configToml).toContain('[features]\nresponses_websockets_v2 = true\ngoals = true')
    expect(codeBlocks).not.toContain('{\n  "OPENAI_API_KEY": "sk-test"\n}')
    expect(wrapper.text()).not.toContain('auth.json')
  })

  it('resets Codex authentication mode when the modal reopens or platform changes', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await wrapper.get('[data-testid="codex-auth-mode-api-key"]').trigger('click')
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    await nextTick()

    expect(wrapper.get('[data-testid="codex-auth-mode-legacy"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.findAll('pre code').map((code) => code.text()).join('\n')).toContain('requires_openai_auth = true')

    await wrapper.get('[data-testid="codex-auth-mode-api-key"]').trigger('click')
    await wrapper.setProps({ platform: 'gemini' })
    await wrapper.setProps({ platform: 'openai' })
    await nextTick()

    expect(wrapper.get('[data-testid="codex-auth-mode-legacy"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.findAll('pre code').map((code) => code.text()).join('\n')).not.toContain('x-openai-actor-authorization')
  })

  it('renders GPT-5.4 mini entry in OpenCode config', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )

    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()

    const codeBlock = wrapper.find('pre code')
    expect(codeBlock.exists()).toBe(true)
    expect(codeBlock.text()).toContain('"name": "GPT-5.4 Mini"')
    expect(codeBlock.text()).not.toContain('"name": "GPT-5.4 Nano"')
  })

  it('renders GPT-5.6 alias and max variants in OpenCode config', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )
    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()

    const parsed = JSON.parse(wrapper.find('pre code').text())
    const models = parsed.provider.openai.models
    for (const model of ['gpt-5.6', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']) {
      expect(models[model]).toBeDefined()
      expect(models[model].variants).toHaveProperty('max')
      expect(models[model].variants).toHaveProperty('xhigh')
    }
    expect(models['gpt-5.6'].name).toBe('GPT-5.6 (Sol)')
  })

  it('renders Claude Fable 5 OpenCode config with adaptive thinking', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'antigravity'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )

    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()

    const claudeConfig = wrapper.findAll('pre code')
      .map((code) => code.text())
      .find((content) => content.includes('"antigravity-claude"'))

    expect(claudeConfig).toBeDefined()
    const parsed = JSON.parse(claudeConfig!)
    const fable51 = parsed.provider['antigravity-claude'].models['claude-fable-5-1']
    const fable = parsed.provider['antigravity-claude'].models['claude-fable-5']

    expect(fable51.name).toBe('Claude Fable 5.1')
    expect(fable51.limit).toEqual({ context: 1048576, output: 128000 })
    expect(fable51.options.thinking).toEqual({ type: 'adaptive' })
    expect(fable51.options.thinking).not.toHaveProperty('budgetTokens')
    expect(fable.name).toBe('Claude Fable 5')
    expect(fable.limit).toEqual({ context: 1048576, output: 128000 })
    expect(fable.options.thinking).toEqual({ type: 'adaptive' })
    expect(fable.options.thinking).not.toHaveProperty('budgetTokens')
  })

  // Scenario: API Key users can fetch a routed group catalog and reference it from config.toml.
  it('offers a downloadable Codex catalog for Composite API keys', async () => {
    const manifest = {
      models: [
        {
          slug: 'claude-opus-4-8',
          default_reasoning_level: 'medium',
          supported_reasoning_levels: [{ effort: 'max', description: 'Maximum reasoning depth' }],
          input_modalities: ['text'],
          model_messages: { instructions_template: 'Use the routed model.' }
        },
        {
          slug: 'grok-4.6',
          default_reasoning_level: 'high',
          supported_reasoning_levels: [{ effort: 'xhigh', description: 'Extra-high reasoning depth' }],
          input_modalities: ['text'],
          model_messages: { instructions_template: 'Use the routed model.' }
        }
      ]
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => manifest
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-composite-test',
        baseUrl: 'https://example.com/v1',
        platform: 'composite'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const codexTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCli')
    )
    expect(codexTab).toBeDefined()
    await codexTab!.trigger('click')
    await nextTick()

    const unixConfig = wrapper.findAll('pre code')
      .map((code) => code.text())
      .find((content) => content.includes('[model_providers.sub2api]'))
    expect(unixConfig).toContain('model_catalog_json = "~/.codex/codex-models.json"')
    expect(unixConfig).toContain('env_key = "SUB2API_API_KEY"')

    await wrapper.get('[data-testid="codex-model-catalog-fetch"]').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/v1/models?client_version=0.147.0',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-composite-test' })
      })
    )
    expect(wrapper.get('[data-testid="codex-model-catalog"]').text())
      .toContain('keys.useKeyModal.codexModelCatalog.download')

    const loadedUnixConfig = wrapper.findAll('pre code')
      .map((code) => code.text())
      .find((content) => content.includes('[model_providers.sub2api]'))
    expect(loadedUnixConfig).toContain('model = "claude-opus-4-8"')
    expect(loadedUnixConfig).toContain('review_model = "claude-opus-4-8"')
    expect(loadedUnixConfig).not.toContain('model = "gpt-5.5"')

    const downloadButton = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.codexModelCatalog.download')
    )
    expect(downloadButton).toBeDefined()
    await downloadButton!.trigger('click')
    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'codex-models.json')
    const downloadedBlob = saveAsMock.mock.calls[0]?.[0] as Blob
    expect(JSON.parse(await readBlobAsText(downloadedBlob))).toEqual(manifest)

    const windowsTab = wrapper.findAll('button').find((button) => button.text().trim() === 'Windows')
    expect(windowsTab).toBeDefined()
    await windowsTab!.trigger('click')
    await nextTick()

    const windowsConfig = wrapper.findAll('pre code')
      .map((code) => code.text())
      .find((content) => content.includes('[model_providers.sub2api]'))
    expect(windowsConfig).toContain(
      'model_catalog_json = "%userprofile%\\\\.codex\\\\codex-models.json"'
    )
  })

  it.each(['anthropic', 'gemini', 'antigravity', 'kimi', 'zhipu'] as const)(
    'offers Codex catalog configuration for the %s routed group',
    async (platform) => {
      const wrapper = mount(UseKeyModal, {
        props: {
          show: true,
          apiKey: `sk-${platform}-test`,
          baseUrl: 'https://example.com/v1',
          platform
        },
        global: {
          stubs: {
            BaseDialog: {
              template: '<div><slot /><slot name="footer" /></div>'
            },
            Icon: {
              template: '<span />'
            }
          }
        }
      })

      const codexTab = wrapper.findAll('button').find((button) =>
        button.text().includes('keys.useKeyModal.cliTabs.codexCli')
      )
      expect(codexTab).toBeDefined()
      await codexTab!.trigger('click')
      await nextTick()

      expect(wrapper.find('[data-testid="codex-model-catalog"]').exists()).toBe(true)
      const config = wrapper.findAll('pre code')
        .map((code) => code.text())
        .find((content) => content.includes('[model_providers.sub2api]'))
      expect(config).toContain('model_catalog_json = "~/.codex/codex-models.json"')
      expect(config).toContain('base_url = "https://example.com/v1"')
      expect(config).toContain('wire_api = "responses"')
    }
  )

  // Scenario: the platform-preferred model remains selected when the downloaded catalog contains it.
  it('keeps the preferred Composite default when it exists in the catalog', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          { slug: 'claude-opus-4-8' },
          { slug: 'gpt-5.5' }
        ]
      })
    }))

    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-composite-test',
        baseUrl: 'https://example.com/v1',
        platform: 'composite'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const codexTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.codexCli')
    )
    expect(codexTab).toBeDefined()
    await codexTab!.trigger('click')
    await wrapper.get('[data-testid="codex-model-catalog-fetch"]').trigger('click')
    await flushPromises()

    const config = wrapper.findAll('pre code')
      .map((code) => code.text())
      .find((content) => content.includes('[model_providers.sub2api]'))
    expect(config).toContain('model = "gpt-5.5"')
    expect(config).toContain('review_model = "gpt-5.5"')
  })

  it('derives OpenAI Codex reasoning effort from the selected catalog descriptor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        models: [
          {
            slug: 'glm-5.3',
            default_reasoning_level: 'none',
            supported_reasoning_levels: [{ effort: 'none' }]
          }
        ]
      })
    }))

    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-openai-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await wrapper.get('[data-testid="codex-model-catalog-fetch"]').trigger('click')
    await flushPromises()

    const configToml = wrapper.findAll('pre code')
      .map((code) => code.text())
      .find((content) => content.includes('model_provider = "OpenAI"'))
    expect(configToml).toContain('model = "glm-5.3"')
    expect(configToml).not.toContain('model_reasoning_effort')
  })

  it('renders configured Codex templates instead of built-in files', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai',
        clientTemplates: {
          codex: {
            files: [
              {
                path: '${configDir}/config.toml',
                hint: 'custom hint ${endpoint}',
                content: 'base_url = "${baseUrl}"\nkey = "{{ apiKey }}"'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await nextTick()

    expect(wrapper.text()).toContain('~/.codex/config.toml')
    expect(wrapper.text()).toContain('custom hint https://example.com/v1')

    const codeBlock = wrapper.find('pre code')
    expect(codeBlock.text()).toContain('base_url = "https://example.com/v1"')
    expect(codeBlock.text()).toContain('key = "sk-test"')
    expect(codeBlock.text()).not.toContain('model_provider = "OpenAI"')
  })

  it('renders configured OpenCode templates for the current endpoint', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-test',
        baseUrl: 'https://example.com/v1',
        platform: 'gemini',
        clientTemplates: {
          opencode: {
            files: [
              {
                path: 'custom-opencode.json',
                content: '{"baseURL":"${endpoint}","apiKey":"${apiKey}"}'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )

    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('custom-opencode.json')

    const codeBlock = wrapper.find('pre code')
    expect(codeBlock.text()).toContain('"baseURL":"https://example.com/v1beta"')
    expect(codeBlock.text()).toContain('"apiKey":"sk-test"')
    expect(codeBlock.text()).not.toContain('Gemini 2.5 Flash')
  })

  async function openOpenCodeTab(wrapper: ReturnType<typeof mount>) {
    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )
    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()
  }

  it('prefers the grok_opencode template over the shared opencode template', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-oc-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok',
        clientTemplates: {
          opencode: {
            files: [{ path: 'opencode.json', content: '{"shared":"${apiKey}"}' }]
          },
          grok_opencode: {
            files: [
              {
                path: 'opencode.json',
                content: '{"model":"grok/grok-4.6","baseURL":"${endpoint}","apiKey":"${apiKey}"}'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(wrapper)

    const codeBlock = wrapper.find('pre code')
    expect(codeBlock.text()).toContain('"model":"grok/grok-4.6"')
    expect(codeBlock.text()).toContain('"baseURL":"https://example.com/v1"')
    expect(codeBlock.text()).toContain('"apiKey":"sk-grok-oc-test"')
    expect(codeBlock.text()).not.toContain('"shared"')
  })

  it('prefers the zhipu_opencode template and falls back to the shared template without it', async () => {
    const sharedOnly = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-glm-oc-test',
        baseUrl: 'https://example.com/v1',
        platform: 'zhipu',
        clientTemplates: {
          opencode: {
            files: [{ path: 'opencode.json', content: '{"shared":"${apiKey}"}' }]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(sharedOnly)
    expect(sharedOnly.find('pre code').text()).toContain('"shared":"sk-glm-oc-test"')

    const withOverride = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-glm-oc-test',
        baseUrl: 'https://example.com/v1',
        platform: 'zhipu',
        clientTemplates: {
          opencode: {
            files: [{ path: 'opencode.json', content: '{"shared":"${apiKey}"}' }]
          },
          zhipu_opencode: {
            files: [
              {
                path: 'opencode.json',
                content: '{"model":"zhipu/glm-4.6","baseURL":"${endpoint}"}'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(withOverride)
    const codeBlock = withOverride.find('pre code')
    expect(codeBlock.text()).toContain('"model":"zhipu/glm-4.6"')
    expect(codeBlock.text()).not.toContain('"shared"')
  })

  it('renders an isolated GLM OpenCode fallback without OpenAI catalog models', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-glm-test',
        baseUrl: 'https://example.com/v1',
        platform: 'zhipu'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(wrapper)

    const parsed = JSON.parse(wrapper.find('pre code').text())
    expect(parsed.model).toBe('zhipu/glm-5.3')
    expect(parsed.provider.zhipu.npm).toBe('@ai-sdk/openai-compatible')
    expect(parsed.provider.zhipu.name).toBe('GLM via Sub2API')
    expect(parsed.provider.zhipu.options).toEqual({
      baseURL: 'https://example.com/v1',
      apiKey: 'sk-glm-test'
    })
    expect(parsed.provider.zhipu.models['glm-5.3']).toBeDefined()
    expect(parsed.provider.zhipu.models['glm-5.3'].limit.context).toBe(1000000)
    expect(parsed.provider.zhipu.models['glm-5.2']).toBeDefined()
    expect(parsed.provider.zhipu.models['glm-5.2'].limit.context).toBe(200000)
    expect(parsed.provider.zhipu.models['glm-5.1']).toBeDefined()
    expect(parsed.provider.zhipu.models['glm-5-turbo']).toBeDefined()
    // GLM-5.x 文本档在 z.ai / models.dev(zhipuai) 上都是 input:["text"]；会看图的是
    // glm-5v-turbo / glm-5.3-flash / glm-4.6v 那几个 vision 型号，本清单没有收。
    // 这里写死 text-only 是"确认过"，不是漏声明——别照着 grok 顺手加 image。
    for (const id of ['glm-5.3', 'glm-5.2', 'glm-5.1', 'glm-5-turbo']) {
      expect(parsed.provider.zhipu.models[id].modalities.input).toEqual(['text'])
    }
    expect(parsed.provider.openai).toBeUndefined()
    expect(JSON.stringify(parsed)).not.toContain('gpt-')
  })

  it('pins one default model per platform in built-in OpenCode fallbacks', async () => {
    const grokWrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-grok-test',
        baseUrl: 'https://example.com/v1',
        platform: 'grok'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })
    await openOpenCodeTab(grokWrapper)
    const grokParsed = JSON.parse(grokWrapper.find('pre code').text())
    expect(grokParsed.model).toBe('grok/grok-4.6')
    expect(grokParsed.provider.grok.models['grok-4.6']).toBeDefined()

    const openaiWrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-openai-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })
    await openOpenCodeTab(openaiWrapper)
    const openaiParsed = JSON.parse(openaiWrapper.find('pre code').text())
    expect(openaiParsed.model).toBe('openai/gpt-5.5')
  })

  it('prefers the openai_opencode template over the shared opencode template', async () => {
    const wrapper = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-openai-oc-test',
        baseUrl: 'https://example.com/v1',
        platform: 'openai',
        clientTemplates: {
          opencode: {
            files: [{ path: 'opencode.json', content: '{"shared":"${apiKey}"}' }]
          },
          openai_opencode: {
            files: [
              {
                path: 'opencode.json',
                content: '{"model":"openai/gpt-5.5","baseURL":"${endpoint}","apiKey":"${apiKey}"}'
              }
            ]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(wrapper)

    const codeBlock = wrapper.find('pre code')
    expect(codeBlock.text()).toContain('"model":"openai/gpt-5.5"')
    expect(codeBlock.text()).toContain('"baseURL":"https://example.com/v1"')
    expect(codeBlock.text()).toContain('"apiKey":"sk-openai-oc-test"')
    expect(codeBlock.text()).not.toContain('"shared"')
  })

  // Regression guard: platforms without their own section must never inherit the
  // OpenAI one. `case 'openai'` and `default` were briefly merged, which pinned
  // kimi/deepseek/composite OpenCode configs to openai/gpt-5.5 — a model their
  // groups cannot route.
  it('keeps platforms without a dedicated section off the openai_opencode section and model pin', async () => {
    const withOpenAISection = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-kimi-oc-test',
        baseUrl: 'https://example.com/v1',
        platform: 'kimi',
        clientTemplates: {
          opencode: {
            files: [{ path: 'opencode.json', content: '{"shared":"${apiKey}"}' }]
          },
          openai_opencode: {
            files: [{ path: 'opencode.json', content: '{"model":"openai/gpt-5.5"}' }]
          }
        }
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(withOpenAISection)
    const sharedText = withOpenAISection.find('pre code').text()
    expect(sharedText).toContain('"shared":"sk-kimi-oc-test"')
    expect(sharedText).not.toContain('openai/gpt-5.5')

    const builtinFallback = mount(UseKeyModal, {
      props: {
        show: true,
        apiKey: 'sk-kimi-builtin-test',
        baseUrl: 'https://example.com/v1',
        platform: 'kimi'
      },
      global: {
        stubs: {
          BaseDialog: {
            template: '<div><slot /><slot name="footer" /></div>'
          },
          Icon: {
            template: '<span />'
          }
        }
      }
    })

    await openOpenCodeTab(builtinFallback)
    const parsed = JSON.parse(builtinFallback.find('pre code').text())
    expect(parsed.model).toBeUndefined()
    expect(JSON.stringify(parsed)).not.toContain('openai/gpt-5.5')
    // The OpenAI-compatible provider shape itself is unchanged from before the
    // per-platform split — only the model pin is withheld.
    expect(parsed.provider.openai.options).toEqual({
      baseURL: 'https://example.com/v1',
      apiKey: 'sk-kimi-builtin-test'
    })
  })
})
