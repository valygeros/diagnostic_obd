<script lang="ts">
  import { dtcDatabase } from '../../dtc-db/lookup'
  import type { DtcIndex } from '../../dtc-db/types'
  import { loadPreClearSnapshots } from '../../storage/pre-clear'
  import Button from '../components/Button.svelte'
  import Card from '../components/Card.svelte'
  import { dateTime } from '../format'
  import { rawLog } from '../session.svelte'
  import { applyTheme, theme, THEME_LABEL, type ThemePref } from '../theme.svelte'

  let logText = $state(rawLog.toText())
  let entries = $state(rawLog.size)
  let copied = $state(false)
  let meta = $state<DtcIndex | undefined>()

  $effect(() =>
    rawLog.onChange(() => {
      logText = rawLog.toText()
      entries = rawLog.size
    }),
  )
  $effect(() => {
    void dtcDatabase.meta().then(
      (m) => (meta = m),
      () => undefined,
    )
  })

  const snapshots = loadPreClearSnapshots()
  const lastLines = $derived(logText.split('\n').slice(-150).join('\n'))

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(rawLog.toText())
      copied = true
      setTimeout(() => (copied = false), 2000)
    } catch {
      copied = false
    }
  }

  function downloadLog() {
    const blob = new Blob([rawLog.toText()], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `journal-obd-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const themes: ThemePref[] = ['system', 'light', 'dark']
</script>

<div class="settings">
  <h1>Réglages</h1>

  <Card title="Affichage">
    <div class="seg" role="radiogroup" aria-label="Thème">
      {#each themes as t (t)}
        <button
          role="radio"
          aria-checked={theme.pref === t}
          class:on={theme.pref === t}
          onclick={() => applyTheme(t)}>{THEME_LABEL[t]}</button
        >
      {/each}
    </div>
  </Card>

  <Card title="Journal des échanges" kicker="{entries} lignes · VIN masqué à l'export">
    <p>
      Tout ce qui passe entre le site et le dongle. Indispensable pour comprendre un problème de
      connexion ou ajouter une voiture.
    </p>
    <pre class="log mono" aria-label="Dernières lignes du journal">{lastLines || '(vide)'}</pre>
    {#snippet actions()}
      <Button onclick={copyLog}>{copied ? 'Copié ✓' : 'Copier'}</Button>
      <Button onclick={downloadLog}>Télécharger</Button>
      <Button variant="ghost" onclick={() => rawLog.clear()}>Vider</Button>
    {/snippet}
  </Card>

  <Card title="Sauvegardes avant effacement">
    {#if snapshots.length === 0}
      <p>Aucune pour l'instant. Chaque effacement de codes enregistre d'abord le diagnostic ici.</p>
    {:else}
      <ul class="snaps">
        {#each snapshots as s, i (i)}
          <li>
            <strong>{dateTime(s.savedAt)}</strong>
            {s.scan.vin?.vin ? `· ${s.scan.vin.manufacturer ?? ''}` : ''} ·
            <span class="mono">
              {s.scan.ecus.flatMap((e) => e.dtcs.map((d) => d.code)).join(', ') || 'aucun code'}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>

  <Card title="Base de codes">
    {#if meta}
      <p>
        {meta.counts.codes.toLocaleString('fr-FR')} codes génériques ({meta.source.name}, licence
        {meta.source.license}), dont {meta.counts.curated} avec une fiche complète en français.
      </p>
      <p>
        Traduit en français : titres {meta.translation.titlesFr} %, causes {meta.translation
          .causesFr} %, symptômes {meta.translation.symptomsFr} %. Les textes restés en anglais sont marqués
        <span class="mono">EN</span>.
      </p>
    {:else}
      <p>Informations indisponibles hors ligne.</p>
    {/if}
  </Card>

  <p class="foot">
    Lecture seule : ce site ne modifie jamais la configuration de la voiture. Seul l'effacement des
    codes défaut est possible, après confirmation. Aucune donnée ne quitte cet appareil.
  </p>
</div>

<style>
  .settings {
    display: grid;
    gap: var(--sp-5);
  }

  .seg {
    display: flex;
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .seg button {
    flex: 1;
    min-height: var(--touch);
    border: 0;
    border-right: var(--border) solid var(--line);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .seg button:last-child {
    border-right: 0;
  }

  .seg button.on {
    background: var(--accent);
    color: var(--accent-ink);
  }

  .log {
    max-height: 18rem;
    overflow: auto;
    margin: var(--sp-3) 0 0;
    padding: var(--sp-3);
    background: var(--ink);
    color: var(--bg);
    font-size: 0.72rem;
    line-height: 1.5;
    border-radius: var(--radius);
    white-space: pre;
  }

  .snaps {
    margin: 0;
    padding-left: 1.2em;
    display: grid;
    gap: var(--sp-2);
  }

  .foot {
    font-size: var(--fs-sm);
    color: var(--ink-3);
  }
</style>
