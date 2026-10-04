<script lang="ts">
  import { currentEnv, detectSupport } from '../../platform/support'
  import { SCENARIOS } from '../../simulator/scenarios'
  import Alert from '../components/Alert.svelte'
  import Button from '../components/Button.svelte'
  import Card from '../components/Card.svelte'
  import ConnectionHelp from '../components/ConnectionHelp.svelte'
  import StepList, { type Step } from '../components/StepList.svelte'
  import { volts, voltageHint } from '../format'
  import { go } from '../router.svelte'
  import {
    connectBluetooth,
    connectDemo,
    disconnect,
    reconnect,
    retryVehicle,
    scan,
    session,
    type SessionPhase,
  } from '../session.svelte'

  const support = detectSupport(currentEnv())
  let demoOpen = $state(false)

  const busy = $derived(['connecting', 'adapter', 'vehicle'].includes(session.phase))

  const ORDER: SessionPhase[] = ['connecting', 'adapter', 'vehicle', 'ready']
  const steps: Step[] = $derived.by(() => {
    const labels = [
      session.demo ? 'Démarrage du simulateur' : 'Connexion Bluetooth',
      'Configuration du dongle',
      'Recherche de la voiture (protocole)',
    ]
    const failedAt = session.phase === 'error' ? session.error?.kind : undefined
    const current = ORDER.indexOf(session.phase)
    return labels.map((label, i) => {
      if (failedAt) {
        const failIndex = failedAt === 'vehicle' ? 2 : failedAt === 'adapter' ? 1 : 0
        return { label, state: i < failIndex ? 'done' : i === failIndex ? 'failed' : 'todo' }
      }
      return { label, state: i < current ? 'done' : i === current ? 'active' : 'todo' }
    })
  })

  async function startScan() {
    go({ name: 'scan' })
    await scan()
  }

  const voltage = $derived(voltageHint(session.adapter?.voltage))
</script>

