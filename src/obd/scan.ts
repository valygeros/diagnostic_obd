/**
 * Full generic scan (CLAUDE.md §8.2): status, stored / pending / permanent codes, VIN, ECU names.
 * Each step is independent: a step that fails is reported and the scan goes on, except when the
 * link itself is lost.
 */

import type { AdapterInfo, Elm327 } from '../elm327/client'
import { ElmTimeoutError } from '../elm327/client'
import { ecuLabel, type EcuMessage } from '../elm327/frames'
import type { ProtocolInfo } from '../elm327/protocols'
import { ElmError } from '../elm327/response'
import { TransportError } from '../transport/types'
import { decodeVin, type VinInfo } from '../vin/vin'
import { ObdClient } from './client'
import type { DtcKind } from './dtc'
import type { MonitorStatus } from './status'

export interface ScannedDtc {
  code: string
  kind: DtcKind
}

export interface EcuScan {
  id: string
  /** Generic label from the address ("Moteur", "Boîte de vitesses"…). */
  label: string
  /** Name reported by the ECU itself (service 09 0A), if any. */
  name: string | undefined
  status: MonitorStatus | undefined
  dtcs: ScannedDtc[]
  supportedPids: number[]
}

export interface ScanResult {
  at: string
  adapter: AdapterInfo | undefined
  protocol: ProtocolInfo | undefined
  vin: VinInfo | undefined
  ecus: EcuScan[]
  /** True if at least one ECU reports the check engine light on. */
  mil: boolean
  /** Steps that could not be completed, in French. */
  warnings: string[]
}

export type ScanStep = 'status' | 'stored' | 'pending' | 'permanent' | 'vin' | 'names' | 'done'

export const SCAN_STEP_LABEL: Record<ScanStep, string> = {
  status: 'Voyant moteur et état',
  stored: 'Codes confirmés',
  pending: 'Codes en attente',
  permanent: 'Codes permanents',
  vin: 'Numéro de série (VIN)',
  names: 'Noms des calculateurs',
  done: 'Terminé',
}

function isFatal(e: unknown): boolean {
  return e instanceof TransportError
}

function describe(e: unknown): string {
  if (e instanceof ElmError || e instanceof ElmTimeoutError) return e.message
  return e instanceof Error ? e.message : String(e)
}

/**
 * Runs the scan. `firstReply` is the 0100 answer from `connectVehicle()`: it tells which ECUs
 * exist and saves one request.
 */
export async function fullScan(
  elm: Elm327,
  firstReply: EcuMessage[],
  onStep: (step: ScanStep) => void = () => {},
): Promise<ScanResult> {
  const obd = new ObdClient(elm)
  const warnings: string[] = []
  const ecus = new Map<string, EcuScan>()
  const ecu = (id: string): EcuScan => {
    let e = ecus.get(id)
    if (!e) {
      e = {
        id,
        label: ecuLabel(id),
        name: undefined,
        status: undefined,
        dtcs: [],
        supportedPids: [],
      }
      ecus.set(id, e)
    }
    return e
  }

  for (const m of firstReply) ecu(m.ecu)

  async function step<T>(name: ScanStep, run: () => Promise<T>): Promise<T | undefined> {
    onStep(name)
    try {
      return await run()
    } catch (e) {
      if (isFatal(e)) throw e
      warnings.push(`${SCAN_STEP_LABEL[name]} : ${describe(e)}`)
      return undefined
    }
  }

  const pids = await step('status', () => obd.supportedPids(firstReply))
  for (const [id, set] of pids ?? []) ecu(id).supportedPids = [...set].sort((a, b) => a - b)
  const status = await step('status', () => obd.monitorStatus())
  for (const [id, s] of status ?? []) ecu(id).status = s

  for (const kind of ['stored', 'pending', 'permanent'] as const) {
    const result = await step(kind, () => obd.dtcs(kind))
    for (const [id, codes] of result ?? []) {
      for (const code of codes) ecu(id).dtcs.push({ code, kind })
    }
  }

  const vin = await step('vin', () => obd.vin())
  const names = await step('names', () => obd.ecuNames())
  for (const [id, name] of names ?? []) ecu(id).name = name
  onStep('done')

  const list = [...ecus.values()].sort((a, b) => a.id.localeCompare(b.id))
  return {
    at: new Date().toISOString(),
    adapter: elm.adapter,
    protocol: elm.protocol,
    vin: vin ? decodeVin(vin) : undefined,
    ecus: list,
    mil: list.some((e) => e.status?.mil),
    warnings,
  }
}
