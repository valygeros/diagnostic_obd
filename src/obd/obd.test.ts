import { describe, expect, it } from 'vitest'
import { decodeDtc, describeDtcStructure, encodeDtc, isValidDtc, parseDtcPayload } from './dtc'
import { parseMonitorStatus } from './status'
import { decodeSupportedBitmap, encodeSupportedBitmap } from './supported'

describe('DTC decoding', () => {
  it.each([
    [0x03, 0x01, 'P0301'],
    [0x01, 0x33, 'P0133'],
    [0x01, 0x71, 'P0171'],
    [0x04, 0x20, 'P0420'],
    [0x13, 0x00, 'P1300'],
    [0x41, 0x23, 'C0123'],
    [0x80, 0x01, 'B0001'],
    [0xc1, 0x00, 'U0100'],
    [0xd1, 0x55, 'U1155'],
    [0x2a, 0xbc, 'P2ABC'],
  ])('%i %i → %s', (b1, b2, code) => {
    expect(decodeDtc(b1, b2)).toBe(code)
    expect(encodeDtc(code)).toEqual([b1, b2])
  })

  it('validates codes', () => {
    expect(isValidDtc('P0301')).toBe(true)
    expect(isValidDtc('P4301')).toBe(false)
    expect(isValidDtc('X0301')).toBe(false)
  })

  it('parses a CAN reply with count byte', () => {
    expect(parseDtcPayload([0x43, 0x02, 0x03, 0x01, 0x01, 0x71], true)).toEqual(['P0301', 'P0171'])
  })

  it('parses a CAN reply with zero codes', () => {
    expect(parseDtcPayload([0x43, 0x00], true)).toEqual([])
  })

  it('parses a legacy reply padded with zeros', () => {
    expect(parseDtcPayload([0x43, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00], false)).toEqual(['P0301'])
  })

  it('describes the structure of unknown codes', () => {
    expect(describeDtcStructure('P0301')).toEqual({
      system: 'Moteur et transmission',
      generic: true,
    })
    expect(describeDtcStructure('P1234').generic).toBe(false)
    expect(describeDtcStructure('U0100').system).toMatch(/communication/)
  })
})

describe('supported PID bitmaps', () => {
  it('decodes 0100 = BE 3F A8 13', () => {
    // Classic example: PIDs 01,03-07,0B-10,11,13,15,1C,1F,20
    expect(decodeSupportedBitmap(0x00, [0xbe, 0x3f, 0xa8, 0x13])).toEqual([
      0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x13, 0x15,
      0x1c, 0x1f, 0x20,
    ])
  })

  it('round-trips', () => {
    const pids = [0x21, 0x2f, 0x33, 0x40]
    expect(decodeSupportedBitmap(0x20, encodeSupportedBitmap(0x20, pids))).toEqual(pids)
  })
})

describe('monitor status (0101)', () => {
  it('MIL on, 2 codes, petrol', () => {
    expect(parseMonitorStatus([0x82, 0x07, 0x65, 0x00])).toMatchObject({
      mil: true,
      dtcCount: 2,
      ignition: 'spark',
    })
  })

  it('MIL off, diesel', () => {
    expect(parseMonitorStatus([0x00, 0x08, 0x00, 0x00])).toMatchObject({
      mil: false,
      dtcCount: 0,
      ignition: 'compression',
    })
  })
})
