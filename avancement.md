# Avancement — Diagnostic OBD Web

> Suivi complet du projet. Référence technique : [CLAUDE.md](CLAUDE.md).
> **À mettre à jour à chaque tâche terminée** (cocher, dater si utile, noter les écarts).

**Légende** : `[ ]` à faire · `[~]` en cours · `[x]` terminé · `[-]` abandonné / reporté (avec raison)
**Règle de fin de phase** (CLAUDE.md §12) : fonctionne dans le simulateur **et** essayé sur une vraie voiture,
ou marqué explicitement « non testé sur véhicule ».

---

## Vue d'ensemble

| Phase | Objectif | Statut |
|---|---|---|
| 0 | Préparation (projet, outils, matériel, déploiement) | 🟡 En cours — reste : matériel, hébergement |
| 1 | MVP générique : connexion, scan, codes en français, effacement, mode démo | ⬜ À faire |
| 2 | Données en direct, freeze frame, contrôle technique, Mode 06, PWA hors ligne | ⬜ À faire |
| 3 | Véhicules, historique, enregistrements, rapport garagiste, export/import | ⬜ À faire |
| 4 | Plugins constructeur (VAG, Renault/Dacia, Stellantis…), PIDs personnalisés | ⬜ À faire |
| 5 | Repli Web Serial (PC, dongles Bluetooth classique / USB) | ⬜ À faire |
| 6 | Finitions, robustesse, accessibilité, documentation | ⬜ À faire |

Ordre conseillé : 0 → 1 → 2 → 3 → 4 → 6 → 5. Les phases 4 et 5 peuvent être réordonnées.

---

## Phase 0 — Préparation

### 0.1 Matériel
- [ ] Choisir et commander le dongle BLE (OBDLink CX recommandé, ou Vgate iCar Pro BLE 4.0)
- [ ] Installer **Bluefy** sur l'iPhone
- [ ] Vérifier que la voiture de test a une prise OBD accessible (sous le volant) et noter : marque, modèle, année, carburant

### 0.2 Initialisation du projet
- [x] `git init`, `.gitignore` (node_modules, dist, coverage, journaux bruts non anonymisés)
- [x] Projet Vite + Svelte + TypeScript
- [x] `tsconfig` en mode strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- [x] ESLint + Prettier (règles `no-eval`, `no-new-func` ; `no-explicit-any` en erreur dans les couches protocole)
- [x] Vitest configuré (+ couverture)
- [x] Arborescence `src/` conforme à CLAUDE.md §5 (+ `src/platform/` pour la détection du navigateur)
- [x] Dossiers `data/dtc/`, `data/pids/`, `scripts/`
- [x] Scripts npm : `dev`, `dev:https`, `build`, `preview`, `test`, `test:watch`, `coverage`, `lint`, `format`, `check` (`db:build` sera ajouté en 1.8)

### 0.3 Développement local en HTTPS
- [x] Vérifier que `localhost` suffit pour Web Bluetooth sur PC (Chrome/Edge) — oui, contexte sécurisé, API détectée
- [~] Tester sur l'iPhone en dev : `npm run dev:https` prêt (certificat auto-signé, accessible sur le réseau local) ;
      reste à vérifier que Bluefy accepte le certificat. Sinon : tester via les préversions déployées (0.4)

### 0.4 Hébergement et déploiement
- [ ] Choisir l'hébergeur statique (GitHub Pages / Netlify / Cloudflare Pages)
- [ ] Dépôt distant (privé si souhaité)
- [ ] Déploiement automatique sur push (`main` → production)
- [ ] Site accessible en HTTPS, page « Hello » ouverte avec succès dans Bluefy

### 0.5 Bases de l'interface
- [x] Design tokens : couleurs (clair/sombre), couleurs de gravité (§7.3), typographie, espacements (`src/app.css`)
- [x] Mise en page mobile d'abord, gros boutons, contraste fort
- [x] Navigation entre écrans (routeur par hash, `src/ui/router.svelte.ts`) + choix du thème Auto/Clair/Sombre
- [x] Composants de base : bouton, carte, badge de gravité (couleur + forme + mot), bandeau d'alerte, boîte de confirmation (avec case « j'ai compris » obligatoire), indicateur de chargement
- [x] Écran « Composants » (`#/components`) : guide visuel de tous les composants et états
- [x] Accueil : détection du navigateur avec message adapté (Bluetooth OK / iPhone → Bluefy / HTTP / navigateur non compatible)

**Critère de fin** : le site vide est en ligne en HTTPS, s'ouvre dans Bluefy et Chrome PC, les tests tournent.

---

## Phase 1 — MVP générique

