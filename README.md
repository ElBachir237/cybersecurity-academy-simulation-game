# HORIZON Cyber Academy

Simulation pédagogique immersive de cybersécurité.

Vous n’êtes pas un joueur qui chasse un flag. Vous êtes un nouvel arrivant chez **HORIZON CORPORATION**. Dès le premier jour, vous travaillez depuis un poste d’entreprise : mail, chat, tickets, terminal Linux, carte réseau, SOC. Les pannes sont dans le monde simulé. Vos décisions ont des conséquences.

**Langues :** français / anglais (bascule en jeu, sans reset de partie).

Dépôt : [ElBachir237/cybersecurity-academy-simulation-game](https://github.com/ElBachir237/cybersecurity-academy-simulation-game)

---

## Idée

La plupart des formations cyber sont des quiz, des slides, ou des CTF. HORIZON vise autre chose : **des réflexes de terrain**.

- Diagnostiquer un hôte réel du monde (interfaces, DNS, DHCP, services, logs).
- Lire le mail, le chat et le ticket avant de taper des commandes.
- Corriger, **vérifier**, puis expliquer.
- Assumer une mauvaise décision (couper un service, mal rassurer un collègue, ignorer un indice).

Le moteur ne récompense pas la bonne commande magique. Il récompense une méthode : collecte → hypothèses → diagnostic → correction → vérification.

---

## Ce que vous voyez en jeu

Un bureau **HORIZON OS** avec des fenêtres, des notifications, du son, et une sauvegarde automatique.

| App | Rôle |
| --- | --- |
| **Academy** | Parcours, missions, théorie, débriefs |
| **Mail** | Briefs, tickets, éventuellement phishing |
| **Chat** | IT-SUPPORT, collègues, appels / décisions |
| **Terminal** | Shell Linux cohérent avec l’état du monde |
| **Network** | Topologie, hôtes, calculateur CIDR |
| **SOC** | Alertes et triage (socle, encore peu de contenu) |
| **Files / Tickets / Browser** | Contexte d’entreprise |
| **Skills / Portfolio** | Compétences, badges, certificats |

Le terminal n’est pas un décor. `ping`, `ip`, `dig` / `nslookup`, `systemctl`, `netplan apply`, `dhclient`, `cat` / `grep` / `nano` lisent et mutent le **même** état que la carte réseau et les missions.

---

## Campagne actuelle

Le curriculum affiche **10 chapitres** et **17 filières** (fondamentaux, réseau, SOC, DFIR, cloud, etc.). Les chapitres **1, 2 et 3** sont jouables de bout en bout.

### Chapitre 1 — First Day (`released`)

Boucle pédagogique complète : lab guidé → mission réelle → examen solo.

| Mission | Type | Sujet |
| --- | --- | --- |
| **Premier poste** (`c1_lab`) | Lab guidé | DNS mort sur `WS-001` |
| **Marie n’a plus Internet** (`c1_mission`) | Mission | DHCP / `systemd-networkd` sur `PC-MARIE` |
| **Incident isolé** (`c1_sim`) | Simulation (examen) | Panne sur `PC-PAUL`, variantes `dns` / `gw` / `link` |

Réussir le chapitre débloque le certificat **Cyber Explorer** (vérifiable via `/verify`).

### Chapitre 2 — Fondamentaux Réseau (`released`)

Boucle complète autour du **plan d’adressage VLAN 40** (`192.168.40.0/26`).

| Mission | Type | Sujet |
| --- | --- | --- |
| **Calculateur de sous-réseaux** (`c2_lab`) | Lab | Calculer `192.168.40.0/26` dans l’app Réseau |
| **Nour n’est pas sur le VLAN 40** (`c2_mission`) | Mission | Config clonée (`192.168.10.80/24`) vs plan d’étage |
| **Plan d’adressage** (`c2_sim`) | Simulation (examen) | Variantes `mask` / `gw` / `ip` sur `PC-NOUR` |

Réussir le chapitre débloque le certificat **Network Foundations**.

### Chapitre 3 — Sécurité réseau (`released`)

Boucle complète autour d’un **pare-feu FORWARD simulé** : défaut inter-VLAN DROP, cœur `10.0.0.0/24` autorisé. `ping` entre VLANs respecte désormais cette politique (sans casser DNS / intranet des chapitres 1–2).

| Mission | Type | Sujet |
| --- | --- | --- |
| **Trou dans le pare-feu** (`c3_lab`) | Lab | Règle `FW-LAB` (bureaux → Finance) : lister, observer, supprimer, vérifier |
| **Le raccourci du prestataire** (`c3_mission`) | Mission | Trou `192.168.0.0/16` → Finance ; mail IT ; appel après lecture ; mauvaise décision Marc = `0.0.0.0/0` |
| **Simulation : segmentation** (`c3_sim`) | Simulation (examen) | Variantes `any` / `src` / `wide` |

Commandes lab : `sudo iptables -L`, `sudo iptables -D <id>`, `sudo iptables -A FORWARD -s CIDR -d CIDR -j ACCEPT\|DROP`.

Réussir le chapitre débloque le certificat **Network Sentinel**.

### Chapitres 4–10 (`soon`)

SOC Operations, Incident Response, Web Security, DFIR, Cloud Security, DevSecOps, Threat Intelligence — **roadmap, pas encore de missions**.

---

## Stack

- **Next.js 16** / **React 19** / **TypeScript**
- **Tailwind CSS 4**
- Moteur de jeu **agnostique du framework** (`src/game`) — React s’abonne
- Sauvegarde locale (`localStorage`) + optionnelle **PostgreSQL** (Drizzle)
- Tests navigateur **Playwright** (desktop, fenêtres, terminal)

---

## Architecture

```
src/
  app/                 pages Next.js (boot, desktop, verify, API)
  components/game/     UI HORIZON OS (fenêtres, apps, modales)
  game/
    engine.ts          état, missions, XP, save
    terminal.ts        simulateur shell + réseau
    workspace.ts       layout des fenêtres
    i18n.ts            dictionnaire FR / EN
    data/              monde, missions, curriculum
  db/                  schéma Drizzle (profils, saves, certificats)
tests/browser/         Playwright
```

Points importants :

- L’état du monde (hôtes, interfaces, DNS, services, tickets, NPC, règles pare-feu) est **persistant** dans la save.
- Les textes d’UI sont des **clés i18n**, pas des chaînes figées dans le state : changer de langue ne casse pas la partie.
- Une mission est une machine à états : `enter` construit le monde, `handle` valide les événements (`cmd`, mail lu, décision, etc.).

---

## Démarrage

Prérequis : Node.js 20+.

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000), créer un profil, entrer chez HORIZON.

