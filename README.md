# 🏪 AIPOS — Restaurant Management System

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-Private-red)

> **Bonjour Alex !** 👋  
> Ce projet est un système de gestion de restaurant complet (POS, réservations, cuisine, marketing, analytics).  
> Tout fonctionne **100% en local** — pas besoin d'abonnement cloud, ni de connexion Internet une fois installé.

---

## 📋 Table des matières

- [Prérequis](#-prérequis)
- [Installation étape par étape](#-installation-étape-par-étape)
- [Première connexion](#-première-connexion)
- [Fonctionnalités](#-fonctionnalités)
- [Architecture technique](#-architecture-technique)
- [Dépannage](#-dépannage)
- [Structure du projet](#-structure-du-projet)

---

## 🛠️ Prérequis

Avant de commencer, installe ces 2 logiciels **gratuits** sur ton ordinateur :

### 1. Node.js (v18 ou plus récent)

```bash
# Télécharge depuis : https://nodejs.org/ (version LTS recommandée)
# Vérifie l'installation :
node --version   # Doit afficher v18.x.x ou plus
npm --version    # Doit afficher 10.x.x ou plus
```

### 2. Docker Desktop (gratuit)

```bash
# Télécharge depuis : https://www.docker.com/products/docker-desktop/
# Vérifie l'installation :
docker --version   # Doit afficher 24.x.x ou plus
```

> ⚠️ **Important** : Docker doit être **en cours d'exécution** (l'icône Docker dans la barre des tâches doit être active).

---

## 🚀 Installation étape par étape

### Étape 1 : Télécharger le projet

**Option A — Avec Git (recommandé)**

```bash
git clone <url-du-repo>
cd aipos
```

**Option B — Sans Git (zip)**

1. Télécharge le zip depuis GitHub
2. Extrais le dossier
3. Ouvre un terminal dans le dossier extrait

### Étape 2 : Installer les dépendances

```bash
npm install
```

⏳ Cette étape prend **1 à 3 minutes** selon ta connexion.

### Étape 3 : Configurer l'environnement

Le fichier `.env` est déjà préconfiguré pour fonctionner en local.  
Vérifie qu'il contient :

```env
VITE_SUPABASE_URL="http://127.0.0.1:54321"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_PROJECT_ID="local"
```

### Étape 4 : Démarrer la base de données (Supabase Local)

```bash
npx supabase start
```

⏳ **Premier lancement uniquement** : télécharge les images Docker (~5-10 minutes selon connexion).  
Les lancements suivants seront instantanés (~30 secondes).

Tu devrais voir :

```
supabase local development setup is running.
  ┌──────────────────────────────────────────┐
  │  Studio  │ http://127.0.0.1:54324       │
  │  API URL │ http://127.0.0.1:54321       │
  └──────────────────────────────────────────┘
```

> ✅ **518 migrations** seront automatiquement appliquées, créant les **98 tables** nécessaires.

### Étape 5 : Lancer l'application

```bash
npm run dev
```

Ouvre ton navigateur sur : **http://localhost:8080** 🎉

---

## 🔑 Première connexion

| Méthode | Identifiant |
|---------|-------------|
| **Email** | `Alex@admin.com` |
| **Mot de passe** | `Ammimmer27` |
| **Code PIN** | `1201` |

### Déroulement de la première connexion

1. Ouvre **http://localhost:8080**
2. Connecte-toi avec `Alex@admin.com` / `Ammimmer27`
3. Le **Setup Wizard** t'accompagne pour configurer tables et menu
4. Choisis l'emplacement de l'appareil (**Bar** pour le POS, **Floor** pour les réservations, **Kitchen** pour la cuisine)
5. C'est prêt ! 🚀

---

## ✨ Fonctionnalités

### 🏪 POS (Point de Vente)
- Prise de commandes rapide
- Paiements (espèces, carte, ticket restaurant)
- Gestion des tables
- Écran "Bar" avec timeout standard

### 📅 Réservations
- Timeline visuelle
- Assignation intelligente des tables
- Détection de conflits (double booking)
- Gestion des groupes de tables

### 👥 Clients (CRM)
- Fiches clients avec historique
- Segmentation
- Statistiques de visites

### 🍳 Cuisine
- Vue des commandes en temps réel
- Statuts : envoyé → en préparation → prêt
- Écran toujours allumé (pas de timeout)

### 📊 Analytics
- Chiffre d'affaires quotidien
- Statistiques de réservations
- Performance des serveurs

### 🎯 Marketing Hub
- Campagnes automatisées
- Connexion Instagram / Facebook
- Brand Kit personnalisable
- Création de posts via IA

### 🚚 Livraison
- Gestion des commandes de livraison
- Suivi des fournisseurs
- Gestion des stocks et inventaire

### ⚙️ Administration
- Gestion des employés avec codes PIN
- Permissions par niveau d'accès
- Paramètres de l'entreprise
- Intégrations tierces (27 connecteurs)
- Horaires d'ouverture
- Configuration des appareils

---

## 🏗️ Architecture technique

```
┌─────────────────────────────────────────────────┐
│            Application React (Vite)              │
│  http://localhost:8080                           │
├─────────────────────────────────────────────────┤
│              Supabase Local Auto-Hébergé          │
├──────────────┬──────────────────────────────────┤
│  PostgreSQL  │  Edge Functions (63)             │
│  (98 tables) │  API REST + Realtime             │
│  Port 54322  │  Port 54321                      │
├──────────────┴──────────────────────────────────┤
│              Docker Desktop                      │
│  12 conteneurs (DB, Auth, Storage, Realtime...) │
└─────────────────────────────────────────────────┘
```

### Ports utilisés

| Port | Service | URL |
|------|---------|-----|
| **8080** | Application | http://localhost:8080 |
| 54321 | API Supabase | http://localhost:54321 |
| 54322 | PostgreSQL direct | postgresql://postgres:postgres@localhost:54322 |
| 54324 | Supabase Studio | http://localhost:54324 |

---

## ❓ Dépannage

### Le serveur ne démarre pas
```bash
# Vérifie que Docker est en cours d'exécution
docker ps

# Si pas de conteneurs, relance Supabase
npx supabase start
```

### Port déjà utilisé
```bash
# Vérifie ce qui écoute sur le port 8080
lsof -i :8080

# Tue le processus si nécessaire
kill -9 <PID>

# Relance
npm run dev
```

### Erreur "relation does not exist"
```bash
# Les migrations n'ont pas été appliquées
npx supabase db reset
```

### L'application est lente
```bash
# Met à jour les données navigateur
npx update-browserslist-db@latest
```

### Réinitialiser complètement
```bash
# Supprime tout et recommence
npx supabase stop --no-backup
npx supabase start
npm run dev
```

---

## 📁 Structure du projet

```
aipos/
├── src/                    # Code source React
│   ├── components/         # Composants UI
│   ├── hooks/              # Hooks React
│   ├── pages/              # Pages de l'application
│   ├── services/           # Services métier
│   ├── utils/              # Utilitaires
│   └── config/             # Configuration
├── supabase/
│   ├── migrations/         # 518 fichiers SQL (schéma DB)
│   ├── functions/          # 63 Edge Functions
│   └── config.toml         # Configuration Supabase
├── .env                    # Variables d'environnement (local)
├── .env.example            # Exemple de configuration
└── package.json            # Dépendances et scripts
```

---

## 📖 Commandes utiles

```bash
# Démarrer l'application
npm run dev

# Démarrer Supabase local
npx supabase start

# Voir le statut Supabase
npx supabase status

# Arrêter Supabase
npx supabase stop

# Réinitialiser la base de données
npx supabase db reset

# Accéder au studio d'administration
# → http://localhost:54324

# Builder l'application pour production
npm run build
```

---

## 🔒 Licence

Projet privé — Tous droits réservés.

---

*Documentation générée le $(date +"%d %B %Y") — Pour Alex, avec ❤️*
