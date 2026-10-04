/**
 * Turns cleaned ELM327 data lines into per-ECU messages (CLAUDE.md §6.2).
 *
 * Expected adapter settings: ATS0 (no spaces) or spaces — both accepted — and ATH1 (headers on).
 * - CAN 11-bit : "7E8 06 41 00 BE 3F A8 13 00"   header 3 hex chars, then PCI + data (+ padding)
 * - CAN 29-bit : "18DAF110 06 41 00 BE 3F A8 13"  header 8 hex chars
 * - Others     : "48 6B 10 41 00 BE 3F A8 13 C2"  3 header bytes (KWP: 3 or 4), data, checksum
 * Without headers (some clones refuse ATH1) everything is attributed to one unknown ECU.
 */

import { reassemble, type CanFrame } from '../isotp/reassembler'
import type { ProtocolInfo } from './protocols'

export interface EcuMessage {
  /** ECU identifier: CAN header ("7E8", "18DAF110"), source address ("10"), or "?" without headers. */
  ecu: string
  /** Payload: service response byte first (e.g. 0x41), no header/PCI/checksum. */
  data: number[]
}

export class FrameError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FrameError'
  }
}

export const UNKNOWN_ECU = '?'

function hexBytes(hex: string): number[] {
  if (hex.length % 2 !== 0 || !/^[0-9A-F]*$/.test(hex)) {
    throw new FrameError(`Ligne illisible : ${hex}`)
  }
  const out: number[] = []
  for (let i = 0; i < hex.length; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16))
  return out
}

export function parseFrames(
  lines: readonly string[],
  protocol: ProtocolInfo | undefined,
  headers: boolean,
): EcuMessage[] {
  const compact = lines.map((l) => l.replace(/\s/g, ''))
  if (!headers) return parseHeaderless(compact, protocol)
  if (protocol?.can) return parseCan(compact, protocol.idBits ?? 11)
  return parseLegacy(compact, protocol)
}

function parseCan(lines: string[], idBits: 11 | 29): EcuMessage[] {
  const headerLen = idBits === 11 ? 3 : 8
  const frames: CanFrame[] = lines.map((line) => ({
    id: line.slice(0, headerLen),
    bytes: hexBytes(line.slice(headerLen)),
  }))
  return reassemble(frames).map((m) => ({ ecu: m.id, data: m.data }))
}

function parseLegacy(lines: string[], protocol: ProtocolInfo | undefined): EcuMessage[] {
  const isKwp = protocol?.id === '4' || protocol?.id === '5'
  return lines.map((line) => {
    const bytes = hexBytes(line)
    // KWP format byte: if its 6 low bits are 0, the length comes in an extra 4th header byte.
    const headerLen = isKwp && ((bytes[0] ?? 0) & 0x3f) === 0 ? 4 : 3
    if (bytes.length < headerLen + 2) throw new FrameError(`Trame trop courte : ${line}`)
    const source = bytes[2] ?? 0
    return {
      ecu: source.toString(16).toUpperCase().padStart(2, '0'),
      data: bytes.slice(headerLen, -1), // last byte is the checksum
    }
  })
}

/**
 * Headers off. CAN multi-frame replies come as "014" (total length) then "0: …", "1: …".
 * Single-line replies are plain data.
 */
function parseHeaderless(lines: string[], protocol: ProtocolInfo | undefined): EcuMessage[] {
  const first = lines[0]
  if (protocol?.can && first !== undefined && /^[0-9A-F]{3}$/.test(first) && lines.length > 1) {
    const total = parseInt(first, 16)
    const data: number[] = []
    for (const line of lines.slice(1)) {
      const m = /^[0-9A-F]:(.*)$/.exec(line)
      data.push(...hexBytes(m ? (m[1] ?? '') : line))
    }
    return [{ ecu: UNKNOWN_ECU, data: data.slice(0, total) }]
  }
  return lines.map((line) => ({ ecu: UNKNOWN_ECU, data: hexBytes(line) }))
}

/** Usual names for the standard OBD addresses (ISO 15765-4 / SAE J1979). */
export function ecuLabel(ecu: string): string {
  const can11: Record<string, string> = {
    '7E8': 'Moteur',
    '7E9': 'Boîte de vitesses',
  }
  if (can11[ecu]) return can11[ecu]
  // 29-bit physical response IDs 18DAF1xx and legacy source addresses use the same xx.
  const addr = ecu.length === 8 ? ecu.slice(6) : ecu.length === 2 ? ecu : undefined
  if (addr === '10' || addr === '11') return 'Moteur'
  if (addr === '18' || addr === '19') return 'Boîte de vitesses'
  if (ecu === UNKNOWN_ECU) return 'Calculateur'
  return `Calculateur ${ecu}`
}
