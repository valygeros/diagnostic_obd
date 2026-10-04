/**
 * Turns a raw ScanResult + base lookups into what the scan screen shows: codes grouped per ECU,
 * one card per code (a code can be stored AND permanent), sorted by severity, and a summary line.
 */

import type { DtcLookup } from '../dtc-db/types'
import type { DtcKind } from '../obd/dtc'
import type { EcuScan, ScanResult } from '../obd/scan'
import { URGENCY_RANK, type Urgency } from './severity'

export interface CodeRow {
  code: string
  kinds: DtcKind[]
  urgency: Urgency
}

export interface EcuGroup {
  ecu: EcuScan
  rows: CodeRow[]
}

export interface ScanSummary {
  totalCodes: number
  urgent: number
  /** Most severe level among the codes, if any. */
  worst: Urgency | undefined
  mil: boolean
  text: string
}

const KIND_ORDER: DtcKind[] = ['stored', 'pending', 'permanent']

/** Unknown codes count as "soon": we don't know, so we don't reassure (CLAUDE.md §9.5). */
function urgencyOf(info: DtcLookup | undefined): Urgency {
  return info?.found ? info.entry.urgency : 'soon'
}

export function groupScan(scan: ScanResult, lookups: Map<string, DtcLookup>): EcuGroup[] {
  return scan.ecus.map((ecu) => {
    const byCode = new Map<string, DtcKind[]>()
    for (const d of ecu.dtcs) byCode.set(d.code, [...(byCode.get(d.code) ?? []), d.kind])
    const rows = [...byCode].map(([code, kinds]) => ({
      code,
      kinds: [...new Set(kinds)].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b)),
      urgency: urgencyOf(lookups.get(code)),
    }))
    rows.sort(
      (a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || a.code.localeCompare(b.code),
    )
    return { ecu, rows }
  })
}

export function summarize(scan: ScanResult, groups: EcuGroup[]): ScanSummary {
  const rows = groups.flatMap((g) => g.rows)
  const urgent = rows.filter((r) => r.urgency === 'stop').length
  const worst = rows.map((r) => r.urgency).sort((a, b) => URGENCY_RANK[a] - URGENCY_RANK[b])[0]
  const parts: string[] = []
  if (rows.length === 0) parts.push('Aucun défaut')
  else {
    parts.push(`${rows.length} défaut${rows.length > 1 ? 's' : ''}`)
    if (urgent) parts[0] += ` dont ${urgent} urgent${urgent > 1 ? 's' : ''}`
  }
  parts.push(scan.mil ? 'Voyant moteur allumé' : 'Voyant moteur éteint')
  return { totalCodes: rows.length, urgent, worst, mil: scan.mil, text: parts.join(' · ') }
}
