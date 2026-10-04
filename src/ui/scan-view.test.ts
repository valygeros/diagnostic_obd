import { describe, expect, it } from 'vitest'
import type { DtcEntry, DtcLookup } from '../dtc-db/types'
import type { ScanResult } from '../obd/scan'
import { groupScan, summarize } from './scan-view'

const found = (code: string, urgency: DtcEntry['urgency']): DtcLookup => ({
  found: true,
  entry: { code, urgency } as DtcEntry,
})

const scan = {
  mil: true,
  ecus: [
    {
      id: '7E8',
      label: 'Moteur',
      dtcs: [
        { code: 'P0420', kind: 'permanent' },
        { code: 'P0171', kind: 'stored' },
        { code: 'P0301', kind: 'stored' },
        { code: 'P0420', kind: 'stored' },
      ],
    },
    { id: '7E9', label: 'Boîte de vitesses', dtcs: [] },
  ],
} as unknown as ScanResult

const lookups = new Map<string, DtcLookup>([
  ['P0420', found('P0420', 'monitor')],
  ['P0171', found('P0171', 'soon')],
  ['P0301', found('P0301', 'stop')],
])

describe('groupScan', () => {
  it('merges kinds per code and sorts by severity', () => {
    const [engine, gearbox] = groupScan(scan, lookups)
    expect(engine?.rows).toEqual([
      { code: 'P0301', kinds: ['stored'], urgency: 'stop' },
      { code: 'P0171', kinds: ['stored'], urgency: 'soon' },
      { code: 'P0420', kinds: ['stored', 'permanent'], urgency: 'monitor' },
    ])
    expect(gearbox?.rows).toEqual([])
  })

  it('treats unknown codes as "soon", not as harmless', () => {
    const [engine] = groupScan(scan, new Map())
    expect(engine?.rows.every((r) => r.urgency === 'soon')).toBe(true)
  })
})

describe('summarize', () => {
  it('builds the one-line summary', () => {
    const s = summarize(scan, groupScan(scan, lookups))
    expect(s).toMatchObject({ totalCodes: 3, urgent: 1, worst: 'stop' })
    expect(s.text).toBe('3 défauts dont 1 urgent · Voyant moteur allumé')
  })

  it('handles a clean car', () => {
    const clean = { mil: false, ecus: [{ id: '7E8', dtcs: [] }] } as unknown as ScanResult
    expect(summarize(clean, groupScan(clean, new Map())).text).toBe(
      'Aucun défaut · Voyant moteur éteint',
    )
  })
})
