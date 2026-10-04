import { describe, expect, it } from 'vitest'
import { assertAllowed, ClearAuthorization, ForbiddenCommandError } from './safety'

const allowed = (cmd: string) => expect(() => assertAllowed(cmd)).not.toThrow()
const refused = (cmd: string) => expect(() => assertAllowed(cmd)).toThrow(ForbiddenCommandError)

describe('assertAllowed — AT commands', () => {
  it.each([
    'ATZ',
    'AT Z',
    'atz',
    'ATE0',
    'ATL0',
    'ATS0',
    'ATH1',
    'ATAT1',
    'ATSP0',
    'ATSP6',
    'ATDPN',
    'ATRV',
    'ATI',
    'AT@1',
    'ATSH7E0',
    'ATSH18DA10F1',
    'ATCRA7E8',
    'ATFCSH7E0',
    'ATFCSD300000',
    'ATFCSM1',
    'ATST64',
  ])('allows %s', allowed)

  it.each(['ATPP0CSV0D', 'ATPP0CON', 'ATSD12', 'AT@3ABCDEF', 'ATBRD45', 'ATXYZ'])(
    'refuses %s',
    refused,
  )
})

describe('assertAllowed — STN commands', () => {
  it.each(['STI', 'STDI'])('allows %s', allowed)
  it.each(['STSBR115200', 'STPX H:7E0, D:2E0101'])('refuses %s', refused)
})

describe('assertAllowed — OBD-II services', () => {
  it.each(['0100', '010C', '010C0D1', '0101', '0200', '03', '07', '0A', '0600', '0902', '090A'])(
    'allows %s',
    allowed,
  )
})

describe('assertAllowed — UDS/KWP read services', () => {
  it.each(['1902FF', '22F190', '22F18C', '3E00', '1003', '1001', '1A9B', '2101', '18000000'])(
    'allows %s',
    allowed,
  )
})

describe('assertAllowed — forbidden services (CLAUDE.md §9.1)', () => {
  it.each([
    ['1002', 'programming session'],
    ['1085', 'KWP programming session'],
    ['1086', 'KWP development session'],
    ['1060', 'manufacturer session'],
    ['1102', 'ECU reset'],
    ['23140000000010', 'read memory'],
    ['2701', 'security access'],
    ['280301', 'communication control'],
    ['2EF1901122', 'write data'],
    ['2F1234030001', 'I/O control'],
    ['3101FF00', 'routine'],
    ['3400441000', 'request download'],
    ['3500441000', 'request upload'],
    ['3601AABB', 'transfer data'],
    ['37', 'transfer exit'],
    ['3D1400100001AA', 'write memory'],
    ['8502', 'DTC setting control'],
    ['3B9A01', 'KWP write data'],
    ['30010101', 'KWP I/O control'],
    ['08', 'OBD on-board control'],
  ])('refuses %s (%s)', (cmd) => refused(cmd))

  it('refuses garbage', () => {
    refused('')
    refused('HELLO')
    refused('0')
  })
})

describe('clearing fault codes (CLAUDE.md §9.2)', () => {
  it('refuses 04 and 14 without authorization', () => {
    refused('04')
    refused('14FFFFFF')
  })

  it('allows 04 once with a fresh authorization', () => {
    const auth = ClearAuthorization.fromUserConfirmation()
    expect(() => assertAllowed('04', { clearAuthorization: auth })).not.toThrow()
    expect(() => assertAllowed('04', { clearAuthorization: auth })).toThrow(ForbiddenCommandError)
  })

  it('refuses an expired authorization', () => {
    const auth = ClearAuthorization.fromUserConfirmation(0, 1000)
    expect(auth.consume(2000)).toBe(false)
  })

  it('does not let an authorization unlock other services', () => {
    const auth = ClearAuthorization.fromUserConfirmation()
    expect(() => assertAllowed('2EF19011', { clearAuthorization: auth })).toThrow(
      ForbiddenCommandError,
    )
  })
})
