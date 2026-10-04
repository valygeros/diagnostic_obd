/**
 * Structured English → French translation of SAE J2012 DTC titles.
 *
 * Titles follow a grammar: [component phrase] [condition] [location].
 * English stacks modifiers before the head noun ("Engine Coolant Temperature Sensor"); French puts
 * the head first and chains complements with "de" ("capteur de température de liquide de
 * refroidissement moteur"). We translate known units, reverse their order and join with "de".
 *
 * Any unknown word → undefined, and the caller keeps the English title. Never guess.
 */

import { UNITS } from './title-fr-units.mjs'

/**
 * Adjectives placed after the noun in French: [masculine, feminine, rank].
 * Rank orders several adjectives the French way: "roue avant gauche" (position, then side).
 */
const ADJECTIVES = {
  Front: ['avant', 'avant', 1],
  Rear: ['arrière', 'arrière', 1],
  Left: ['gauche', 'gauche', 2],
  Right: ['droit', 'droite', 2],
  Upper: ['supérieur', 'supérieure', 1],
  Lower: ['inférieur', 'inférieure', 1],
  Primary: ['primaire', 'primaire', 0],
  Secondary: ['secondaire', 'secondaire', 0],
  Main: ['principal', 'principale', 0],
  Auxiliary: ['auxiliaire', 'auxiliaire', 0],
  Hydraulic: ['hydraulique', 'hydraulique', 0],
  Variable: ['variable', 'variable', 0],
  Internal: ['interne', 'interne', 0],
  Heated: ['chauffé', 'chauffée', 0],
  Third: ['de 3e rangée', 'de 3e rangée', 3],
  Second: ['de 2e rangée', 'de 2e rangée', 3],
}

/**
 * Conditions at the end of a title. "{m|f}" picks the form agreeing with the component's head
 * noun. Matched longest first.
 */
