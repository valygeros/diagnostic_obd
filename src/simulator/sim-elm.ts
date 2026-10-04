/**
 * Simulated ELM327 adapter + vehicle. Speaks the same text protocol as a real dongle
 * (echo, spaces, headers, SEARCHING…, ISO-TP framing, legacy checksums) so the real client
 * code runs unchanged against it.
 */

import { encodeDtc } from '../obd/dtc'
import { encodeSupportedBitmap, isBitmapPid } from '../obd/supported'
import type { Responder } from '../transport/mock-transport'
import type { Scenario, SimEcu } from './types'

interface Settings {
  echo: boolean
  linefeeds: boolean
  spaces: boolean
  headers: boolean
  protocol: string // '0' = auto
}

const DEFAULTS: Settings = {
  echo: true,
  linefeeds: true,
  spaces: true,
  headers: false,
  protocol: '0',
}

type DtcState = { stored: string[]; pending: string[]; permanent: string[] }

export class SimulatedElm implements Responder {
  private settings: Settings = { ...DEFAULTS }
  private found = false
  private requests = 0
  private readonly start: number
  private readonly dtcs = new Map<string, DtcState>()

  constructor(
    readonly scenario: Scenario,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.start = now()
    for (const ecu of scenario.ecus) {
      this.dtcs.set(ecu.id, {
        stored: [...(ecu.dtcs?.stored ?? [])],
        pending: [...(ecu.dtcs?.pending ?? [])],
        permanent: [...(ecu.dtcs?.permanent ?? [])],
      })
    }
  }

  get name(): string {
    return `Démo · ${this.scenario.label}`
  }

  delayFor(command: string): number {
    const cmd = command.replace(/\s/g, '').toUpperCase()
    if (cmd === 'ATZ') return 300
    if (!cmd.startsWith('AT') && !this.found && this.settings.protocol === '0') {
      return this.scenario.behaviour?.searchDelayMs ?? 800
    }
    return 0
  }

  handle(command: string): string | { disconnect: string } | { silent: true } {
    const cmd = command.replace(/\s/g, '').toUpperCase()
    const quirks = this.scenario.adapter?.quirks
    // The chip echoes the command before executing it (so ATE0 is itself echoed).
    const echoOn = this.settings.echo || quirks?.ignoresEchoOff
    let body: string
    if (cmd === '') body = ''
    else if (cmd.startsWith('AT')) body = this.at(cmd.slice(2))
    else if (cmd.startsWith('ST'))
      body = this.scenario.adapter?.stnId && cmd === 'STI' ? this.scenario.adapter.stnId : '?'
    else {
      const limit = this.scenario.behaviour?.disconnectAfterRequests
      if (limit !== undefined && ++this.requests > limit) {
        return { disconnect: 'Liaison Bluetooth perdue (simulation)' }
      }
      body = this.obd(cmd)
    }
    const echo = echoOn ? command + '\r' : ''
    const out = echo + body
    return quirks?.lowercase ? out.toLowerCase() : out
  }

  // ---- AT commands --------------------------------------------------------------------

  private at(c: string): string {
    if (this.scenario.adapter?.quirks?.refuses?.includes('AT' + c)) return '?'
    const s = this.settings
    if (c === 'Z' || c === 'WS') {
      this.settings = { ...DEFAULTS }
      this.found = false
      return '\r' + (this.scenario.adapter?.id ?? 'ELM327 v1.5')
    }
    if (c === 'D') {
      this.settings = { ...DEFAULTS, echo: s.echo }
      return 'OK'
    }
    const flag = /^([ELSH])([01])$/.exec(c)
    if (flag) {
      const on = flag[2] === '1'
      if (flag[1] === 'E') s.echo = on
      if (flag[1] === 'L') s.linefeeds = on
      if (flag[1] === 'S') s.spaces = on
      if (flag[1] === 'H') s.headers = on
      return 'OK'
    }
    if (/^AT[012]$/.test(c) || /^ST[0-9A-F]{2}$/.test(c) || /^CAF[01]$/.test(c)) return 'OK'
    const sp = /^SPA?([0-9A-C])$/.exec(c)
    if (sp) {
      s.protocol = sp[1] ?? '0'
      this.found = s.protocol !== '0' && s.protocol === this.scenario.protocol
      return 'OK'
    }
    if (c === 'DPN') {
      if (s.protocol !== '0') return s.protocol
      return this.found ? 'A' + this.scenario.protocol : '0'
    }
    if (c === 'RV') return `${(this.scenario.adapter?.voltage ?? 12.6).toFixed(1)}V`
    if (c === 'I') return this.scenario.adapter?.id ?? 'ELM327 v1.5'
    if (c === '@1') return 'OBDII to RS232 Interpreter'
    return '?'
  }

