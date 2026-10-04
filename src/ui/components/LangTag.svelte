<script lang="ts">
  // Flags text still in English (CLAUDE.md §9.5: never pass off untranslated text as French).
  interface Props {
    lang: 'fr' | 'en'
  }
  let { lang }: Props = $props()
</script>

{#if lang === 'en'}
  <span class="tag" title="Texte d'origine en anglais, traduction à venir">EN</span>
{/if}

<style>
  .tag {
    display: inline-block;
    margin-left: 0.4em;
    padding: 0 0.35em;
    border: 1px solid var(--ink-3);
    border-radius: 3px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    line-height: 1.4;
    color: var(--ink-3);
    vertical-align: middle;
  }
</style>