const CONDITIONS = [
  ['Control Circuit Range/Performance', 'circuit de commande — plage ou performance incorrecte'],
  ['Control Circuit Low', 'circuit de commande — signal bas'],
  ['Control Circuit High', 'circuit de commande — signal haut'],
  ['Control Circuit Open', 'circuit de commande ouvert'],
  ['Control Circuit/Open', 'circuit de commande ouvert'],
  ['Control Circuit', 'circuit de commande'],
  ['Control Performance/Stuck Off', 'commande — performance insuffisante ou bloquée inactive'],
  ['Control Performance', 'commande — performance insuffisante'],
  ['Control Stuck On', 'commande bloquée active'],
  ['Control Stuck Off', 'commande bloquée inactive'],
  ['Control Signal Circuit/Open', 'circuit du signal de commande ouvert'],
  ['Heater Control Circuit Low', 'circuit de commande du chauffage — signal bas'],
  ['Heater Control Circuit High', 'circuit de commande du chauffage — signal haut'],
  ['Heater Control Circuit/Open', 'circuit de commande du chauffage ouvert'],
  ['Heater Control Circuit', 'circuit de commande du chauffage'],
  ['Heater Circuit Malfunction', 'dysfonctionnement du circuit de chauffage'],
  ['Heater Circuit Low', 'circuit de chauffage — signal bas'],
  ['Heater Circuit High', 'circuit de chauffage — signal haut'],
  ['Heater Circuit', 'circuit de chauffage'],
  ['Heater Performance', 'performance du chauffage insuffisante'],
  ['Heater Resistance', 'résistance du chauffage incorrecte'],
  ['Supply Voltage Circuit Low', "circuit d'alimentation — tension basse"],
  ['Supply Voltage Circuit High', "circuit d'alimentation — tension haute"],
  ['Supply Voltage Circuit/Open', "circuit d'alimentation ouvert"],
  ['Supply Voltage Circuit', "circuit d'alimentation"],
  ['Supply Voltage Low', "tension d'alimentation basse"],
  ['Supply Voltage High', "tension d'alimentation haute"],
  ['Supply Circuit/Open', "circuit d'alimentation ouvert"],
  ['Supply Circuit Low', "circuit d'alimentation — signal bas"],
  ['Supply Circuit High', "circuit d'alimentation — signal haut"],
  ['Supply Circuit', "circuit d'alimentation"],
  ['Sense Circuit Low', 'circuit de mesure — signal bas'],
  ['Sense Circuit High', 'circuit de mesure — signal haut'],
  ['Sense Circuit Range/Performance', 'circuit de mesure — plage ou performance incorrecte'],
  ['Sense Circuit', 'circuit de mesure'],
  ['Signal Circuit Low', 'circuit de signal — signal bas'],
  ['Signal Circuit High', 'circuit de signal — signal haut'],
  ['Circuit Range/Performance', 'circuit — plage ou performance incorrecte'],
  ['Circuit Intermittent/Erratic', 'circuit — signal intermittent ou erratique'],
  ['Circuit Intermittent', 'circuit — signal intermittent'],
  ['Circuit Erratic', 'circuit — signal erratique'],
  ['Circuit Low Voltage', 'circuit — tension basse'],
  ['Circuit High Voltage', 'circuit — tension haute'],
  ['Circuit Low Input', 'circuit — signal bas'],
  ['Circuit High Input', 'circuit — signal haut'],
  ['Circuit Low', 'circuit — signal bas'],
  ['Circuit High', 'circuit — signal haut'],
  ['Circuit Open', 'circuit ouvert'],
  ['Circuit Short to Ground', 'circuit en court-circuit à la masse'],
  ['Circuit Short to Battery', 'circuit en court-circuit au +12 V'],
  ['Circuit Shorted', 'circuit en court-circuit'],
  ['Circuit Malfunction', 'dysfonctionnement du circuit'],
  ['Circuit No Activity', 'circuit — aucune activité'],
  ['Circuit Slow Response', 'circuit — réponse lente'],
  ['Circuit No Signal', 'circuit — aucun signal'],
  ['Circuit Performance', 'circuit — performance insuffisante'],
  ['Circuit/Open', 'circuit ouvert'],
  ['Circuit', 'circuit'],
  ['Range/Performance', 'plage ou performance incorrecte'],
  ['Performance/Stuck Off', 'performance insuffisante ou {bloqué|bloquée} inacti{f|ve}'],
  ['Performance or Stuck Off', 'performance insuffisante ou {bloqué|bloquée} inacti{f|ve}'],
  ['Performance Stuck Off', '{bloqué|bloquée} inacti{f|ve}'],
  ['Performance', 'performance insuffisante'],
  ['Stuck Open', '{bloqué|bloquée} ouver{t|te}'],
  ['Stuck Closed', '{bloqué|bloquée} fermé{|e}'],
  ['Stuck On', '{bloqué|bloquée} acti{f|ve}'],
  ['Stuck Off', '{bloqué|bloquée} inacti{f|ve}'],
  ['Stuck', '{bloqué|bloquée}'],
  ['Too High', 'trop élevé{|e}'],
  ['Too Low', 'trop {bas|basse}'],
  ['Current Too High', 'courant trop élevé'],
  ['Current Too Low', 'courant trop faible'],
  ['Current High', 'courant élevé'],
  ['Current Low', 'courant faible'],
  ['Current', 'courant anormal'],
  ['Voltage Too High', 'tension trop élevée'],
  ['Voltage Too Low', 'tension trop basse'],
  ['Voltage High', 'tension haute'],
  ['Voltage Low', 'tension basse'],
  ['Low', 'valeur basse'],
  ['High', 'valeur haute'],
  ['Malfunction', 'dysfonctionnement'],
  ['Insufficient Flow Detected', 'débit insuffisant détecté'],
  ['Excessive Flow Detected', 'débit excessif détecté'],
  ['Flow Excessive Detected', 'débit excessif détecté'],
  ['Flow Insufficient Detected', 'débit insuffisant détecté'],
  ['Insufficient Flow', 'débit insuffisant'],
  ['Excessive Flow', 'débit excessif'],
  ['Slow Response', 'réponse lente'],
  ['No Activity Detected', 'aucune activité détectée'],
  ['No Activity', 'aucune activité'],
  ['Incorrect', 'incorrect{|e}'],
  ['Intermittent/Erratic', 'intermittent{|e} ou erratique'],
  ['Intermittent', 'intermittent{|e}'],
  ['Erratic', 'erratique'],
  ['Open', 'ouver{t|te}'],
  ['Leak Detected (large leak)', 'fuite détectée (grosse fuite)'],
  ['Leak Detected (small leak)', 'fuite détectée (petite fuite)'],
  ['Leak Detected (very small leak)', 'fuite détectée (très petite fuite)'],
  ['Leak Detected', 'fuite détectée'],
  ['Efficiency Below Threshold', 'efficacité sous le seuil'],
  ['Over Temperature', 'surchauffe'],
  ['Overtemperature', 'surchauffe'],
  ['Over Current', 'surintensité'],
  ['Mechanical', 'défaut mécanique'],
  ['Electrical', 'défaut électrique'],
  ['Correlation', 'incohérence de mesure'],
  ['Not Learned', 'non appris{|e}'],
  ['Exceeded Learning Limit', "limite d'apprentissage dépassée"],
  ['Offset Learning At Max Limit', 'correction apprise en butée haute'],
  ['Offset Learning At Min Limit', 'correction apprise en butée basse'],
  ['Offset Not Learned', 'correction non apprise'],
  ['Timing Over-Advanced or System Performance', 'calage trop avancé ou performance du système'],
  ['Timing Over-Advanced', 'calage trop avancé'],
  ['Timing Over-Retarded', 'calage trop retardé'],
  ['Position Not Learned', 'position non apprise'],
  ['Not Programmed', 'non programmé{|e}'],
  ['Detected', 'détecté{|e}'],
  ['Inoperative', 'inopérant{|e}'],
  ['Missing', 'absent{|e}'],
  ['Disabled', 'désactivé{|e}'],
  ['Shorted', 'en court-circuit'],
  ['Short to Ground', 'en court-circuit à la masse'],
  ['Short to Battery', 'en court-circuit au +12 V'],
  ['Loop Open', 'ligne de déclenchement ouverte'],
  ['Loop Resistance High', 'résistance de la ligne de déclenchement trop élevée'],
  ['Loop Resistance Low', 'résistance de la ligne de déclenchement trop faible'],
  ['Loop Short to Ground', 'ligne de déclenchement en court-circuit à la masse'],
  ['Loop Short to Battery', 'ligne de déclenchement en court-circuit au +12 V'],
  ['Underboost', 'pression de suralimentation insuffisante'],
  ['Overboost', 'pression de suralimentation excessive'],
].sort((a, b) => b[0].length - a[0].length)

