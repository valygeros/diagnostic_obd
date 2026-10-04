<script lang="ts">
  import { href, router } from './ui/router.svelte'
  import Components from './ui/screens/Components.svelte'
  import Home from './ui/screens/Home.svelte'
  import { cycleTheme, theme, THEME_LABEL } from './ui/theme.svelte'
</script>

<header class="topbar">
  <a class="brand" href={href('home')}>
    <span class="plug" aria-hidden="true"></span>
    <span>OBD<span class="slash">/</span>DIAG</span>
  </a>
  <nav>
    <a href={href('components')} aria-current={router.route === 'components' ? 'page' : undefined}
      >Composants</a
    >
    <button class="theme" onclick={cycleTheme} aria-label="Changer de thème">
      {THEME_LABEL[theme.pref]}
    </button>
  </nav>
</header>

<main>
  {#if router.route === 'components'}
    <Components />
  {:else}
    <Home />
  {/if}
</main>

<style>
  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: calc(env(safe-area-inset-top, 0px) + var(--sp-2)) var(--gutter) var(--sp-2);
    background: var(--ink);
    color: var(--bg);
    border-bottom: 4px solid var(--accent);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-lg);
    letter-spacing: 0.06em;
    text-decoration: none;
    min-height: var(--touch);
  }

  .slash {
    color: var(--accent);
  }

  /* Stylised OBD connector (trapezoid) */
  .plug {
    width: 26px;
    height: 16px;
    background: var(--accent);
    clip-path: polygon(0 0, 100% 0, 88% 100%, 12% 100%);
  }

  nav {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }

  nav a,
  .theme {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: inherit;
    text-decoration: none;
    border: 1px solid color-mix(in srgb, var(--bg) 40%, transparent);
    border-radius: var(--radius);
    background: transparent;
    cursor: pointer;
  }

  nav a[aria-current='page'] {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }

  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: var(--sp-5) var(--gutter) calc(env(safe-area-inset-bottom, 0px) + var(--sp-6));
  }
</style>
