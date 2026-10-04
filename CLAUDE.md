# CLAUDE.md — Diagnostic OBD Web

> Document de référence du projet. À lire en entier avant toute modification.
> En cas de conflit entre ce fichier et une demande ponctuelle, demander à l'utilisateur.
> **Suivi des tâches : [avancement.md](avancement.md).** Le lire en début de session pour savoir où on en est,
> et le mettre à jour (cases cochées, problèmes connus, décisions, compatibilité testée) à chaque tâche terminée.

---

## 1. Vision

Site web personnel de diagnostic automobile qui remplace une valise à 300 €.
On branche un dongle OBD **Bluetooth Low Energy** sous le volant, on ouvre le site
(iPhone via Bluefy, ou Chrome/Edge sur PC/Android), et on obtient :

- les **codes défaut expliqués en français** (cause, urgence, quoi vérifier) ;
- les **données en direct** (jauges, graphiques, enregistrement) ;
- la **préparation au contrôle technique** (moniteurs antipollution) ;
- l'**historique** par véhicule.

Principes :
- **C'est un site web, pas une application.** Pas d'App Store, pas de build natif.
- **Usage personnel.** Pas de comptes, pas de backend, pas de monétisation, pas d'analytics.
- **Universel.** Doit fonctionner sur le **maximum de voitures**. Le socle est l'OBD-II/EOBD
  générique ; le spécifique constructeur vient en extension, sans jamais casser le socle.
- **Pas d'IA.** Les explications viennent d'une base de codes fixe embarquée.
- **Hors ligne.** Tout marche sans réseau une fois le site chargé (PWA). Parkings souterrains inclus.
- **Lecture seule.** On diagnostique, on ne modifie pas la voiture (voir §9).

---

## 2. Analyse des outils existants

Ce que font les vrais outils, et ce qu'on en retient. Ne pas réinventer ce qui marche,
ne pas copier ce qui agace leurs utilisateurs.

| Outil | Type | Points forts à reprendre | Défauts à éviter |
|---|---|---|---|
| **Car Scanner ELM OBD2** | App ELM327, iOS/Android | Tableau de bord configurable, freeze frame, readiness, Mode 06, **profils de connexion par marque** (ABS, boîte, airbag…), PIDs personnalisés, export CSV, HUD | Résultats des profils très variables selon modèle/année ; connexions qui échouent sans explication (BLE vs classique, clones) |
| **OBD Fusion** | App ELM327, iOS/Android | Personnalisation fine du live, **4 graphes comparés**, rapports de diagnostic exportables | Diagnostics constructeur en achats séparés |
| **Torque Pro** | App ELM327, Android | Format de **PID personnalisé** simple et devenu standard de fait (`Mode+PID`, `Header`, formule `A*256+B`, min/max/unité), import CSV de PIDs communautaires, logs exportables | Interface datée, Android seulement |
| **BlueDriver** | Dongle propriétaire + app | Rapports de réparation par code/VIN, **avertit de sauvegarder le freeze frame avant d'effacer**, readiness « smog check », graphes live | Rafraîchissement lent (4–5 s/PID sur l'ancien modèle) ; matériel captif |
| **FIXD** | Dongle + app | **Langage simple, indicateur de gravité**, historique multi-véhicules, rappels d'entretien | Moteur seulement ; l'essentiel payant |
| **OBDeleven** | Dongle propriétaire, VAG | Liste des calculateurs + scan complet, fiches défaut détaillées | Codage payant ; matériel captif |
| **VCDS (Ross-Tech)** | Interface HEX + PC, VAG | Référence du **rapport d'autoscan** : par calculateur, chaque défaut avec statut binaire, priorité, fréquence, compteur d'effacement, kilométrage, freeze frame | Outil d'atelier, Windows, matériel dédié |
| **AndrOBD** | Open source (GPL), Android | Bluetooth/USB/Wi-Fi, codes, live, freeze frame, infos véhicule, graphes, HUD, export CSV, **mode démo sans adaptateur**, traduction des descriptions | Interface austère |
| **Tablettes pro** (Autel MaxiSys, Launch X431, Bosch KTS/ESI[tronic]) | Matériel d'atelier | VIN auto, scan de tous les calculateurs, **carte des calculateurs** colorée, **pré-scan / post-scan**, live jusqu'à 8 courbes fusionnables, **enregistrement + relecture**, comparaison à des **valeurs de référence**, **diagnostic guidé** pas à pas (Bosch SIS), rapport client | Remises à zéro, tests actionneurs, codage, programmation : **exclus volontairement** (§9) ; schémas et bulletins techniques propriétaires |
| **python-OBD** | Bibliothèque open source | Architecture **table de commandes + décodeurs séparés + couche protocole** | — |
| **ELM327-emulator** (Ircama) | Émulateur open source | Simulation multi-ECU par scénarios, dictionnaire requête→réponse extensible | — |

