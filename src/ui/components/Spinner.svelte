<script lang="ts">
  interface Props {
    label: string
  }

  let { label }: Props = $props()
</script>

<div class="spinner" role="status">
  <span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
  <span class="label">{label}</span>
</div>

<style>
  .spinner {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }

  /* Bargraph, like a signal meter */
  .bars {
    display: inline-flex;
    align-items: flex-end;
    gap: 3px;
    height: 1.4em;
  }

  .bars i {
    width: 5px;
    background: var(--ink);
    animation: meter 0.9s ease-in-out infinite;
  }

  .bars i:nth-child(2) {
    animation-delay: 0.1s;
  }
  .bars i:nth-child(3) {
    animation-delay: 0.2s;
  }
  .bars i:nth-child(4) {
    animation-delay: 0.3s;
  }
  .bars i:nth-child(5) {
    animation-delay: 0.4s;
  }

  @keyframes meter {
    0%,
    100% {
      height: 20%;
    }
    50% {
      height: 100%;
      background: var(--accent);
    }
  }
</style>
