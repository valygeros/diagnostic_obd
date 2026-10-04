/**
 * Byte-level link to the OBD dongle (CLAUDE.md §6.1). Text in, text out:
 * ELM327 adapters speak ASCII, so transports deal in strings.
 */

export type Unsubscribe = () => void

export interface Transport {
  /** Human-readable kind, e.g. "Bluetooth (BLE)", "Simulateur". */
  readonly kind: string
  /** Device name once connected (BLE advertised name, simulator scenario…). */
  readonly deviceName: string | undefined
  readonly connected: boolean
  /** Must be called from a user gesture for BLE. */
  connect(): Promise<void>
  /** Sends raw text. The caller appends the trailing `\r`. */
  write(text: string): Promise<void>
  /** Raw incoming text, in whatever chunks the link delivers. */
  onData(cb: (chunk: string) => void): Unsubscribe
  /** Fired on unexpected link loss (not on a deliberate `disconnect()`). */
  onDisconnect(cb: (reason: string) => void): Unsubscribe
  disconnect(): Promise<void>
}

/** Small typed event helper shared by transports. */
export class Emitter<T> {
  private listeners = new Set<(value: T) => void>()

  on(cb: (value: T) => void): Unsubscribe {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  emit(value: T): void {
    for (const cb of [...this.listeners]) cb(value)
  }

  clear(): void {
    this.listeners.clear()
  }
}

export class TransportError extends Error {
  constructor(
    message: string,
    /** Stable code the UI maps to a French explanation. */
    readonly code:
      | 'cancelled'
      | 'unsupported'
      | 'no-matching-profile'
      | 'connection-failed'
      | 'not-connected'
      | 'write-failed',
  ) {
    super(message)
    this.name = 'TransportError'
  }
}
