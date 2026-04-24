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
  it('renders updated GPT-5.4 mini/nano names in OpenCode config', async () => {
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
    expect(codeBlock.text()).toContain('"name": "GPT-5.4 Nano"')
  })

  it('prefers configured client templates when provided', async () => {
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
                content: 'base_url = "${baseUrl}"'
              },
              {
                path: '${configDir}/auth.json',
                content: '{ "OPENAI_API_KEY": "${apiKey}" }'
              }
            ]
          },
          opencode: {
            files: [
              {
                path: 'custom-opencode.json',
                content: '{ "endpoint": "${apiBase}", "apiKey": "${apiKey}" }'
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

    const codeBlocks = wrapper.findAll('pre code')
    expect(codeBlocks[0].text()).toContain('base_url = "https://example.com/v1"')
    expect(codeBlocks[1].text()).toContain('"OPENAI_API_KEY": "sk-test"')

    const opencodeTab = wrapper.findAll('button').find((button) =>
      button.text().includes('keys.useKeyModal.cliTabs.opencode')
    )

    expect(opencodeTab).toBeDefined()
    await opencodeTab!.trigger('click')
    await nextTick()

    const opencodeCodeBlock = wrapper.find('pre code')
    expect(wrapper.text()).toContain('custom-opencode.json')
    expect(opencodeCodeBlock.text()).toContain('"endpoint": "https://example.com/v1"')
    expect(opencodeCodeBlock.text()).toContain('"apiKey": "sk-test"')
  })
})
