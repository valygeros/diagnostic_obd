/**
 * Raw frame log (CLAUDE.md §6.1): every byte exchanged with the dongle, timestamped.
 * Tool #1 for adding support for a new car or dongle. Kept in memory, bounded.
 */

import { Emitter, type Transport, type Unsubscribe } from './types'

export type LogDirection = 'tx' | 'rx' | 'info' | 'error'

export interface LogEntry {
  /** Milliseconds since the log was created. */
  t: number
  dir: LogDirection
  text: string
}

export class RawLog {
  private entries: LogEntry[] = []
  private start: number
  private readonly changes = new Emitter<void>()

  constructor(
    readonly capacity = 5000,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.start = now()
  }

  add(dir: LogDirection, text: string): void {
    this.entries.push({ t: Math.round(this.now() - this.start), dir, text })
    if (this.entries.length > this.capacity) {
      this.entries.splice(0, this.entries.length - this.capacity)
    }
    this.changes.emit()
  }

  info(text: string): void {
    this.add('info', text)
  }

  error(text: string): void {
    this.add('error', text)
  }

  all(): readonly LogEntry[] {
    return this.entries
  }

  get size(): number {
    return this.entries.length
  }

  clear(): void {
    this.entries = []
    this.start = this.now()
    this.changes.emit()
  }

  onChange(cb: () => void): Unsubscribe {
    return this.changes.on(cb)
  }

  /**
   * Plain-text export. `maskVin` hides VINs (17 chars, no I/O/Q) so logs can be shared
   * or turned into test fixtures (CLAUDE.md §9.4, §11).
   */
  toText({ maskVin = true }: { maskVin?: boolean } = {}): string {
    const arrow: Record<LogDirection, string> = { tx: '>>', rx: '<<', info: '--', error: '!!' }
    return this.entries
      .map((e) => {
        const text = maskVin ? maskVins(e.text) : e.text
        return `${(e.t / 1000).toFixed(3).padStart(9)} ${arrow[e.dir]} ${visible(text)}`
      })
      .join('\n')
  }
}

/** Makes control characters readable in the log. */
function visible(text: string): string {
  return text.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
}

const VIN_TEXT = /\b[A-HJ-NPR-Z0-9]{17}\b/g

/** Masks VINs written as text, and as the hex ASCII bytes of a mode 09 reply. */
export function maskVins(text: string): string {
  let out = text.replace(VIN_TEXT, (vin) => vin.slice(0, 3) + '*'.repeat(14))
  // Hex form: 17 consecutive ASCII-printable bytes (VIN chars), with or without spaces.
  out = out.replace(/((?:[3-5][0-9A-F] ?){17})/gi, (hex) => {
    const bytes = hex.replace(/ /g, '').match(/../g) ?? []
    const ascii = bytes.map((b) => String.fromCharCode(parseInt(b, 16))).join('')
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(ascii)) return hex
    const sep = hex.includes(' ') ? ' ' : ''
    return bytes.map((b, i) => (i < 3 ? b : '**')).join(sep) + (hex.endsWith(' ') ? ' ' : '')
  })
  return out
}

/** Wraps a transport so every write and every received chunk lands in the log. */
export function withLog(inner: Transport, log: RawLog): Transport {
  return {
    get kind() {
      return inner.kind
    },
    get deviceName() {
      return inner.deviceName
    },
    get connected() {
      return inner.connected
    },
    async connect() {
      log.info(`connexion (${inner.kind})…`)
      try {
        await inner.connect()
        log.info(`connecté : ${inner.deviceName ?? 'appareil sans nom'}`)
      } catch (e) {
        log.error(`échec de connexion : ${e instanceof Error ? e.message : String(e)}`)
        throw e
      }
    },
    async write(text) {
      log.add('tx', text)
      await inner.write(text)
    },
    onData(cb) {
      return inner.onData(cb)
    },
    onDisconnect(cb) {
      return inner.onDisconnect(cb)
    },
    async disconnect() {
      log.info('déconnexion')
      await inner.disconnect()
    },
  }
}

/** Subscribes the log to incoming data and link loss. Returns the unsubscribe function. */
export function attachLog(transport: Transport, log: RawLog): Unsubscribe {
  const offData = transport.onData((chunk) => log.add('rx', chunk))
  const offDisc = transport.onDisconnect((reason) => log.error(`connexion perdue : ${reason}`))
  return () => {
    offData()
    offDisc()
  }
}
