import { describe, expect, it, vi } from 'vitest'

vi.stubGlobal('location', { hash: '' })
vi.stubGlobal('window', { addEventListener: () => {}, scrollTo: () => {} })
const { href, parseHash } = await import('./router.svelte')

describe('router', () => {
  it.each([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/scan', { name: 'scan' }],
    ['#/code/p0301', { name: 'code', code: 'P0301', ecu: undefined }],
    ['#/code/P0301?ecu=7E8', { name: 'code', code: 'P0301', ecu: '7E8' }],
    ['#/code/XYZ', { name: 'home' }],
    ['#/settings', { name: 'settings' }],
    ['#/nope', { name: 'home' }],
  ])('%s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route)
  })

  it('round-trips', () => {
    const r = { name: 'code', code: 'P0420', ecu: '7E8' } as const
    expect(parseHash(href(r))).toEqual(r)
  })
})
