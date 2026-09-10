# HORIZON Cyber Academy

Simulation pédagogique immersive de cybersécurité.

Vous n’êtes pas un joueur qui chasse un flag. Vous êtes un **jeune pro** chez **HORIZON CORPORATION**. Vous commencez au helpdesk, vous prenez des décisions qui restent sur votre dossier, et vous pouvez, plus tard, **concevoir** le réseau que vous avez d’abord réparé. Mail, chat, tickets, terminaux (Linux, puis Windows, switch, AP), carte réseau, SOC. Les pannes sont dans le monde simulé.

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

Le terminal n’est pas un décor. Les commandes **lisent et mutent le même état** que la carte réseau et les missions. Chaque famille d’équipement a **son** CLI (pas un faux langage unique) :

| Famille | CLI visé (simulé, cohérent avec le monde) |
| --- | --- |
| Linux | `ip`, `ping`, `dig`, `systemctl`, `netplan`, `iptables`, … |
| Windows | `ipconfig`, `ping`, `netsh`, `Get-EventLog` / PowerShell admin |
| Switch / routeur | `show vlan`, `show ip route`, `interface` / `switchport`, ACL |
| AP / caméra / imprimante | CLI ou UI web **d’administration** (SSID, VLAN, enregistrement) |

Ce sont des commandes **d’exploitation légitime** (admin, diag, durcissement). Le jeu **n’inclura pas** Metasploit, payloads, modules d’exploit, ni procédures d’attaque copiables. La piste pentest / Red Team se joue **côté défense et audit interne** : tu vois ce qui s’est passé, tu contiens, tu corriges, tu rapportes.

---

## Campagne actuelle

Le curriculum **jouable** aujourd’hui : chapitres **1, 2 et 3**. La vision carrière (helpdesk → architecte / GRC) est décrite plus bas ; l’Académie in-game affiche encore l’ancienne liste 1–10 tant que les palier suivants ne sont pas codés.

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
| **Le port n’est pas le VLAN** (`c3_port`) | Mission | `SW-01 Gi0/14` resté VLAN 10 alors que PC-NOUR est déjà en `192.168.40.24/26` |
| **Le NAT du prestataire** (`c3_nat`) | Mission | Publication `0.0.0.0/0 → 192.168.20.45/32` ; ne pas élargir au VLAN Finance |
| **Le raccourci du prestataire** (`c3_mission`) | Mission | Trou `192.168.0.0/16` → Finance ; mail IT ; appel après lecture ; mauvaise décision Marc = `0.0.0.0/0` |
| **Simulation : segmentation** (`c3_sim`) | Simulation (examen) | Variantes `any` / `src` / `wide` |

Commandes lab : `sudo iptables -L`, `sudo iptables -D <id>`, `sudo iptables -A FORWARD -s CIDR -d CIDR -j ACCEPT|DROP`, et sur `SW-01` : `show vlan`, `show interfaces status`, `sudo switchport Gi0/14 vlan 40`.

Réussir le chapitre débloque le certificat **Network Sentinel**.

---

## Vision : une carrière, pas un catalogue

HORIZON n’est pas une collection de labs isolés. C’est **la vie d’un jeune pro** chez HORIZON CORPORATION, du premier ticket helpdesk jusqu’à l’architecture / la gouvernance. Les chapitres se suivent comme des **années** : chaque bloc débloque des équipements, des CLI, des collègues, et des conséquences qui restent sur le personnage (réputation, erreurs, titre, dossier de carrière).

Le nombre de chapitres **peut augmenter**. L’essentiel : **notions, compétences, décisions**, dans un monde qui tourne.

### Règles de vie (tous les chapitres à venir)

- **Contexte de chapitre** : seuls les éléments du palier sont exigés ; le siège s’enrichit, il n’est pas reset.
- **Temps imparti** : missions et examens ont une horloge (crise, direction qui relance). Dépasser le délai = score, réputation, parfois un ticket d’escalade — comme au bureau.
- **Dossier de carrière** : chaque décision (laisser un trou, mal rassurer Marie, isoler trop large) s’inscrit sur le personnage. Les chapitres suivants peuvent la rappeler.
- **Équipe** (après le SOC L1) : rôles helpdesk / admin / SOC L1–L2, partie partagée, vue formateur. Pas avant d’avoir un métier solo jouable.
- **Atelier architecture** (mode bac à sable, débloqué progressivement) : tu **dessines** le réseau d’une entreprise (VLAN, FW, AD, Wi-Fi, cloud HORIZON), tu **configures** avec les vrais CLI d’admin, tu **simules** le trafic (ping, ACL, DHCP). C’est le Packet Tracer d’HORIZON, branché sur les compétences déjà apprises — pas un second jeu déconnecté.

