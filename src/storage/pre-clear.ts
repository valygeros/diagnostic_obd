/**
 * Snapshot of the scan taken right before clearing codes (CLAUDE.md §9.2), so nothing is lost.
 * Phase 1 keeps the last few in localStorage; phase 3 moves this into the IndexedDB history.
 */

import type { ScanResult } from '../obd/scan'

const KEY = 'pre-clear-snapshots'
const MAX = 10

export interface PreClearSnapshot {
  savedAt: string
  scan: ScanResult
}

export function loadPreClearSnapshots(): PreClearSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as PreClearSnapshot[]) : []
  } catch {
    return []
  }
}

/** Returns false if the browser refused to store it (private mode, quota). */
export function savePreClearSnapshot(scan: ScanResult): boolean {
  try {
    const list = [{ savedAt: new Date().toISOString(), scan }, ...loadPreClearSnapshots()].slice(
      0,
      MAX,
    )
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}
