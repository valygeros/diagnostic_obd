/** Shape of public/dtc/<prefix>.json entries, produced by scripts/build-dtc-db.mjs. */

import type { Urgency } from '../ui/severity'

export type Lang = 'fr' | 'en'

export interface DtcText {
  text: string
  lang: Lang
}

export interface DtcCause extends DtcText {
  likelihood: 'low' | 'medium' | 'high'
}

export interface DtcEntry {
  code: string
  title: string
  titleLang: Lang
  /** curated = hand-written, auto = structured translation, source = English original. */
  titleSource: 'curated' | 'auto' | 'source'
  titleEn: string
  description: string
  descriptionLang: Lang
  symptoms: DtcText[]
  causes: DtcCause[]
  checks: string[]
  urgency: Urgency
  urgencySource: 'curated' | 'rule'
  flags: {
    mil: boolean | null
    emissions: boolean | null
    limpMode: boolean | null
    driveCycle: boolean | null
  }
  repair: {
    difficulty: 'easy' | 'medium' | 'hard' | 'shop_only' | null
    diy: boolean | null
    costEur: [number, number] | null
    hours: [number, number] | null
  } | null
  related: string[]
  sources: string[]
}

export interface DtcIndex {
  version: number
  source: { name: string; license: string; commit: string }
  prefixes: string[]
  counts: { codes: number; curated: number }
  translation: { titlesFr: number; causesFr: number; symptomsFr: number; descriptionsFr: number }
}

/** What the UI gets for any code, documented or not (CLAUDE.md §7.4). */
export type DtcLookup =
  | { found: true; entry: DtcEntry }
  | { found: false; code: string; system: string; generic: boolean }
