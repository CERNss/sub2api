import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const componentPath = resolve(dirname(fileURLToPath(import.meta.url)), '../AppSidebar.vue')
const componentSource = readFileSync(componentPath, 'utf8')
const customPagePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../views/user/CustomPageView.vue')
const customPageSource = readFileSync(customPagePath, 'utf8')
const stylePath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../style.css')
const styleSource = readFileSync(stylePath, 'utf8')

describe('AppSidebar custom SVG styles', () => {
  it('does not override uploaded SVG fill or stroke colors', () => {
    expect(componentSource).toContain('.sidebar-svg-icon {')
    expect(componentSource).toContain('color: currentColor;')
    expect(componentSource).toContain('display: block;')
    expect(componentSource).not.toContain('stroke: currentColor;')
    expect(componentSource).not.toContain('fill: none;')
  })
})

describe('AppSidebar header styles', () => {
  it('does not clip the version badge dropdown', () => {
    const sidebarHeaderBlockMatch = styleSource.match(/\.sidebar-header\s*\{[\s\S]*?\n {2}\}/)
    const sidebarBrandBlockMatch = componentSource.match(/\.sidebar-brand\s*\{[\s\S]*?\n\}/)

    expect(sidebarHeaderBlockMatch).not.toBeNull()
    expect(sidebarBrandBlockMatch).not.toBeNull()
    expect(sidebarHeaderBlockMatch?.[0]).not.toContain('@apply overflow-hidden;')
    expect(sidebarBrandBlockMatch?.[0]).not.toContain('overflow: hidden;')
  })
})

describe('AppSidebar backend-mode (develop-lite) menu hiding', () => {
  it('defines a flag that hides menus while backend mode is on', () => {
    // 纯 API 服务器（Backend 模式）下隐藏面向用户/经营性菜单。
    // undefined（设置未加载）也按隐藏处理，避免闪现。
    expect(componentSource).toContain('const flagHideInBackendMode')
    expect(componentSource).toContain('appStore.cachedPublicSettings?.backend_mode_enabled === false')
  })

  it('gates the sales/operational menus on backend mode', () => {
    // 从每个受控菜单项声明的起点截到行尾，确认挂上了 flagHideInBackendMode。
    const gatedPaths = [
      '/admin/channels',
      '/admin/subscriptions',
      '/admin/announcements',
      '/admin/redeem',
      '/admin/promo-codes',
      '/subscriptions',
      '/redeem',
    ]
    for (const p of gatedPaths) {
      const start = componentSource.indexOf(`path: '${p}',`)
      expect(start, `menu ${p} not found in source`).toBeGreaterThan(-1)
      // 界定到"下一个 path:"之前，把范围限定在当前菜单项自身，避免误判相邻项。
      const rest = componentSource.slice(start + 1)
      const nextPath = rest.indexOf('path:')
      const scope = nextPath === -1 ? rest : rest.slice(0, nextPath)
      expect(
        scope.includes('flagHideInBackendMode'),
        `menu ${p} should be gated by flagHideInBackendMode`,
      ).toBe(true)
    }
  })
})

describe('AppSidebar external custom menu items', () => {
  it('opens external custom menu items without routing to the iframe custom page', () => {
    expect(componentSource).toContain("path: externalUrl ? `external:${item.id}` : `/custom/${item.id}`")
    expect(componentSource).toContain('v-else-if="item.externalUrl"')
    expect(componentSource).toContain("window.open(url, '_blank', 'noopener,noreferrer')")
  })

  it('keeps external custom menu items out of CustomPageView iframe resolution', () => {
    expect(customPageSource).toContain("item.id === id && item.open_mode !== 'external'")
  })
})