<div class="home">
  {#if session.phase === 'idle'}
    <section class="hero">
      <p class="kicker mono">OBD-II · EOBD · ELM327 BLE</p>
      <h1>Diagnostic<br /><span class="hl">auto</span></h1>
      <p class="lead">Branche le dongle sous le volant, mets le contact, puis connecte-toi.</p>
    </section>

    {#if support.bluetooth === 'ios-needs-bluefy'}
      <Alert tone="warning" title="Ouvre ce site dans l'app Bluefy">
        <p>
          Sur iPhone, Safari et Chrome ne savent pas parler en Bluetooth à un site web. Installe
          <strong>Bluefy</strong> (gratuit, App Store), puis ouvre cette adresse dedans. Le mode démo
          marche partout.
        </p>
      </Alert>
    {:else if support.bluetooth === 'insecure-context'}
      <Alert tone="danger" title="Connexion non sécurisée">
        Le Bluetooth web ne marche qu'en HTTPS. Ouvre la version <code>https://</code> du site.
      </Alert>
    {:else if support.bluetooth === 'unsupported-browser'}
      <Alert tone="warning" title="Navigateur non compatible">
        Utilise <strong>Chrome</strong> ou <strong>Edge</strong> (PC, Mac, Android) ou
        <strong>Bluefy</strong> sur iPhone. Le mode démo marche partout.
      </Alert>
    {/if}

    <div class="actions">
      <Button
        variant="primary"
        size="lg"
        block
        disabled={support.bluetooth !== 'ok'}
        onclick={connectBluetooth}
      >
        Connecter le dongle
      </Button>
      <Button size="lg" block onclick={() => (demoOpen = !demoOpen)} aria-expanded={demoOpen}>
        Mode démo
      </Button>
    </div>

    {#if demoOpen}
      <section class="demo" aria-label="Choisir une voiture simulée">
        <p class="mono kicker">Voitures simulées — aucun dongle nécessaire</p>
        {#each SCENARIOS as s (s.id)}
          <button class="scenario" onclick={() => connectDemo(s.id)}>
            <strong>{s.label}</strong>
            <span>{s.description}</span>
          </button>
        {/each}
      </section>
    {/if}
  {:else if busy || session.phase === 'error'}
    <section class="progress">
      <h2>{session.phase === 'error' ? 'Connexion impossible' : 'Connexion…'}</h2>
      <StepList {steps} />
      {#if session.phase === 'vehicle'}
        <p class="note">
          La première recherche peut prendre jusqu'à 20 secondes sur les voitures anciennes.
        </p>
      {/if}
    </section>

    {#if session.phase === 'error' && session.error}
      <Alert tone="danger" title={session.error.title}>{session.error.detail}</Alert>
      <ConnectionHelp kind={session.error.kind} />
      <div class="actions">
        {#if session.error.kind === 'vehicle'}
          <Button variant="primary" size="lg" block onclick={retryVehicle}>Réessayer</Button>
        {:else if !session.demo}
          <Button variant="primary" size="lg" block onclick={connectBluetooth}>Réessayer</Button>
        {/if}
        <Button block onclick={disconnect}>Retour</Button>
      </div>
    {/if}
  {:else if session.phase === 'lost'}
    <Alert tone="danger" title="Connexion perdue">{session.error?.detail}</Alert>
    <ConnectionHelp kind="link" />
    <div class="actions">
      {#if !session.demo}
        <Button variant="primary" size="lg" block onclick={reconnect}>Se reconnecter</Button>
      {/if}
      <Button block onclick={disconnect}>Retour à l'accueil</Button>
    </div>
  {:else}
    <section class="connected">
      <p class="kicker mono">{session.demo ? 'MODE DÉMO' : 'Connecté'}</p>
      <h2>Prêt pour le diagnostic</h2>
    </section>

    <Card kicker="Liaison" title={session.deviceName ?? 'Dongle'}>
      <dl class="facts">
        <dt>Dongle</dt>
        <dd>
          {session.adapter?.id ?? 'inconnu'}{session.adapter?.stnId
            ? ` · ${session.adapter.stnId}`
            : ''}
        </dd>
        <dt>Protocole</dt>
        <dd>{session.protocol?.name ?? 'inconnu'}</dd>
        <dt>Batterie</dt>
        <dd class="mono">{volts(session.adapter?.voltage)}</dd>
      </dl>
      {#if voltage}
        <p class="volt {voltage.tone}">{voltage.text}</p>
      {/if}
      {#if session.adapter?.refused.length}
        <p class="note">
          Dongle bas de gamme probable : il a refusé {session.adapter.refused.join(', ')}. Le
          diagnostic reste possible.
        </p>
      {/if}
    </Card>

    <div class="actions">
      <Button variant="primary" size="lg" block onclick={startScan}>
        {session.scan ? 'Relancer le diagnostic' : 'Lancer le diagnostic'}
      </Button>
      {#if session.scan}
        <Button block onclick={() => go({ name: 'scan' })}>Voir le dernier résultat</Button>
      {/if}
      <Button variant="ghost" block onclick={disconnect}>Se déconnecter</Button>
    </div>
  {/if}
</div>

<style>
  .home {
    display: grid;
    gap: var(--sp-5);
  }

  .hero {
    display: grid;
    gap: var(--sp-3);
    padding-block: var(--sp-4) var(--sp-2);
  }

  .kicker {
    font-size: var(--fs-xs);
    letter-spacing: 0.1em;
    color: var(--ink-3);
    text-transform: uppercase;
  }

  h1 {
    font-size: clamp(3rem, 16vw, 5.5rem);
    line-height: 0.88;
  }

  .hl {
    background: var(--accent);
    color: var(--accent-ink);
    padding: 0 0.12em;
  }

  .lead {
    font-size: var(--fs-lg);
    color: var(--ink-2);
    max-width: 28ch;
  }

  .actions {
    display: grid;
    gap: var(--sp-4);
  }

  .demo {
    display: grid;
    gap: var(--sp-3);
  }

  .scenario {
    display: grid;
    gap: var(--sp-1);
    text-align: left;
    padding: var(--sp-3) var(--sp-4);
    min-height: var(--touch);
    background: var(--surface);
    color: var(--ink);
    border: var(--border) solid var(--line);
    border-radius: var(--radius);
    font: inherit;
    cursor: pointer;
  }

  .scenario span {
    color: var(--ink-2);
    font-size: var(--fs-sm);
  }

  .scenario:active {
    background: var(--surface-2);
  }

  .progress,
  .connected {
    display: grid;
    gap: var(--sp-4);
  }

  .note {
    color: var(--ink-3);
    font-size: var(--fs-sm);
  }

  .facts {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-1) var(--sp-4);
    margin: 0;
  }

  dt {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: uppercase;
    color: var(--ink-3);
    padding-top: 0.2em;
  }

  dd {
    margin: 0;
    color: var(--ink);
    font-weight: 600;
  }

  .volt {
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  .volt.ok {
    color: var(--ok-text);
  }
  .volt.warn {
    color: var(--sev-soon-text);
  }
  .volt.bad {
    color: var(--sev-stop-text);
  }
</style>
