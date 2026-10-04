import { describe, expect, it } from 'vitest'
import { checkDigit, decodeVin, isVin, modelYears, vinFromBytes } from './vin'

describe('decodeVin', () => {
  it('decodes a VW Polo', () => {
    const v = decodeVin('WVWZZZ6RZCY123456', 2026)
    expect(v).toMatchObject({
      valid: true,
      manufacturer: 'Volkswagen',
      group: 'vag',
      country: 'Allemagne',
      modelYears: [1982, 2012],
      likelyModelYear: 2012,
      checkDigitOk: undefined,
    })
  })

  it('decodes a Renault and a Peugeot', () => {
    expect(decodeVin('VF1RFB00X56789012').manufacturer).toBe('Renault')
    expect(decodeVin('VF1RFB00X56789012').country).toBe('France')
    expect(decodeVin('VF3XXXXXXXX123456').group).toBe('stellantis')
  })

  it('handles unknown manufacturers and invalid VINs', () => {
    expect(decodeVin('ABC12345678901234').manufacturer).toBeUndefined()
    const bad = decodeVin('WVWZZZ6RZCY12345') // 16 chars
    expect(bad.valid).toBe(false)
    expect(bad.modelYears).toEqual([])
  })

  it('normalises spaces and case', () => {
    expect(isVin(' wvwzzz6rzcy123456 ')).toBe(true)
    expect(isVin('WVWZZZ6RZCY12345O')).toBe(false) // O forbidden
  })

  it('verifies the North-American check digit', () => {
    // Standard example from NHTSA documentation
    expect(checkDigit('1M8GDM9AXKP042788')).toBe('X')
    expect(decodeVin('1M8GDM9AXKP042788').checkDigitOk).toBe(true)
    expect(decodeVin('1M8GDM9A1KP042788').checkDigitOk).toBe(false)
  })
})

describe('modelYears', () => {
  it('cycles every 30 years', () => {
    expect(modelYears('A', 2026)).toEqual([1980, 2010])
    expect(modelYears('C', 2026)).toEqual([1982, 2012])
    expect(modelYears('Y', 2026)).toEqual([2000])
    expect(modelYears('1', 2026)).toEqual([2001])
    expect(modelYears('T', 2026)).toEqual([1996, 2026])
  })
})

describe('vinFromBytes', () => {
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
  it('extracts the VIN from a CAN payload', () => {
    expect(vinFromBytes([0x01, ...ascii('WVWZZZ6RZCY123456')])).toBe('WVWZZZ6RZCY123456')
  })
  it('ignores legacy zero padding', () => {
    expect(vinFromBytes([0, 0, 0, ...ascii('VF1RFB00X56789012')])).toBe('VF1RFB00X56789012')
  })
  it('returns undefined when there is no VIN', () => {
    expect(vinFromBytes([0, 0, 0])).toBeUndefined()
  })
})
