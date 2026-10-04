<script lang="ts">
  // Living style guide: every base component in every state, to check contrast in sunlight.
  import { URGENCY_HINT, type Urgency } from '../severity'
  import Alert from '../components/Alert.svelte'
  import Button from '../components/Button.svelte'
  import Card from '../components/Card.svelte'
  import ConfirmDialog from '../components/ConfirmDialog.svelte'
  import SeverityBadge from '../components/SeverityBadge.svelte'
  import Spinner from '../components/Spinner.svelte'

  const levels: Urgency[] = ['stop', 'soon', 'monitor', 'info']
  let dialogOpen = $state(false)
  let lastAction = $state('')
</script>

<div class="guide">
  <h1>Composants</h1>

  <section>
    <h2>Gravité</h2>
    <div class="row">
      {#each levels as u (u)}<SeverityBadge urgency={u} />{/each}
    </div>
    <div class="row">
      {#each levels as u (u)}<SeverityBadge urgency={u} size="sm" />{/each}
    </div>
  </section>

  <section>
    <h2>Boutons</h2>
    <div class="row">
      <Button variant="primary">Principal</Button>
      <Button>Secondaire</Button>
      <Button variant="danger">Effacer</Button>
      <Button variant="ghost">Lien</Button>
    </div>
    <div class="row">
      <Button variant="primary" busy>Connexion</Button>
      <Button disabled>Désactivé</Button>
    </div>
    <Button variant="primary" size="lg" block>Grand bouton</Button>
  </section>

  <section>
    <h2>Cartes</h2>
    <Card kicker="P0301 · Moteur" title="Raté d'allumage — cylindre 1" tone="stop">
      <SeverityBadge urgency="stop" size="sm" />
      <p>{URGENCY_HINT.stop}</p>
    </Card>
    <Card kicker="P0171 · Moteur" title="Mélange trop pauvre — banc 1" tone="soon">
      <p>{URGENCY_HINT.soon}</p>
    </Card>
    <Card kicker="ABS" title="Aucun défaut" tone="ok">
      <p>Calculateur interrogé, rien à signaler.</p>
    </Card>
  </section>

  <section>
    <h2>Alertes</h2>
    <Alert tone="info" title="Information">Message neutre.</Alert>
    <Alert tone="success" title="Connecté">OBDLink CX · ISO 15765-4 CAN · 12,6 V</Alert>
    <Alert tone="warning" title="Tension basse">La batterie est à 11,8 V.</Alert>
    <Alert tone="danger" title="Pas de réponse">UNABLE TO CONNECT : mets le contact.</Alert>
  </section>

  <section>
    <h2>Chargement</h2>
    <Spinner label="Recherche du protocole…" />
  </section>

  <section>
    <h2>Confirmation</h2>
    <Button variant="danger" onclick={() => (dialogOpen = true)}>Effacer les codes</Button>
    {#if lastAction}<p class="mono">→ {lastAction}</p>{/if}
    <ConfirmDialog
      open={dialogOpen}
      title="Effacer les codes ?"
      confirmLabel="Effacer"
      danger
      acknowledge="Le moteur est coupé et le contact est mis."
      onconfirm={() => {
        dialogOpen = false
        lastAction = 'confirmé'
      }}
      oncancel={() => {
        dialogOpen = false
        lastAction = 'annulé'
      }}
    >
      <p>Les moniteurs antipollution repasseront « non prêts ».</p>
      <p>Un défaut effacé sans réparation reviendra.</p>
    </ConfirmDialog>
  </section>
</div>

<style>
  .guide {
    display: grid;
    gap: var(--sp-6);
  }

  section {
    display: grid;
    gap: var(--sp-4);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-3);
    align-items: center;
  }
</style>
