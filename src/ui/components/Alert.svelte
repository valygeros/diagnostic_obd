<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    tone?: 'info' | 'warning' | 'danger' | 'success'
    title: string
    children?: Snippet
  }

  let { tone = 'info', title, children }: Props = $props()

  const ICON = { info: 'i', warning: '!', danger: '■', success: '✓' } as const
  const ROLE = { info: 'status', warning: 'alert', danger: 'alert', success: 'status' } as const
</script>

<div class="alert {tone}" role={ROLE[tone]}>
  <span class="icon" aria-hidden="true">{ICON[tone]}</span>
  <div class="text">
    <p class="title">{title}</p>
    {#if children}<div class="detail">{@render children()}</div>{/if}
  </div>
</div>

<style>
  .alert {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-3);
    align-items: start;
    padding: var(--sp-3) var(--sp-4);
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: var(--border) solid var(--line);
    border-radius: 50%;
    font-family: var(--font-mono);
    font-weight: 800;
  }

  .title {
    font-weight: 700;
    color: var(--ink);
  }

  .detail {
    color: var(--ink-2);
    margin-top: var(--sp-1);
  }

  .info .icon {
    background: var(--surface-2);
  }
  .warning .icon {
    background: var(--sev-soon);
    color: var(--sev-soon-ink);
  }
  .danger .icon {
    background: var(--sev-stop);
    color: var(--sev-stop-ink);
  }
  .success .icon {
    background: var(--ok);
    color: var(--ok-ink);
  }
  .warning,
  .danger {
    box-shadow: var(--shadow-hard);
  }
</style>