La partie se joue **sans base de données** : sauvegarde automatique dans le navigateur. PostgreSQL n’est utile que pour la sync serveur (saves, certificats).

### Base optionnelle

```bash
# .env.local
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
```

Sans `DATABASE_URL`, les routes `/api/save` et `/api/certificates` échouent, mais le jeu local continue.

### Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run smoke` | Walkthrough moteur chapitres 1–3 |

Playwright (serveur déjà lancé) :

```bash
npx playwright test
```

---

## Pédagogie visée (inchangée pour la suite)

1. **Lab guidé** — on vous montre la méthode.
2. **Mission** — ticket réel, collègues, conséquences.
3. **Simulation / examen** — seul, variantes, peu d’indices.
4. **Debrief** — score, erreurs, compétences validées, suite recommandée.

Ce que le projet **ne** veut pas devenir : un QCM déguisé, un CTF de flags, ou un simulateur d’exploits réels.

---

## Améliorations futures

Classées par priorité produit. Le moteur et le desktop sont déjà trop en avance sur le **contenu**.

### 1. Contenu — priorité haute

C’est le vrai chantier. Sans ça, HORIZON reste une démo du premier jour.

- **Chapitre 4 — SOC** : file d’alertes, faux positifs, escalation, playbooks. L’app SOC existe déjà, elle est quasi vide.
- **Chapitre 5 — Incident Response** : containment, communication, timeline, leçons apprises.
- **Chapitres 6–10** dans l’ordre : Web, DFIR, Cloud, DevSecOps, Threat Intel — **une boucle lab → mission → exam par chapitre**, pas un catalogue de compétences orphelines.
- Plus de **variantes** d’examens (comme `c1_sim`) pour empêcher le par cœur.
- Scénarios **phishing / social engineering** dans Mail + Chat (déjà prévu dans le modèle de données).
- Attestations au-delà de Cyber Explorer (un certificat par chapitre, puis un parcours métier).

