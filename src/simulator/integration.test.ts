/**
 * End-to-end: real ELM client + OBD layer against the simulated adapter, for every scenario
 * (CLAUDE.md §11).
 */
import { describe, expect, it } from 'vitest'
import { Elm327, type ElmOptions } from '../elm327/client'
import { ElmError } from '../elm327/response'
import { ClearAuthorization, ForbiddenCommandError } from '../elm327/safety'
import { ObdClient } from '../obd/client'
import { fullScan } from '../obd/scan'
import { MockTransport } from '../transport/mock-transport'
import { attachLog, RawLog, withLog } from '../transport/raw-log'
import { TransportError } from '../transport/types'
import { scenarioById } from './scenarios'
import { SimulatedElm } from './sim-elm'

async function setup(id: string, opts: ElmOptions = {}) {
  const scenario = scenarioById(id)
  if (!scenario) throw new Error(id)
  // Fast simulation: no search delay.
  const sim = new SimulatedElm({
    ...scenario,
    behaviour: { ...scenario.behaviour, searchDelayMs: 0 },
  })
  const log = new RawLog()
  const transport = withLog(new MockTransport(sim, { latencyMs: 0, chunkSize: 7 }), log)
  attachLog(transport, log)
  await transport.connect()
  const elm = new Elm327(transport, {
    log,
    timeoutMs: 500,
    searchTimeoutMs: 1000,
    resetTimeoutMs: 500,
    ...opts,
  })
  return { elm, log, transport, sim }
}

describe('scenario: healthy CAN car', () => {
  it('initialises, detects CAN 11/500, finds no fault', async () => {
    const { elm } = await setup('healthy-can')
    const adapter = await elm.initAdapter()
    expect(adapter).toMatchObject({ id: 'ELM327 v1.5', voltage: 14.1, headers: true, refused: [] })
    const first = await elm.connectVehicle()
    expect(elm.protocol?.id).toBe('6')
    const scan = await fullScan(elm, first)
    expect(scan.mil).toBe(false)
    expect(scan.ecus).toHaveLength(1)
    expect(scan.ecus[0]).toMatchObject({
      id: '7E8',
      label: 'Moteur',
      name: 'ECM-EngineControl',
      dtcs: [],
    })
    expect(scan.ecus[0]?.supportedPids).toContain(0x0c)
    expect(scan.vin?.vin).toBe('VF1RJA00X68123456')
    expect(scan.vin?.manufacturer).toBe('Renault')
    expect(scan.warnings).toEqual([])
  })
})

describe('scenario: faults on two CAN ECUs', () => {
  it('reads every kind of code per ECU, with the MIL on', async () => {
    const { elm } = await setup('faults-can')
    await elm.initAdapter()
    const scan = await fullScan(elm, await elm.connectVehicle())
    expect(scan.mil).toBe(true)
    const engine = scan.ecus.find((e) => e.id === '7E8')
    const gearbox = scan.ecus.find((e) => e.id === '7E9')
    expect(engine?.dtcs).toEqual([
      { code: 'P0301', kind: 'stored' },
      { code: 'P0171', kind: 'stored' },
      { code: 'P0133', kind: 'pending' },
      { code: 'P0420', kind: 'permanent' },
    ])
    expect(engine?.status).toMatchObject({ mil: true, dtcCount: 2 })
    expect(gearbox?.dtcs).toEqual([{ code: 'P0715', kind: 'stored' }])
    expect(gearbox?.label).toBe('Boîte de vitesses')
    expect(scan.vin?.vin).toBe('WVWZZZ6RZCY123456')
  })

  it('refuses to clear without authorization, clears with it; permanent codes stay', async () => {
    const { elm } = await setup('faults-can')
    await elm.initAdapter()
    await elm.connectVehicle()
    const obd = new ObdClient(elm)
    expect(() => elm.send('04')).toThrow(ForbiddenCommandError)

    const acked = await obd.clearDtcs(ClearAuthorization.fromUserConfirmation())
    expect(acked.sort()).toEqual(['7E8', '7E9'])
    expect([...(await obd.dtcs('stored')).values()].flat()).toEqual([])
    expect((await obd.dtcs('permanent')).get('7E8')).toEqual(['P0420'])
  })
})