  // ---- OBD requests -------------------------------------------------------------------

  private obd(cmd: string): string {
    const hex = cmd.length % 2 === 1 ? cmd.slice(0, -1) : cmd
    if (!/^[0-9A-F]+$/.test(hex)) return '?'
    const bytes = hex.match(/../g)?.map((b) => parseInt(b, 16)) ?? []

    const searching = this.settings.protocol === '0' && !this.found
    const prefix = searching ? 'SEARCHING...\r' : ''
    if (this.scenario.behaviour?.noVehicle) return prefix + 'UNABLE TO CONNECT'
    if (this.settings.protocol !== '0' && this.settings.protocol !== this.scenario.protocol) {
      return 'UNABLE TO CONNECT'
    }
    this.found = true

    const lines: string[] = []
    for (const ecu of this.scenario.ecus) {
      const payloads = this.respond(ecu, bytes)
      for (const p of payloads) lines.push(...this.format(ecu, p))
    }
    return prefix + (lines.length ? lines.join(this.eol()) : 'NO DATA')
  }

  /** Returns the response payload(s) of one ECU, or [] if it stays silent. */
  private respond(ecu: SimEcu, req: number[]): number[][] {
    const [service, ...args] = req
    const can = this.isCan()
    const state = this.dtcs.get(ecu.id)
    switch (service) {
      case 0x01: {
        if (args.length === 0) return []
        const out: number[] = [0x41]
        for (const pid of args.slice(0, 6)) {
          const data = this.pidData(ecu, pid)
          if (data) out.push(pid, ...data)
        }
        return out.length > 1 ? [out] : []
      }
      case 0x03:
        return this.dtcPayloads(0x43, state?.stored ?? [], can)
      case 0x07:
        return this.dtcPayloads(0x47, state?.pending ?? [], can)
      case 0x0a:
        return this.dtcPayloads(0x4a, state?.permanent ?? [], can)
      case 0x04:
        if (state) {
          state.stored = []
          state.pending = []
        }
        return [[0x44]]
      case 0x09:
        return this.mode09(ecu, args[0], can)
      default:
        return []
    }
  }

  private pidData(ecu: SimEcu, pid: number): readonly number[] | undefined {
    if (isBitmapPid(pid)) {
      const keys = [...Object.keys(ecu.pids).map(Number), 0x01]
      const inRange = keys.filter((k) => k > pid && k <= pid + 0x20)
      const hasNext = keys.some((k) => k > pid + 0x20)
      if (pid !== 0 && inRange.length === 0) return undefined
      return encodeSupportedBitmap(pid, hasNext ? [...inRange, pid + 0x20] : inRange)
    }
    if (pid === 0x01) {
      const stored = this.dtcs.get(ecu.id)?.stored.length ?? 0
      const mil = ecu.mil ?? stored > 0
      const [b, c, d] = ecu.monitors ?? [0x07, 0x65, 0x00]
      return [(mil ? 0x80 : 0) | Math.min(stored, 0x7f), b, c, d]
    }
    const v = ecu.pids[pid]
    if (v === undefined) return undefined
    return typeof v === 'function' ? v((this.now() - this.start) / 1000) : v
  }

