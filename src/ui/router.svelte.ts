/**
 * Minimal hash router: works on any static host and any sub-path, no server rewrite needed.
 */

export const ROUTES = ['home', 'components'] as const
export type Route = (typeof ROUTES)[number]

function parse(hash: string): Route {
  const name = hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'home'
}

export const router = $state({ route: parse(location.hash) })

window.addEventListener('hashchange', () => {
  router.route = parse(location.hash)
  window.scrollTo(0, 0)
})

export function href(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`
}
