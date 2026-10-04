<script module lang="ts">
  export interface Step {
    label: string
    state: 'done' | 'active' | 'todo' | 'failed'
  }
</script>

<script lang="ts">
  interface Props {
    steps: Step[]
  }
  let { steps }: Props = $props()

  const MARK = { done: '✓', active: '…', todo: '', failed: '✕' } as const
  const SR = { done: 'terminé', active: 'en cours', todo: 'à venir', failed: 'échec' } as const
</script>

<ol class="steps">
  {#each steps as step, i (i)}
    <li class={step.state}>
      <span class="mark" aria-hidden="true">{MARK[step.state]}</span>
      <span>{step.label}</span>
      <span class="visually-hidden">({SR[step.state]})</span>
    </li>
  {/each}
</ol>

<style>
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--sp-2);
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-weight: 600;
    color: var(--ink-3);
  }

  .mark {
    display: grid;
    place-items: center;
    width: 1.75rem;
    height: 1.75rem;
    flex: none;
    border: var(--border) solid var(--line-soft);
    border-radius: 50%;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .done {
    color: var(--ink);
  }
  .done .mark {
    background: var(--ok);
    color: var(--ok-ink);
    border-color: var(--line);
  }

  .active {
    color: var(--ink);
  }
  .active .mark {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--line);
    animation: pulse 1s ease-in-out infinite;
  }

  .failed {
    color: var(--sev-stop-text);
  }
  .failed .mark {
    background: var(--sev-stop);
    color: var(--sev-stop-ink);
    border-color: var(--line);
  }

  @keyframes pulse {
    50% {
      transform: scale(0.85);
    }
  }
</style>
