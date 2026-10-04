/**
 * Connection session shared by every screen: transport → ELM327 → OBD scan.
 * The UI only calls these actions and reads `session`; it never talks to the dongle directly
 * (CLAUDE.md §5).
 */

import { Elm327, ElmTimeoutError, type AdapterInfo } from '../elm327/client'
import type { EcuMessage } from '../elm327/frames'
import type { ProtocolInfo } from '../elm327/protocols'
import { ElmError } from '../elm327/response'
import { ClearAuthorization } from '../elm327/safety'
import { ObdClient } from '../obd/client'
import { fullScan, type ScanResult, type ScanStep } from '../obd/scan'
import { scenarioById } from '../simulator/scenarios'
import { SimulatedElm } from '../simulator/sim-elm'
import { BleTransport } from '../transport/ble-transport'
import { MockTransport } from '../transport/mock-transport'
import { attachLog, RawLog, withLog } from '../transport/raw-log'
import { TransportError, type Transport } from '../transport/types'
import { savePreClearSnapshot } from '../storage/pre-clear'

export type SessionPhase =
  | 'idle'
  | 'connecting' // opening the Bluetooth link
  | 'adapter' // configuring the ELM327
  | 'vehicle' // searching the car protocol
  | 'ready'
  | 'scanning'
  | 'clearing'
  | 'lost' // link lost, reconnection possible
  | 'error'

export interface SessionError {
  title: string
  detail: string
  /** Guided checklist key for the connection help (CLAUDE.md §8.1). */
  kind: 'cancelled' | 'bluetooth' | 'adapter' | 'vehicle' | 'link' | 'other'
}

/** One log for the whole app: survives reconnections, exported from the settings. */
export const rawLog = new RawLog()

export const session = $state({
  phase: 'idle' as SessionPhase,
  demo: undefined as string | undefined,
  deviceName: undefined as string | undefined,
  transportKind: undefined as string | undefined,
  adapter: undefined as AdapterInfo | undefined,
  protocol: undefined as ProtocolInfo | undefined,
  scan: undefined as ScanResult | undefined,
  scanStep: undefined as ScanStep | undefined,
  error: undefined as SessionError | undefined,
  /** Codes cleared during this session, shown after the rescan. */
  lastClear: undefined as { at: string; acked: string[] } | undefined,
})

let transport: Transport | undefined
let ble: BleTransport | undefined
let elm: Elm327 | undefined
let firstReply: EcuMessage[] = []
let detachLog: (() => void) | undefined

function describeError(e: unknown, stage: SessionPhase): SessionError {
  if (e instanceof TransportError) {
    if (e.code === 'cancelled') {
      return { kind: 'cancelled', title: 'Connexion annulée', detail: 'Aucun dongle choisi.' }
    }
    if (e.code === 'not-connected') {
      return { kind: 'link', title: 'Connexion Bluetooth perdue', detail: e.message }
    }
    return { kind: 'bluetooth', title: 'Connexion Bluetooth impossible', detail: e.message }
  }
  if (e instanceof ElmError) {
    const kind = stage === 'vehicle' || e.code === 'UNABLE_TO_CONNECT' ? 'vehicle' : 'adapter'
    return { kind, title: e.message, detail: e.hint }
  }
  if (e instanceof ElmTimeoutError) {
    return {
      kind: stage === 'vehicle' ? 'vehicle' : 'adapter',
      title: 'Le dongle ne répond pas',
      detail:
        "Débranche et rebranche le dongle, puis réessaie. S'il clignote, il est peut-être connecté à un autre téléphone.",
    }
  }
  return {
    kind: 'other',
    title: 'Erreur inattendue',
    detail: e instanceof Error ? e.message : String(e),
  }
}

function fail(e: unknown, stage: SessionPhase): void {
  session.error = describeError(e, stage)
  session.phase = session.error.kind === 'link' ? 'lost' : 'error'
  rawLog.error(`${session.error.title} — ${session.error.detail}`)
}

