/** Theme preference: follows the system unless the user picks one. */

export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'theme'

function load(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

export const theme = $state({ pref: load() })

export function applyTheme(pref: ThemePref): void {
  theme.pref = pref
  if (pref === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = pref
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    // Private browsing: the choice just won't persist.
  }
}

export function cycleTheme(): void {
  const next: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' }
  applyTheme(next[theme.pref])
}

export const THEME_LABEL: Record<ThemePref, string> = {
  system: 'Auto',
  light: 'Clair',
  dark: 'Sombre',
}
