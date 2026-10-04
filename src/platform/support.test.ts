import { describe, expect, it } from 'vitest'
import { detectSupport, isIOS, type PlatformEnv } from './support'

const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const WINDOWS_FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'
const IPADOS_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

function env(overrides: Partial<PlatformEnv>): PlatformEnv {
  return {
    userAgent: WINDOWS_CHROME,
    platform: 'Win32',
    maxTouchPoints: 0,
    isSecureContext: true,
    hasBluetooth: true,
    hasSerial: true,
    ...overrides,
  }
}

describe('isIOS', () => {
  it('detects iPhone browsers', () => {
    expect(isIOS({ userAgent: IPHONE_CHROME, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true)
  })

  it('detects iPadOS masquerading as a Mac', () => {
    expect(isIOS({ userAgent: IPADOS_SAFARI, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
  })

  it('does not flag a real Mac', () => {
    expect(isIOS({ userAgent: IPADOS_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
  })
})

describe('detectSupport', () => {
  it('accepts Chrome on Windows', () => {
    expect(detectSupport(env({}))).toEqual({ isIOS: false, bluetooth: 'ok', serial: true })
  })

  it('asks iPhone users without Web Bluetooth to use Bluefy', () => {
    const s = detectSupport(
      env({
        userAgent: IPHONE_CHROME,
        platform: 'iPhone',
        maxTouchPoints: 5,
        hasBluetooth: false,
        hasSerial: false,
      }),
    )
    expect(s.bluetooth).toBe('ios-needs-bluefy')
  })

  it('accepts an iOS browser that exposes Web Bluetooth (Bluefy)', () => {
    const s = detectSupport(
      env({ userAgent: IPHONE_CHROME, platform: 'iPhone', maxTouchPoints: 5 }),
    )
    expect(s).toMatchObject({ isIOS: true, bluetooth: 'ok' })
  })

  it('explains that HTTP hides the API', () => {
    const s = detectSupport(env({ isSecureContext: false, hasBluetooth: false, hasSerial: true }))
    expect(s).toEqual({ isIOS: false, bluetooth: 'insecure-context', serial: false })
  })

  it('flags Firefox as unsupported', () => {
    const s = detectSupport(
      env({ userAgent: WINDOWS_FIREFOX, hasBluetooth: false, hasSerial: false }),
    )
    expect(s.bluetooth).toBe('unsupported-browser')
  })
})
