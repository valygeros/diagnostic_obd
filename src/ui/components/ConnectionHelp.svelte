<script lang="ts">
  // Guided checklist when the connection fails (CLAUDE.md §8.1, avancement 1.10).
  import type { SessionError } from '../session.svelte'

  interface Props {
    kind: SessionError['kind']
  }
  let { kind }: Props = $props()

  const CHECKS: Record<SessionError['kind'], string[]> = {
    cancelled: [
      'Dans la liste, choisis le dongle (souvent « OBDII », « OBDLink », « Vgate » ou « IOS-Vlink »).',
      'Si la liste est vide : vérifie que le Bluetooth du téléphone est activé et que le dongle est branché (voyant allumé).',
    ],
    bluetooth: [
      'Le dongle doit être en Bluetooth Low Energy (BLE). Les modèles Bluetooth « classique » ne marchent pas sur iPhone.',
      "Le dongle n'est connecté qu'à un appareil à la fois : ferme les autres applis OBD et désactive le Bluetooth des autres téléphones à proximité.",
      "Ne l'appaire pas dans les réglages Bluetooth du téléphone : la connexion se fait uniquement depuis le site.",
      'Débranche le dongle 10 secondes puis rebranche-le.',
    ],
    adapter: [
      'Débranche le dongle 10 secondes puis rebranche-le.',
      'Les clones ELM327 très bon marché répondent parfois mal : exporte le journal (Réglages) pour diagnostiquer.',
    ],
    vehicle: [
      'Mets le contact (position « marche », voyants du tableau de bord allumés) ou démarre le moteur.',
      'Vérifie que le dongle est bien enfoncé dans la prise OBD (sous le volant, souvent derrière un cache).',
      'Les voitures essence avant 2001 et diesel avant 2004 (Europe) ne sont pas toujours compatibles OBD.',
      'Si ça ne passe toujours pas, essaie de forcer un protocole dans les réglages (à venir).',
    ],
    link: [
      "Garde le téléphone près de la voiture et l'écran allumé.",
      'Le démarrage du moteur peut faire chuter la tension et redémarrer le dongle : reconnecte-toi une fois le moteur lancé.',
    ],
    other: ['Réessaie. Si le problème revient, exporte le journal depuis les réglages.'],
  }
</script>

<div class="help">
  <p class="title">À vérifier</p>
  <ol>
    {#each CHECKS[kind] as check, i (i)}
      <li>{check}</li>
    {/each}
  </ol>
</div>

<style>
  .help {
    border: var(--border) dashed var(--line-soft);
    border-radius: var(--radius);
    padding: var(--sp-4);
    background: var(--surface);
  }

  .title {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--fs-lg);
    text-transform: uppercase;
    margin-bottom: var(--sp-2);
  }

  ol {
    margin: 0;
    padding-left: 1.3em;
    display: grid;
    gap: var(--sp-2);
    color: var(--ink-2);
  }
</style>
