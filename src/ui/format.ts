/** Display helpers (French formatting). */

import type { DtcKind } from '../obd/dtc'

export const KIND_LABEL: Record<DtcKind, string> = {
  stored: 'Confirmé',
  pending: 'En attente',
  permanent: 'Permanent',
}

export const KIND_HINT: Record<DtcKind, string> = {
  stored: 'Le défaut a été confirmé et enregistré par le calculateur.',
  pending: "Le défaut a été vu une fois ; il sera confirmé s'il se reproduit au prochain trajet.",
  permanent:
    "Code conservé même après effacement, jusqu'à ce que le calculateur constate que le problème a disparu.",
}

export function volts(v: number | undefined): string {
  return v === undefined ? '—' : `${v.toFixed(1).replace('.', ',')} V`
}

/** Battery voltage judgement (engine off ≈ 12.4–12.7 V, running ≈ 13.5–14.7 V). */
export function voltageHint(
  v: number | undefined,
): { tone: 'ok' | 'warn' | 'bad'; text: string } | undefined {
  if (v === undefined) return undefined
  if (v >= 15.2)
    return { tone: 'bad', text: 'Tension trop élevée : régulateur de charge à vérifier.' }
  if (v >= 13.3) return { tone: 'ok', text: 'Moteur tournant, la charge semble normale.' }
  if (v >= 12.4) return { tone: 'ok', text: 'Batterie correctement chargée (moteur coupé).' }
  if (v >= 12.0) return { tone: 'warn', text: 'Batterie un peu faible.' }
  return { tone: 'bad', text: 'Batterie faible : un scan peut être perturbé.' }
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

export function euros(range: [number, number] | null | undefined): string | undefined {
  if (!range) return undefined
  const f = (n: number) => n.toLocaleString('fr-FR')
  return range[0] === range[1] ? `${f(range[0])} €` : `${f(range[0])} à ${f(range[1])} €`
}

export const DIFFICULTY_LABEL = {
  easy: 'Facile',
  medium: 'Moyenne',
  hard: 'Difficile',
  shop_only: 'Garage uniquement',
} as const

export const LIKELIHOOD_LABEL = { high: 'Fréquent', medium: 'Possible', low: 'Rare' } as const
