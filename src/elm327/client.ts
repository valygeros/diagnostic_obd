/**
 * ELM327 client (CLAUDE.md §6.2): one command in flight at a time, reply ends with the `>` prompt.
 * Every command passes the read-only safety filter before reaching the transport.
 */

import type { RawLog } from '../transport/raw-log'
import { TransportError, type Transport, type Unsubscribe } from '../transport/types'
import { parseFrames, type EcuMessage } from './frames'
import { parseDpn, PROTOCOLS, type ProtocolInfo } from './protocols'
import { cleanLines, ElmError, splitErrors } from './response'
import { assertAllowed, type CommandContext } from './safety'

export class ElmTimeoutError extends Error {
  constructor(readonly command: string) {
    super(`Le dongle n'a pas répondu à temps (${command}).`)
    this.name = 'ElmTimeoutError'
  }
}

export interface ElmOptions {
  log?: RawLog
  /** Default per-command timeout. */
  timeoutMs?: number
  /** First OBD request after ATSP0: the adapter may spend seconds "SEARCHING...". */
  searchTimeoutMs?: number
  /** ATZ restarts the chip. */
  resetTimeoutMs?: number
  /** Force an ELM protocol ('1'..'C') instead of automatic search. */
  forcedProtocol?: string
}

export interface AdapterInfo {
  /** ATI reply, e.g. "ELM327 v1.5". */
  id: string | undefined
  /** STI reply on OBDLink (STN chips). */
  stnId: string | undefined
  /** Battery voltage seen by the adapter (pin 16). */
  voltage: number | undefined
  headers: boolean
  /** Settings the adapter refused — typical of low-end clones. */
  refused: string[]
}

