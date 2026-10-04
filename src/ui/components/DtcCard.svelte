<script lang="ts">
  import type { DtcLookup } from '../../dtc-db/types'
  import type { DtcKind } from '../../obd/dtc'
  import { KIND_LABEL } from '../format'
  import { href } from '../router.svelte'
  import LangTag from './LangTag.svelte'
  import SeverityBadge from './SeverityBadge.svelte'

  interface Props {
    code: string
    kinds: DtcKind[]
    ecu: string
    info: DtcLookup | undefined
  }
  let { code, kinds, ecu, info }: Props = $props()

  const urgency = $derived(info?.found ? info.entry.urgency : 'soon')
</script>

<a class="dtc {urgency}" href={href({ name: 'code', code, ecu })}>
  <div class="top">
    <span class="code mono">{code}</span>
    {#if info?.found}
      <SeverityBadge urgency={info.entry.urgency} size="sm" />
    {/if}
  </div>
  <p class="title">
    {#if info === undefined}
      Recherche de l'explication…
    {:else if info.found}
      {info.entry.title}<LangTag lang={info.entry.titleLang} />
    {:else}
      Code {info.generic ? 'générique' : 'spécifique constructeur'} non documenté · {info.system}
    {/if}
  </p>
  <p class="kinds">
    {#each kinds as k (k)}
      <span class="kind {k}">{KIND_LABEL[k]}</span>
    {/each}
  </p>
  <span class="chev" aria-hidden="true">›</span>
</a>

<style>
  .dtc {
    position: relative;
    display: grid;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-6) var(--sp-3) var(--sp-4);
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
    border: var(--border) solid var(--line);
    border-left-width: 10px;
    border-radius: var(--radius);
  }

  .dtc.stop {
    border-left-color: var(--sev-stop);
  }
  .dtc.soon {
    border-left-color: var(--sev-soon);
  }
  .dtc.monitor {
    border-left-color: var(--sev-monitor);
  }
  .dtc.info {
    border-left-color: var(--sev-info);
  }

  .dtc:active {
    background: var(--surface-2);
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
  }

  .code {
    font-size: var(--fs-lg);
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .title {
    font-weight: 600;
    line-height: 1.3;
  }

  .kinds {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }

  .kind {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.1em 0.5em;
    border: 1px solid var(--ink-3);
    border-radius: 3px;
    color: var(--ink-2);
  }

  .kind.stored {
    border-color: var(--ink);
    color: var(--ink);
    font-weight: 700;
  }

  .chev {
    position: absolute;
    right: var(--sp-3);
    top: 50%;
    transform: translateY(-50%);
    font-size: 2rem;
    color: var(--ink-3);
  }
</style>