### Ce que « vrai AD / malware / AWS / pentest » veut dire ici

| Compétence visée | Dans HORIZON | Hors jeu (refusé) |
| --- | --- | --- |
| Active Directory | Annuaire simulé : users, OU, GPO, lockout, groupes | Installer un vrai domaine / outils d’attaque AD |
| Malware | Sandbox SOC : hash, strings, comportement narré | Binaire exécutable, dropper, payload |
| Cloud | Console **HORIZON Cloud** (IAM, SG, bucket) | Clone AWS et recettes d’intrusion |
| Web | Config / session / perms sur `SRV-WEB` | PoC d’exploit, SQLi copiable |
| Pentest | Audit interne + findings + correctifs | Metasploit, exploits, mouvement latéral « pour de vrai » |

---

## Parcours prévu (novice → expert)

Chaque chapitre : **lab + tickets terrain + décision + examen à variantes**, certificat, skills branchées sur le moteur. Les titres ci-dessous sont le **but métier** ; l’Académie actuelle affiche encore 10 lignes « soon » — elles seront renommées / étendues au fur et à mesure.

### Chapitres 1–3 — `released` (années 0–2)

Helpdesk Linux, adressage, segmentation. Voir ci-dessus.

**Compétences déjà en jeu :** terminal, DNS, DHCP, IPv4/CIDR, VLAN, switching d’accès, firewall FORWARD, NAT trop ouvert, diagnostic.

### Chapitre 4 — Helpdesk & poste de travail (`next`)

**But :** vivre le premier métier : dépanner un humain, un PC Windows, le Wi-Fi, une imprimante — avec **leurs** commandes.

**Objectif :** le joueur n’est plus seulement « celui qui ping Linux ». Il installe un compte, lit `ipconfig` / `netsh`, remet un AP sur le bon SSID/VLAN, clôture un ticket dans le temps.

| Mission type | Contenu |
| --- | --- |
| Lab | Poste Windows `PC-WIN` : `ipconfig`, ping, DNS |
| Ticket matériel | AP / Wi-Fi : client isolé, mauvais VLAN |
| Ticket logiciel | Compte lockout, imprimante, logiciel qui « ne lance pas » |
| Décision | Rassurer trop vite vs diagnostiquer |
| Exam | 3 pannes (lien / IP / Wi-Fi) |

**Skills :** `windows_admin`, `wifi`, `computer_basics`, `network_diag`. Certificat visé : **Service Desk Associate**.

### Chapitre 5 — Systèmes (Linux & Windows)

**But :** administrer, pas seulement dépanner. Services, logs, sauvegarde, un premier **annuaire**.

**Objectif :** relancer un service sans casser l’étage ; lire un journal ; créer un utilisateur dans l’AD **simulé**.

**Skills :** `linux_admin`, `windows_admin`, `services`, `active_directory` (base). Certificat : **Systems Technician**.

### Chapitre 6 — Admin réseau d’entreprise

**But :** le quotidien admin réseau : VPN, Wi-Fi d’entreprise, DHCP multi-VLAN, supervision — CLI switch/routeur/AP complets (toujours simulés, syntaxe réelle).

**Objectif :** un changement de VLAN / d’ACL tenu de bout en bout, vérifié par ping et par un collègue.

**Skills :** `routing`, `switching`, `vlan`, `firewall`, `wifi`. Certificat : **Network Administrator**.

**Atelier architecture — palier 1 :** tu poses toi-même VLAN + GW + FW d’un petit siège (5–20 hôtes) et tu dois faire passer le plan d’adressage + la segmentation du ch. 3.

### Chapitre 7 — SOC L1

**But :** porte d’entrée cyber. File d’alertes, SIEM, phishing, faux positif, escalation **dans le temps imparti**.

**Objectif :** trier 10 alertes, n’en escalader qu’une vraie, sans noyer Soriya.

