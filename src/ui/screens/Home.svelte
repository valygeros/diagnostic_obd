<script lang="ts">
  import { currentEnv, detectSupport } from '../../platform/support'
  import Alert from '../components/Alert.svelte'
  import Button from '../components/Button.svelte'
  import Card from '../components/Card.svelte'

  const support = detectSupport(currentEnv())
</script>

<div class="home">
  <section class="hero">
    <p class="kicker mono">OBD-II · EOBD · ELM327 BLE</p>
    <h1>Diagnostic<br /><span class="hl">auto</span></h1>
    <p class="lead">Branche le dongle sous le volant, mets le contact, puis connecte-toi.</p>
  </section>

  {#if support.bluetooth === 'ok'}
    <Alert tone="success" title="Bluetooth disponible">
      Ce navigateur peut se connecter au dongle OBD.
    </Alert>
  {:else if support.bluetooth === 'ios-needs-bluefy'}
    <Alert tone="warning" title="Ouvre ce site dans l'app Bluefy">
      <p>
        Sur iPhone, Safari et Chrome ne savent pas parler en Bluetooth à un site web. Installe
        <strong>Bluefy</strong> (gratuit, App Store), puis ouvre cette adresse dedans.
      </p>
    </Alert>
  {:else if support.bluetooth === 'insecure-context'}
    <Alert tone="danger" title="Connexion non sécurisée">
      Le Bluetooth web ne marche qu'en HTTPS. Ouvre la version <code>https://</code> du site.
    </Alert>
  {:else}
    <Alert tone="warning" title="Navigateur non compatible">
      Utilise <strong>Chrome</strong> ou <strong>Edge</strong> (PC, Mac, Android) ou
      <strong>Bluefy</strong> sur iPhone.
    </Alert>
  {/if}

  <div class="actions">
    <Button variant="primary" size="lg" block disabled>Connecter le dongle</Button>
    <Button size="lg" block disabled>Mode démo</Button>
  </div>

  <Card kicker="Phase 0" title="Le site est en place">
    <p>
      La connexion au dongle et le mode démo arrivent en phase 1. Cette page sert à vérifier que le
      site s'ouvre bien sur ton appareil.
    </p>
  </Card>
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
  }

  h1 {
    font-size: clamp(3rem, 16vw, 5.5rem);
    line-height: 0.88;
  }

  .hl {
    background: var(--accent);
    color: var(--accent-ink);
    padding: 0 0.12em;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
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
</style>
