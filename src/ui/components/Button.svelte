<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { HTMLButtonAttributes } from 'svelte/elements'

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
    size?: 'md' | 'lg'
    block?: boolean
    busy?: boolean
    children: Snippet
  }

  let {
    variant = 'secondary',
    size = 'md',
    block = false,
    busy = false,
    disabled,
    type = 'button',
    children,
    ...rest
  }: Props = $props()
</script>

<button
  {...rest}
  {type}
  class="btn {variant} {size}"
  class:block
  disabled={disabled || busy}
  aria-busy={busy || undefined}
>
  {#if busy}<span class="spin" aria-hidden="true"></span>{/if}
  <span class="label">{@render children()}</span>
</button>

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    min-height: var(--touch);
    padding: 0 var(--sp-5);
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: var(--shadow-hard);
    transition:
      transform 80ms ease,
      box-shadow 80ms ease;
    touch-action: manipulation;
  }

  .btn:active:not(:disabled) {
    transform: translate(3px, 3px);
    box-shadow: 1px 1px 0 var(--line);
  }

  .btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }

  .lg {
    min-height: 64px;
    font-size: var(--fs-xl);
  }

  .block {
    display: flex;
    width: 100%;
  }

  .primary {
    background: var(--accent);
    color: var(--accent-ink);
  }
  .secondary {
    background: var(--surface);
    color: var(--ink);
  }
  .danger {
    background: var(--sev-stop);
    color: var(--sev-stop-ink);
  }
  .ghost {
    background: transparent;
    color: var(--ink);
    border-color: transparent;
    box-shadow: none;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 4px;
  }

  .spin {
    width: 1em;
    height: 1em;
    border: 3px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
