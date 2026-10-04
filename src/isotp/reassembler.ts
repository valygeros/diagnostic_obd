/**
 * ISO 15765-2 (ISO-TP) reassembly of CAN frames as printed by an ELM327 with headers on.
 * Each frame payload starts with the PCI byte(s):
 *   0x0L          single frame, L data bytes
 *   0x1L LL       first frame, 12-bit total length, then 6 data bytes
 *   0x2N          consecutive frame, sequence N (1..F, 0, 1…), then up to 7 data bytes
 *   0x3x          flow control (sent by the tester; ignored if echoed)
 * Padding bytes after the declared length are dropped.
 */

export interface CanFrame {
  /** CAN identifier as printed (e.g. "7E8", "18DAF110"). */
  id: string
  bytes: number[]
}

export interface IsoTpMessage {
  id: string
  data: number[]
}

interface Pending {
  expected: number
  data: number[]
  nextSeq: number
}

export class IsoTpError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IsoTpError'
  }
}

/**
 * Reassembles frames (in arrival order, possibly interleaved between ECUs) into messages.
 * Incomplete multi-frame messages are reported as errors rather than silently truncated.
 */
export function reassemble(frames: readonly CanFrame[]): IsoTpMessage[] {
  const out: IsoTpMessage[] = []
  const pending = new Map<string, Pending>()

  for (const { id, bytes } of frames) {
    const pci = bytes[0]
    if (pci === undefined) continue
    const type = pci >> 4

    if (type === 0) {
      let len = pci & 0x0f
      let start = 1
      if (len === 0) {
        // CAN FD escape: length in the next byte.
        len = bytes[1] ?? 0
        start = 2
      }
      out.push({ id, data: bytes.slice(start, start + len) })
    } else if (type === 1) {
      const expected = ((pci & 0x0f) << 8) | (bytes[1] ?? 0)
      pending.set(id, { expected, data: bytes.slice(2, 2 + Math.min(6, expected)), nextSeq: 1 })
    } else if (type === 2) {
      const p = pending.get(id)
      if (!p) throw new IsoTpError(`Trame de suite sans trame de début (${id})`)
      const seq = pci & 0x0f
      if (seq !== p.nextSeq) {
        throw new IsoTpError(`Trame manquante pour ${id} (attendu ${p.nextSeq}, reçu ${seq})`)
      }
      p.data.push(...bytes.slice(1, 1 + Math.min(7, p.expected - p.data.length)))
      p.nextSeq = (p.nextSeq + 1) & 0x0f
      if (p.data.length >= p.expected) {
        out.push({ id, data: p.data })
        pending.delete(id)
      }
    }
    // type 3 (flow control) and others: ignored.
  }

  for (const [id, p] of pending) {
    throw new IsoTpError(`Réponse incomplète de ${id} (${p.data.length}/${p.expected} octets)`)
  }
  return out
}
