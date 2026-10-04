/**
 * Local VIN decoding (CLAUDE.md §6.7): validity, manufacturer from the WMI, model year.
 * No network. ISO 3779 / ISO 3780.
 */

import { WMI_TABLE } from './wmi'

export interface VinInfo {
  vin: string
  valid: boolean
  /** Manufacturer / brand, when the WMI is known. */
  manufacturer: string | undefined
  /** Manufacturer group, used to pick a plugin (phase 4). */
  group: string | undefined
  country: string | undefined
  /** Possible model years (the 10th character repeats every 30 years). */
  modelYears: number[]
  /** Most recent candidate: OBD-II readers mostly see cars from 1996 on. */
  likelyModelYear: number | undefined
  /** North-American check digit (position 9). Not used in Europe, so only informative. */
  checkDigitOk: boolean | undefined
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/

export function normalizeVin(raw: string): string {
  return raw.replace(/[\s\0-]/g, '').toUpperCase()
}

export function isVin(raw: string): boolean {
  return VIN_RE.test(normalizeVin(raw))
}

/** 10th character → year. A=1980/2010, …, Y=2000/2030, 1=2001/2031, …, 9=2009/2039. */
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789'

export function modelYears(code: string, reference = new Date().getFullYear()): number[] {
  const i = YEAR_CODES.indexOf(code)
  if (i < 0) return []
  const years: number[] = []
  for (let y = 1980 + i; y <= reference + 1; y += 30) years.push(y)
  return years
}

const TRANSLIT: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  P: 7,
  R: 9,
  S: 2,
  T: 3,
  U: 4,
  V: 5,
  W: 6,
  X: 7,
  Y: 8,
  Z: 9,
}
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]

export function checkDigit(vin: string): string {
  let sum = 0
  for (let i = 0; i < 17; i++) {
    const ch = vin[i] ?? '0'
    const v = /[0-9]/.test(ch) ? Number(ch) : (TRANSLIT[ch] ?? 0)
    sum += v * (WEIGHTS[i] ?? 0)
  }
  const r = sum % 11
  return r === 10 ? 'X' : String(r)
}

const COUNTRIES: [RegExp, string][] = [
  [/^[A-H]/, 'Afrique'],
  [/^[J]/, 'Japon'],
  [/^K[L-R]/, 'Corée du Sud'],
  [/^L/, 'Chine'],
  [/^M[A-E]/, 'Inde'],
  [/^[N-R]/, 'Asie'],
  [/^S[A-M]/, 'Royaume-Uni'],
  [/^S[N-T]/, 'Allemagne (ex-RDA)'],
  [/^S[U-Z]/, 'Pologne'],
  [/^T[A-H]/, 'Suisse'],
  [/^T[J-P]/, 'République tchèque'],
  [/^T[R-V]/, 'Hongrie'],
  [/^T[W-Z1]/, 'Portugal'],
  [/^U[5-7]/, 'Slovaquie'],
  [/^V[A-E]/, 'Autriche'],
  [/^V[F-R]/, 'France'],
  [/^V[S-W]/, 'Espagne'],
  [/^V[X-Z0-2]/, 'Serbie / ex-Yougoslavie'],
  [/^W/, 'Allemagne'],
  [/^X[3-9]|^X0/, 'Russie'],
  [/^Y[A-E]/, 'Belgique'],
  [/^Y[F-K]/, 'Finlande'],
  [/^Y[S-W]/, 'Suède'],
  [/^Z[A-R]/, 'Italie'],
  [/^[1-5]/, 'Amérique du Nord'],
  [/^[6-7]/, 'Océanie'],
  [/^[8-9]/, 'Amérique du Sud'],
]

export function decodeVin(raw: string, reference?: number): VinInfo {
  const vin = normalizeVin(raw)
  const valid = VIN_RE.test(vin)
  const wmi = vin.slice(0, 3)
  const entry = WMI_TABLE[wmi] ?? WMI_TABLE[wmi.slice(0, 2)]
  const northAmerican = /^[1-5]/.test(vin)
  const years = valid ? modelYears(vin[9] ?? '', reference) : []
  return {
    vin,
    valid,
    manufacturer: entry?.[0],
    group: entry?.[1],
    country: COUNTRIES.find(([re]) => re.test(vin))?.[1],
    modelYears: years,
    likelyModelYear: years.at(-1),
    checkDigitOk: valid && northAmerican ? checkDigit(vin) === vin[8] : undefined,
  }
}

/** Extracts the VIN from a service 09 PID 02 payload (CAN or legacy, already concatenated). */
export function vinFromBytes(bytes: readonly number[]): string | undefined {
  const text = String.fromCharCode(...bytes.filter((b) => b >= 0x20 && b < 0x7f))
  const m = /[A-HJ-NPR-Z0-9]{17}/.exec(text.toUpperCase())
  return m?.[0]
}