/** Whole-title patterns. $1… = translated captured component phrases. */
const PATTERNS = [
  [/^Lost Communication [Ww]ith (.+)$/, 'Perte de communication — $1'],
  [/^Invalid Data Received [Ff]rom (.+)$/, 'Données invalides reçues — $1'],
  [/^Invalid Data [Ff]rom (.+)$/, 'Données invalides reçues — $1'],
  [/^Software Incompatibility [Ww]ith (.+)$/, 'Logiciel incompatible — $1'],
  [/^(.+) - (.+) Correlation$/, 'Incohérence entre $1 et $2'],
  [/^(.+) \/ (.+) Correlation$/, 'Incohérence entre $1 et $2'],
]

/** Locations at the end of the title. */
function translateLocation(text, probe = 'capteur') {
  const loc = []
  let rest = text
  const patterns = [
    [/\s*\(?Bank ?(\d),? Sensor (\d|[A-Z])\)?$/, (m) => `banc ${m[1]}, ${probe} ${m[2]}`],
    [/\s*\(?Bank ?(\d)\)?$/, (m) => `banc ${m[1]}`],
    [/\s*\(Sensor (\d)\)$/, (m) => `${probe} ${m[1]}`],
  ]
  for (const [re, fn] of patterns) {
    const m = re.exec(rest)
    if (m) {
      loc.unshift(fn(m))
      rest = rest.slice(0, m.index)
    }
  }
  return { rest: rest.trim(), loc: loc.join(', ') }
}

