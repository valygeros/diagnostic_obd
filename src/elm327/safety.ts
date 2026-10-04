/**
 * Read-only safety filter (CLAUDE.md §9.1). Every command goes through `assertAllowed`
 * before reaching the transport — the UI, plugins and the developer console included.
 * Default is DENY: anything not explicitly listed is refused.
 */

export class ForbiddenCommandError extends Error {
  constructor(
    readonly command: string,
    reason: string,
  ) {
    super(`Commande refusée (${command}) : ${reason}`)
    this.name = 'ForbiddenCommandError'
  }
}

/**
 * Proof that the user went through the clear-codes confirmation (CLAUDE.md §9.2).
 * Single use, short-lived. Only the UI confirmation flow should create one.
 */
export class ClearAuthorization {
  private used = false
  private readonly expiresAt: number

  private constructor(now: number, ttlMs: number) {
    this.expiresAt = now + ttlMs
  }

  /** Call only right after the user confirmed "engine off, ignition on, erase". */
  static fromUserConfirmation(now = Date.now(), ttlMs = 60_000): ClearAuthorization {
    return new ClearAuthorization(now, ttlMs)
  }

  /** Consumes the authorization. Returns false if already used or expired. */
  consume(now = Date.now()): boolean {
    if (this.used || now > this.expiresAt) return false
    this.used = true
    return true
  }
}

/**
 * AT commands allowed, as uppercase prefixes after "AT". Configuration and identification only.
 * Not allowed, among others: PP (writes the adapter's EEPROM), SD (saves user data), @3 (writes the
 * device ID), and anything we have no use for.
 */
const AT_ALLOWED: readonly RegExp[] = [
  /^Z$/, // reset
  /^WS$/, // warm start
  /^D$/, // defaults
  /^E[01]$/, // echo
  /^L[01]$/, // linefeeds
  /^S[01]$/, // spaces
  /^H[01]$/, // headers
  /^AT[012]$/, // adaptive timing
  /^ST[0-9A-F]{2}$/, // timeout
  /^SP[0-9A-C]$/, // set protocol
  /^SPA[0-9A-C]$/, // set protocol with auto fallback
  /^TP[0-9A-C]$/, // try protocol
  /^TPA[0-9A-C]$/,
  /^DPN?$/, // describe protocol (number)
  /^RV$/, // read voltage
  /^I$/, // identify
  /^@1$/, // device description
  /^CAF[01]$/, // CAN auto formatting
  /^CFC[01]$/, // CAN flow control on/off
  /^SH([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/, // set header
  /^CRA([0-9A-FX]{3}|[0-9A-FX]{8})?$/, // receive address filter
  /^AR$/, // automatic receive
  /^FCSH([0-9A-F]{3}|[0-9A-F]{8})$/, // flow control header
  /^FCSD([0-9A-F]{2}){1,5}$/, // flow control data
  /^FCSM[0-2]$/, // flow control mode
  /^CP[0-9A-F]{2}$/, // CAN priority (29-bit)
  /^SR[0-9A-F]{2}$/, // receive address
  /^IIA[0-9A-F]{2}$/, // ISO init address
  /^SW[0-9A-F]{2}$/, // wakeup interval
  /^PC$/, // protocol close
  /^BI$/, // bypass init
  /^M[01]$/, // memory off/on (only stores last protocol)
  /^R[01]$/, // responses
  /^MA$/, // monitor all (read only)
]

/** STN (OBDLink) commands allowed: identification only. */
const ST_ALLOWED: readonly RegExp[] = [/^I$/, /^DI$/, /^MFR$/, /^SN$/]

/** OBD-II services (SAE J1979) allowed. 04 needs a ClearAuthorization. */
const OBD_SERVICES = new Set([0x01, 0x02, 0x03, 0x06, 0x07, 0x09, 0x0a])

/**
 * Diagnostic session types allowed for 0x10: UDS default (01) and extended (03), KWP standard (81).
 * Anything else (UDS 02 programming, KWP 85 programming, 86/87 development/adjustment,
 * manufacturer-specific values) is refused. Add a value only with a cited source.
 */
const SAFE_SESSIONS = new Set([0x01, 0x03, 0x81])

/**
 * Read-only UDS (ISO 14229) and KWP2000 (ISO 14230) services.
 * Explicitly NOT here (CLAUDE.md §9.1): 0x11 reset, 0x23 read memory (gateway to dumps),
 * 0x27 security access, 0x28 communication control, 0x2E/0x3B write data, 0x2F/0x30 I/O control,
 * 0x31 routines, 0x34–0x37 transfers, 0x3D write memory, 0x85 DTC setting control…
 */
const READ_SERVICES = new Set([
  0x19, // UDS ReadDTCInformation
  0x22, // UDS ReadDataByIdentifier
  0x3e, // TesterPresent
  0x1a, // KWP ReadEcuIdentification
  0x21, // KWP ReadDataByLocalIdentifier
  0x18, // KWP ReadDiagnosticTroubleCodesByStatus
  0x17, // KWP ReadStatusOfDiagnosticTroubleCodes
  0x13, // KWP ReadDiagnosticTroubleCodes
])

/** Services that erase fault memory: allowed only with a fresh ClearAuthorization. */
const CLEAR_SERVICES = new Set([
  0x04, // OBD clear DTCs
  0x14, // UDS ClearDiagnosticInformation / KWP ClearDiagnosticInformation
])

export interface CommandContext {
  clearAuthorization?: ClearAuthorization
}

/** Throws ForbiddenCommandError unless the command is on the allow list. */
export function assertAllowed(rawCommand: string, ctx: CommandContext = {}): void {
  const cmd = rawCommand.replace(/[\s\r\n]/g, '').toUpperCase()
  if (cmd === '') throw new ForbiddenCommandError(rawCommand, 'commande vide')

  if (cmd.startsWith('AT')) {
    const body = cmd.slice(2)
    if (!AT_ALLOWED.some((re) => re.test(body))) {
      throw new ForbiddenCommandError(rawCommand, 'commande AT non autorisée')
    }
    return
  }

  if (cmd.startsWith('ST')) {
    const body = cmd.slice(2)
    if (!ST_ALLOWED.some((re) => re.test(body))) {
      throw new ForbiddenCommandError(rawCommand, 'commande STN non autorisée')
    }
    return
  }

  if (!/^[0-9A-F]+$/.test(cmd)) {
    throw new ForbiddenCommandError(rawCommand, 'format inconnu')
  }

  // A trailing single hex digit is the ELM "expected responses" hint (e.g. "010C1").
  const hex = cmd.length % 2 === 1 ? cmd.slice(0, -1) : cmd
  if (hex.length < 2) throw new ForbiddenCommandError(rawCommand, 'requête trop courte')

  const service = parseInt(hex.slice(0, 2), 16)

  if (OBD_SERVICES.has(service) || READ_SERVICES.has(service)) return

  if (service === 0x10) {
    const session = hex.length >= 4 ? parseInt(hex.slice(2, 4), 16) : NaN
    if (SAFE_SESSIONS.has(session)) return
    throw new ForbiddenCommandError(rawCommand, 'session de diagnostic non autorisée')
  }

  if (CLEAR_SERVICES.has(service)) {
    if (ctx.clearAuthorization?.consume()) return
    throw new ForbiddenCommandError(
      rawCommand,
      "effacement sans confirmation de l'utilisateur (ou confirmation expirée)",
    )
  }

  throw new ForbiddenCommandError(
    rawCommand,
    `service 0x${hex.slice(0, 2)} interdit (lecture seule)`,
  )
}
