import { describe, expect, it } from 'vitest'
// @ts-expect-error — plain .mjs build helper without type declarations
import { translateTitle } from './title-fr.mjs'
// @ts-expect-error — plain .mjs build helper without type declarations
import { deriveUrgency } from './urgency.mjs'

const t = translateTitle as (en: string) => string | undefined
const u = deriveUrgency as (code: string, title: string, flags?: Record<string, boolean>) => string

describe('translateTitle', () => {
  it.each([
    ['Cylinder 3 Misfire Detected', "Raté d'allumage détecté — cylindre 3"],
    ['System Too Lean (Bank 1)', 'Mélange trop pauvre — banc 1'],
    [
      'Engine Coolant Temperature Sensor 1 Circuit High',
      'Capteur 1 de température de liquide de refroidissement moteur : circuit — signal haut',
    ],
    [
      'O2 Sensor Circuit Low Voltage (Bank 1 Sensor 1)',
      'Sonde lambda : circuit — tension basse (banc 1, sonde 1)',
    ],
    [
      'Right Front Wheel Speed Sensor A Circuit/Open',
      'Capteur A de vitesse de roue avant droite : circuit ouvert',
    ],
    ['Fuel Rail Pressure Too Low', "Pression de rampe d'injection : trop basse"],
    ['Shift Solenoid A Stuck On', 'Électrovanne de passage A : bloquée active'],
    ['Fan 3 Performance/Stuck Off', 'Ventilateur 3 : performance insuffisante ou bloqué inactif'],
  ])('%s', (en, fr) => {
    expect(t(en)).toBe(fr)
  })

  it('agrees conditions with feminine head nouns', () => {
    expect(t('Brake Temperature Too High')).toBe('Température de frein : trop élevée')
  })

  it('never translates "Driver" alone (conducteur vs. output stage)', () => {
    expect(t('Driver Frontal Deployment Loop Open')).toMatch(/conducteur/)
    expect(t('Electric/Auxiliary Transmission Fluid Pump B Driver Circuit Performance')).toMatch(
      /étage de commande/,
    )
  })

  it('gives up on unknown words instead of guessing', () => {
    expect(t('Flux Capacitor Circuit High')).toBeUndefined()
  })
})

describe('deriveUrgency', () => {
  it('stops for misfires, oil pressure and airbags', () => {
    expect(u('P0306', 'Cylinder 6 Misfire Detected')).toBe('stop')
    expect(u('P0521', 'Engine Oil Pressure Sensor/Switch Range/Performance')).toBe('stop')
    expect(u('B0001', 'Driver Frontal Stage 1 Deployment Control')).toBe('stop')
  })

  it('keeps emission-only faults at "monitor"', () => {
    expect(
      u('P0442', 'Evaporative Emission System Leak Detected (small leak)', { mil: true }),
    ).toBe('monitor')
  })

  it('escalates when limp mode is possible', () => {
    expect(u('P0700', 'Transmission Control System', { limp_mode_possible: true })).toBe('soon')
  })
})
