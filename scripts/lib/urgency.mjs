/**
 * Severity rules (CLAUDE.md §7.3) for codes that have no hand-written sheet.
 * OBDex has no severity field, so we derive one from the code, its title and its flags.
 * Rules are deliberately conservative: when a fault can damage the engine or affect safety → stop.
 *
 * Returns 'stop' | 'soon' | 'monitor' | 'info'.
 */

const STOP_TITLE = [
  /Misfire/i, // unburnt fuel destroys the catalyst; flashing MIL
  /Engine Oil Pressure/i,
  /Engine Coolant Over ?Temperature/i,
  /Engine Over ?Temperature/i,
  /Crankshaft Position Sensor [A-Z]? ?Circuit$/i, // engine may stall
  /Brake Fluid/i,
  /Brake Pressure/i,
  /Deployment|Pretensioner|Restraint|Airbag|Inflatable/i, // airbag may not deploy
  /Steering .*Loss of Assist|Power Steering .*Assist/i,
]

const MONITOR_TITLE = [
  /Evaporative Emission|EVAP/i,
  /Catalyst .*Efficiency Below Threshold/i,
  /Heater (Control )?Circuit/i, // O2 / NOx sensor heaters
  /Fuel Level Sensor/i,
  /Intake Air Temperature/i,
  /Ambient Air Temperature/i,
]

export function deriveUrgency(code, titleEn, flags = {}) {
  if (STOP_TITLE.some((re) => re.test(titleEn))) return 'stop'
  if (MONITOR_TITLE.some((re) => re.test(titleEn)) && !flags.limp_mode_possible) return 'monitor'
  if (flags.limp_mode_possible) return 'soon'
  if (code.startsWith('U')) return 'soon' // lost communication can disable whole systems
  if (code.startsWith('C') || code.startsWith('B')) return 'soon' // chassis/body: safety-related
  if (flags.mil === false) return 'monitor'
  if (flags.emissions_relevant && !flags.limp_mode_possible) return 'monitor'
  return 'soon'
}
