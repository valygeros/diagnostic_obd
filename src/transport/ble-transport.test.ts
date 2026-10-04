import { afterEach, describe, expect, it, vi } from 'vitest'
import { BleTransport } from './ble-transport'
import { RawLog } from './raw-log'
import { TransportError } from './types'

const u = (short: number) =>
  `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`

interface FakeChar {
  uuid: string
  properties: Partial<BluetoothCharacteristicProperties>
}

/** Minimal fake of the Web Bluetooth objects the transport touches. */
function fakeDevice(services: Record<string, FakeChar[]>) {
  const written: string[] = []
  const deviceListeners: Record<string, (() => void)[]> = {}
  let notifyListener: ((e: Event) => void) | undefined
  let connected = false

  const makeChar = (c: FakeChar) => ({
    uuid: c.uuid,
    properties: {
      read: false,
      write: false,
      writeWithoutResponse: false,
      notify: false,
      indicate: false,
      ...c.properties,
    },
    value: undefined as DataView | undefined,
    writeValueWithResponse: vi.fn(async (b: Uint8Array) => {
      written.push(new TextDecoder().decode(b))
    }),
    writeValueWithoutResponse: vi.fn(async (b: Uint8Array) => {
      written.push(new TextDecoder().decode(b))
    }),
    startNotifications: vi.fn(async () => undefined),
    stopNotifications: vi.fn(async () => undefined),
    addEventListener: (_: string, l: (e: Event) => void) => {
      notifyListener = l
    },
  })
  const chars = Object.fromEntries(
    Object.entries(services).map(([s, cs]) => [
      s,
      Object.fromEntries(cs.map((c) => [c.uuid, makeChar(c)])),
    ]),
  )

  const server = {
    connect: async () => {
      connected = true
      return server
    },
    disconnect: () => {
      connected = false
      for (const l of deviceListeners['gattserverdisconnected'] ?? []) l()
    },
    get connected() {
      return connected
    },
    getPrimaryService: async (uuid: string) => {
      const cs = chars[uuid]
      if (!cs) throw new DOMException('no service', 'NotFoundError')
      return {
        uuid,
        getCharacteristic: async (cu: string) => {
          const c = cs[cu]
          if (!c) throw new DOMException('no char', 'NotFoundError')
          return c
        },
        getCharacteristics: async () => Object.values(cs),
      }
    },
    getPrimaryServices: async () =>
      Object.keys(chars).map((uuid) => ({
        uuid,
        getCharacteristics: async () => Object.values(chars[uuid] ?? {}),
      })),
  }

  const device = {
    name: 'OBDII',
    gatt: server,
    addEventListener: (type: string, l: () => void) => {
      ;(deviceListeners[type] ??= []).push(l)
    },
  }

  return {
    device,
    written,
    chars,
    notify(text: string) {
      const bytes = new TextEncoder().encode(text)
      notifyListener?.({ target: { value: new DataView(bytes.buffer) } } as unknown as Event)
    },
    dropLink() {
      connected = false
      for (const l of deviceListeners['gattserverdisconnected'] ?? []) l()
    },
  }
}

function installBluetooth(device: unknown) {
  vi.stubGlobal('navigator', { bluetooth: { requestDevice: vi.fn(async () => device) } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('BleTransport', () => {
  it('picks the FFF0 profile, writes in 20-byte chunks and decodes notifications', async () => {
    const fake = fakeDevice({
      [u(0xfff0)]: [
        { uuid: u(0xfff1), properties: { notify: true } },
        { uuid: u(0xfff2), properties: { write: true, writeWithoutResponse: true } },
      ],
    })
    installBluetooth(fake.device)
    const t = new BleTransport()
    await t.connect()
    expect(t.connected).toBe(true)
    expect(t.profile?.name).toMatch(/FFF0/)
    expect(t.deviceName).toBe('OBDII')

    await t.write('0123456789ABCDEFGHIJKLMNO\r') // 26 bytes → 20 + 6
    expect(fake.written).toEqual(['0123456789ABCDEFGHIJ', 'KLMNO\r'])

    const got: string[] = []
    t.onData((c) => got.push(c))
    fake.notify('41 0C 1A F8\r\r>')
    expect(got).toEqual(['41 0C 1A F8\r\r>'])
  })

  it('falls back to the HM-10 profile (same characteristic for both directions)', async () => {
    const fake = fakeDevice({
      [u(0xffe0)]: [{ uuid: u(0xffe1), properties: { notify: true, writeWithoutResponse: true } }],
    })
    installBluetooth(fake.device)
    const t = new BleTransport()
    await t.connect()
    expect(t.profile?.name).toMatch(/FFE0/)
    await t.write('ATZ\r')
    expect(fake.chars[u(0xffe0)]?.[u(0xffe1)]?.writeValueWithoutResponse).toHaveBeenCalled()
  })

  it('logs the services of an unknown dongle and fails clearly', async () => {
    const fake = fakeDevice({
      [u(0xabcd)]: [{ uuid: u(0xabce), properties: { notify: true, write: true } }],
    })
    installBluetooth(fake.device)
    const log = new RawLog()
    const err = await new BleTransport(log).connect().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(TransportError)
    expect((err as TransportError).code).toBe('no-matching-profile')
    expect(log.toText()).toMatch(/abce.*\[WN\]/)
  })

  it('reports an unexpected link loss, but not a deliberate disconnect', async () => {
    const fake = fakeDevice({
      [u(0xfff0)]: [
        { uuid: u(0xfff1), properties: { notify: true } },
        { uuid: u(0xfff2), properties: { write: true } },
      ],
    })
    installBluetooth(fake.device)
    const t = new BleTransport()
    const reasons: string[] = []
    t.onDisconnect((r) => reasons.push(r))
    await t.connect()
    fake.dropLink()
    expect(reasons).toEqual(['Liaison Bluetooth perdue'])
    expect(t.connected).toBe(false)

    await t.reconnect()
    expect(t.connected).toBe(true)
    await t.disconnect()
    expect(reasons).toHaveLength(1)
  })

  it('maps a cancelled picker to a "cancelled" error', async () => {
    vi.stubGlobal('navigator', {
      bluetooth: {
        requestDevice: vi.fn(async () => {
          throw new DOMException('User cancelled', 'NotFoundError')
        }),
      },
    })
    const err = await new BleTransport().connect().catch((e: unknown) => e)
    expect((err as TransportError).code).toBe('cancelled')
  })
})
