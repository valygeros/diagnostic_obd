/**
 * Service 01 PID 01 — "Monitor status since DTCs cleared" (SAE J1979).
 *   A7     : MIL (check engine light) on
 *   A6..A0 : number of emission-related confirmed DTCs
 *   B3     : 0 = spark ignition (petrol), 1 = compression ignition (diesel)
 *   B, C, D: readiness monitors — fully decoded in phase 2 (2.6); raw bytes kept here.
 */

export interface MonitorStatus {
  mil: boolean
  dtcCount: number
  ignition: 'spark' | 'compression'
  raw: [number, number, number, number]
}

export function parseMonitorStatus(bytes: readonly number[]): MonitorStatus {
  const [a = 0, b = 0, c = 0, d = 0] = bytes
  return {
    mil: (a & 0x80) !== 0,
    dtcCount: a & 0x7f,
    ignition: b & 0x08 ? 'compression' : 'spark',
    raw: [a, b, c, d],
  }
}