const UNIT_KEYS = Object.keys(UNITS).sort(
  (a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length,
)

function elide(prefix, word) {
  return /^[aeiouyéèêàâîôûh]/i.test(word) && !/^h(aut|uit)/i.test(word)
    ? `${prefix.slice(0, -1)}'${word}`
    : `${prefix} ${word}`
}

const isIdentifier = (tok) =>
  /^"?[A-Z]"?$/.test(tok) || /^\d{1,2}$/.test(tok) || /^\([A-Z/0-9]+\)$/.test(tok)

/**
 * Translates a component phrase ("Engine Coolant Temperature Sensor A").
 * Returns { text, fem } or undefined if any word is unknown.
 */
export function translateComponentInfo(phrase) {
  const tokens = phrase.trim().split(/\s+/).filter(Boolean)
  const units = []
  let pendingAdj = []
  let pendingIds = []
  let i = 0
  outer: while (i < tokens.length) {
    const tok = tokens[i]
    if (isIdentifier(tok)) {
      const id = tok.replace(/"/g, '')
      const last = units.at(-1)
      if (last && pendingAdj.length === 0) last.suffix.push(id)
      else pendingIds.push(id) // leading identifier: "A Camshaft…"
      i++
      continue
    }
    if (ADJECTIVES[tok]) {
      pendingAdj.push(tok)
      i++
      continue
    }
    for (const key of UNIT_KEYS) {
      const kt = key.split(/\s+/)
      if (kt.every((k, j) => tokens[i + j] === k)) {
        let fr = UNITS[key]
        const fem = fr.startsWith('f:')
        if (fem) fr = fr.slice(2)
        const adj = [...pendingAdj]
          .sort((a, b) => ADJECTIVES[a][2] - ADJECTIVES[b][2])
          .map((a) => ADJECTIVES[a][fem ? 1 : 0])
        units.push({ fr, fem, suffix: pendingIds, adj })
        pendingAdj = []
        pendingIds = []
        i += kt.length
        continue outer
      }
    }
    return undefined // unknown word: give up rather than guess
  }
  if (pendingAdj.length || pendingIds.length || units.length === 0) return undefined
  // Head noun (last English unit) first; complements chained with "de".
  const reversed = units.reverse()
  const parts = reversed.map((u) => [u.fr, ...u.adj, ...u.suffix].join(' '))
  const text = parts.reduce((acc, p) => (acc === '' ? p : elide(`${acc} de`, p)), '')
  return { text, fem: reversed[0].fem }
}

export function translateComponent(phrase) {
  return translateComponentInfo(phrase)?.text
}

function agree(text, fem) {
  return text.replace(/\{([^|}]*)\|([^}]*)\}/g, (_, m, f) => (fem ? f : m))
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Full title translation, or undefined when any part is unknown. */
export function translateTitle(en) {
  const title = en
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bCircuit \/ Open\b/, 'Circuit/Open')

  const misfire = /^Cylinder (\d+) Misfire Detected$/.exec(title)
  if (misfire) return `Raté d'allumage détecté — cylindre ${misfire[1]}`
  if (title === 'Random/Multiple Cylinder Misfire Detected') {
    return "Ratés d'allumage aléatoires/multiples détectés"
  }
  const lean = /^System Too (Lean|Rich) \(?Bank (\d)\)?$/.exec(title)
  if (lean) return `Mélange trop ${lean[1] === 'Lean' ? 'pauvre' : 'riche'} — banc ${lean[2]}`
  const trim = /^Cylinder (\d+) - Fuel Trim at (Max|Min) Limit$/.exec(title)
  if (trim) {
    return `Cylindre ${trim[1]} : correction de richesse en butée ${trim[2] === 'Max' ? 'haute' : 'basse'}`
  }

  // Oxygen / air-fuel sensors are "sondes" in French.
  const probe = /\b(O2|HO2S|Oxygen|A\/F|Air-Fuel|NOx)\b/.test(title) ? 'sonde' : 'capteur'
  const { rest, loc } = translateLocation(title, probe)
  const where = loc ? ` (${loc})` : ''

  for (const [re, tpl] of PATTERNS) {
    const m = re.exec(rest)
    if (!m) continue
    let out = tpl
    for (let g = 1; g < m.length; g++) {
      const comp = /^"?[A-Z]"?$/.test(m[g]) ? m[g].replace(/"/g, '') : translateComponent(m[g])
      if (!comp) return undefined
      out = out.replace(`$${g}`, comp)
    }
    return capitalize(out + where)
  }

  // "Component - Condition" or "Component Condition"
  const candidates = []
  const dashed = /^(.+?) - (.+)$/.exec(rest)
  if (dashed) {
    const condFr = CONDITIONS.find(([c]) => c === dashed[2])?.[1]
    if (condFr) candidates.push([dashed[1], condFr])
  }
  for (const [cond, condFr] of CONDITIONS) {
    if (rest.endsWith(' ' + cond)) candidates.push([rest.slice(0, -cond.length - 1), condFr])
  }
  for (const [compEn, condFr] of candidates) {
    const comp = translateComponentInfo(compEn)
    if (comp) return capitalize(`${comp.text} : ${agree(condFr, comp.fem)}${where}`)
  }

  const comp = translateComponentInfo(rest)
  if (!comp) return undefined
  return capitalize(comp.text + where)
}
