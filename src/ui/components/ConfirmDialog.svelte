<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'

  interface Props {
    open: boolean
    title: string
    confirmLabel: string
    cancelLabel?: string
    danger?: boolean
    /** Optional checkbox the user must tick before confirming (e.g. "engine off, ignition on"). */
    acknowledge?: string
    onconfirm: () => void
    oncancel: () => void
    children: Snippet
  }

  let {
    open,
    title,
    confirmLabel,
    cancelLabel = 'Annuler',
    danger = false,
    acknowledge,
    onconfirm,
    oncancel,
    children,
  }: Props = $props()

  let dialog: HTMLDialogElement | undefined = $state()
  let acknowledged = $state(false)

  $effect(() => {
    if (!dialog) return
    if (open && !dialog.open) {
      acknowledged = false
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  })
</script>

<dialog
  bind:this={dialog}
  aria-labelledby="confirm-title"
  oncancel={(e) => {
    e.preventDefault()
    oncancel()
  }}
>
  <h2 id="confirm-title">{title}</h2>
  <div class="content">{@render children()}</div>

  {#if acknowledge}
    <label class="ack">
      <input type="checkbox" bind:checked={acknowledged} />
      <span>{acknowledge}</span>
    </label>
  {/if}

  <div class="actions">
    <Button variant="ghost" onclick={oncancel}>{cancelLabel}</Button>
    <Button
      variant={danger ? 'danger' : 'primary'}
      disabled={acknowledge !== undefined && !acknowledged}
      onclick={onconfirm}
    >
      {confirmLabel}
    </Button>
  </div>
</dialog>

<style>
  dialog {
    width: min(32rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: var(--sp-5);
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    box-shadow: 8px 8px 0 var(--line);
  }

  dialog::backdrop {
    background: rgb(0 0 0 / 0.6);
  }

  .content {
    margin-block: var(--sp-4);
    color: var(--ink-2);
    display: grid;
    gap: var(--sp-3);
  }

  .ack {
    display: flex;
    gap: var(--sp-3);
    align-items: flex-start;
    padding: var(--sp-3);
    border: var(--border) dashed var(--line-soft);
    border-radius: var(--radius);
    font-weight: 600;
    cursor: pointer;
  }

  .ack input {
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    accent-color: var(--accent);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--sp-3);
    margin-top: var(--sp-5);
  }
</style>