describe('scenario: legacy protocols', () => {
  it('ISO 9141-2: codes and VIN split over 5 messages', async () => {
    const { elm } = await setup('old-iso9141')
    await elm.initAdapter()
    const scan = await fullScan(elm, await elm.connectVehicle())
    expect(elm.protocol?.id).toBe('3')
    expect(scan.ecus.map((e) => e.id)).toEqual(['10'])
    expect(scan.ecus[0]?.dtcs).toEqual([{ code: 'P0118', kind: 'stored' }])
    expect(scan.vin?.vin).toBe('VF3XXXXXXXX123456')
  })

  it('KWP: diesel with a pending code', async () => {
    const { elm } = await setup('diesel-kwp')
    await elm.initAdapter()
    const scan = await fullScan(elm, await elm.connectVehicle())
    expect(elm.protocol?.id).toBe('5')
    expect(scan.ecus[0]?.status?.ignition).toBe('compression')
    expect(scan.ecus[0]?.dtcs).toEqual([{ code: 'P0401', kind: 'pending' }])
  })
})

describe('scenario: cheap clone', () => {
  it('copes with echo, lowercase and refused settings', async () => {
    const { elm } = await setup('cheap-clone')
    const adapter = await elm.initAdapter()
    expect(adapter.refused).toEqual(['ATH1', 'ATAT1'])
    expect(adapter.headers).toBe(false)
    const scan = await fullScan(elm, await elm.connectVehicle())
    expect(scan.ecus).toHaveLength(1)
    expect(scan.ecus[0]?.dtcs).toEqual([{ code: 'P0442', kind: 'stored' }])
    expect(scan.vin?.vin).toBe('VF7XXXXXXXX654321')
  })
})

describe('scenario: car not answering', () => {
  it('reports UNABLE TO CONNECT with a French hint', async () => {
    const { elm } = await setup('no-vehicle')
    await elm.initAdapter()
    const err = await elm.connectVehicle().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ElmError)
    expect((err as ElmError).code).toBe('UNABLE_TO_CONNECT')
    expect((err as ElmError).hint).toMatch(/contact/i)
  })
})

describe('scenario: Bluetooth lost mid-scan', () => {
  it('aborts the scan with a transport error', async () => {
    const { elm, log } = await setup('disconnect')
    await elm.initAdapter()
    const first = await elm.connectVehicle()
    await expect(fullScan(elm, first)).rejects.toBeInstanceOf(TransportError)
    expect(log.toText()).toMatch(/connexion perdue/)
  })
})

describe('raw log', () => {
  it('records the whole exchange with VIN masked on export', async () => {
    const { elm, log } = await setup('faults-can')
    await elm.initAdapter()
    await fullScan(elm, await elm.connectVehicle())
    const text = log.toText()
    expect(text).toMatch(/>> ATZ/)
    expect(text).toMatch(/<< .*41/)
    expect(text).not.toMatch(/5A 5A 5A 36 52/) // VIN bytes masked
  })
})

describe('timeouts', () => {
  it('times out, then resynchronises and keeps working', async () => {
    const { elm, sim } = await setup('healthy-can', { timeoutMs: 50 })
    await elm.initAdapter()
    await elm.connectVehicle()
    const original = sim.handle.bind(sim)
    let swallow = true
    sim.handle = (cmd) => (swallow && cmd === '010C' ? { silent: true } : original(cmd))
    await expect(elm.request('010C')).rejects.toThrow(/pas répondu/)
    swallow = false
    const msgs = await elm.request('010D')
    expect(msgs[0]?.data.slice(0, 2)).toEqual([0x41, 0x0d])
  })
})