### Ce qu'on en retient (exigences)

1. **Scan complet en un bouton**, avec un résumé clair, comme FIXD/BlueDriver, et le détail par calculateur, comme VCDS.
2. **Chaque code a une gravité visible** (couleur + mot) et une explication en langage simple.
3. **Le freeze frame est sauvegardé automatiquement avant tout effacement.**
4. **Les PIDs personnalisés reprennent le modèle Torque** (header, mode+PID, formule, unité, min/max),
   pour pouvoir réutiliser le savoir communautaire.
5. **Profils constructeur sous forme de plugins** comme Car Scanner, avec un statut de support honnête
   (« testé », « expérimental », « non supporté ») plutôt qu'un échec silencieux.
6. **Mode démo** (simulateur) disponible partout, comme AndrOBD.
7. **Diagnostic de connexion explicite** : on dit pourquoi ça ne se connecte pas.
8. **Rafraîchissement live rapide** : afficher la fréquence réelle (Hz) et optimiser les requêtes (§6.4).
9. **Export d'un rapport lisible** à montrer à un garagiste (HTML imprimable / texte copiable).
10. **Valeurs de référence** : plages normales des PIDs, valeurs hors plage mises en évidence, analyses passives
    (richesse, lambda, thermostat, ratés) présentées comme des indices, jamais des certitudes.
11. **Diagnostic guidé** : depuis un code, procédure « quoi regarder, valeur attendue, conclusion » reliée au live ;
    recherche par symptôme quand il n'y a pas de code.
12. **Avant / après réparation** : comparer un scan « avant » et un scan « après ».
13. **Enregistrement déclenché + relecture** : capture automatique sur seuil ou apparition d'un code, relecture au curseur.
14. **Test batterie / charge** via la tension mesurée par le dongle (repos, démarrage, moteur tournant).
15. **Carte des calculateurs** (topologie) avec état de chacun : OK, défaut, muet, non supporté.

---

## 3. Compatibilité

### 3.1 Véhicules
| Zone | Obligation OBD |
|---|---|
| Europe essence | 2001+ (EOBD) |
| Europe diesel | 2004+ |
| USA | 1996+ |

Protocoles (détection auto `ATSP0`, avec repli manuel dans les réglages) :
ISO 15765-4 CAN (11/29 bits, 250/500 kbps), ISO 14230-4 KWP2000 (init 5 bauds et rapide),
ISO 9141-2, SAE J1850 PWM/VPW.

### 3.2 Navigateurs (Web Bluetooth requis)
| Plateforme | Navigateur | Statut |
|---|---|---|
| iPhone / iPad | **Bluefy** (ou WebBLE) | ✅ cible principale de l'utilisateur |
| iPhone / iPad | Safari, Chrome, Edge, autres | ❌ tous sur WebKit, sans Web Bluetooth |
| Android | Chrome, Edge | ✅ |
| Windows / macOS / Linux | Chrome, Edge | ✅ |
| Partout | Firefox | ❌ |

