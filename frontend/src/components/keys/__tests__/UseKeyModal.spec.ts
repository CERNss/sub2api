import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/useClipboard', () => ({
  useClipboard: () => ({
    copyToClipboard: vi.fn().mockResolvedValue(true)
  })
}))

import UseKeyModal from '../UseKeyModal.vue'

describe('UseKeyModal', () => {
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
})
