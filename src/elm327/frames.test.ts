import { describe, expect, it } from 'vitest'
import { ecuLabel, FrameError, parseFrames, UNKNOWN_ECU } from './frames'
import { PROTOCOLS, parseDpn } from './protocols'

const CAN11 = PROTOCOLS['6']
const CAN29 = PROTOCOLS['7']
const ISO9141 = PROTOCOLS['3']
const KWP = PROTOCOLS['5']

// VIN "WVWZZZ6RZCY123456" as ASCII
const VIN_HEX = '57 56 57 5A 5A 5A 36 52 5A 43 59 31 32 33 34 35 36'
const vinBytes = VIN_HEX.split(' ').map((b) => parseInt(b, 16))

describe('parseDpn', () => {
  it('parses automatic and fixed protocols', () => {
    expect(parseDpn('A6')).toEqual({ protocol: CAN11, auto: true })
    expect(parseDpn('3')).toEqual({ protocol: ISO9141, auto: false })
  })
  it('rejects 0 and garbage', () => {
    expect(parseDpn('0')).toBeUndefined()
    expect(parseDpn('?')).toBeUndefined()
  })
})

describe('parseFrames — CAN 11 bits', () => {
  it('single frame with padding', () => {
    expect(parseFrames(['7E8 06 41 00 BE 3F A8 13 00'], CAN11, true)).toEqual([
      { ecu: '7E8', data: [0x41, 0x00, 0xbe, 0x3f, 0xa8, 0x13] },
    ])
  })

  it('works without spaces (ATS0)', () => {
    expect(parseFrames(['7E8064100BE3FA81300'], CAN11, true)).toEqual([
      { ecu: '7E8', data: [0x41, 0x00, 0xbe, 0x3f, 0xa8, 0x13] },
    ])
  })

  it('separates two ECUs answering the same request', () => {
    const msgs = parseFrames(
      ['7E8 06 41 00 BE 3F A8 13 00', '7E9 06 41 00 98 18 00 13 00'],
      CAN11,
      true,
    )
    expect(msgs.map((m) => m.ecu)).toEqual(['7E8', '7E9'])
  })

  it('reassembles a multi-frame VIN (service 09 02)', () => {
    // 49 02 01 + 17 VIN bytes = 20 bytes
    const lines = [
      '7E8 10 14 49 02 01 57 56 57',
      '7E8 21 5A 5A 5A 36 52 5A 43',
      '7E8 22 59 31 32 33 34 35 36',
    ]
    const [msg] = parseFrames(lines, CAN11, true)
    expect(msg?.ecu).toBe('7E8')
    expect(msg?.data).toEqual([0x49, 0x02, 0x01, ...vinBytes])
  })

  it('reassembles interleaved multi-frame replies from two ECUs', () => {
    const lines = [
      '7E8 10 08 43 03 01 33 03 00',
      '7E9 03 43 01 07 00 00 00 00',
      '7E8 21 01 71 00 00 00 00 00',
    ]
    expect(parseFrames(lines, CAN11, true)).toEqual([
      { ecu: '7E9', data: [0x43, 0x01, 0x07] },
      { ecu: '7E8', data: [0x43, 0x03, 0x01, 0x33, 0x03, 0x00, 0x01, 0x71] },
    ])
  })

  it('reports a missing consecutive frame', () => {
    expect(() =>
      parseFrames(['7E8 10 14 49 02 01 57 56 57', '7E8 22 59 31 32 33 34 35 36'], CAN11, true),
    ).toThrow(/manquante/)
  })
})

describe('parseFrames — CAN 29 bits', () => {
  it('uses the 8-char identifier', () => {
    expect(parseFrames(['18DAF110 03 41 0D 32 00 00 00 00'], CAN29, true)).toEqual([
      { ecu: '18DAF110', data: [0x41, 0x0d, 0x32] },
    ])
  })
})

describe('parseFrames — legacy protocols', () => {
  it('ISO 9141-2: 3-byte header, checksum dropped', () => {
    expect(parseFrames(['48 6B 10 41 00 BE 3E B8 11 C9'], ISO9141, true)).toEqual([
      { ecu: '10', data: [0x41, 0x00, 0xbe, 0x3e, 0xb8, 0x11] },
    ])
  })

  it('KWP with length in the format byte', () => {
    expect(parseFrames(['83 F1 11 41 0D 32 F7'], KWP, true)).toEqual([
      { ecu: '11', data: [0x41, 0x0d, 0x32] },
    ])
  })

  it('KWP with a separate length byte', () => {
    expect(parseFrames(['80 F1 11 03 41 0D 32 F7'], KWP, true)).toEqual([
      { ecu: '11', data: [0x41, 0x0d, 0x32] },
    ])
  })

  it('rejects unreadable lines', () => {
    expect(() => parseFrames(['48 6B 1'], ISO9141, true)).toThrow(FrameError)
  })
})

describe('parseFrames — headers off (stubborn clones)', () => {
  it('single line', () => {
    expect(parseFrames(['41 0D 32'], CAN11, false)).toEqual([
      { ecu: UNKNOWN_ECU, data: [0x41, 0x0d, 0x32] },
    ])
  })

  it('ELM multi-line format "014" / "0: …"', () => {
    const lines = [
      '014',
      '0: 49 02 01 57 56 57',
      '1: 5A 5A 5A 36 52 5A 43',
      '2: 59 31 32 33 34 35 36',
    ]
    expect(parseFrames(lines, CAN11, false)).toEqual([
      { ecu: UNKNOWN_ECU, data: [0x49, 0x02, 0x01, ...vinBytes] },
    ])
  })
})

describe('ecuLabel', () => {
  it.each([
    ['7E8', 'Moteur'],
    ['7E9', 'Boîte de vitesses'],
    ['18DAF110', 'Moteur'],
    ['10', 'Moteur'],
    ['7EA', 'Calculateur 7EA'],
  ])('%s → %s', (ecu, label) => expect(ecuLabel(ecu)).toBe(label))
})