  private dtcPayloads(service: number, codes: string[], can: boolean): number[][] {
    const bytes = codes.flatMap((c) => encodeDtc(c))
    if (can) return [[service, codes.length, ...bytes]]
    // Legacy: 3 codes per message, zero-padded; one message even with no code.
    const out: number[][] = []
    for (let i = 0; i < Math.max(1, codes.length); i += 3) {
      const chunk = bytes.slice(i * 2, i * 2 + 6)
      while (chunk.length < 6) chunk.push(0)
      out.push([service, ...chunk])
    }
    return out
  }

  private mode09(ecu: SimEcu, pid: number | undefined, can: boolean): number[][] {
    const supported = [ecu.vin && 0x02, ecu.ecuName && 0x0a].filter((x): x is number => !!x)
    if (pid === 0x00)
      return supported.length ? [[0x49, 0x00, ...encodeSupportedBitmap(0, supported)]] : []
    const ascii = (s: string) => [...s].map((ch) => ch.charCodeAt(0))
    if (pid === 0x02 && ecu.vin) {
      const vin = ascii(ecu.vin)
      if (can) return [[0x49, 0x02, 0x01, ...vin]]
      const padded = [0, 0, 0, ...vin] // 20 bytes = 5 messages × 4
      return [0, 1, 2, 3, 4].map((i) => [0x49, 0x02, i + 1, ...padded.slice(i * 4, i * 4 + 4)])
    }
    if (pid === 0x0a && ecu.ecuName && can) {
      const name = ascii(ecu.ecuName.padEnd(20, '\0').slice(0, 20))
      return [[0x49, 0x0a, 0x01, ...name]]
    }
    return []
  }

  // ---- formatting ---------------------------------------------------------------------

  private isCan(): boolean {
    return ['6', '7', '8', '9'].includes(this.scenario.protocol)
  }

  private eol(): string {
    return this.settings.linefeeds ? '\r\n' : '\r'
  }

  private hex(bytes: readonly number[]): string {
    const parts = bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    return parts.join(this.settings.spaces ? ' ' : '')
  }

  private join(header: string, bytes: readonly number[]): string {
    return header + (this.settings.spaces ? ' ' : '') + this.hex(bytes)
  }

  /** Formats one payload into the lines a real ELM327 would print. */
  private format(ecu: SimEcu, payload: number[]): string[] {
    const { headers } = this.settings
    if (!this.isCan()) {
      if (!headers) return [this.hex(payload)]
      const addr = parseInt(ecu.id, 16)
      const kwp = this.scenario.protocol === '4' || this.scenario.protocol === '5'
      const header = kwp ? [0x80 | payload.length, 0xf1, addr] : [0x48, 0x6b, addr]
      const all = [...header, ...payload]
      const checksum = all.reduce((a, b) => a + b, 0) & 0xff
      return [this.hex([...all, checksum])]
    }

    if (payload.length <= 7) {
      if (!headers) return [this.hex(payload)]
      const frame = [payload.length, ...payload]
      while (frame.length < 8) frame.push(0x00)
      return [this.join(ecu.id, frame)]
    }

    // ISO-TP multi-frame
    if (!headers) {
      const lines = [payload.length.toString(16).toUpperCase().padStart(3, '0')]
      lines.push(`0:${this.settings.spaces ? ' ' : ''}${this.hex(payload.slice(0, 6))}`)
      let seq = 1
      for (let i = 6; i < payload.length; i += 7, seq++) {
        const chunk = payload.slice(i, i + 7)
        while (chunk.length < 7) chunk.push(0x00)
        lines.push(
          `${(seq & 0xf).toString(16).toUpperCase()}:${this.settings.spaces ? ' ' : ''}${this.hex(chunk)}`,
        )
      }
      return lines
    }
    const lines = [
      this.join(ecu.id, [
        0x10 | (payload.length >> 8),
        payload.length & 0xff,
        ...payload.slice(0, 6),
      ]),
    ]
    let seq = 1
    for (let i = 6; i < payload.length; i += 7, seq++) {
      const frame = [0x20 | (seq & 0x0f), ...payload.slice(i, i + 7)]
      while (frame.length < 8) frame.push(0x00)
      lines.push(this.join(ecu.id, frame))
    }
    return lines
  }
}
