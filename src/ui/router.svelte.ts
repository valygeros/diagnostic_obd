/**
 * Minimal hash router: works on any static host and any sub-path, no server rewrite needed.
 * Routes: #/  #/scan  #/code/P0301  #/settings  #/components
 */

export type Route =
  | { name: 'home' }
  | { name: 'scan' }
  | { name: 'code'; code: string; ecu: string | undefined }
  | { name: 'settings' }
  | { name: 'components' }

export function parseHash(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#\/?/, '').split('?')
  const parts = path.split('/').filter(Boolean)
  // Parsed once, not reactive state.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const params = new URLSearchParams(query)
  switch (parts[0]) {
    case 'scan':
      return { name: 'scan' }
    case 'code':
      if (parts[1] && /^[PCBU][0-3][0-9A-F]{3}$/i.test(parts[1])) {
        return { name: 'code', code: parts[1].toUpperCase(), ecu: params.get('ecu') ?? undefined }
      }
      return { name: 'home' }
    case 'settings':
      return { name: 'settings' }
    case 'components':
      return { name: 'components' }
    default:
      return { name: 'home' }
  }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/'
    case 'code':
      return `#/code/${route.code}${route.ecu ? `?ecu=${encodeURIComponent(route.ecu)}` : ''}`
    default:
      return `#/${route.name}`
  }
}

export const router = $state({ route: parseHash(location.hash) })

window.addEventListener('hashchange', () => {
  router.route = parseHash(location.hash)
  window.scrollTo(0, 0)
})

export function go(route: Route): void {
  location.hash = href(route)
}
