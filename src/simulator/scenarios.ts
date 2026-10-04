/**
 * Demo / test scenarios (CLAUDE.md §11). VINs are fictitious but well-formed.
 * PID data bytes follow SAE J1979 scaling (e.g. coolant = A − 40 °C, rpm = (256A + B) / 4).
 */

import type { PidValue, Scenario } from './types'

/** Engine running at idle, warming up, with a little noise. */
function idleEngine(diesel = false): Record<number, PidValue> {
  const wave = (t: number, period: number, amp: number) =>
    Math.sin((2 * Math.PI * t) / period) * amp
  return {
    0x04: (t) => [Math.round(0x40 + wave(t, 3, 6))], // load ~25 %
    0x05: (t) => [Math.min(40 + 90, Math.round(40 + 25 + t * 0.8))], // coolant 25 → 90 °C
    0x06: (t) => [Math.round(128 + wave(t, 2, 4))], // STFT ~0 %
    0x07: [130], // LTFT +1.6 %
    0x0b: [33], // MAP 33 kPa
    0x0c: (t) => {
      const rpm = Math.round((diesel ? 820 : 760) + wave(t, 1.7, 25))
      return [(rpm * 4) >> 8, (rpm * 4) & 0xff]
    },
    0x0d: [0], // speed
    0x0f: [40 + 22], // intake air 22 °C
    0x10: [0x01, 0x2c], // MAF 3.00 g/s
    0x11: [diesel ? 0 : 0x22], // throttle
    0x1f: (t) => [0, Math.min(255, Math.round(t))], // run time
    0x2f: [0x99], // fuel 60 %
    0x33: [101], // baro
    0x42: [0x37, 0x6e], // module voltage 14.19 V
    0x46: [40 + 18], // ambient 18 °C
  }
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'healthy-can',
    label: 'Voiture saine (CAN)',
    description: 'Essence récente, protocole CAN, aucun défaut.',
    protocol: '6',
    adapter: { id: 'ELM327 v1.5', voltage: 14.1 },
    ecus: [
      { id: '7E8', pids: idleEngine(), vin: 'VF1RJA00X68123456', ecuName: 'ECM-EngineControl' },
    ],
  },
  {
    id: 'faults-can',
    label: 'Voiture avec défauts (CAN)',
    description:
      'Raté cylindre 1 et mélange pauvre (confirmés), sonde lambda en attente, défaut catalyseur permanent. Moteur + boîte.',
    protocol: '6',
    adapter: { id: 'ELM327 v1.5', voltage: 12.4 },
    ecus: [
      {
        id: '7E8',
        pids: idleEngine(),
        vin: 'WVWZZZ6RZCY123456',
        ecuName: 'ECM-EngineControl',
        dtcs: { stored: ['P0301', 'P0171'], pending: ['P0133'], permanent: ['P0420'] },
      },
      {
        id: '7E9',
        pids: { 0x0d: [0], 0x0c: [0x0b, 0xe0] },
        ecuName: 'TCM-TransmissionCtl',
        dtcs: { stored: ['P0715'] },
        mil: false,
      },
    ],
  },
  {
    id: 'old-iso9141',
    label: 'Ancienne voiture (ISO 9141)',
    description:
      'Essence des années 2000, protocole ISO 9141-2 (lent), un défaut sonde de température.',
    protocol: '3',
    adapter: { id: 'ELM327 v1.4b', voltage: 12.2 },
    behaviour: { searchDelayMs: 3500 },
    ecus: [
      {
        id: '10',
        pids: idleEngine(),
        vin: 'VF3XXXXXXXX123456',
        dtcs: { stored: ['P0118'] },
      },
    ],
  },
  {
    id: 'diesel-kwp',
    label: 'Diesel KWP2000',
    description:
      'Diesel milieu des années 2000, protocole KWP rapide, défaut vanne EGR en attente.',
    protocol: '5',
    adapter: { id: 'ELM327 v1.5', voltage: 12.5 },
    ecus: [
      {
        id: '11',
        pids: idleEngine(true),
        monitors: [0x0f, 0x00, 0x00],
        dtcs: { pending: ['P0401'] },
      },
    ],
  },
  {
    id: 'cheap-clone',
    label: 'Clone ELM327 bas de gamme',
    description:
      'Dongle « v2.1 » : écho permanent, refuse les en-têtes et le timing adaptatif. Voiture CAN avec un défaut.',
    protocol: '6',
    adapter: {
      id: 'ELM327 v2.1',
      voltage: 12.6,
      quirks: { ignoresEchoOff: true, refuses: ['ATH1', 'ATAT1'], lowercase: true },
    },
    ecus: [
      { id: '7E8', pids: idleEngine(), vin: 'VF7XXXXXXXX654321', dtcs: { stored: ['P0442'] } },
    ],
  },
  {
    id: 'no-vehicle',
    label: 'Contact coupé',
    description: 'Le dongle répond mais la voiture non (contact coupé ou prise mal branchée).',
    protocol: '6',
    adapter: { id: 'ELM327 v1.5', voltage: 12.3 },
    behaviour: { noVehicle: true, searchDelayMs: 2500 },
    ecus: [],
  },
  {
    id: 'disconnect',
    label: 'Coupure Bluetooth',
    description: 'La liaison Bluetooth est perdue au milieu du scan.',
    protocol: '6',
    behaviour: { disconnectAfterRequests: 4 },
    ecus: [{ id: '7E8', pids: idleEngine(), dtcs: { stored: ['P0301'] } }],
  },
]

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id)
}