interface Pending {
  command: string
  resolve: (raw: string) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class Elm327 {
  /** Protocol in use, known after `connectVehicle()`. */
  protocol: ProtocolInfo | undefined
  /** Whether replies carry headers (ATH1 accepted). */
  headers = true
  adapter: AdapterInfo | undefined

  private buffer = ''
  private pending: Pending | undefined
  private chain: Promise<unknown> = Promise.resolve()
  private needsResync = false
  private closed = false
  private readonly subs: Unsubscribe[]
  private readonly opts: Required<Omit<ElmOptions, 'log' | 'forcedProtocol'>> &
    Pick<ElmOptions, 'log' | 'forcedProtocol'>

  constructor(
    private readonly transport: Transport,
    options: ElmOptions = {},
  ) {
    this.opts = {
      timeoutMs: 2500,
      searchTimeoutMs: 20000,
      resetTimeoutMs: 5000,
      ...options,
    }
    this.subs = [
      transport.onData((chunk) => this.onData(chunk)),
      transport.onDisconnect((reason) => this.fail(new TransportError(reason, 'not-connected'))),
    ]
  }

  /** Stops listening to the transport; pending and queued commands fail. */
  dispose(): void {
    this.closed = true
    for (const off of this.subs) off()
    this.fail(new TransportError('Connexion fermée', 'not-connected'))
  }

  /**
   * Sends one command and returns its cleaned lines (echo, prompt, SEARCHING… removed).
   * Commands are serialised; the safety filter runs before anything is written.
   */
  send(
    command: string,
    opts: { timeoutMs?: number; ctx?: CommandContext; preserveCase?: boolean } = {},
  ): Promise<string[]> {
    // Check synchronously so a refused command never even enters the queue.
    assertAllowed(command, opts.ctx)
    const run = async () => {
      if (this.closed) throw new TransportError('Connexion fermée', 'not-connected')
      if (this.needsResync) await this.resync()
      const raw = await this.exchange(command, opts.timeoutMs ?? this.opts.timeoutMs)
      return cleanLines(raw, command, { preserveCase: opts.preserveCase ?? false })
    }
    const result = this.chain.then(run, run)
    this.chain = result.catch(() => undefined)
    return result
  }

  /**
   * Sends an OBD/UDS request and returns one message per answering ECU.
   * Throws ElmError when no ECU answered (NO DATA, UNABLE TO CONNECT…).
   */
  async request(
    hex: string,
    opts: { timeoutMs?: number; ctx?: CommandContext } = {},
  ): Promise<EcuMessage[]> {
    const lines = await this.send(hex, opts)
    const { data, error } = splitErrors(lines)
    if (error) throw new ElmError(error, hex, lines.join(' | '))
    return parseFrames(data, this.protocol, this.headers)
  }

  /** Resets and configures the adapter. Does not talk to the car yet. */
  async initAdapter(): Promise<AdapterInfo> {
    const refused: string[] = []
    // Some adapters don't answer ATZ over BLE in time: not fatal, the next commands tell.
    await this.send('ATZ', { timeoutMs: this.opts.resetTimeoutMs }).catch((e: unknown) => {
      if (!(e instanceof ElmTimeoutError)) throw e
    })

    const setting = async (cmd: string, required = false) => {
      const lines = await this.send(cmd)
      const ok = lines.some((l) => l === 'OK') && !lines.includes('?')
      if (!ok) {
        refused.push(cmd)
        if (required) throw new ElmError('UNKNOWN_COMMAND', cmd, lines.join(' | '))
      }
      return ok
    }

    await setting('ATE0', true)
    await setting('ATL0')
    await setting('ATS0')
    this.headers = await setting('ATH1')
    await setting('ATAT1')
    const forced = this.opts.forcedProtocol
    await setting(forced && PROTOCOLS[forced] ? `ATSP${forced}` : 'ATSP0', true)

    const id = (await this.send('ATI', { preserveCase: true })).find((l) => l !== '?')
    const stn = (await this.send('STI', { preserveCase: true })).find((l) => l !== '?')
    this.adapter = {
      id,
      stnId: stn,
      voltage: await this.readVoltage(),
      headers: this.headers,
      refused,
    }
    this.opts.log?.info(
      `dongle : ${id ?? 'inconnu'}${stn ? ` / ${stn}` : ''}` +
        (refused.length ? ` — réglages refusés : ${refused.join(', ')}` : ''),
    )
    return this.adapter
  }

  /**
   * First request to the car (protocol search) and protocol detection.
   * Returns the ECUs that answered 0100. Throws ElmError (e.g. UNABLE_TO_CONNECT) if the car is silent.
   */
  async connectVehicle(): Promise<EcuMessage[]> {
    this.protocol = undefined
    const lines = await this.send('0100', { timeoutMs: this.opts.searchTimeoutMs })
    const { data, error } = splitErrors(lines)
    if (error) throw new ElmError(error, '0100', lines.join(' | '))

    const dpn = (await this.send('ATDPN'))[0] ?? ''
    this.protocol = parseDpn(dpn)?.protocol
    this.opts.log?.info(`protocole : ${this.protocol?.name ?? `inconnu (${dpn})`}`)
    return parseFrames(data, this.protocol, this.headers)
  }

  async readVoltage(): Promise<number | undefined> {
    const line = (await this.send('ATRV'))[0] ?? ''
    const m = /^(\d+(?:\.\d+)?)V?$/.exec(line)
    return m ? Number(m[1]) : undefined
  }

  // ---- internals ----------------------------------------------------------------------

  private exchange(command: string, timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined
        // The adapter may still be busy: realign on the next prompt before the next command.
        this.needsResync = true
        reject(new ElmTimeoutError(command))
      }, timeoutMs)
      this.pending = { command, resolve, reject, timer }
      this.transport.write(command + '\r').catch((e: unknown) => {
        clearTimeout(timer)
        this.pending = undefined
        reject(e instanceof Error ? e : new Error(String(e)))
      })
    })
  }

  /** Sends a bare CR and waits for a prompt, discarding whatever was in flight. */
  private async resync(): Promise<void> {
    this.needsResync = false
    this.buffer = ''
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.pending = undefined
        resolve()
      }, 1000)
      this.pending = {
        command: '\\r',
        resolve: () => {
          clearTimeout(timer)
          resolve()
        },
        reject: () => resolve(),
        timer,
      }
      this.transport.write('\r').catch(() => resolve())
    })
    this.opts.log?.info('resynchronisation avec le dongle')
  }

  private onData(chunk: string): void {
    this.buffer += chunk
    let idx: number
    while ((idx = this.buffer.indexOf('>')) >= 0) {
      const reply = this.buffer.slice(0, idx)
      this.buffer = this.buffer.slice(idx + 1)
      const p = this.pending
      if (!p) continue // stale reply after a timeout: drop it
      this.pending = undefined
      clearTimeout(p.timer)
      p.resolve(reply)
    }
  }

  private fail(err: Error): void {
    const p = this.pending
    if (!p) return
    this.pending = undefined
    clearTimeout(p.timer)
    p.reject(err)
  }
}