**Skills :** `alert_triage`, `siem`, `log_analysis`. Certificat : **SOC Analyst L1**. L’app SOC se remplit pour de vrai. **Co-op** possible (helpdesk + L1).

### Chapitre 8 — Analyste / SOC L2

**But :** plus d’autonomie : endpoint (EDR **simulé**), hunting léger, malware en **sandbox** (pas d’exécutable).

**Skills :** `log_analysis`, `malware_triage`, `ioc`, `threat_hunting`. Certificat : **Security Analyst**.

### Chapitre 9 — Réponse à incident

**But :** contenir, communiquer, timeline — sous pression (timer, direction).

**Objectif :** isoler sans tuer la paie ; un mauvais containment laisse une trace au dossier.

**Skills :** `incident_response`, `defense_depth`. Certificat : **Incident Responder**.

### Chapitre 10 — DFIR

**But :** preuve et récit. Comment est-il entré, qu’a-t-il touché, quoi extraire — artefacts **dans** HORIZON.

**Skills :** `forensics`, `timeline`, `ioc`. Certificat : **DFIR Analyst**.

### Chapitre 11 — Sécurité web & applicative (défense)

**But :** durcir `SRV-WEB` (auth, session, perms, headers). Pas de kit d’exploitation.

**Skills :** `http`, `auth`, `web_security`, `api_security`. Certificat : **AppSec Defender**.

### Chapitre 12 — Cloud HORIZON & DevSecOps

**But :** IAM trop large, SG `0.0.0.0/0`, secret dans Git, CI — analogue du NAT / du `/16`, dans le cloud **simulé**.

**Skills :** `cloud_iam`, `cloud_network`, `git`, `sast`, `containers`. Certificat : **Cloud Security Engineer**.

**Atelier architecture — palier 2 :** le siège + un VPC HORIZON, Zero Trust basique.

### Chapitre 13 — Ingénieur sécurité / architecture

**But :** concevoir : segmentation, IAM, défense en profondeur, Zero Trust **sur le parc déjà vécu**.

**Objectif (atelier palier 3) :** une architecture **5 étoiles** (campus, DMZ, OT/caméras en VLAN isolé, cloud, bastion) que tu configures toi-même et que le simulateur **fait vivre** (trafic, pannes, audit).

**Skills :** `seg_arch`, `zero_trust`, `iam`, `pki`. Certificat : **Security Engineer**.

### Chapitre 14 — GRC & management

**But :** risque, policy, audit, fournisseurs, arbitrage avec Marc et la direction. Moins de CLI, plus de décisions qui **restent** sur le CV du personnage.

**Skills :** `risk`, `audit`. Certificat : **GRC Practitioner**.

### Chapitre 15 — Capstone (architecte / CISO junior)

**But :** un incident qui traverse tout le parcours (réseau + AD + SOC + cloud + comms). Rapport, architecture, leçon apprise. Titre de fin : **Security Architect** / lead.

**Skills :** croisées. Certificat : **HORIZON Professional**.

La piste **Purple / audit interne** (équivalent pentester **côté défense**) s’ouvre après le ch. 11 : findings, pas d’armes.

---

## Plan de travail (étape par étape)

On ne code pas 15 chapitres d’un coup. Chaque palier = contenu jouable + smoke + README + push GitHub — comme les ch. 1–3.

| Étape | Livrable | Débloque |
| --- | --- | --- |
| **E0** | Ce document de vision (ce commit) | Alignement produit |
| **E1** | Ch. 4 Helpdesk : Windows + `ipconfig`/`netsh` + Wi-Fi/AP | Métier junior, plus seulement Linux |
| **E2** | Horloge de mission + dossier de carrière (décisions persistantes) | Pression « monde réel » |
| **E3** | Ch. 5 Systèmes + AD simulé (users/OU/GPO, pas un vrai DC attaquable) | Admin |
| **E4** | Ch. 6 Admin réseau + CLI switch/routeur/AP enrichi | Quotidien réseau |
| **E5** | **Atelier architecture palier 1** (éditeur de topologie + simu ping/ACL) | « Je construis le siège » |
| **E6** | Ch. 7 SOC L1 + app SOC branchée + timer | Porte d’entrée cyber |
| **E7** | Co-op 2 joueurs (helpdesk + SOC) + vue formateur | Travail en équipe |
| **E8** | Ch. 8–10 (L2, IR, DFIR) dans l’ordre | Analyste → DFIR |
| **E9** | Ch. 11–12 (web défense, cloud HORIZON) | Ingénieur |
| **E10** | Atelier palier 2–3 + ch. 13 architecture 5★ | Concevoir et faire tourner |
| **E11** | Ch. 14–15 GRC + capstone | Management / expert |

