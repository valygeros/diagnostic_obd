/**
 * Web Bluetooth (BLE GATT) transport (CLAUDE.md §6.1). Works in Chrome/Edge and in Bluefy on iOS.
 * - writes split in ≤ 20-byte packets (minimum BLE MTU)
 * - notifications decoded as ASCII
 * - unexpected disconnection reported, with one automatic reconnection attempt available
 */

import { ALL_SERVICES, BLE_PROFILES, type BleProfile } from './ble-profiles'
import type { RawLog } from './raw-log'
import { Emitter, TransportError, type Transport, type Unsubscribe } from './types'

const CHUNK = 20

export class BleTransport implements Transport {
  readonly kind = 'Bluetooth (BLE)'
  profile: BleProfile | undefined
  private device: BluetoothDevice | undefined
  private rx: BluetoothRemoteGATTCharacteristic | undefined
  private tx: BluetoothRemoteGATTCharacteristic | undefined
  private writeWithoutResponse = false
  private deliberate = false
  private readonly decoder = new TextDecoder('latin1')
  private readonly data = new Emitter<string>()
  private readonly lost = new Emitter<string>()
  /** Writes must not overlap on a GATT characteristic. */
  private writing: Promise<void> = Promise.resolve()

  constructor(private readonly log?: RawLog) {}

  static isAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  get deviceName(): string | undefined {
    return this.device?.name ?? undefined
  }

  get connected(): boolean {
    return this.device?.gatt?.connected === true && this.tx !== undefined
  }

  /** Opens the browser device picker. Must run inside a user gesture (click). */
  async connect(): Promise<void> {
    if (!BleTransport.isAvailable()) {
      throw new TransportError("Ce navigateur n'a pas le Bluetooth web", 'unsupported')
    }
    if (!this.device) {
      try {
        this.device = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ALL_SERVICES,
        })
      } catch (e) {
        if (e instanceof DOMException && e.name === 'NotFoundError') {
          throw new TransportError('Aucun appareil choisi', 'cancelled')
        }
        throw new TransportError(errorText(e), 'connection-failed')
      }
      this.device.addEventListener('gattserverdisconnected', this.onGattDisconnected)
    }
    await this.openGatt()
  }

  /** Reconnects to the same device without the picker (after a link loss). */
  async reconnect(): Promise<void> {
    if (!this.device) throw new TransportError('Aucun appareil connu', 'not-connected')
    await this.openGatt()
  }

  async write(text: string): Promise<void> {
    const tx = this.tx
    if (!tx || !this.connected) throw new TransportError('Dongle déconnecté', 'not-connected')
    const bytes = new TextEncoder().encode(text)
    const job = this.writing.then(async () => {
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const chunk = bytes.slice(i, i + CHUNK)
        try {
          await writeChunk(tx, chunk, this.writeWithoutResponse)
        } catch (e) {
          throw new TransportError(
            `Écriture Bluetooth impossible : ${errorText(e)}`,
            'write-failed',
          )
        }
      }
    })
    this.writing = job.catch(() => undefined)
    return job
  }

  onData(cb: (chunk: string) => void): Unsubscribe {
    return this.data.on(cb)
  }

  onDisconnect(cb: (reason: string) => void): Unsubscribe {
    return this.lost.on(cb)
  }

  async disconnect(): Promise<void> {
    this.deliberate = true
    try {
      await this.rx?.stopNotifications().catch(() => undefined)
      this.device?.gatt?.disconnect()
    } finally {
      this.rx = undefined
      this.tx = undefined
    }
  }

  // ---- internals ----------------------------------------------------------------------

  private async openGatt(): Promise<void> {
    const gatt = this.device?.gatt
    if (!gatt) throw new TransportError("L'appareil n'expose pas de GATT", 'connection-failed')
    this.deliberate = false
    let server: BluetoothRemoteGATTServer
    try {
      server = await gatt.connect()
    } catch (e) {
      throw new TransportError(
        `Connexion impossible : ${errorText(e)}. Le dongle est peut-être déjà connecté à un autre appareil.`,
        'connection-failed',
      )
    }

    const found = await this.findProfile(server)
    if (!found) {
      await this.logServices(server)
      server.disconnect()
      throw new TransportError(
        "Ce dongle n'utilise aucun des profils Bluetooth connus. Exporte le journal pour l'ajouter.",
        'no-matching-profile',
      )
    }

    const { profile, rx, tx } = found
    this.profile = profile
    this.rx = rx
    this.tx = tx
    // Acknowledged writes when possible: commands are tiny, reliability matters more than speed.
    this.writeWithoutResponse = !tx.properties.write
    rx.addEventListener('characteristicvaluechanged', this.onNotify)
    await rx.startNotifications()
    this.log?.info(
      `profil BLE : ${profile.name} (écriture ${this.writeWithoutResponse ? 'sans' : 'avec'} accusé)`,
    )
  }

  private async findProfile(server: BluetoothRemoteGATTServer): Promise<
    | {
        profile: BleProfile
        rx: BluetoothRemoteGATTCharacteristic
        tx: BluetoothRemoteGATTCharacteristic
      }
    | undefined
  > {
    for (const profile of BLE_PROFILES) {
      try {
        const service = await server.getPrimaryService(profile.service)
        const rx = await service.getCharacteristic(profile.notify)
        const tx =
          profile.write === profile.notify ? rx : await service.getCharacteristic(profile.write)
        if (!rx.properties.notify && !rx.properties.indicate) continue
        if (!tx.properties.write && !tx.properties.writeWithoutResponse) continue
        return { profile, rx, tx }
      } catch {
        // Service or characteristic absent: try the next profile.
      }
    }
    return undefined
  }

  /** Logs whatever the dongle exposes so a new profile can be added (CLAUDE.md §3.3). */
  private async logServices(server: BluetoothRemoteGATTServer): Promise<void> {
    try {
      for (const service of await server.getPrimaryServices()) {
        const chars = await service.getCharacteristics()
        const desc = chars.map((c) => {
          const p = c.properties
          const flags = [
            p.read && 'R',
            p.write && 'W',
            p.writeWithoutResponse && 'w',
            p.notify && 'N',
            p.indicate && 'I',
          ]
            .filter(Boolean)
            .join('')
          return `${c.uuid} [${flags}]`
        })
        this.log?.info(`service ${service.uuid} : ${desc.join(', ')}`)
      }
    } catch (e) {
      this.log?.error(`impossible de lister les services : ${errorText(e)}`)
    }
  }

  private readonly onNotify = (event: Event): void => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value
    if (value) this.data.emit(this.decoder.decode(value))
  }

  private readonly onGattDisconnected = (): void => {
    this.rx = undefined
    this.tx = undefined
    if (!this.deliberate) this.lost.emit('Liaison Bluetooth perdue')
  }
}

/** Older Web Bluetooth implementations (some iOS browsers) only have writeValue(). */
async function writeChunk(
  tx: BluetoothRemoteGATTCharacteristic,
  chunk: Uint8Array<ArrayBuffer>,
  withoutResponse: boolean,
): Promise<void> {
  if (withoutResponse && typeof tx.writeValueWithoutResponse === 'function') {
    await tx.writeValueWithoutResponse(chunk)
  } else if (!withoutResponse && typeof tx.writeValueWithResponse === 'function') {
    await tx.writeValueWithResponse(chunk)
  } else {
    await tx.writeValue(chunk)
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
