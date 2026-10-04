/**
 * Generic OBD-II services on top of the ELM327 client (CLAUDE.md §6.3).
 * Results are always grouped per ECU.
 */

import type { Elm327 } from '../elm327/client'
import type { EcuMessage } from '../elm327/frames'
import { ElmError } from '../elm327/response'
import type { ClearAuthorization } from '../elm327/safety'
import { vinFromBytes } from '../vin/vin'
import { DTC_SERVICES, parseDtcPayload, type DtcKind } from './dtc'
import { parseMonitorStatus, type MonitorStatus } from './status'
import { BITMAP_PIDS, decodeSupportedBitmap } from './supported'

/** UDS/OBD negative response codes worth explaining (ISO 14229-1 annex A). */
const NRC: Record<number, string> = {
  0x10: 'refus général',
  0x11: 'service non pris en charge',
  0x12: 'sous-fonction non prise en charge',
  0x21: 'calculateur occupé, réessayer',
  0x22: 'conditions non remplies (moteur tournant ? vitesse ?)',
  0x31: 'demande hors limites',
  0x78: 'réponse en attente',
}

export class NegativeResponseError extends Error {
  constructor(
    readonly ecu: string,
    readonly service: number,
    readonly nrc: number,
  ) {
    super(`Le calculateur ${ecu} a refusé la demande : ${NRC[nrc] ?? `code 0x${nrc.toString(16)}`}`)
    this.name = 'NegativeResponseError'
  }
}

/** Keeps positive replies to `service`; throws if every ECU answered negatively. */
function positive(msgs: EcuMessage[], service: number): EcuMessage[] {
  const ok = msgs.filter((m) => m.data[0] === service + 0x40)
  if (ok.length === 0) {
    const neg = msgs.find((m) => m.data[0] === 0x7f && m.data[1] === service)
    if (neg) throw new NegativeResponseError(neg.ecu, service, neg.data[2] ?? 0)
  }
  return ok
}

/** NO DATA means "nobody has this": an empty answer, not a failure. */
async function orEmpty(p: Promise<EcuMessage[]>): Promise<EcuMessage[]> {
  try {
    return await p
  } catch (e) {
    if (e instanceof ElmError && e.code === 'NO_DATA') return []
    throw e
  }
}

export class ObdClient {
  constructor(readonly elm: Elm327) {}

  get isCan(): boolean {
    return this.elm.protocol?.can ?? true
  }

  /** Service 01 supported PIDs per ECU, walking the 00/20/40… bitmaps. */
  async supportedPids(first?: EcuMessage[]): Promise<Map<string, Set<number>>> {
    const result = new Map<string, Set<number>>()
    for (const base of BITMAP_PIDS) {
      const pidHex = base.toString(16).toUpperCase().padStart(2, '0')
      const msgs =
        base === 0 && first ? first : positive(await orEmpty(this.elm.request('01' + pidHex)), 0x01)
      let more = false
      for (const m of msgs) {
        if (m.data[1] !== base) continue
        const pids = decodeSupportedBitmap(base, m.data.slice(2, 6))
        const set = result.get(m.ecu) ?? new Set<number>()
        for (const p of pids) set.add(p)
        result.set(m.ecu, set)
        if (pids.includes(base + 0x20)) more = true
      }
      if (!more) break
    }
    return result
  }

  /** PID 01: check engine light, code count, ignition type, readiness bytes. */
  async monitorStatus(): Promise<Map<string, MonitorStatus>> {
    const msgs = positive(await orEmpty(this.elm.request('0101')), 0x01)
    return new Map(
      msgs
        .filter((m) => m.data[1] === 0x01)
        .map((m) => [m.ecu, parseMonitorStatus(m.data.slice(2))]),
    )
  }

  /** Services 03 / 07 / 0A. ECUs that stay silent are simply absent from the map. */
  async dtcs(kind: DtcKind): Promise<Map<string, string[]>> {
    const { request, response } = DTC_SERVICES[kind]
    const msgs = await orEmpty(this.elm.request(request, { timeoutMs: 5000 }))
    const result = new Map<string, string[]>()
    for (const m of positive(msgs, response - 0x40)) {
      const codes = parseDtcPayload(m.data, this.isCan)
      result.set(m.ecu, [...(result.get(m.ecu) ?? []), ...codes])
    }
    return result
  }

  /**
   * Service 04. Needs the authorization produced by the confirmation flow (CLAUDE.md §9.2).
   * Returns the ECUs that acknowledged.
   */
  async clearDtcs(authorization: ClearAuthorization): Promise<string[]> {
    const msgs = await this.elm.request('04', {
      ctx: { clearAuthorization: authorization },
      timeoutMs: 5000,
    })
    return positive(msgs, 0x04).map((m) => m.ecu)
  }

  /** Service 09 PID 02. Legacy protocols split it into numbered messages. */
  async vin(): Promise<string | undefined> {
    const msgs = positive(await orEmpty(this.elm.request('0902', { timeoutMs: 5000 })), 0x09)
    const byEcu = new Map<string, EcuMessage[]>()
    for (const m of msgs.filter((m) => m.data[1] === 0x02)) {
      byEcu.set(m.ecu, [...(byEcu.get(m.ecu) ?? []), m])
    }
    for (const parts of byEcu.values()) {
      const bytes = this.isCan
        ? parts.flatMap((m) => m.data.slice(3))
        : [...parts]
            .sort((a, b) => (a.data[2] ?? 0) - (b.data[2] ?? 0))
            .flatMap((m) => m.data.slice(3))
      const vin = vinFromBytes(bytes)
      if (vin) return vin
    }
    return undefined
  }

  /** Service 09 PID 0A: ECU names, when supported (CAN mostly). */
  async ecuNames(): Promise<Map<string, string>> {
    const msgs = positive(await orEmpty(this.elm.request('090A')), 0x09)
    const result = new Map<string, string>()
    for (const m of msgs.filter((m) => m.data[1] === 0x0a)) {
      const text = String.fromCharCode(
        ...m.data.slice(3).filter((b) => b >= 0x20 && b < 0x7f),
      ).trim()
      if (text) result.set(m.ecu, text)
    }
    return result
  }
}
