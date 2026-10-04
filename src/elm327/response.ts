/**
 * Cleanup and error detection for raw ELM327 replies (CLAUDE.md §6.2).
 * Clones are sloppy: tolerate echoes, stray spaces, lowercase, blank lines and NUL bytes.
 */

export type ElmErrorCode =
  | 'NO_DATA'
  | 'UNABLE_TO_CONNECT'
  | 'BUS_INIT_ERROR'
  | 'CAN_ERROR'
  | 'BUS_BUSY'
  | 'BUS_ERROR'
  | 'DATA_ERROR'
  | 'RX_ERROR'
  | 'FB_ERROR'
  | 'STOPPED'
  | 'UNKNOWN_COMMAND'
  | 'BUFFER_FULL'
  | 'LOW_POWER'
  | 'INTERNAL_ERROR'

interface ElmErrorSpec {
  code: ElmErrorCode
  test: RegExp
  /** French message shown to the user. */
  message: string
  /** What to try. */
  hint: string
}

export const ELM_ERRORS: readonly ElmErrorSpec[] = [
  {
    code: 'NO_DATA',
    test: /^NO ?DATA$/,
    message: 'Aucune réponse de la voiture pour cette demande.',
    hint: 'Normal si la voiture ne gère pas cette information. Sinon, vérifie que le contact est mis.',
  },
  {
    code: 'UNABLE_TO_CONNECT',
    test: /^UNABLE TO CONNECT$/,
    message: 'Le dongle ne parvient pas à dialoguer avec la voiture.',
    hint: 'Mets le contact (ou démarre le moteur), vérifie que le dongle est bien enfoncé dans la prise OBD, puis réessaie.',
  },
  {
    code: 'BUS_INIT_ERROR',
    test: /^BUS INIT:?\s*\.*\s*ERROR$/,
    message: "L'initialisation de la communication a échoué.",
    hint: 'Coupe le contact 10 secondes, remets-le, puis réessaie. Les voitures anciennes (KWP/ISO 9141) sont parfois capricieuses.',
  },
  {
    code: 'CAN_ERROR',
    test: /^CAN ERROR$/,
    message: 'Erreur sur le réseau CAN de la voiture.',
    hint: 'Contact mis ? Si le problème persiste, essaie de forcer un autre protocole dans les réglages.',
  },
  {
    code: 'BUS_BUSY',
    test: /^BUS BUSY$/,
    message: 'Le réseau de la voiture est trop occupé.',
    hint: 'Réessaie dans quelques secondes.',
  },
  {
    code: 'BUS_ERROR',
    test: /^BUS ERROR$/,
    message: 'Erreur électrique sur la ligne de diagnostic.',
    hint: 'Vérifie le branchement du dongle.',
  },
  {
    code: 'DATA_ERROR',
    test: /^DATA ERROR>?$|^<DATA ERROR$/,
    message: 'Réponse de la voiture corrompue.',
    hint: 'Réessaie. Si ça se répète, le dongle est peut-être de mauvaise qualité.',
  },
  {
    code: 'RX_ERROR',
    test: /^<RX ERROR$/,
    message: 'Réponse de la voiture mal reçue.',
    hint: 'Réessaie.',
  },
  {
    code: 'FB_ERROR',
    test: /^FB ERROR$/,
    message: 'Problème électrique sur la ligne de diagnostic.',
    hint: 'Vérifie le branchement du dongle.',
  },
  {
    code: 'STOPPED',
    test: /^STOPPED$/,
    message: 'La demande a été interrompue.',
    hint: 'Réessaie.',
  },
  {
    code: 'UNKNOWN_COMMAND',
    test: /^\?$/,
    message: 'Le dongle ne connaît pas cette commande.',
    hint: 'Fréquent avec les clones ELM327 bas de gamme.',
  },
  {
    code: 'BUFFER_FULL',
    test: /^BUFFER FULL$/,
    message: 'La mémoire du dongle est saturée.',
    hint: 'Le dongle reçoit plus vite que le Bluetooth ne transmet. Réessaie.',
  },
  {
    code: 'LOW_POWER',
    test: /^LV RESET$|^ACT ALERT$|^LP ALERT$/,
    message: 'Le dongle a détecté une tension trop basse et a redémarré.',
    hint: 'Batterie faible ? Mets le contact et vérifie la tension.',
  },
  {
    code: 'INTERNAL_ERROR',
    test: /^ERR\d{2}$/,
    message: 'Erreur interne du dongle.',
    hint: 'Débranche et rebranche le dongle.',
  },
]

export class ElmError extends Error {
  readonly hint: string

  constructor(
    readonly code: ElmErrorCode,
    readonly command: string,
    readonly raw: string,
  ) {
    const spec = ELM_ERRORS.find((e) => e.code === code)
    super(spec?.message ?? code)
    this.hint = spec?.hint ?? ''
    this.name = 'ElmError'
  }
}

/** Status lines the ELM prints before the actual data. */
const NOISE_PREFIX = /^(SEARCHING\.*|BUS INIT:?\s*\.*\s*OK)\s*/

/**
 * Splits a raw reply (everything before `>`) into meaningful, normalised lines:
 * uppercase, no NUL bytes, no blank lines, no echo of `sentCommand`, no "SEARCHING...".
 */
export function cleanLines(
  raw: string,
  sentCommand?: string,
  { preserveCase = false }: { preserveCase?: boolean } = {},
): string[] {
  const echo = sentCommand?.replace(/\s/g, '').toUpperCase()
  const lines: string[] = []
  for (const part of raw
    .replace(/\0/g, '')
    .replace(/>/g, '')
    .split(/[\r\n]+/)) {
    let line = preserveCase ? part.trim() : part.trim().toUpperCase()
    // SEARCHING... and BUS INIT can be glued to the data on the same line.
    while (NOISE_PREFIX.test(line)) line = line.replace(NOISE_PREFIX, '')
    if (line === '') continue
    if (echo && line.replace(/\s/g, '') === echo) continue
    lines.push(line)
  }
  return lines
}

export function errorCodeOf(line: string): ElmErrorCode | undefined {
  return ELM_ERRORS.find((e) => e.test.test(line))?.code
}

/**
 * Separates data lines from error lines. When several ECUs answer, one may say NO DATA
 * while another returns data: that is not an error, so only report an error when no data came back.
 */
export function splitErrors(lines: string[]): { data: string[]; error: ElmErrorCode | undefined } {
  const data: string[] = []
  let error: ElmErrorCode | undefined
  for (const line of lines) {
    const code = errorCodeOf(line)
    if (code) error ??= code
    else data.push(line)
  }
  return { data, error: data.length > 0 ? undefined : error }
}
