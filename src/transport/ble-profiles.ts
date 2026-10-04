/**
 * Known GATT layouts of BLE OBD dongles (CLAUDE.md §3.3). A new dongle = one more entry here,
 * no special case anywhere else. All services must be listed in `optionalServices`,
 * otherwise Web Bluetooth hides them.
 */

export interface BleProfile {
  name: string
  service: BluetoothServiceUUID
  /** Characteristic we subscribe to for replies. */
  notify: BluetoothCharacteristicUUID
  /** Characteristic we write commands to (may equal `notify`). */
  write: BluetoothCharacteristicUUID
  examples: string
}

/** 16-bit UUIDs expanded to the Bluetooth base UUID. */
const uuid16 = (short: number): string =>
  `0000${short.toString(16).padStart(4, '0')}-0000-1000-8000-00805f9b34fb`

export const BLE_PROFILES: readonly BleProfile[] = [
  {
    name: 'FFF0 (OBDLink CX, nombreux clones)',
    service: uuid16(0xfff0),
    notify: uuid16(0xfff1),
    write: uuid16(0xfff2),
    examples: 'OBDLink CX, iCar, Veepeak BLE',
  },
  {
    name: 'FFE0 (puce type HM-10)',
    service: uuid16(0xffe0),
    notify: uuid16(0xffe1),
    write: uuid16(0xffe1),
    examples: 'Clones ELM327 BLE',
  },
  {
    name: '18F0 (Vgate)',
    service: uuid16(0x18f0),
    notify: uuid16(0x2af0),
    write: uuid16(0x2af1),
    examples: 'Vgate iCar Pro BLE 4.0',
  },
  {
    name: 'Nordic UART',
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
    write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    examples: 'Divers modules BLE',
  },
]

export const ALL_SERVICES: BluetoothServiceUUID[] = BLE_PROFILES.map((p) => p.service)

/** Name prefixes seen on OBD dongles, used to sort the device picker. Not a filter. */
export const OBD_NAME_HINTS = [
  'OBD',
  'OBDII',
  'OBDLink',
  'Vgate',
  'iCar',
  'IOS-Vlink',
  'V-LINK',
  'Veepeak',
  'ELM',
]
