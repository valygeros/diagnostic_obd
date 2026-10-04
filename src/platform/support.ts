/**
 * Detects whether this browser can talk to an OBD dongle (CLAUDE.md §3.2).
 * Pure function over an environment snapshot so it can be unit-tested.
 */

export interface PlatformEnv {
  userAgent: string
  platform: string
  maxTouchPoints: number
  isSecureContext: boolean
  hasBluetooth: boolean
  hasSerial: boolean
}

export type BluetoothVerdict =
  /** Web Bluetooth usable. */
  | 'ok'
  /** iPhone/iPad without Web Bluetooth: open the site in Bluefy. */
  | 'ios-needs-bluefy'
  /** Page not served over HTTPS (or localhost): the API is hidden by the browser. */
  | 'insecure-context'
  /** Desktop/Android browser without Web Bluetooth (Firefox, old Safari…). */
  | 'unsupported-browser'

export interface PlatformSupport {
  isIOS: boolean
  bluetooth: BluetoothVerdict
  /** Web Serial fallback (PC only, phase 5). */
  serial: boolean
}

export function isIOS(
  env: Pick<PlatformEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>,
): boolean {
  if (/iPad|iPhone|iPod/.test(env.userAgent)) return true
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  return env.platform === 'MacIntel' && env.maxTouchPoints > 1
}

export function detectSupport(env: PlatformEnv): PlatformSupport {
  const ios = isIOS(env)
  let bluetooth: BluetoothVerdict
  if (env.hasBluetooth) bluetooth = 'ok'
  else if (ios) bluetooth = 'ios-needs-bluefy'
  else if (!env.isSecureContext) bluetooth = 'insecure-context'
  else bluetooth = 'unsupported-browser'

  return { isIOS: ios, bluetooth, serial: env.hasSerial && env.isSecureContext }
}

export function currentEnv(): PlatformEnv {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    isSecureContext: window.isSecureContext,
    hasBluetooth: 'bluetooth' in navigator,
    hasSerial: 'serial' in navigator,
  }
}
