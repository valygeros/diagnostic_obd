import { describe, expect, it } from 'vitest'
import { cleanLines, ElmError, errorCodeOf, splitErrors } from './response'

describe('cleanLines', () => {
  it('drops prompt, blank lines and the echo', () => {
    expect(cleanLines('0100\r41 00 BE 3F A8 13\r\r>', '0100')).toEqual(['41 00 BE 3F A8 13'])
  })

  it('removes SEARCHING... on its own line or glued to data', () => {
    expect(cleanLines('SEARCHING...\r7E8064100BE3FA813\r\r')).toEqual(['7E8064100BE3FA813'])
    expect(cleanLines('SEARCHING...7E8064100BE3FA813\r')).toEqual(['7E8064100BE3FA813'])
  })

  it('removes BUS INIT: ...OK', () => {
    expect(cleanLines('BUS INIT: ...OK\r486B104100BE3EB811C9\r')).toEqual(['486B104100BE3EB811C9'])
  })

  it('normalises clone quirks: lowercase, NUL bytes, \\n\\r mixes, echo with spaces', () => {
    expect(cleanLines('\0at e0\r\nok\n\r>', 'ATE0')).toEqual(['OK'])
    expect(cleanLines('41 0c 1a f8\r', undefined)).toEqual(['41 0C 1A F8'])
  })
})

describe('errors', () => {
  it.each([
    ['NO DATA', 'NO_DATA'],
    ['NODATA', 'NO_DATA'],
    ['UNABLE TO CONNECT', 'UNABLE_TO_CONNECT'],
    ['BUS INIT: ...ERROR', 'BUS_INIT_ERROR'],
    ['CAN ERROR', 'CAN_ERROR'],
    ['STOPPED', 'STOPPED'],
    ['?', 'UNKNOWN_COMMAND'],
    ['BUFFER FULL', 'BUFFER_FULL'],
    ['LV RESET', 'LOW_POWER'],
    ['ERR94', 'INTERNAL_ERROR'],
  ])('recognises %s', (line, code) => {
    expect(errorCodeOf(line)).toBe(code)
  })

  it('does not report NO DATA when another ECU answered', () => {
    expect(splitErrors(['NO DATA', '7E8034101'])).toEqual({ data: ['7E8034101'], error: undefined })
  })

  it('reports the error when nothing came back', () => {
    expect(splitErrors(['NO DATA'])).toEqual({ data: [], error: 'NO_DATA' })
  })

  it('carries a French message and a hint', () => {
    const e = new ElmError('UNABLE_TO_CONNECT', '0100', 'UNABLE TO CONNECT')
    expect(e.message).toMatch(/dialoguer avec la voiture/)
    expect(e.hint).toMatch(/contact/)
  })
})
