<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    /** Small uppercase label above the title. */
    kicker?: string
    tone?: 'default' | 'stop' | 'soon' | 'monitor' | 'ok'
    children: Snippet
    actions?: Snippet
  }

  let { title, kicker, tone = 'default', children, actions }: Props = $props()
</script>

<section class="card {tone}">
  {#if kicker || title}
    <header>
      {#if kicker}<p class="kicker">{kicker}</p>{/if}
      {#if title}<h3>{title}</h3>{/if}
    </header>
  {/if}
  <div class="body">{@render children()}</div>
  {#if actions}<footer>{@render actions()}</footer>{/if}
</section>

<style>
  .card {
    background: var(--surface);
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    padding: var(--sp-4);
    display: grid;
    gap: var(--sp-3);
  }

  /* Coloured left edge for tone: an extra cue on top of the text, never the only one. */
  .stop {
    border-left: 10px solid var(--sev-stop);
  }
  .soon {
    border-left: 10px solid var(--sev-soon);
  }
  .monitor {
    border-left: 10px solid var(--sev-monitor);
  }
  .ok {
    border-left: 10px solid var(--ok);
  }

  header {
    display: grid;
    gap: var(--sp-1);
  }

  .kicker {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-3);
  }

  .body {
    color: var(--ink-2);
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
</style>
