<script lang="ts">
  import { URGENCY_LABEL, type Urgency } from '../severity'

  interface Props {
    urgency: Urgency
    size?: 'sm' | 'md'
  }

  let { urgency, size = 'md' }: Props = $props()

  // Shape differs per level so the badge reads without colour (CLAUDE.md §13).
  const ICON: Record<Urgency, string> = { stop: '■', soon: '▲', monitor: '●', info: 'i' }
</script>

<span class="badge {urgency} {size}">
  <span class="icon" aria-hidden="true">{ICON[urgency]}</span>
  {URGENCY_LABEL[urgency]}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.2em 0.6em;
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-md);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .sm {
    font-size: var(--fs-xs);
    padding: 0.1em 0.45em;
  }

  .icon {
    font-family: var(--font-body);
    font-size: 0.8em;
    line-height: 1;
  }

  .stop {
    background: var(--sev-stop);
    color: var(--sev-stop-ink);
  }
  .soon {
    background: var(--sev-soon);
    color: var(--sev-soon-ink);
  }
  .monitor {
    background: var(--sev-monitor);
    color: var(--sev-monitor-ink);
  }
  .info {
    background: var(--sev-info);
    color: var(--sev-info-ink);
  }
  .info .icon {
    font-family: var(--font-mono);
    font-weight: 700;
  }
</style>
