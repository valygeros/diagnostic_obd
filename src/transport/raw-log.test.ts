import { describe, expect, it } from 'vitest'
import { maskVins, RawLog } from './raw-log'

function clock() {
  let t = 0
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('RawLog', () => {
  it('timestamps entries relative to creation', () => {
    const c = clock()
    const log = new RawLog(10, c.now)
    c.advance(1500)
    log.add('tx', 'ATZ\r')
    expect(log.all()).toEqual([{ t: 1500, dir: 'tx', text: 'ATZ\r' }])
  })

  it('keeps only the last `capacity` entries', () => {
    const log = new RawLog(3, clock().now)
    for (let i = 0; i < 5; i++) log.info(`m${i}`)
    expect(log.all().map((e) => e.text)).toEqual(['m2', 'm3', 'm4'])
  })

  it('exports readable text with control chars escaped', () => {
    const log = new RawLog(10, clock().now)
    log.add('tx', '0100\r')
    log.add('rx', '41 00 BE 3F A8 13\r\r>')
    expect(log.toText()).toBe('    0.000 >> 0100\\r\n    0.000 << 41 00 BE 3F A8 13\\r\\r>')
  })

  it('notifies listeners on change and clears', () => {
    const log = new RawLog(10, clock().now)
    let n = 0
    log.onChange(() => n++)
    log.info('a')
    log.clear()
    expect(n).toBe(2)
    expect(log.size).toBe(0)
  })
})

describe('maskVins', () => {
  it('masks a plain-text VIN', () => {
    expect(maskVins('VIN WVWZZZ6RZCY123456 ok')).toBe('VIN WVW************** ok')
  })

  it('masks the hex bytes of a VIN reply', () => {
    // "WVWZZZ6RZCY123456" in ASCII hex
    const hex = '57 56 57 5A 5A 5A 36 52 5A 43 59 31 32 33 34 35 36'
    expect(maskVins(hex)).toBe('57 56 57 ** ** ** ** ** ** ** ** ** ** ** ** ** **')
  })

  it('leaves ordinary hex data alone', () => {
    const data = '41 00 BE 3F A8 13'
    expect(maskVins(data)).toBe(data)
  })
})
