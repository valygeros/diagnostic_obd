/**
 * Diagnostic trouble codes (SAE J2012 / ISO 15031-6 two-byte form, CLAUDE.md §6.3).
 *   bits 15-14: system letter  00=P 01=C 10=B 11=U
 *   bits 13-12: first digit 0-3
 *   bits 11-0 : three hex digits
 */

export type DtcKind = 'stored' | 'pending' | 'permanent'

const LETTERS = ['P', 'C', 'B', 'U'] as const

export function decodeDtc(b1: number, b2: number): string {
  const letter = LETTERS[(b1 >> 6) & 0x03]
  const d1 = (b1 >> 4) & 0x03
  const rest = (((b1 & 0x0f) << 8) | b2).toString(16).toUpperCase().padStart(3, '0')
  return `${letter}${d1}${rest}`
}

const DTC_RE = /^([PCBU])([0-3])([0-9A-F]{3})$/

export function isValidDtc(code: string): boolean {
  return DTC_RE.test(code)
}

export function encodeDtc(code: string): [number, number] {
  const m = DTC_RE.exec(code.toUpperCase())
  if (!m) throw new Error(`Code défaut invalide : ${code}`)
  const letter = LETTERS.indexOf(m[1] as (typeof LETTERS)[number])
  const value = parseInt(m[3] ?? '0', 16)
  return [(letter << 6) | (Number(m[2]) << 4) | (value >> 8), value & 0xff]
}

/** Response service byte for each DTC-reading request. */
export const DTC_SERVICES: Record<DtcKind, { request: string; response: number }> = {
  stored: { request: '03', response: 0x43 },
  pending: { request: '07', response: 0x47 },
  permanent: { request: '0A', response: 0x4a },
}

/**
 * Decodes the codes in one ECU reply to service 03/07/0A.
 * CAN replies carry a count byte after the service byte; legacy protocols don't and pad with 0000.
 */
export function parseDtcPayload(data: readonly number[], isCan: boolean): string[] {
  const body = isCan ? data.slice(2) : data.slice(1)
  const codes: string[] = []
  for (let i = 0; i + 1 < body.length; i += 2) {
    const b1 = body[i] ?? 0
    const b2 = body[i + 1] ?? 0
    if (b1 === 0 && b2 === 0) continue // padding
    codes.push(decodeDtc(b1, b2))
  }
  return codes
}

/** Human description of what the structure of a code says, for codes missing from the base. */
export function describeDtcStructure(code: string): { system: string; generic: boolean } {
  const systems: Record<string, string> = {
    P: 'Moteur et transmission',
    C: 'Châssis (freins, direction, suspension)',
    B: 'Carrosserie (airbags, confort, éclairage)',
    U: 'Réseau de communication entre calculateurs',
  }
  const letter = code[0] ?? 'P'
  const d1 = code[1] ?? '0'
  // P0, P2, P3 (partly), C0, B0, U0 are SAE-defined; P1, C1-2, B1-2, U1-2 are manufacturer-specific.
  const generic = d1 === '0' || (letter === 'P' && d1 === '2') || (letter === 'P' && d1 === '3')
  return { system: systems[letter] ?? 'Inconnu', generic }
}
