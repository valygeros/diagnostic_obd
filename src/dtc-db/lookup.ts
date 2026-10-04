/**
 * Fault-code lookup (CLAUDE.md §7.4): manufacturer base first (phase 4), generic base next,
 * and an honest "undocumented" answer otherwise. Files are fetched on demand and cached.
 */

import { describeDtcStructure, isValidDtc } from '../obd/dtc'
import type { DtcEntry, DtcIndex, DtcLookup } from './types'

export type Fetcher = (path: string) => Promise<unknown>

/** Fetches JSON relative to the page, so it works under any hosting sub-path. */
const httpFetcher: Fetcher = async (path) => {
  const res = await fetch(new URL(path, document.baseURI))
  if (!res.ok) throw new Error(`HTTP ${res.status} pour ${path}`)
  return res.json()
}

export class DtcDatabase {
  private readonly chunks = new Map<string, Promise<Record<string, DtcEntry>>>()
  private index: Promise<DtcIndex> | undefined

  constructor(
    private readonly fetcher: Fetcher = httpFetcher,
    private readonly base = 'dtc/',
  ) {}

  meta(): Promise<DtcIndex> {
    this.index ??= this.fetcher(`${this.base}index.json`) as Promise<DtcIndex>
    return this.index
  }

  async lookup(rawCode: string): Promise<DtcLookup> {
    const code = rawCode.trim().toUpperCase()
    const structure = describeDtcStructure(code)
    const unknown: DtcLookup = { found: false, code, ...structure }
    if (!isValidDtc(code)) return unknown

    const prefix = code.slice(0, 3)
    const index = await this.meta().catch(() => undefined)
    if (index && !index.prefixes.includes(prefix)) return unknown

    let chunk = this.chunks.get(prefix)
    if (!chunk) {
      chunk = this.fetcher(`${this.base}${prefix}.json`) as Promise<Record<string, DtcEntry>>
      // Don't cache failures: a later attempt (back online) may succeed.
      chunk.catch(() => this.chunks.delete(prefix))
      this.chunks.set(prefix, chunk)
    }
    const entry = (await chunk.catch(() => ({}) as Record<string, DtcEntry>))[code]
    return entry ? { found: true, entry } : unknown
  }

  async lookupMany(codes: readonly string[]): Promise<Map<string, DtcLookup>> {
    const unique = [...new Set(codes)]
    const results = await Promise.all(unique.map((c) => this.lookup(c)))
    return new Map(unique.map((c, i) => [c, results[i] as DtcLookup]))
  }
}

export const dtcDatabase = new DtcDatabase()
