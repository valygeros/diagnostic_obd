<script lang="ts">
  import { dtcDatabase } from '../../dtc-db/lookup'
  import type { DtcLookup } from '../../dtc-db/types'
  import { SCAN_STEP_LABEL, type ScanStep } from '../../obd/scan'
  import Alert from '../components/Alert.svelte'
  import Button from '../components/Button.svelte'
  import ConfirmDialog from '../components/ConfirmDialog.svelte'
  import DtcCard from '../components/DtcCard.svelte'
  import SeverityBadge from '../components/SeverityBadge.svelte'
  import StepList, { type Step } from '../components/StepList.svelte'
  import { dateTime, volts } from '../format'
  import { go } from '../router.svelte'
  import { groupScan, summarize } from '../scan-view'
  import { clearCodes, scan, session } from '../session.svelte'

  let lookups = $state(new Map<string, DtcLookup>())
  let confirmOpen = $state(false)

  $effect(() => {
    const result = session.scan
    if (!result) return
    const codes = result.ecus.flatMap((e) => e.dtcs.map((d) => d.code))
    void dtcDatabase.lookupMany(codes).then((m) => (lookups = m))
  })

  const groups = $derived(session.scan ? groupScan(session.scan, lookups) : [])
  const summary = $derived(session.scan ? summarize(session.scan, groups) : undefined)
  const hasCodes = $derived(groups.some((g) => g.rows.length > 0))
  const permanentOnly = $derived(
    groups.flatMap((g) => g.rows).every((r) => r.kinds.length === 1 && r.kinds[0] === 'permanent'),
  )

  const STEPS: ScanStep[] = ['status', 'stored', 'pending', 'permanent', 'vin', 'names']
  const steps: Step[] = $derived.by(() => {
    const current = session.scanStep ? STEPS.indexOf(session.scanStep) : -1
    return STEPS.map((s, i) => ({
      label: SCAN_STEP_LABEL[s],
      state: i < current ? 'done' : i === current ? 'active' : 'todo',
    }))
  })

  const connected = $derived(['ready', 'scanning', 'clearing'].includes(session.phase))

  async function confirmClear() {
    confirmOpen = false
    await clearCodes()
  }
</script>

