/**
 * In-memory transport talking to a simulated adapter (CLAUDE.md §11).
 * Replies are delivered in small chunks, like BLE notifications, to exercise reassembly.
 */

import { Emitter, TransportError, type Transport, type Unsubscribe } from './types'

export interface Responder {
  /** Name shown as the device name. */
  readonly name: string
  /**
   * Handles one command (without the trailing CR). Returns the reply text up to — not including —
   * the prompt, or `{ disconnect }` to simulate a lost link, or `{ silent }` to never answer.
   */
  handle(command: string): string | { disconnect: string } | { silent: true }
  /** Extra delay before replying to this command (e.g. protocol search). */
  delayFor?(command: string): number
}

export interface MockOptions {
  /** Base latency per reply, ms. */
  latencyMs?: number
  /** Chunk size for incoming data (BLE MTU-like). */
  chunkSize?: number
}

export class MockTransport implements Transport {
  readonly kind = 'Simulateur'
  private _connected = false
  private input = ''
  private readonly data = new Emitter<string>()
  private readonly lost = new Emitter<string>()
  private readonly latency: number
  private readonly chunkSize: number

  constructor(
    private readonly responder: Responder,
    opts: MockOptions = {},
  ) {
    this.latency = opts.latencyMs ?? 15
    this.chunkSize = opts.chunkSize ?? 20
  }

  get deviceName(): string {
    return this.responder.name
  }

  get connected(): boolean {
    return this._connected
  }

  async connect(): Promise<void> {
    await sleep(this.latency)
    this._connected = true
  }

  async write(text: string): Promise<void> {
    if (!this._connected) throw new TransportError('Simulateur déconnecté', 'not-connected')
    this.input += text
    let idx: number
    while ((idx = this.input.indexOf('\r')) >= 0) {
      const command = this.input.slice(0, idx)
      this.input = this.input.slice(idx + 1)
      void this.reply(command)
    }
  }

  onData(cb: (chunk: string) => void): Unsubscribe {
    return this.data.on(cb)
  }

  onDisconnect(cb: (reason: string) => void): Unsubscribe {
    return this.lost.on(cb)
  }

  async disconnect(): Promise<void> {
    this._connected = false
  }

  private async reply(command: string): Promise<void> {
    const result = this.responder.handle(command)
    await sleep(this.latency + (this.responder.delayFor?.(command) ?? 0))
    if (!this._connected) return
    if (typeof result !== 'string') {
      if ('disconnect' in result) {
        this._connected = false
        this.lost.emit(result.disconnect)
      }
      return
    }
    const text = result + '\r\r>'
    for (let i = 0; i < text.length; i += this.chunkSize) {
      this.data.emit(text.slice(i, i + this.chunkSize))
    }
  }
}

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve()
}