- Si `navigator.bluetooth` est absent : écran d'aide clair. Sur iOS : « Ouvre ce site dans l'app Bluefy »
  avec la marche à suivre. Le **mode démo reste accessible** même sans Bluetooth.
- Bluefy peut être moins stable : reconnexion robuste obligatoire (§6.1).
- HTTPS obligatoire (Web Bluetooth ne fonctionne pas en HTTP, sauf `localhost` en dev).

### 3.3 Dongles
- **Cible : ELM327 et compatibles en BLE.** Recommandés : **OBDLink CX** (fiable, bon support des protocoles),
  **Vgate iCar Pro BLE 4.0** (économique).
- Les ELM327 Bluetooth classique (SPP) ne marchent pas en Web Bluetooth. Repli **PC uniquement** via
  Web Serial (dongle appairé dans l'OS → port COM) : transport secondaire, phase 5.
- **UUID GATT connus** (tous déclarés dans `optionalServices` ; liste centralisée dans `transport/ble-profiles.ts`) :
  | Service | Notify | Write | Exemples |
  |---|---|---|---|
  | `FFF0` | `FFF1` | `FFF2` | OBDLink CX, nombreux clones |
  | `FFE0` | `FFE1` | `FFE1` | Puces type HM-10 |
  | `18F0` | `2AF0` | `2AF1` | Vgate |
  | Nordic UART `6E400001-…` | `6E400003-…` | `6E400002-…` | Divers |
  Après connexion : parcourir les services et prendre le premier profil qui correspond. Si aucun ne
  correspond, journaliser les services/caractéristiques trouvés (pour pouvoir ajouter le profil).
- **Clones ELM327 souvent bugués** (surtout les « v2.1 ») : ne jamais supposer qu'une commande AT est
  supportée, tolérer `?`, échos parasites, espaces, minuscules, lignes vides.

---

## 4. Stack

- **Vite + TypeScript (strict) + Svelte**
- **PWA** (vite-plugin-pwa) : installable, hors ligne, mise à jour signalée à l'utilisateur
- **IndexedDB** via `idb` : véhicules, sessions, codes, enregistrements
- Graphiques live : bibliothèque légère orientée temps réel (ex. uPlot) ; jauges en SVG maison
- **Vitest** pour les tests unitaires ; Playwright plus tard pour l'UI avec le simulateur
- Hébergement statique HTTPS : GitHub Pages / Netlify / Cloudflare Pages. **Aucun serveur.**
- Polices embarquées (@fontsource, sous-ensemble latin) pour le hors ligne : Barlow Condensed (titres),
  Barlow (texte), JetBrains Mono (codes, valeurs). Navigation par hash (`#/ecran`), `base: './'`.

### Commandes
| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev (http://localhost:5173, Web Bluetooth OK sur PC) |
| `npm run dev:https` | Dev en HTTPS sur le réseau local (certificat auto-signé) pour tester depuis un téléphone |
| `npm run check` | Vérification des types (svelte-check + tsc) |
| `npm run lint` | ESLint |
| `npm test` / `npm run test:watch` / `npm run coverage` | Vitest |
| `npm run build` / `npm run preview` | Build de production / aperçu |

Avant chaque commit : `npm run check && npm run lint && npm test`.

---

## 5. Architecture

Couches strictement séparées : une couche ne connaît que celle du dessous. L'UI ne parle jamais
directement au dongle.

```
src/
  transport/        # Octets bruts : BleTransport, SerialTransport, MockTransport, ble-profiles.ts
  elm327/           # File de commandes AT/OBD, parsing des réponses ELM, détection protocole
  isotp/            # Réassemblage multi-trames (ISO 15765-2) quand les en-têtes sont activés
  obd/              # Services génériques 01/02/03/04/06/07/09/0A, table des PIDs, décodage DTC
  uds/              # Services UDS en lecture (0x19, 0x22, 0x14) — utilisés par les plugins
  manufacturers/    # Plugins constructeur (lecture seule) + registre + détection par VIN
  vin/              # Décodage VIN (WMI → marque/pays, année modèle)
  dtc-db/           # Base de codes (JSON) + recherche (constructeur d'abord, générique ensuite)
  storage/          # IndexedDB : véhicules, scans, historique, enregistrements, export/import
  report/           # Génération du rapport garagiste (HTML imprimable, texte)
  simulator/        # Scénarios de voitures simulées pour MockTransport
  platform/         # Détection des capacités du navigateur (Web Bluetooth, Web Serial, iOS/Bluefy)
  ui/               # Composants Svelte, écrans (§8). Aucune logique protocole ici.
    components/     # Composants de base (Button, Card, Alert, SeverityBadge, ConfirmDialog, Spinner)
    screens/        # Un fichier par écran ; « Composants » = guide visuel de tous les états
data/
  dtc/              # Sources de la base de codes (voir §7)
  pids/             # Définitions de PIDs génériques et personnalisés
scripts/            # Génération/validation de la base de codes, import de données ouvertes
```

---

## 6. Communication avec la voiture

### 6.1 Transport
Interface commune : `connect()`, `write(text)`, `onData(cb)`, `onDisconnect(cb)`, `disconnect()`.
- La connexion part **toujours** d'un geste utilisateur (clic « Connecter »).
- BLE : découper les écritures en paquets ≤ 20 octets ; réassembler les notifications ; terminer
  chaque commande par `\r`.
- Déconnexion inattendue (`gattserverdisconnected`) : état visible, reconnexion proposée
  (et tentée automatiquement une fois via `device.gatt.connect()` si l'appareil est encore connu).
- **Journal brut** (trames envoyées/reçues, horodatées) toujours actif en mémoire, exportable depuis
  les réglages : c'est l'outil n°1 pour ajouter le support d'une voiture ou d'un dongle.

### 6.2 ELM327
- **Une seule commande en vol à la fois** : file d'attente ; une réponse se termine par le prompt `>`.
- Timeouts par commande ; plus long pour la toute première requête OBD (`SEARCHING...`).
- Init : `ATZ` → `ATE0` → `ATL0` → `ATS0` → `ATH1` → `ATAT1` → `ATSP0` → `0100`,
  puis `ATDPN` (protocole retenu), `ATRV` (tension batterie), `ATI`/`STI` (identité du dongle).
- Réponses à gérer explicitement : `NO DATA`, `SEARCHING...`, `UNABLE TO CONNECT`,
  `BUS INIT: ...ERROR`, `CAN ERROR`, `STOPPED`, `?`, `BUFFER FULL`, `ERR94`, `LV RESET`.
  Chacune a un message utilisateur en français et une piste de résolution.
- Plusieurs calculateurs peuvent répondre à une même requête : grouper les réponses **par ECU**
  (en-tête), afficher chaque ECU séparément.

### 6.3 OBD-II générique (socle, toute voiture compatible)
| Service | Usage |
|---|---|
| 01 | Données en direct ; PIDs supportés via `0100`, `0120`, `0140`, … (bitmaps) |
| 01 PID 01 | Voyant moteur (MIL), nombre de codes, **état des moniteurs** (readiness) |
| 02 | Freeze frame |
| 03 | Codes confirmés |
| 07 | Codes en attente |
| 0A | Codes permanents |
| 04 | Effacement (voir §9) |
| 06 | Résultats des tests embarqués (MID/TID, valeur, min, max, OK/échec) — écran « avancé » |
| 09 | VIN, CALID, CVN, nom de l'ECU |

- Décodage DTC : 2 octets → lettre P/C/B/U (2 bits de poids fort) + 4 caractères hexadécimaux.
- **N'afficher que les PIDs annoncés comme supportés.**
- Mode 06 : appliquer les tables unité/échelle de SAE J1979 ; les MID/TID non standard sont affichés
  bruts avec la mention « spécifique constructeur ».

### 6.4 Performance du live
- Sur CAN, demander **plusieurs PIDs dans une seule requête** service 01 (jusqu'à 6).
- Ajouter le nombre de réponses attendu en fin de commande quand c'est possible (ex. `010C1`) pour éviter
  d'attendre le timeout.
- Timing adaptatif ELM (`ATAT1/2`) ; ne jamais interroger plus de PIDs que ceux affichés.
- Afficher la fréquence réelle de rafraîchissement (Hz) sur l'écran live.

### 6.5 Extensions constructeur (plugins)
Interface :
```ts
interface ManufacturerPlugin {
  id: string;                         // "vag", "renault", "psa", …
  name: string;
  matches(vin: VinInfo): boolean;     // détection auto via le WMI du VIN
  support: "tested" | "experimental";
  listModules(ctx): Promise<Module[]>;           // calculateurs connus/présents
  readDtcs(ctx, m: Module): Promise<Dtc[]>;      // avec statut UDS et données d'environnement si dispo
  clearDtcs?(ctx, m: Module): Promise<void>;     // confirmation obligatoire (§9)
  readLiveData?(ctx, m: Module): Promise<LiveValue[]>;
  customPids?: PidDefinition[];                  // format §6.6
}
```
- Accès aux autres calculateurs via les en-têtes CAN (`ATSH`, `ATCRA`, `ATFCSH`…) puis UDS
  (0x19 lecture DTC, 0x22 lecture de données, 0x14 effacement) ou KWP2000 selon la marque.
- **Ordre de priorité** : groupes les plus courants en France et les mieux documentés —
  VAG (VW/Audi/Seat/Skoda), Renault/Dacia, Stellantis (Peugeot/Citroën/DS/Opel), puis Toyota, Ford, BMW…
- Limite connue : les VAG anciens (plateformes PQ, ~2009–2014) utilisent souvent **VW TP2.0**, que l'ELM327
  gère mal. À traiter en « expérimental » ou « non supporté », jamais en faisant semblant.
- **Chaque adresse, identifiant ou formule constructeur cite sa source** en commentaire ou dans le JSON.
  Pas de valeur devinée. Idéalement validée sur un journal brut réel.
- Le statut UDS d'un DTC (octet de statut) est décodé et affiché lisiblement :
  bit 0 échec en cours · bit 2 en attente · bit 3 confirmé · bit 7 demande d'allumer le voyant, etc.
  Quand le calculateur les fournit : kilométrage, compteur d'occurrences, données d'environnement
  (même esprit que les rapports VCDS).
- Une voiture sans plugin garde 100 % des fonctions génériques.

### 6.6 Format des PIDs (inspiré de Torque, pour réutiliser les listes communautaires)
```json
{
  "id": "vag.oil_temp",
  "name": "Température d'huile",
  "short": "Huile",
  "header": "7E0",
  "request": "22F40C",
  "formula": "A-40",
  "unit": "°C",
  "min": -40,
  "max": 160,
  "source": "URL ou référence"
}
```
- Variables `A`, `B`, `C`, `D`… = octets de données après l'écho de la requête ; fonctions `signed()`, bits.
- La formule est **évaluée par un mini-parseur sûr** (pas d'`eval`, pas de `Function`).
- Import d'un CSV au format Torque (Name, ShortName, ModeAndPID, Equation, Min, Max, Units, Header)
  dans les réglages.

### 6.7 VIN
- Décodage local : WMI (3 premiers caractères) → constructeur/pays ; 10ᵉ caractère → année modèle.
- Le VIN identifie le véhicule dans l'historique et sélectionne le plugin constructeur.
- VIN illisible (véhicules anciens) : saisie manuelle ou nom libre.

---

## 7. Base de codes défaut (`dtc-db/`)

### 7.1 Sources
- **Socle générique : [OBDex](https://github.com/foerbsnavi/OBDex)** — données **CC0** (domaine public),
  9 533 codes SAE J2012 (P0, P2, P3, U0, U3, B0, C0), en anglais/allemand, avec causes, symptômes,
  difficulté, coût estimé, indicateurs voyant/antipollution/mode dégradé. **À traduire en français**
  via un script (`scripts/`) + relecture ; la traduction vit dans notre dépôt.
- **Codes constructeur** : OBDex les exclut volontairement. Sources possibles à vérifier une par une
  (licence et provenance) ; par exemple `Wal33D/dtc-database` (MIT, ~18 800 codes constructeur, mais
  provenance des données non documentée → à utiliser avec prudence, jamais copier en bloc sans vérification).
- **Interdit** : copier une base sous licence propriétaire ou du contenu d'outil commercial.

### 7.2 Format (un fichier par famille : `generic.json`, `vag.json`, `renault.json`…)
```json
{
  "code": "P0301",
  "scope": "generic",
  "title": "Raté d'allumage détecté — cylindre 1",
  "description": "Le calculateur a détecté des combustions incomplètes sur le cylindre 1.",
  "symptoms": ["À-coups", "Ralenti instable", "Voyant moteur clignotant"],
  "causes": [
    { "text": "Bougie usée ou encrassée", "likelihood": "high" },
    { "text": "Bobine d'allumage défaillante", "likelihood": "high" },
    { "text": "Injecteur encrassé", "likelihood": "medium" }
  ],
  "urgency": "stop",
  "checks": ["Inverser la bobine avec celle d'un autre cylindre et voir si le défaut suit"],
  "flags": { "mil": true, "emissions": true, "limpMode": false },
  "related": ["P0300", "P0302"],
  "sources": ["OBDex"]
}
```

### 7.3 Gravité (affichée partout par une couleur ET un mot, jamais la couleur seule)
| `urgency` | Libellé | Sens |
|---|---|---|
| `stop` | 🔴 Arrêt conseillé | Risque de casse ou de sécurité (raté qui clignote, pression d'huile, freinage, airbag…) |
| `soon` | 🟠 À faire vite | Rouler possible, réparer rapidement |
| `monitor` | 🟡 À surveiller | Pas d'urgence, peut s'aggraver |
| `info` | ⚪ Information | Code informatif ou historique |

### 7.4 Recherche
**Plugin constructeur d'abord, générique ensuite.** Un code inconnu s'affiche quand même :
« Code spécifique constructeur, non documenté », avec le code brut, l'ECU et le statut.

---

## 8. Écrans et expérience

**Mobile d'abord** (iPhone dans Bluefy), utilisable avec une main, gros boutons, contraste fort
(plein soleil), thème clair/sombre, unités métriques par défaut (réglables).

1. **Accueil / Connexion**
   - Bouton « Connecter le dongle », bouton « Mode démo ».
   - Une fois connecté : nom du dongle, protocole détecté, **tension batterie** (`ATRV`), VIN/véhicule reconnu.
   - En cas d'échec : diagnostic guidé (contact mis ? dongle BLE ? bon navigateur ? autre appareil
     déjà connecté au dongle ?).
2. **Scan complet** (action principale)
   - Un bouton → VIN, voyant moteur, codes 03/07/0A de tous les ECU génériques, readiness,
     puis les calculateurs du plugin constructeur s'il existe.
   - **Résumé** : « 2 défauts dont 1 urgent · Voyant moteur allumé · CT : 1 moniteur non prêt ».
   - Puis la liste **groupée par calculateur** (Moteur, Boîte, ABS, Airbag…), en indiquant les
     calculateurs sans défaut et ceux qui n'ont pas répondu.
3. **Fiche d'un code**
   - Code, titre, badge de gravité, statut (confirmé / en attente / permanent / intermittent),
     calculateur d'origine.
   - Description simple, symptômes, **causes classées par probabilité**, vérifications à faire.
   - Freeze frame / données d'environnement si disponibles.
   - Historique de ce code sur ce véhicule (première apparition, récurrences).
4. **Effacer les codes** — parcours dédié (§9.2).
5. **Données en direct**
   - Liste des PIDs supportés, recherche, favoris ; sélection limitée pour garder un bon rafraîchissement.
   - Vues : liste de valeurs, jauges, graphiques (jusqu'à 8 courbes, séparées ou fusionnées).
   - Plages normales et valeurs hors plage mises en évidence ; min / max / moyenne de la session.
   - Préréglages par situation (ralenti, richesse, température, turbo).
   - Enregistrement manuel ou déclenché (seuil, apparition d'un code), relecture au curseur, export CSV.
   - Affichage de la fréquence (Hz).
   - Bandeau « Ne pas manipuler en conduisant ».
6. **Contrôle technique** : moniteurs antipollution (prêt / non prêt / non supporté) + verdict simple
   + explication (« roule 20 min mixte ville/route puis rescanne »).
7. **Tests embarqués (Mode 06)** : écran « avancé », valeur vs limites, OK/échec.
8. **Infos véhicule** : VIN décodé, calculateurs détectés (nom, CALID, CVN), protocole.
9. **Mes véhicules / Historique** : liste des véhicules, scans horodatés, évolution des codes.
10. **Rapport** : rapport lisible (véhicule, date, kilométrage saisi, codes + explications, readiness,
    freeze frames) en HTML imprimable et texte copiable, pour le garagiste.
11. **Test batterie** : parcours guidé en 3 mesures (repos, démarrage, moteur tournant) + verdict.
12. **Recherche par symptôme** : symptôme → codes possibles + PIDs à surveiller avec valeurs attendues.
13. **Carte des calculateurs** (phase 4) : vue d'ensemble colorée + texte, toucher un calculateur → ses défauts.
14. **Réglages** : unités, thème, profil BLE forcé, protocole forcé, import de PIDs (CSV Torque),
    export/import des données (JSON), **journal brut exportable**, mode développeur.

---

## 9. Règles de sécurité (non négociables)

### 9.1 Lecture seule
- Aucun codage, adaptation, réglage de base, programmation, test actionneur ni écriture mémoire.
- Services **autorisés** : OBD 01/02/03/06/07/09/0A ; UDS 0x10 (session par défaut / étendue uniquement),
  0x19, 0x22, 0x3E ; équivalents KWP en lecture ; et l'effacement des défauts (OBD 04 / UDS 0x14).
- Services **interdits**, bloqués dans la couche protocole elle-même (pas seulement dans l'UI) :
  UDS 0x10 session de programmation, 0x11, 0x23, 0x27, 0x28, 0x2E, 0x2F, 0x31, 0x34–0x37, 0x3D, 0x85,
  et leurs équivalents KWP.
- La console brute du mode développeur passe par le même filtre.

### 9.2 Effacement des codes
Confirmation explicite, avec :
- prérequis : **moteur coupé, contact mis** ;
- **sauvegarde automatique** des codes et freeze frames dans l'historique avant d'effacer ;
- avertissements : le freeze frame est perdu côté voiture ; les **moniteurs antipollution repassent
  « non prêts »** (le CT peut échouer juste après) ; un défaut effacé sans réparation reviendra ;
  certains codes (permanents, airbag…) ne s'effacent pas tant que le problème est présent ;
- rescanne automatique après effacement pour montrer le résultat.

### 9.3 Conduite
- Aucune interaction requise en roulant. Rappel visible sur l'écran live.

### 9.4 Données
- Aucune donnée ne quitte le navigateur : pas d'analytics, pas d'appel réseau hors chargement du site.
- Pas de mise de données personnelles (VIN…) dans des URL.

### 9.5 Honnêteté
- Ne jamais afficher une valeur, un statut ou une explication inventés. Inconnu = affiché comme inconnu.
- Un calculateur qui ne répond pas ≠ un calculateur sans défaut : l'UI fait la différence.

---

## 10. Stockage

- Véhicules identifiés par VIN (ou nom libre).
- Chaque scan est horodaté et conservé : codes par ECU, statuts, freeze frames, readiness, tension batterie.
- Historique d'un code : première apparition, dernière apparition, disparition, récurrences.
- Enregistrements live : séries temporelles, exportables en CSV.
- Export / import JSON complet (passer du téléphone au PC, sauvegarde). Format versionné, avec migrations.

---

## 11. Simulateur et tests

- `MockTransport` + scénarios dans `simulator/`, inspirés d'ELM327-emulator (dictionnaire requête → réponse,
  multi-ECU, tâches pour les échanges à état). Scénarios minimum :
  voiture CAN saine · voiture avec codes confirmés/en attente/permanents + freeze frame ·
  vieille voiture KWP/ISO 9141 · plusieurs ECU qui répondent · réponse multi-trames (VIN) ·
  clone ELM327 qui répond mal · déconnexion en plein scan · voiture qui ne répond pas.
- **Tout le développement doit pouvoir se faire sans voiture.** Le mode démo de l'UI utilise le simulateur.
- Tests unitaires pour chaque parseur (réponses ELM, ISO-TP, PIDs, DTC, statut UDS, Mode 06, VIN, formules),
  avec des trames réelles ou réalistes. Les journaux bruts réels anonymisés deviennent des fixtures.
- Tests de non-régression du filtre de sécurité (§9.1) : chaque service interdit doit être refusé.

---

## 12. Phases

1. **MVP générique** : connexion BLE (multi-profils), init ELM, scan (03/07/0A + MIL), VIN, effacement
   sécurisé, base de codes génériques en français (OBDex traduit), simulateur + mode démo, journal brut.
2. **Live & CT** : données en direct (liste, jauges, graphes, Hz), freeze frame, readiness, Mode 06, PWA hors ligne.
3. **Historique & rapport** : véhicules, historique des codes, enregistrements CSV, rapport garagiste,
   export/import.
4. **Constructeurs** : système de plugins, UDS en lecture, premier plugin (VAG), puis Renault/Dacia, Stellantis…
   Import de PIDs personnalisés (CSV Torque).
5. **Repli Web Serial** sur PC pour les dongles Bluetooth classique / USB.

Une phase n'est terminée que si elle fonctionne dans le simulateur **et** a été essayée sur une vraie voiture
(ou est explicitement marquée « non testée sur véhicule »).

---

## 13. Conventions

- Interface et documentation en **français** ; code, identifiants et messages de commit en **anglais**.
- TypeScript strict ; pas de `any` dans `transport/`, `elm327/`, `isotp/`, `obd/`, `uds/`, `manufacturers/`.
- Les PIDs, formules et tables (Mode 06, WMI, statuts) sont des **données déclaratives**, pas du code
  éparpillé dans l'UI.
- Pas d'`eval` / `new Function` (formules évaluées par parseur maison).
- Accessibilité : la gravité n'est jamais portée par la couleur seule ; tailles de police lisibles.
- Petites dépendances, bundle léger (chargement rapide en 4G dans un parking).

---

## 14. Références

- ELM327 datasheet (Elm Electronics) — commandes AT et format des réponses
- SAE J1979 / ISO 15031-5 (services OBD), SAE J2012 / ISO 15031-6 (codes), ISO 15765 (CAN/ISO-TP), ISO 14229 (UDS)
- OBDex — base de codes CC0 : https://github.com/foerbsnavi/OBDex
- python-OBD — architecture commandes/décodeurs : https://python-obd.readthedocs.io/
- AndrOBD — appli open source de référence : https://github.com/fr3ts0n/AndrOBD
- ELM327-emulator — simulation multi-ECU : https://github.com/Ircama/ELM327-emulator
- Web Bluetooth (MDN / Chrome samples), Bluefy (App Store)