### 1.1 Transport — interface et simulateur de base
- [ ] Type `Transport` : `connect`, `write`, `onData`, `onDisconnect`, `disconnect`, état de connexion
- [ ] `MockTransport` : relie l'ELM simulé au reste de l'application, latence réglable
- [ ] **Journal brut** : enregistrement en mémoire de chaque trame envoyée/reçue (horodatage, sens, texte)
- [ ] Taille maximale du journal (tampon circulaire) pour ne pas saturer la mémoire
- [ ] Tests unitaires du journal

### 1.2 Transport — Bluetooth Low Energy
- [ ] `ble-profiles.ts` : profils `FFF0`, `FFE0`, `18F0`, Nordic UART (service, notify, write)
- [ ] `requestDevice` avec `acceptAllDevices` + tous les `optionalServices` (ou filtres par nom si plus fiable)
- [ ] Découverte des services → sélection du premier profil qui correspond
- [ ] Aucun profil trouvé → journaliser services et caractéristiques + message clair
- [ ] Écriture découpée en paquets ≤ 20 octets, avec `\r` final
- [ ] Choix `writeValueWithoutResponse` / `writeValueWithResponse` selon les propriétés de la caractéristique
- [ ] Réassemblage des notifications (texte ASCII)
- [ ] Gestion de `gattserverdisconnected` : état visible, une tentative de reconnexion automatique, puis bouton manuel
- [ ] Détection de l'absence de `navigator.bluetooth` (+ détection iOS hors Bluefy)
- [ ] Gestion des erreurs : utilisateur qui annule, Bluetooth désactivé, permission refusée, appareil déjà connecté ailleurs
- [ ] Test manuel avec le vrai dongle sur PC (Chrome) puis iPhone (Bluefy)

### 1.3 ELM327 — cœur
- [ ] File d'attente : **une commande à la fois**, fin de réponse sur `>`
- [ ] Timeouts par commande (normal / long pour la première requête OBD / personnalisable)
- [ ] Nettoyage des réponses : échos, espaces, `\r\n`, lignes vides, minuscules, octets nuls
- [ ] Reconnaissance des réponses spéciales : `OK`, `?`, `NO DATA`, `SEARCHING...`, `UNABLE TO CONNECT`,
      `BUS INIT: ...ERROR`, `CAN ERROR`, `STOPPED`, `BUFFER FULL`, `ERR94`, `LV RESET`
- [ ] Table des messages d'erreur en français + piste de résolution pour chacun
- [ ] Séquence d'init : `ATZ` → `ATE0` → `ATL0` → `ATS0` → `ATH1` → `ATAT1` → `ATSP0` → `0100`
- [ ] Tolérance aux clones : commande AT non supportée (`?`) → on continue si elle n'est pas indispensable
- [ ] Lecture `ATDPN` (protocole), `ATRV` (tension batterie), `ATI` / `STI` (identité du dongle)
- [ ] Table des protocoles ELM (numéro → nom lisible)
- [ ] Parsing des réponses avec en-têtes : regroupement **par ECU** (CAN 11 bits, CAN 29 bits, anciens protocoles)
- [ ] Annulation propre d'une commande en cours (déconnexion, changement d'écran)
- [ ] Tests unitaires : chaque type de réponse, réponses fragmentées, réponses de clones

### 1.4 ISO-TP (multi-trames)
- [ ] Réassemblage des trames First Frame / Consecutive Frames quand les en-têtes sont activés
- [ ] Gestion du format de réponse multi-lignes ELM (`0: …`, `1: …`) sans en-têtes
- [ ] Tests unitaires avec réponses VIN réelles/réalistes