### 2. Auteur de contenu

Aujourd’hui une mission = TypeScript + closures. Un formateur ne peut pas écrire un scénario sans coder.

- Extraire briefs, tâches, décisions et textes dans des fichiers de données (JSON / YAML / MDX).
- Garder le code uniquement pour les *hooks* monde (casser un DNS, stopper un service).
- Découper `i18n.ts` (déjà > 1 300 lignes) par domaine : UI, missions, théorie.
- Outil interne « mission preview » : lancer une étape sans rejouer tout le chapitre.

### 3. Monde simulé plus riche

- Hôtes **Windows** (aujourd’hui le parc est surtout Ubuntu / Debian).
- Active Directory, IAM, certificats PKI — les skills existent, le monde non.
- SIEM plus crédible : corrélation, fenêtres de logs, fausse piste.
- Pannes **multi-hôtes** (un DHCP down qui casse un étage, pas un PC).
- Carte réseau interactive : cliquer un hôte ouvre le bon terminal / les bons logs.
- Mode **crise** déjà esquissé dans l’audio (`tense` / `crisis`) : l’utiliser vraiment (timer, direction qui appelle, tickets qui s’empilent).

### 4. Produit & classe

- Comptes réels (pas un profil local anonyme).
- Sync cloud fiable des saves (l’API existe, l’auth non).
- Espace **formateur** : voir la progression, les erreurs fréquentes, débloquer un chapitre.
- Analytics (`analytics_events` est dans le schéma, inutilisé).
- Vérification publique des certificats plus solide (page `/verify` + anti-falsification).
- Export PDF / partage LinkedIn du certificat et du portfolio de compétences.
- Cohortes, deadline de chapitre, mode examen surveillé (timer, hints coupés).

### 5. UX

- Responsive / tablette : le window manager est pensé desktop 1440×900.
- Accessibilité clavier complète (focus trap, lecteurs d’écran).
- Onboarding plus court si le joueur a déjà un profil.
- Profondeur des apps « simples » (Files, Browser, Tickets) : aujourd’hui surtout du contexte.
- Meilleur feedback d’échec : montrer *pourquoi* la vérif a échoué, sans spoiler la solution.

### 6. Technique & qualité

- Renommer le package (`nextjs-postgresql-template` → `horizon-cyber-academy`).
- Déplacer Playwright en `devDependency`.
- Rendre `DATABASE_URL` vraiment optionnel (ne plus crasher l’import `db` au boot API).
- Protéger `POST /api/certificates` (aujourd’hui n’importe qui peut insérer un certificat).
- Tests moteur **unitaires** (terminal, DNS, DHCP, scoring) en plus du Playwright UI.
- CI GitHub Actions : `typecheck` + `lint` + Playwright.
- Format de save versionné avec migrations explicites (le `SAVE_VERSION` existe déjà).

### 7. Ligne rouge pédagogique

Tout nouveau contenu offensif (web, malware, purple team) reste **dans la fiction HORIZON** :

- pas d’exploits reproductibles sur des cibles réelles ;
- pas de payloads, PoC ou procédures d’attaque copiables hors simu ;
- l’objectif reste diagnostiquer, contenir, expliquer — pas « casser pour le fun ».

---

## État honnête du projet

| Couche | Maturité |
| --- | --- |
| Desktop OS, fenêtres, FR/EN, save locale | Avancée |
| Moteur + terminal réseau | Solide pour le chapitre 1 |
| Contenu jouable | Chapitres 1 et 2 (7 missions, exams à variantes) |
| Curriculum / skills / titres | Squelette large, peu branché |
| SOC, certificats serveur, classe | Amorcé |
| Auth, CI, docs produit | À faire |

Le prototype est convaincant comme **premier jour IT / réseau**. Ce n’est pas encore une académie complète. La suite utile n’est pas « plus d’UI », c’est **plus de missions de qualité** et un format de contenu tenable.

---

## Licence

Projet personnel / pédagogique, tous droits réservés pour l’instant (pas de licence open source déclarée).
