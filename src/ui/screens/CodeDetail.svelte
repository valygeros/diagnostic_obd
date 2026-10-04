<script lang="ts">
  import { dtcDatabase } from '../../dtc-db/lookup'
  import type { DtcLookup } from '../../dtc-db/types'
  import { ecuLabel } from '../../elm327/frames'
  import Alert from '../components/Alert.svelte'
  import LangTag from '../components/LangTag.svelte'
  import SeverityBadge from '../components/SeverityBadge.svelte'
  import Spinner from '../components/Spinner.svelte'
  import { DIFFICULTY_LABEL, euros, KIND_HINT, KIND_LABEL, LIKELIHOOD_LABEL } from '../format'
  import { href } from '../router.svelte'
  import { URGENCY_HINT } from '../severity'
  import { session } from '../session.svelte'

  interface Props {
    code: string
    ecu: string | undefined
  }
  let { code, ecu }: Props = $props()

  let info = $state<DtcLookup | undefined>()
  $effect(() => {
    info = undefined
    const c = code
    void dtcDatabase.lookup(c).then((r) => {
      if (c === code) info = r
    })
  })

  // Status of this code in the current scan, if it is there.
  const kinds = $derived(
    session.scan?.ecus
      .filter((e) => !ecu || e.id === ecu)
      .flatMap((e) => e.dtcs.filter((d) => d.code === code).map((d) => d.kind)) ?? [],
  )

  const ORDER = { high: 0, medium: 1, low: 2 } as const
  const causes = $derived(
    info?.found
      ? [...info.entry.causes].sort((a, b) => ORDER[a.likelihood] - ORDER[b.likelihood])
      : [],
  )
</script>

<article class="detail">
  <a class="back" href={href({ name: 'scan' })}>‹ Retour au diagnostic</a>

  <header>
    <p class="code mono">{code}</p>
    {#if info?.found}
      <h1>{info.entry.title}<LangTag lang={info.entry.titleLang} /></h1>
      <SeverityBadge urgency={info.entry.urgency} />
      <p class="hint">{URGENCY_HINT[info.entry.urgency]}</p>
    {:else if info}
      <h1>Code non documenté</h1>
    {/if}
  </header>

  {#if kinds.length || ecu}
    <section class="status">
      {#if ecu}<p>
          <strong>Calculateur :</strong>
          {ecuLabel(ecu)} <span class="mono">({ecu})</span>
        </p>{/if}
      {#each [...new Set(kinds)] as k (k)}
        <p><strong>{KIND_LABEL[k]} :</strong> {KIND_HINT[k]}</p>
      {/each}
    </section>
  {/if}

  {#if info === undefined}
    <Spinner label="Chargement de l'explication…" />
  {:else if !info.found}
    <Alert tone="info" title="Ce code n'est pas encore dans la base">
      <p>
        Système concerné : <strong>{info.system}</strong>.
        {#if info.generic}
          C'est un code générique : sa signification est normalisée, mais il manque à notre base.
        {:else}
          C'est un code <strong>spécifique au constructeur</strong> : sa signification dépend de la
          marque. Cherche « {code} » avec la marque et le modèle de la voiture.
        {/if}
      </p>
    </Alert>
  {:else}
    {@const e = info.entry}
    {#if e.description}
      <section>
        <h2>Ce que ça veut dire<LangTag lang={e.descriptionLang} /></h2>
        <p>{e.description}</p>
      </section>
    {/if}

    {#if e.symptoms.length}
      <section>
        <h2>Symptômes possibles</h2>
        <ul>
          {#each e.symptoms as s, i (i)}<li>{s.text}<LangTag lang={s.lang} /></li>{/each}
        </ul>
      </section>
    {/if}

    {#if causes.length}
      <section>
        <h2>Causes probables</h2>
        <ul class="causes">
          {#each causes as c, i (i)}
            <li>
              <span class="like {c.likelihood}">{LIKELIHOOD_LABEL[c.likelihood]}</span>
              <span>{c.text}<LangTag lang={c.lang} /></span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if e.checks.length}
      <section>
        <h2>À vérifier</h2>
        <ol>
          {#each e.checks as c, i (i)}<li>{c}</li>{/each}
        </ol>
      </section>
    {/if}

    {#if e.repair}
      <section class="repair">
        <h2>Réparation (estimation indicative)</h2>
        <dl>
          {#if e.repair.difficulty}<dt>Difficulté</dt>
            <dd>{DIFFICULTY_LABEL[e.repair.difficulty]}</dd>{/if}
          {#if e.repair.diy !== null}<dt>Faisable soi-même</dt>
            <dd>{e.repair.diy ? 'Oui' : 'Non'}</dd>{/if}
          {#if euros(e.repair.costEur)}<dt>Coût</dt>
            <dd>{euros(e.repair.costEur)}</dd>{/if}
        </dl>
      </section>
    {/if}

    {#if e.related.length}
      <section>
        <h2>Codes liés</h2>
        <p class="related">
          {#each e.related as r (r)}<a
              class="mono"
              href={href({ name: 'code', code: r, ecu: undefined })}>{r}</a
            >{/each}
        </p>
      </section>
    {/if}

    <footer class="sources">
      <p><strong>Intitulé normalisé (SAE J2012) :</strong> {e.titleEn}</p>
      {#if e.titleSource === 'auto'}<p>
          Titre traduit automatiquement à partir de l'intitulé normalisé.
        </p>{/if}
      {#if e.urgencySource === 'rule'}<p>Gravité estimée d'après le type de défaut.</p>{/if}
      <p>Sources : {e.sources.join(' · ')}</p>
    </footer>
  {/if}
</article>

<style>
  .detail {
    display: grid;
    gap: var(--sp-5);
  }

  .back {
    font-weight: 600;
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
  }

  header {
    display: grid;
    gap: var(--sp-3);
    justify-items: start;
  }

  .code {
    font-size: var(--fs-xxl);
    font-weight: 700;
    line-height: 1;
    background: var(--ink);
    color: var(--bg);
    padding: 0.1em 0.3em;
  }

  h1 {
    font-size: var(--fs-xl);
    text-transform: none;
  }

  .hint {
    color: var(--ink-2);
    font-weight: 600;
  }

  h2 {
    font-size: var(--fs-lg);
    margin-bottom: var(--sp-2);
  }

  section {
    display: grid;
    gap: var(--sp-2);
  }

  .status {
    padding: var(--sp-3) var(--sp-4);
    background: var(--surface);
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
  }

  ul,
  ol {
    margin: 0;
    padding-left: 1.3em;
    display: grid;
    gap: var(--sp-2);
  }

  .causes {
    list-style: none;
    padding: 0;
  }

  .causes li {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: var(--sp-3);
    align-items: start;
  }

  .like {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    padding: 0.15em 0.4em;
    border: 1px solid var(--line);
    border-radius: 3px;
    text-align: center;
  }
  .like.high {
    background: var(--ink);
    color: var(--bg);
  }
  .like.medium {
    background: var(--surface-2);
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-1) var(--sp-4);
    margin: 0;
  }

  dt {
    color: var(--ink-3);
  }

  dd {
    margin: 0;
    font-weight: 600;
  }

  .related {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
  }

  .related a {
    padding: 0.3em 0.6em;
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    text-decoration: none;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
  }

  .sources {
    display: grid;
    gap: var(--sp-1);
    font-size: var(--fs-xs);
    color: var(--ink-3);
    border-top: 1px solid var(--line-soft);
    padding-top: var(--sp-3);
  }
</style>
