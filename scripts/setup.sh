#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# 🚀 AIPOS - Script d'installation automatique
# Pour Alex — Restaurant Management System
# ═══════════════════════════════════════════════════════════════

set -e

# Couleurs pour les messages
VERT='\033[0;32m'
BLEU='\033[0;34m'
JAUNE='\033[1;33m'
ROUGE='\033[0;31m'
GRIS='\033[0;90m'
NC='\033[0m' # Pas de couleur

echo -e "${BLEU}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLEU}║        🚀  AIPOS - Installation              ║${NC}"
echo -e "${BLEU}║     Restaurant Management System              ║${NC}"
echo -e "${BLEU}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── Étape 1 : Vérification des prérequis ─────────────────────
echo -e "${BLEU}[1/5] Vérification des prérequis...${NC}"

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo -e "${ROUGE}❌ Node.js n'est pas installé.${NC}"
    echo -e "${JAUNE}   → Télécharge-le sur https://nodejs.org (version LTS)${NC}"
    exit 1
fi
echo -e "${VERT}  ✅ Node.js $(node --version)${NC}"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    echo -e "${ROUGE}❌ npm n'est pas installé.${NC}"
    exit 1
fi
echo -e "${VERT}  ✅ npm $(npm --version)${NC}"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo -e "${ROUGE}❌ Docker n'est pas installé.${NC}"
    echo -e "${JAUNE}   → Télécharge-le sur https://www.docker.com/products/docker-desktop/${NC}"
    exit 1
fi
echo -e "${VERT}  ✅ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"

# Vérifier que Docker tourne
if ! docker info &>/dev/null; then
    echo -e "${ROUGE}❌ Docker n'est pas en cours d'exécution.${NC}"
    echo -e "${JAUNE}   → Lance Docker Desktop et réessaye.${NC}"
    exit 1
fi
echo -e "${VERT}  ✅ Docker est en fonctionnement${NC}"
echo ""

# ── Étape 2 : Installation des dépendances ───────────────────
echo -e "${BLEU}[2/5] Installation des dépendances npm...${NC}"
echo -e "${GRIS}  (Cela peut prendre 1-3 minutes)${NC}"

npm install

if [ $? -eq 0 ]; then
    echo -e "${VERT}  ✅ Dépendances installées${NC}"
else
    echo -e "${ROUGE}❌ Erreur lors de l'installation des dépendances${NC}"
    exit 1
fi
echo ""

# ── Étape 3 : Vérification du fichier .env ───────────────────
echo -e "${BLEU}[3/5] Vérification de la configuration...${NC}"

if [ ! -f ".env" ]; then
    echo -e "${JAUNE}  ⚠️  Fichier .env manquant, création à partir de .env.example${NC}"
    cp .env.example .env
fi
echo -e "${VERT}  ✅ Configuration prête${NC}"
echo ""

# ── Étape 4 : Démarrage de Supabase ──────────────────────────
echo -e "${BLEU}[4/5] Démarrage de Supabase local...${NC}"
echo -e "${GRIS}  (Premier lancement : 5-10 minutes pour télécharger les images)${NC}"
echo -e "${GRIS}  (Lancements suivants : ~30 secondes)${NC}"
echo ""

npx supabase start

if [ $? -eq 0 ]; then
    echo -e "${VERT}  ✅ Supabase est opérationnel${NC}"
else
    echo -e "${ROUGE}❌ Erreur lors du démarrage de Supabase${NC}"
    echo -e "${JAUNE}   → Vérifie que Docker est bien lancé${NC}"
    exit 1
fi
echo ""

# ── Étape 5 : Tout est prêt ──────────────────────────────────
echo -e "${BLEU}[5/5] Finalisation...${NC}"
echo ""

# Récupérer l'URL du studio
STUDIO_URL=$(npx supabase status 2>/dev/null | grep "Studio" | awk '{print $2}')

echo -e "${VERT}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${VERT}║         ✅  INSTALLATION RÉUSSIE !           ║${NC}"
echo -e "${VERT}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  📋 ${BLEU}Résumé :${NC}"
echo ""
echo -e "  📁  ${GRIS}Dossier :${NC} $(pwd)"
echo -e "  🖥️   ${GRIS}App :${NC}      http://localhost:8080"
echo -e "  🗄️   ${GRIS}Studio :${NC}   ${STUDIO_URL:-http://localhost:54324}"
echo ""
echo -e "  🔑 ${BLEU}Connexion :${NC}"
echo -e "  ─────────────────────────────────────────────"
echo -e "  Email    :  ${JAUNE}Alex@admin.com${NC}"
echo -e "  Password :  ${JAUNE}Ammimmer27${NC}"
echo -e "  PIN      :  ${JAUNE}1201${NC}"
echo ""
echo -e "  🚀 ${BLEU}Pour lancer l'application :${NC}"
echo -e "  ─────────────────────────────────────────────"
echo -e "  ${GRIS}npm run dev${NC}"
echo ""
echo -e "  🌐 ${BLEU}Puis ouvre :${NC} ${JAUNE}http://localhost:8080${NC}"
echo ""
echo -e "${JAUNE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${JAUNE}║  💡  Astuce :                               ║${NC}"
echo -e "${JAUNE}║  Pour arrêter Supabase : npx supabase stop  ║${NC}"
echo -e "${JAUNE}║  Studio admin : ${STUDIO_URL:-http://localhost:54324}  ║${NC}"
echo -e "${JAUNE}╚═══════════════════════════════════════════════╝${NC}"
echo ""
