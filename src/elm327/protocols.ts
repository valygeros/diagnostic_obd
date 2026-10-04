/** ELM327 protocol numbers (ATSPx / ATDPN) — ELM327 datasheet, "SP h". */

export interface ProtocolInfo {
  /** ELM protocol number, '1'..'C'. */
  id: string
  name: string
  /** Short label for compact UI. */
  short: string
  can: boolean
  /** CAN identifier size, when `can`. */
  idBits?: 11 | 29
}

export const PROTOCOLS: Record<string, ProtocolInfo> = {
  '1': { id: '1', name: 'SAE J1850 PWM (41,6 kbaud)', short: 'J1850 PWM', can: false },
  '2': { id: '2', name: 'SAE J1850 VPW (10,4 kbaud)', short: 'J1850 VPW', can: false },
  '3': { id: '3', name: 'ISO 9141-2 (5 bauds, 10,4 kbaud)', short: 'ISO 9141-2', can: false },
  '4': { id: '4', name: 'ISO 14230-4 KWP (init 5 bauds)', short: 'KWP 5 bauds', can: false },
  '5': { id: '5', name: 'ISO 14230-4 KWP (init rapide)', short: 'KWP rapide', can: false },
  '6': {
    id: '6',
    name: 'ISO 15765-4 CAN (11 bits, 500 kbaud)',
    short: 'CAN 11/500',
    can: true,
    idBits: 11,
  },
  '7': {
    id: '7',
    name: 'ISO 15765-4 CAN (29 bits, 500 kbaud)',
    short: 'CAN 29/500',
    can: true,
    idBits: 29,
  },
  '8': {
    id: '8',
    name: 'ISO 15765-4 CAN (11 bits, 250 kbaud)',
    short: 'CAN 11/250',
    can: true,
    idBits: 11,
  },
  '9': {
    id: '9',
    name: 'ISO 15765-4 CAN (29 bits, 250 kbaud)',
    short: 'CAN 29/250',
    can: true,
    idBits: 29,
  },
  A: { id: 'A', name: 'SAE J1939 CAN (29 bits, 250 kbaud)', short: 'J1939', can: true, idBits: 29 },
  B: { id: 'B', name: 'CAN utilisateur 1', short: 'CAN USR1', can: true, idBits: 11 },
  C: { id: 'C', name: 'CAN utilisateur 2', short: 'CAN USR2', can: true, idBits: 11 },
}

/**
 * Parses an ATDPN reply. "A6" means "6, found by automatic search".
 * Returns undefined for "0" (still automatic, nothing found yet) or garbage.
 */
export function parseDpn(reply: string): { protocol: ProtocolInfo; auto: boolean } | undefined {
  const m = /^(A)?([1-9A-C])$/.exec(reply.trim().toUpperCase())
  if (!m) return undefined
  const protocol = PROTOCOLS[m[2] ?? '']
  return protocol ? { protocol, auto: m[1] === 'A' } : undefined
}