async function open(t: Transport): Promise<void> {
  await teardown()
  transport = t
  detachLog = attachLog(t, rawLog)
  t.onDisconnect(() => {
    if (session.phase !== 'idle') {
      fail(new TransportError('Liaison Bluetooth perdue', 'not-connected'), session.phase)
    }
  })
  session.error = undefined
  session.scan = undefined
  session.lastClear = undefined
  session.transportKind = t.kind

  session.phase = 'connecting'
  await t.connect()
  session.deviceName = t.deviceName
  await setupElm()
}

async function setupElm(): Promise<void> {
  if (!transport) return
  elm?.dispose()
  elm = new Elm327(transport, { log: rawLog })
  session.phase = 'adapter'
  session.adapter = await elm.initAdapter()
  session.phase = 'vehicle'
  firstReply = await elm.connectVehicle()
  session.protocol = elm.protocol
  session.phase = 'ready'
}

/** Must be called from a click handler (Web Bluetooth requirement). */
export async function connectBluetooth(): Promise<void> {
  session.demo = undefined
  ble = new BleTransport(rawLog)
  try {
    await open(withLog(ble, rawLog))
  } catch (e) {
    fail(e, session.phase)
  }
}

export async function connectDemo(scenarioId: string): Promise<void> {
  const scenario = scenarioById(scenarioId)
  if (!scenario) return
  session.demo = scenario.label
  ble = undefined
  try {
    await open(withLog(new MockTransport(new SimulatedElm(scenario), { latencyMs: 25 }), rawLog))
  } catch (e) {
    fail(e, session.phase)
  }
}

/** Retries the car connection (e.g. after "turn the ignition on"), keeping the link. */
export async function retryVehicle(): Promise<void> {
  if (!transport?.connected) return
  session.error = undefined
  try {
    await setupElm()
  } catch (e) {
    fail(e, session.phase)
  }
}

/** Reconnects to the same BLE dongle after a link loss, without the device picker. */
export async function reconnect(): Promise<void> {
  if (!ble || !transport) return
  session.error = undefined
  session.phase = 'connecting'
  try {
    await ble.reconnect()
    await setupElm()
  } catch (e) {
    fail(e, session.phase)
  }
}

export async function scan(): Promise<ScanResult | undefined> {
  if (!elm || session.phase !== 'ready') return undefined
  session.phase = 'scanning'
  session.error = undefined
  try {
    const result = await fullScan(elm, firstReply, (step) => (session.scanStep = step))
    session.scan = result
    session.phase = 'ready'
    // Battery voltage may have changed (engine started): refresh it.
    const voltage = await elm.readVoltage().catch(() => undefined)
    if (session.adapter && voltage !== undefined) session.adapter = { ...session.adapter, voltage }
    return result
  } catch (e) {
    fail(e, 'scanning')
    return undefined
  } finally {
    session.scanStep = undefined
  }
}

/**
 * Clears fault codes. Only reachable from the confirmation dialog (CLAUDE.md §9.2):
 * saves the current scan first, then clears, then rescans.
 */
export async function clearCodes(): Promise<void> {
  if (!elm || session.phase !== 'ready') return
  if (session.scan) savePreClearSnapshot(session.scan)
  session.phase = 'clearing'
  try {
    const acked = await new ObdClient(elm).clearDtcs(ClearAuthorization.fromUserConfirmation())
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- timestamp only, not reactive
    session.lastClear = { at: new Date().toISOString(), acked }
    rawLog.info(`codes effacés — calculateurs : ${acked.join(', ') || 'aucun accusé'}`)
    session.phase = 'ready'
    await scan()
  } catch (e) {
    fail(e, 'clearing')
  }
}

async function teardown(): Promise<void> {
  elm?.dispose()
  elm = undefined
  detachLog?.()
  detachLog = undefined
  const t = transport
  transport = undefined
  await t?.disconnect().catch(() => undefined)
}

export async function disconnect(): Promise<void> {
  session.phase = 'idle'
  await teardown()
  session.deviceName = undefined
  session.adapter = undefined
  session.protocol = undefined
  session.demo = undefined
  session.error = undefined
}
