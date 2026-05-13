import { describe, expect, it } from 'vitest'
import { buildExternalMenuUrl } from '../external-menu-url'

describe('external-menu-url', () => {
  it('adds the current auth token to external menu URLs', () => {
    const result = buildExternalMenuUrl('https://sidecar.example.com/dashboard?view=ops', 'token-123')

    const url = new URL(result)
    expect(url.searchParams.get('view')).toBe('ops')
    expect(url.searchParams.get('token')).toBe('token-123')
  })

  it('preserves URLs when no token is available', () => {
    const result = buildExternalMenuUrl('https://sidecar.example.com/dashboard?view=ops')

    const url = new URL(result)
    expect(url.searchParams.get('view')).toBe('ops')
    expect(url.searchParams.has('token')).toBe(false)
  })

  it('returns original string for invalid url input', () => {
    expect(buildExternalMenuUrl('not a url', 'token-123')).toBe('not a url')
  })
})