<div class="scan">
  <h1>Diagnostic</h1>

  {#if session.phase === 'scanning' || session.phase === 'clearing'}
    <section class="running">
      <h2>{session.phase === 'clearing' ? 'Effacement…' : 'Lecture en cours…'}</h2>
      {#if session.phase === 'scanning'}<StepList {steps} />{/if}
      <p class="note">Garde le contact mis et ne débranche pas le dongle.</p>
    </section>
  {:else if !session.scan}
    {#if connected}
      <Button variant="primary" size="lg" block onclick={scan}>Lancer le diagnostic</Button>
    {:else if session.phase !== 'lost' && session.phase !== 'error'}
      <Alert tone="info" title="Pas encore de résultat">
        Connecte-toi au dongle (ou lance le mode démo) depuis l'accueil.
      </Alert>
      <Button block onclick={() => go({ name: 'home' })}>Aller à l'accueil</Button>
    {/if}
  {/if}

  {#if session.phase === 'lost' || session.phase === 'error'}
    <Alert tone="danger" title={session.error?.title ?? 'Erreur'}>
      {session.error?.detail}
      <p><a href="#/">Revenir à l'accueil pour se reconnecter</a></p>
    </Alert>
  {/if}

  {#if session.scan && summary && session.phase !== 'scanning' && session.phase !== 'clearing'}
    <section class="summary {summary.worst ?? 'ok'}" aria-live="polite">
      <p class="kicker mono">{dateTime(session.scan.at)}{session.demo ? ' · DÉMO' : ''}</p>
      <p class="headline">{summary.text}</p>
      {#if summary.worst}
        <SeverityBadge urgency={summary.worst} />
      {/if}
      {#if session.scan.vin}
        <p class="vehicle">
          {session.scan.vin.manufacturer ?? 'Constructeur inconnu'}
          {#if session.scan.vin.likelyModelYear}· {session.scan.vin.likelyModelYear}{/if}
          <span class="mono vin">{session.scan.vin.vin}</span>
        </p>
      {/if}
      <p class="meta mono">
        {session.scan.protocol?.short ?? '?'} · batterie {volts(session.adapter?.voltage)}
      </p>
    </section>

    {#if session.lastClear}
      <Alert tone="success" title="Codes effacés">
        Résultat ci-dessous après relecture. Les codes permanents restent tant que le calculateur
        n'a pas vérifié que le problème est réglé ; les codes qui reviennent signalent un défaut
        toujours présent.
      </Alert>
    {/if}

    {#each groups as group (group.ecu.id)}
      <section class="ecu">
        <header>
          <h2>{group.ecu.label}</h2>
          <span class="mono ecu-id">
            {group.ecu.id}{group.ecu.name ? ` · ${group.ecu.name}` : ''}
          </span>
        </header>
        {#if group.rows.length === 0}
          <p class="clean">✓ Aucun défaut enregistré</p>
        {:else}
          <div class="rows">
            {#each group.rows as row (row.code)}
              <DtcCard
                code={row.code}
                kinds={row.kinds}
                ecu={group.ecu.id}
                info={lookups.get(row.code)}
              />
            {/each}
          </div>
        {/if}
      </section>
    {/each}

    <p class="note">
      Ce scan lit les calculateurs qui répondent au protocole OBD standard (surtout moteur et
      boîte). ABS, airbag, carrosserie… arriveront avec les modules par marque.
    </p>

    {#if session.scan.warnings.length}
      <Alert tone="warning" title="Lecture incomplète">
        <ul>
          {#each session.scan.warnings as w, i (i)}<li>{w}</li>{/each}
        </ul>
      </Alert>
    {/if}

    {#if connected}
      <div class="actions">
        <Button block onclick={scan}>Relire</Button>
        {#if hasCodes && !permanentOnly}
          <Button variant="danger" block onclick={() => (confirmOpen = true)}
            >Effacer les codes</Button
          >
        {/if}
      </div>
    {/if}
  {/if}
</div>

<ConfirmDialog
  open={confirmOpen}
  title="Effacer les codes défaut ?"
  confirmLabel="Effacer"
  danger
  acknowledge="Le moteur est coupé et le contact est mis."
  onconfirm={confirmClear}
  oncancel={() => (confirmOpen = false)}
>
  <p>Avant d'effacer, ce diagnostic est enregistré sur cet appareil.</p>
  <ul class="warn-list">
    <li>
      Les données enregistrées au moment du défaut (freeze frame) seront perdues dans la voiture.
    </li>
    <li>
      Les moniteurs antipollution repasseront « non prêts » : un contrôle technique juste après peut
      échouer.
    </li>
    <li>Un défaut effacé sans réparation reviendra.</li>
    <li>
      Les codes permanents et certains défauts graves ne s'effacent pas tant que le problème est
      présent.
    </li>
  </ul>
</ConfirmDialog>

<style>
  .scan {
    display: grid;
    gap: var(--sp-5);
  }

  .running {
    display: grid;
    gap: var(--sp-4);
  }

  .note {
    color: var(--ink-3);
    font-size: var(--fs-sm);
  }

  .summary {
    display: grid;
    gap: var(--sp-2);
    justify-items: start;
    padding: var(--sp-4);
    background: var(--surface);
    border: var(--border) solid var(--line);
    border-top: 10px solid var(--ok);
    border-radius: var(--radius);
    box-shadow: var(--shadow-hard);
  }
  .summary.stop {
    border-top-color: var(--sev-stop);
  }
  .summary.soon {
    border-top-color: var(--sev-soon);
  }
  .summary.monitor {
    border-top-color: var(--sev-monitor);
  }

  .kicker {
    font-size: var(--fs-xs);
    color: var(--ink-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .headline {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-xl);
    line-height: 1.05;
  }

  .vehicle {
    font-weight: 600;
  }

  .vin {
    display: block;
    font-size: var(--fs-xs);
    color: var(--ink-3);
    font-weight: 400;
  }

  .meta {
    font-size: var(--fs-xs);
    color: var(--ink-3);
  }

  .ecu {
    display: grid;
    gap: var(--sp-3);
  }

  .ecu header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--sp-2) var(--sp-3);
    border-bottom: var(--border) solid var(--line);
    padding-bottom: var(--sp-1);
  }

  .ecu-id {
    font-size: var(--fs-xs);
    color: var(--ink-3);
  }

  .rows {
    display: grid;
    gap: var(--sp-3);
  }

  .clean {
    font-weight: 600;
    color: var(--ok-text);
  }

  .actions {
    display: grid;
    gap: var(--sp-3);
  }

  .warn-list {
    margin: 0;
    padding-left: 1.2em;
    display: grid;
    gap: var(--sp-2);
  }
</style>
