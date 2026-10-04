/** Severity levels shared by the DTC base and the UI (CLAUDE.md §7.3). */
export type Urgency = 'stop' | 'soon' | 'monitor' | 'info'

export const URGENCY_LABEL: Record<Urgency, string> = {
  stop: 'Arrêt conseillé',
  soon: 'À faire vite',
  monitor: 'À surveiller',
  info: 'Information',
}

export const URGENCY_HINT: Record<Urgency, string> = {
  stop: 'Risque de casse ou de sécurité. Évite de rouler.',
  soon: 'Tu peux rouler, mais fais réparer rapidement.',
  monitor: "Pas d'urgence, mais ça peut s'aggraver.",
  info: 'Code informatif ou historique.',
}

/** Order used to sort faults, most urgent first. */
export const URGENCY_RANK: Record<Urgency, number> = { stop: 0, soon: 1, monitor: 2, info: 3 }
