<script lang="ts">
  import { href, router } from './ui/router.svelte'
  import CodeDetail from './ui/screens/CodeDetail.svelte'
  import Components from './ui/screens/Components.svelte'
  import Home from './ui/screens/Home.svelte'
  import Scan from './ui/screens/Scan.svelte'
  import Settings from './ui/screens/Settings.svelte'
  import { session } from './ui/session.svelte'

  const linkState = $derived.by(() => {
    switch (session.phase) {
      case 'idle':
        return { cls: 'off', text: 'Déconnecté' }
      case 'ready':
      case 'scanning':
      case 'clearing':
        return { cls: 'on', text: session.demo ? 'Démo' : 'Connecté' }
      case 'lost':
      case 'error':
        return { cls: 'bad', text: 'Erreur' }
      default:
        return { cls: 'busy', text: 'Connexion…' }
    }
  })

  const r = $derived(router.route)
</script>

<header class="topbar">
  <a class="brand" href={href({ name: 'home' })}>
    <span class="plug" aria-hidden="true"></span>
    <span>OBD<span class="slash">/</span>DIAG</span>
  </a>
  <span class="link {linkState.cls}" role="status">
    <span class="dot" aria-hidden="true"></span>{linkState.text}
  </span>
</header>

{#if session.demo}
  <div class="demo-banner" role="note">MODE DÉMO · {session.demo} · voiture simulée</div>
{/if}

<main>
  {#if r.name === 'scan'}
    <Scan />
  {:else if r.name === 'code'}
    {#key r.code}<CodeDetail code={r.code} ecu={r.ecu} />{/key}
  {:else if r.name === 'settings'}
    <Settings />
  {:else if r.name === 'components'}
    <Components />
  {:else}
    <Home />
  {/if}
</main>

<nav class="tabs" aria-label="Navigation principale">
  <a href={href({ name: 'home' })} aria-current={r.name === 'home' ? 'page' : undefined}>Accueil</a>
  <a
    href={href({ name: 'scan' })}
    aria-current={r.name === 'scan' || r.name === 'code' ? 'page' : undefined}>Diagnostic</a
  >
  <a href={href({ name: 'settings' })} aria-current={r.name === 'settings' ? 'page' : undefined}
    >Réglages</a
  >
</nav>

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

  .plug {
    width: 26px;
    height: 16px;
    background: var(--accent);
    clip-path: polygon(0 0, 100% 0, 88% 100%, 12% 100%);
  }

  .link {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid currentColor;
  }
  .on .dot {
    background: var(--ok);
  }
  .busy .dot {
    background: var(--accent);
    animation: blink 0.8s steps(2) infinite;
  }
  .bad .dot {
    background: var(--sev-stop);
  }

  @keyframes blink {
    50% {
      opacity: 0.2;
    }
  }

  .demo-banner {
    position: sticky;
    top: calc(env(safe-area-inset-top, 0px) + 64px);
    z-index: 9;
    padding: var(--sp-1) var(--gutter);
    background: repeating-linear-gradient(
      -45deg,
      var(--accent),
      var(--accent) 10px,
      color-mix(in srgb, var(--accent) 80%, var(--ink)) 10px,
      color-mix(in srgb, var(--accent) 80%, var(--ink)) 20px
    );
    color: var(--accent-ink);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    font-weight: 700;
    text-align: center;
  }

  main {
    max-width: 40rem;
    margin: 0 auto;
    padding: var(--sp-5) var(--gutter) calc(env(safe-area-inset-bottom, 0px) + 6rem);
  }

  .tabs {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: var(--surface);
    border-top: var(--border) solid var(--line);
  }

  .tabs a {
    display: grid;
    place-items: center;
    min-height: 56px;
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-md);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-decoration: none;
    color: var(--ink-2);
  }

  .tabs a[aria-current='page'] {
    color: var(--ink);
    box-shadow: inset 0 4px 0 var(--accent);
  }
</style>