**Prochaine implémentation :** étape **E1** (chapitre 4 helpdesk Windows / Wi-Fi), pas le SOC, pas l’atelier 5★. L’atelier sans les compétences 4–6 serait un dessin, pas une carrière.

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

Ce que le projet **ne** veut pas devenir : un QCM déguisé, un CTF de flags, ou un simulateur d’exploits réels (Metasploit, payloads, PoC). Il veut devenir **une carrière simulée** : helpdesk → admin → SOC → IR/DFIR → ingénieur → architecte / GRC, avec de vrais CLI d’admin et un atelier d’architecture.

---

## Améliorations futures

Classées par priorité produit. Le moteur et le desktop sont déjà trop en avance sur le **contenu**.

### 1. Contenu — priorité haute

C’est le vrai chantier. Sans ça, HORIZON reste une démo du premier jour.

- **Étapes E1 → E11** du plan ci-dessus (helpdesk Windows d’abord, puis systèmes, réseau, atelier, SOC, équipe, etc.).
- Plus de **variantes** d’examens pour empêcher le par cœur.
- Scénarios **phishing / social engineering** dans Mail + Chat (déjà prévu dans le modèle de données).
- Un certificat **par palier de carrière**, puis le capstone HORIZON Professional.

### 2. Auteur de contenu

Aujourd’hui une mission = TypeScript + closures. Un formateur ne peut pas écrire un scénario sans coder.

- Extraire briefs, tâches, décisions et textes dans des fichiers de données (JSON / YAML / MDX).
- Garder le code uniquement pour les *hooks* monde (casser un DNS, stopper un service).
- Découper `i18n.ts` (déjà > 1 300 lignes) par domaine : UI, missions, théorie.
- Outil interne « mission preview » : lancer une étape sans rejouer tout le chapitre.

### 3. Monde simulé plus riche

- Hôtes **Windows** et CLI `ipconfig` / `netsh` (chapitre 4).
- Active Directory **simulé**, IAM, certificats PKI — les skills existent, le monde non encore.
- SIEM plus crédible : corrélation, fenêtres de logs, fausse piste.
- Pannes **multi-hôtes** (un DHCP down qui casse un étage, pas un PC).
- **Atelier architecture** : cliquer, câbler, configurer, simuler.
- Mode **crise** (`tense` / `crisis`) : timer, direction qui appelle, tickets qui s’empilent.

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

Tout nouveau contenu « offensif » (web, malware, purple) reste **dans la fiction HORIZON** et **côté défense / audit** :

- pas d’exploits reproductibles, pas de Metasploit, pas de payloads, pas de PoC copiables hors simu ;
- pas de maliciel exécutable ;
- l’objectif reste diagnostiquer, contenir, concevoir, expliquer — pas « casser pour le fun ».

---

## État honnête du projet

| Couche | Maturité |
| --- | --- |
| Desktop OS, fenêtres, FR/EN, save locale | Avancée |
| Moteur + terminal réseau | Solide pour les chapitres 1–3 (Linux, VLAN, FW, switch) |
| Contenu jouable | Chapitres 1–3 (lab + tickets + exams à variantes, ch. 3 = 5 missions) |
| Curriculum carrière (ch. 4–15, atelier, timer, co-op) | Vision écrite, pas encore jouable |
| SOC, certificats serveur, classe | Amorcé |
| Auth, CI, docs produit | À faire |

Le prototype est convaincant comme **début de carrière IT / réseau** (helpdesk Linux → adressage → segmentation). Ce n’est pas encore l’académie complète (Windows, AD, SOC, architecture 5★, équipe). La suite utile n’est pas « plus d’UI », c’est **le palier suivant du métier** (étape E1).

---

## Licence

Projet personnel / pédagogique, tous droits réservés pour l’instant (pas de licence open source déclarée).