### 1.5 Filtre de sécurité (CLAUDE.md §9.1)
- [ ] Liste blanche des services autorisés (OBD 01/02/03/04/06/07/09/0A ; UDS 0x10 sessions 01/03, 0x14, 0x19, 0x22, 0x3E ; KWP lecture)
- [ ] Liste noire explicite des services interdits (0x10 programmation, 0x11, 0x23, 0x27, 0x28, 0x2E, 0x2F, 0x31, 0x34–0x37, 0x3D, 0x85 + KWP)
- [ ] Filtre appliqué **dans la couche protocole**, avant l'envoi au transport, pour toutes les commandes
- [ ] Commandes AT : liste blanche également (pas de commandes d'écriture de paramètres persistants du dongle sans raison)
- [ ] Effacement (04 / 0x14) : n'accepte que si un jeton de confirmation utilisateur est fourni
- [ ] Tests de non-régression : chaque service interdit est refusé, chaque service autorisé passe

### 1.6 OBD-II — services de base
- [ ] Lecture des PIDs supportés (`0100`, `0120`, `0140`… tant que le bit suivant est à 1), par ECU
- [ ] PID `0101` : voyant moteur (MIL), nombre de codes, type d'allumage, état des moniteurs (décodé)
- [ ] Service 03 : codes confirmés, par ECU
- [ ] Service 07 : codes en attente, par ECU
- [ ] Service 0A : codes permanents, par ECU
- [ ] Décodage DTC (2 octets → P/C/B/U + 4 caractères), ignorer les `0000` de remplissage
- [ ] Gestion des différences CAN / non-CAN (octet de nombre de codes en CAN)
- [ ] Service 04 : effacement (passe par le filtre et la confirmation)
- [ ] Service 09 : VIN (`0902`), nom de l'ECU (`090A`) si supporté
- [ ] Modèle de données `Dtc` : code, ECU, type (confirmé/en attente/permanent), source
- [ ] Tests unitaires pour chaque service avec trames réalistes (CAN et non-CAN)

### 1.7 VIN
- [ ] Validation (17 caractères, pas de I/O/Q, chiffre de contrôle pour les VIN nord-américains)
- [ ] Table WMI → constructeur / pays (données déclaratives)
- [ ] 10ᵉ caractère → année modèle (cycle de 30 ans, levée d'ambiguïté)
- [ ] VIN absent/illisible → saisie manuelle ou nom libre
- [ ] Tests unitaires avec VIN de plusieurs marques

### 1.8 Base de codes défaut
- [ ] Récupérer OBDex (données CC0) dans `data/dtc/source/` avec sa version et la date
- [ ] Script `scripts/` : conversion OBDex → notre format (CLAUDE.md §7.2)
- [ ] Correspondance des niveaux de gravité OBDex → `stop` / `soon` / `monitor` / `info`, avec règles documentées
- [ ] **Traduction en français** : titre, description, symptômes, causes, vérifications
  - [ ] Stratégie de traduction choisie et documentée (script + relecture)
  - [ ] Glossaire technique FR (sonde lambda, papillon, débitmètre, catalyseur, vanne EGR, FAP…)
  - [ ] Relecture prioritaire des ~200 codes les plus courants (P0100–P0499, P0500–P0799…)
  - [ ] Relecture du reste par familles
- [ ] Script de validation : schéma JSON, doublons, champs vides, gravité présente, sources présentes
- [ ] Découpage/compression pour un chargement léger (chargement à la demande par famille)
- [ ] Module de recherche : plugin constructeur d'abord, générique ensuite, « code non documenté » sinon
- [ ] Description générique de repli selon la structure du code (lettre + 1er chiffre = générique/constructeur, 2ᵉ chiffre = sous-système)
- [ ] Tests unitaires de la recherche

### 1.9 Simulateur — scénarios MVP
- [ ] Moteur de simulation : dictionnaire requête → réponse, multi-ECU, état (codes effacés après `04`)
- [ ] Émulation des commandes AT de base (`ATZ`, `ATE0`, `ATSP0`, `ATDPN`, `ATRV`, `ATI`…)
- [ ] Scénario « voiture CAN saine »
- [ ] Scénario « codes confirmés + en attente + permanents » (plusieurs ECU)
- [ ] Scénario « vieille voiture KWP / ISO 9141 »
- [ ] Scénario « VIN multi-trames »
- [ ] Scénario « clone ELM327 qui répond mal »
- [ ] Scénario « voiture qui ne répond pas » (`UNABLE TO CONNECT`)
- [ ] Scénario « déconnexion en plein scan »
- [ ] Tests d'intégration : scan complet bout à bout sur chaque scénario

### 1.10 Interface MVP
- [ ] **Écran « navigateur non compatible »** : explication + marche à suivre Bluefy + accès au mode démo
- [ ] **Accueil / Connexion** : bouton « Connecter le dongle », bouton « Mode démo »,
      état (dongle, protocole, tension batterie, VIN/marque)
- [ ] **Diagnostic de connexion guidé** en cas d'échec (contact mis ? dongle BLE ? bon navigateur ? autre appareil connecté ?)
- [ ] **Scan complet** : progression étape par étape, puis résumé (« X défauts dont Y urgents · voyant · … »)
- [ ] Liste des défauts **groupée par calculateur**, avec calculateurs sans défaut et calculateurs muets distingués
- [ ] **Fiche d'un code** : code, titre, badge de gravité, statut, ECU, description, symptômes, causes triées, vérifications
- [ ] **Parcours d'effacement** (CLAUDE.md §9.2) :
  - [ ] Rappel des prérequis (moteur coupé, contact mis)
  - [ ] Sauvegarde automatique des codes (et freeze frame dès la phase 2) avant effacement
  - [ ] Avertissements (freeze frame perdu, moniteurs CT remis à zéro, défaut qui reviendra, codes non effaçables)
  - [ ] Confirmation explicite
  - [ ] Rescan automatique et affichage du résultat
- [ ] Indicateur permanent de l'état de connexion + bouton de déconnexion
- [ ] Badge « MODE DÉMO » toujours visible en mode simulateur
- [ ] **Réglages (version minimale)** : journal brut (afficher, copier, exporter en fichier texte)

### 1.11 Essais réels
- [ ] Connexion du dongle sur PC (Chrome) : init OK, protocole détecté
- [ ] Connexion sur iPhone (Bluefy) : init OK
- [ ] Scan complet sur la voiture de test
- [ ] Journal brut exporté, anonymisé (VIN masqué) et ajouté aux fixtures de tests
- [ ] Si possible : essai sur une 2ᵉ voiture d'une autre marque / d'un autre protocole
- [ ] Liste des bugs relevés reportée ci-dessous (section « Problèmes connus »)

**Critère de fin** : depuis l'iPhone dans Bluefy, on connecte le dongle, on lance un scan, on lit les codes
expliqués en français, on peut les effacer en toute sécurité ; tout marche aussi en mode démo.

---

## Phase 2 — Données en direct, freeze frame, contrôle technique

### 2.1 Table des PIDs génériques (service 01)
- [ ] Table déclarative des PIDs SAE J1979 (nom FR, nom court, octets, formule, unité, min, max) dans `data/pids/`
- [ ] Reprise des formules depuis OBDex (`pids/mode01.json`, CC0) + vérification
- [ ] PIDs à bits (état du système de carburant, air secondaire, etc.) décodés en texte
- [ ] Tests unitaires de chaque formule avec valeurs connues

### 2.2 Évaluateur de formules
- [ ] Mini-parseur sûr (sans `eval`/`Function`) : `+ - * / ( )`, variables `A`–`Z`, `signed()`, opérations sur bits, comparaisons simples
- [ ] Messages d'erreur clairs pour une formule invalide
- [ ] Tests unitaires (dont formules de type Torque : `(A*256)+B`, `((signed(A)*256)+B)/512`…)

### 2.3 Moteur de lecture en direct
- [ ] Boucle de lecture qui n'interroge que les PIDs affichés
- [ ] Regroupement de jusqu'à 6 PIDs par requête sur CAN
- [ ] Ajout du nombre de réponses attendu quand c'est possible (ex. `010C1`)
- [ ] Repli PID par PID si le regroupement échoue (vieux protocoles, clones)
- [ ] Mesure et exposition de la fréquence réelle (Hz)
- [ ] Pause automatique quand l'onglet est en arrière-plan ou l'écran quitté
- [ ] Gestion des erreurs en cours de lecture (NO DATA ponctuel, déconnexion)

### 2.4 Écran « Données en direct »
- [ ] Liste des PIDs supportés, avec recherche
- [ ] Favoris (mémorisés)
- [ ] Limite de sélection + explication (« plus de valeurs = rafraîchissement plus lent »)
- [ ] Vue liste de valeurs
- [ ] Vue jauges (SVG maison, min/max, unité)
- [ ] Vue graphiques (uPlot) : jusqu'à 8 courbes, affichage séparé ou **fusionné** (superposé), défilement temporel
- [ ] Pause / figer l'affichage pour examiner une valeur
- [ ] Préréglages de PIDs par situation (« ralenti », « richesse », « température », « turbo ») pour démarrer vite
- [ ] Affichage de la fréquence (Hz)
- [ ] Bandeau « Ne pas manipuler en conduisant »
- [ ] Empêcher la mise en veille de l'écran pendant le live (Wake Lock API si disponible)

### 2.5 Freeze frame (service 02)
- [ ] Lecture du code ayant déclenché le freeze frame (PID 02)
- [ ] Lecture des PIDs disponibles dans le freeze frame
- [ ] Affichage dans la fiche du code concerné, avec comparaison aux plages normales (2.11)
- [ ] Sauvegarde automatique avant effacement (intégrée au parcours de 1.10)
- [ ] Scénario simulateur avec freeze frame

### 2.6 Contrôle technique (readiness)
- [ ] Décodage complet des moniteurs (essence / diesel) depuis `0101`
- [ ] Moniteurs depuis le dernier effacement vs cycle de conduite en cours (`0141`) si supporté
- [ ] Écran « Contrôle technique » : liste prêt / non prêt / non supporté, verdict simple
- [ ] Conseils pour faire passer les moniteurs à « prêt » (cycle de conduite)
- [ ] Distance et temps depuis l'effacement des codes (`0131`, `014E`) si supportés

### 2.7 Mode 06 (tests embarqués)
- [ ] Lecture des MID supportés puis des résultats (CAN)
- [ ] Tables unité/échelle SAE J1979 (données déclaratives)
- [ ] Noms FR des MID standard (catalyseur, sondes, EGR, EVAP, ratés…)
- [ ] MID/TID non standard affichés bruts avec mention « spécifique constructeur »
- [ ] Écran « Tests embarqués » (avancé) : valeur, min, max, OK/échec
- [ ] Gestion du format non-CAN (plus ancien, moins normalisé) ou marquage « non supporté »

### 2.8 Infos véhicule
- [ ] Service 09 : CALID (`0904`), CVN (`0906`), compteurs de performance si utiles
- [ ] Écran « Infos véhicule » : VIN décodé, calculateurs détectés, protocole, dongle, tension batterie

### 2.9 PWA hors ligne
- [ ] vite-plugin-pwa : manifeste (nom, icônes, couleurs), service worker
- [ ] Mise en cache de toute l'application et de la base de codes
- [ ] Message « nouvelle version disponible » avec bouton de rechargement
- [ ] Vérifier le fonctionnement hors ligne (mode avion) sur PC et iPhone/Bluefy
- [ ] Vérifier le comportement de Bluefy avec le service worker et les favoris

### 2.10 Simulateur — scénarios phase 2
- [ ] Données en direct qui évoluent dans le temps (régime, température qui monte, vitesse…)
- [ ] Moniteurs prêts / non prêts
- [ ] Résultats Mode 06 (dont un en échec)

### 2.11 Valeurs de référence et analyses automatiques (inspiré des tablettes pro)
- [ ] Plages normales pour les PIDs génériques (`data/pids/` : `normal: {min, max, condition}`, ex. correcteur court terme −10 / +10 % au ralenti moteur chaud), avec source
- [ ] Mise en évidence des valeurs hors plage (couleur + icône + texte)
- [ ] Statistiques par PID pendant la session : min, max, moyenne
- [ ] Analyses passives automatiques, en lecture seule :
  - [ ] Correcteurs de richesse (court + long terme) : mélange trop pauvre / trop riche, prise d'air probable
  - [ ] Sondes lambda amont : oscillation présente ou non
  - [ ] Température moteur : montée normale, thermostat bloqué ouvert probable
  - [ ] Ratés d'allumage par cylindre (Mode 06, si disponible)
- [ ] Chaque analyse affiche « indice », jamais « certitude », et renvoie vers les codes ou PIDs concernés

### 2.12 Test batterie et charge (lecture seule, via `ATRV`)
- [ ] Tension au repos (moteur coupé) → état de charge estimé
- [ ] Creux de tension au démarrage (échantillonnage rapide pendant le démarrage) → santé de la batterie
- [ ] Tension moteur tournant (≈ 13,5–14,7 V) → alternateur / régulateur
- [ ] Écran guidé « Test batterie » en 3 étapes avec verdict simple

### 2.13 Diagnostic guidé (esprit Bosch SIS, version simple)
- [ ] Format de « procédure de vérification » dans la base de codes : étapes, PID à regarder, valeur attendue, conclusion
- [ ] Depuis la fiche d'un code : bouton « Vérifier » qui ouvre le live sur les bons PIDs avec les plages attendues
- [ ] Rédaction des procédures pour les ~50 codes les plus courants (ratés, richesse, catalyseur, lambda, débitmètre, EGR, thermostat)
- [ ] Recherche par **symptôme** sans code (« ralenti instable », « surconsommation », « manque de puissance ») → codes possibles + PIDs à surveiller

### 2.14 Essais réels
- [ ] Live sur la voiture de test : valeurs cohérentes, fréquence mesurée notée
- [ ] Freeze frame lu sur un vrai défaut (si présent)
- [ ] Readiness comparée à un autre outil si possible
- [ ] Mode hors ligne testé dans la voiture

**Critère de fin** : jauges et graphiques fluides en direct, écran CT fiable, site utilisable sans réseau.

---

## Phase 3 — Véhicules, historique, rapport

### 3.1 Stockage IndexedDB
- [ ] Schéma versionné : `vehicles`, `scans`, `dtcHistory`, `recordings`, `settings`
- [ ] Système de migrations
- [ ] Couche d'accès (`idb`) testée (avec fake-indexeddb)
- [ ] Gestion du stockage plein / navigation privée (message clair, l'app reste utilisable)

### 3.2 Véhicules
- [ ] Création automatique à partir du VIN au premier scan
- [ ] Création manuelle (nom libre) si VIN illisible
- [ ] Renommer, ajouter le kilométrage, supprimer (avec confirmation)
- [ ] Sélection du véhicule actif ; reconnaissance automatique à la connexion

### 3.3 Historique des scans et des codes
- [ ] Enregistrement de chaque scan (codes par ECU, statuts, freeze frames, readiness, tension, kilométrage saisi)
- [ ] Calcul pour chaque code : première apparition, dernière apparition, disparition, récurrences
- [ ] Écran « Historique » : chronologie des scans
- [ ] Section historique dans la fiche d'un code
- [ ] Mise en avant des codes nouveaux / revenus / disparus par rapport au scan précédent
- [ ] **Avant / après réparation** (pré-scan / post-scan des tablettes pro) : marquer un scan « avant », puis « après », écran de comparaison côte à côte
- [ ] Note libre attachée à un scan (« bougies changées », « bobine 2 remplacée »)
- [ ] Carnet d'entretien simple : interventions + kilométrage + rappels (vidange, bougies…), saisie manuelle

### 3.4 Enregistrements des données en direct
- [ ] Bouton enregistrer / arrêter sur l'écran live
- [ ] **Déclenchement automatique** : démarrer l'enregistrement quand une valeur dépasse un seuil ou qu'un code apparaît, en gardant les secondes précédentes (tampon)
- [ ] Marqueurs posés pendant l'enregistrement (« à-coup ici »)
- [ ] **Relecture** (playback) avec curseur temporel, sur les mêmes vues que le live
- [ ] Stockage par lots (pas d'écriture à chaque valeur)
- [ ] Liste des enregistrements, relecture sous forme de graphiques
- [ ] Export CSV (horodatage + une colonne par PID, unités en en-tête)
- [ ] Suppression d'un enregistrement

### 3.5 Rapport garagiste
- [ ] Contenu : véhicule, date, kilométrage, codes + explications + gravité, readiness, freeze frames, tension batterie
- [ ] Version HTML imprimable (feuille de style d'impression)
- [ ] Version texte copiable (presse-papiers)
- [ ] Partage via Web Share API quand disponible
- [ ] Vérifier le rendu sur iPhone/Bluefy et PC

### 3.6 Export / import des données
- [ ] Export JSON complet (versionné), téléchargé en fichier
- [ ] Import JSON avec validation et fusion (pas d'écrasement silencieux)
- [ ] Test : export depuis l'iPhone → import sur PC

### 3.7 Réglages complets
- [ ] Unités (°C/°F, km/h/mph, bar/psi, L/100 km…)
- [ ] Thème clair / sombre / système
- [ ] Profil BLE forcé, protocole OBD forcé
- [ ] Effacer toutes les données (avec confirmation)

**Critère de fin** : chaque scan est conservé par véhicule, on voit l'évolution des codes, on génère un
rapport lisible et on transfère ses données du téléphone au PC.

---

## Phase 4 — Constructeurs et PIDs personnalisés

### 4.1 Socle UDS / KWP en lecture
- [ ] Gestion des en-têtes et filtres CAN (`ATSH`, `ATCRA`, `ATFCSH`, `ATFCSD`, `ATFCSM`, `ATCP`)
- [ ] Restauration de l'état ELM après chaque échange constructeur (retour aux en-têtes OBD)
- [ ] UDS 0x10 (session par défaut/étendue), 0x3E (maintien de session)
- [ ] UDS 0x19 : `reportNumberOfDTCByStatusMask`, `reportDTCByStatusMask`, snapshots et données étendues si supportés
- [ ] UDS 0x22 : lecture de données par identifiant
- [ ] UDS 0x14 : effacement (filtre + confirmation)
- [ ] Gestion des réponses négatives UDS (0x7F + NRC) avec messages FR, dont 0x78 « réponse en attente »
- [ ] Décodage de l'octet de statut DTC UDS (8 bits) en libellés lisibles
- [ ] Décodage des DTC UDS sur 3 octets (format ISO 15031-6 / SAE J2012 + type de défaut)
- [ ] Lecture KWP2000 équivalente (0x18 / 0x14 / 0x21 / 0x1A) pour les marques qui l'utilisent
- [ ] Tests unitaires de chaque service et des réponses négatives

### 4.2 Système de plugins
- [ ] Interface `ManufacturerPlugin` (CLAUDE.md §6.5)
- [ ] Registre des plugins + sélection automatique par VIN (WMI) + choix manuel
- [ ] Statut de support affiché (« testé », « expérimental », « non supporté »)
- [ ] Intégration au scan complet : calculateurs constructeur après le générique
- [ ] Chaque calculateur : répondu / sans défaut / muet / non supporté
- [ ] Une erreur de plugin n'interrompt jamais le scan générique

### 4.3 Plugin VAG (VW, Audi, Seat, Skoda, Cupra)
- [ ] Recherche et documentation des sources (adresses des calculateurs, identifiants) dans `manufacturers/vag/SOURCES.md`
- [ ] Liste des calculateurs (moteur, boîte, ABS, airbag, tableau de bord, passerelle, confort, clim…) avec adresses sourcées
- [ ] Lecture des défauts UDS sur les plateformes récentes (MQB et ultérieures)
- [ ] Plateformes PQ (~2009–2014, VW TP2.0) : étude de faisabilité avec ELM327/OBDLink → « expérimental » ou « non supporté »
- [ ] Données en direct VAG (quelques PIDs 0x22 sourcés)
- [ ] Codes constructeur VAG dans `data/dtc/vag.json` (sources vérifiées)
- [ ] Scénario simulateur VAG
- [ ] Essai sur un véhicule VAG réel + journal brut en fixture

### 4.4 Plugin Renault / Dacia
- [ ] Sources documentées
- [ ] Calculateurs + lecture des défauts
- [ ] Codes constructeur sourcés
- [ ] Scénario simulateur + essai réel si possible

### 4.5 Plugin Stellantis (Peugeot, Citroën, DS, Opel récents)
- [ ] Sources documentées
- [ ] Calculateurs + lecture des défauts
- [ ] Codes constructeur sourcés
- [ ] Scénario simulateur + essai réel si possible

### 4.6 Autres marques (selon demande et documentation disponible)
- [ ] Toyota / Lexus
- [ ] Ford
- [ ] BMW / Mini
- [ ] Mercedes
- [ ] Hyundai / Kia
- [ ] Autres

### 4.7 PIDs personnalisés
- [ ] Format JSON (CLAUDE.md §6.6) + validation
- [ ] Import CSV au format Torque (Name, ShortName, ModeAndPID, Equation, Min, Max, Units, Header)
- [ ] Conversion des formules Torque vers notre évaluateur (et rejet clair des formules non supportées)
- [ ] Les PIDs importés passent par le filtre de sécurité (0x22 / 0x21 / 01 uniquement)
- [ ] Gestion dans les réglages : liste, activer/désactiver, supprimer
- [ ] Utilisation dans l'écran live au même titre que les PIDs génériques

### 4.8 Écrans constructeur
- [ ] **Carte des calculateurs** (topologie, comme Autel) : tous les calculateurs groupés par réseau/système,
      pastille couleur + texte (OK · défaut · muet · non supporté), toucher un calculateur → ses défauts
- [ ] Filtres et tri des défauts : par statut (actif, mémorisé, intermittent), par gravité, par calculateur
- [ ] Lecture du kilométrage depuis le calculateur quand c'est documenté (sinon saisie manuelle)
- [ ] Identification de chaque calculateur (référence pièce, version logicielle, matériel) via UDS 0x22 standard (`F187`, `F189`, `F191`, `F18C`…)
- [ ] Fiche défaut enrichie : statut UDS détaillé, kilométrage, compteur d'occurrences, données d'environnement (esprit VCDS)
- [ ] Effacement par calculateur (même parcours sécurisé que §9.2)

**Critère de fin** : sur au moins une voiture VAG réelle, on lit les défauts ABS/airbag/boîte en plus du moteur,
avec un statut de support honnête pour les autres.

---

## Phase 5 — Repli Web Serial (PC)

- [ ] `SerialTransport` (Web Serial API) : sélection du port, débit configurable (38400, 115200…)
- [ ] Détection de la disponibilité de Web Serial (Chrome/Edge PC uniquement)
- [ ] Choix du transport à la connexion sur PC : BLE ou port série
- [ ] Aide : appairer un dongle Bluetooth classique dans Windows, trouver le port COM
- [ ] Support des dongles USB (ELM327 USB, OBDLink SX/EX)
- [ ] Essai avec un dongle Bluetooth classique et un dongle USB
- [ ] Tests unitaires avec un faux port série

**Critère de fin** : sur PC, un dongle ELM327 Bluetooth classique ou USB fonctionne comme un dongle BLE.

---

## Phase 6 — Finitions et robustesse

### 6.1 Robustesse
- [ ] Revue de tous les messages d'erreur (français clair, piste de résolution)
- [ ] Reconnexion BLE éprouvée (coupure moteur, éloignement, mise en veille du téléphone)
- [ ] Comportement correct si la voiture démarre ou s'arrête pendant un scan
- [ ] Essais avec plusieurs dongles (OBDLink, Vgate, clone)
- [ ] Essais sur le plus de voitures possible (tableau de compatibilité ci-dessous)

### 6.2 Performance
- [ ] Taille du bundle mesurée et optimisée (chargement à la demande des écrans lourds et de la base de codes)
- [ ] Temps de premier affichage en 4G mesuré
- [ ] Fluidité du live sur un iPhone ancien

### 6.3 Accessibilité et ergonomie
- [ ] Gravité jamais portée par la couleur seule (vérifié partout)
- [ ] Contrastes vérifiés (clair et sombre, plein soleil)
- [ ] Taille des zones tactiles ≥ 44 px
- [ ] Lecteur d'écran : libellés des boutons, jauges et badges
- [ ] Utilisation à une main

### 6.4 Qualité
- [ ] Tests Playwright des parcours principaux avec le simulateur (connexion démo, scan, fiche, effacement, live)
- [ ] Couverture des couches protocole (`elm327`, `isotp`, `obd`, `uds`) ≥ 90 %
- [ ] Revue de sécurité du filtre (§9.1) et de l'absence d'appels réseau (§9.4)
- [ ] Revue du code (`/code-review`)

### 6.5 Documentation
- [ ] `README.md` : présentation, prérequis (dongle BLE, Bluefy), utilisation, développement
- [ ] Guide « ajouter un profil de dongle BLE »
- [ ] Guide « ajouter un plugin constructeur » (avec exigences de sources)
- [ ] Guide « ajouter / corriger un code défaut »
- [ ] Page d'aide intégrée au site (premiers pas, où est la prise OBD, que faire si ça ne se connecte pas)

---

## Comparaison avec les tablettes pro (Autel, Launch, Bosch KTS…)

| Fonction pro | Chez nous | Où |
|---|---|---|
| Identification auto par VIN | ✅ | 1.7 |
| Scan complet de tous les calculateurs | ✅ générique, puis par marque | 1.6, 4.2–4.6 |
| Carte des calculateurs (topologie) | ✅ version liste/schéma | 4.8 |
| Lecture / effacement des défauts, statuts, filtres | ✅ | 1.6, 4.1, 4.8 |
| Freeze frame / données d'environnement | ✅ | 2.5, 4.1 |
| Live : graphiques fusionnés, 8 courbes, enregistrement, relecture | ✅ | 2.4, 3.4 |
| Valeurs de référence / hors plage | ✅ PIDs génériques | 2.11 |
| Diagnostic guidé (procédures, valeurs attendues) | ✅ version simple | 2.13 |
| Recherche par symptôme | ✅ | 2.13 |
| Pré-scan / post-scan | ✅ | 3.3 |
| Rapport client | ✅ | 3.5 |
| Test batterie / charge | ✅ via tension du dongle | 2.12 |
| Infos calculateurs (références, versions) | ✅ | 2.8, 4.8 |
| **Remises à zéro (vidange, frein de parking, angle volant, FAP, batterie…)** | ❌ volontairement | Écriture dans la voiture (CLAUDE.md §9) |
| **Tests actionneurs (bidirectionnel)** | ❌ volontairement | Commande des organes de la voiture |
| **Codage, adaptations, programmation, clés, ADAS** | ❌ volontairement | Risque d'immobiliser la voiture |
| Oscilloscope, multimètre | ❌ | Matériel spécifique |
| Schémas électriques, bulletins techniques constructeur | ❌ | Données propriétaires payantes |
| Assistance à distance / cloud | ❌ | Pas de serveur, usage perso |

Les lignes ❌ « volontairement » sont une décision de sécurité. Si on veut un jour en ajouter (par exemple
la remise à zéro de l'indicateur de vidange), ce sera une décision explicite, consignée ci-dessous, avec une
liste blanche limitée et une source par véhicule.

## Tableau de compatibilité testée

| Véhicule (marque, modèle, année, carburant) | Protocole | Dongle | Navigateur | Générique | Constructeur | Notes |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |

## Dongles testés

| Dongle | Profil BLE | Navigateur | Résultat | Notes |
|---|---|---|---|---|
| — | — | — | — | — |

## Problèmes connus

_(à remplir au fil des essais)_

## Décisions prises

| Date | Décision | Raison |
|---|---|---|
| 2026-10-04 | Site web (pas d'application native) | Rien à publier, une seule base de code |
| 2026-10-04 | iPhone via Bluefy | Aucun navigateur iOS standard ne supporte Web Bluetooth |
| 2026-10-04 | Dongles BLE uniquement (Web Serial en repli PC) | Seul le BLE est accessible depuis le web sur iPhone |
| 2026-10-04 | Pas d'IA, base de codes fixe | Choix de l'utilisateur ; hors ligne, sans clé ni serveur |
| 2026-10-04 | Universel, pas centré sur un véhicule | Fonctionner sur le maximum de voitures |
| 2026-10-04 | Lecture seule (sauf effacement des codes) | Sécurité : aucun risque d'immobiliser une voiture |
| 2026-10-04 | Base générique issue d'OBDex (CC0) traduite en FR | Seule base complète sous licence libre |
| 2026-10-04 | Reprise des fonctions de lecture des tablettes pro ; exclusion des remises à zéro, tests actionneurs et codage | Tout ce qui lit est utile et sans risque ; tout ce qui écrit peut immobiliser la voiture |
