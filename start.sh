#!/bin/bash
# ═══════════════════════════════════════════════════
#  🚀 OrderGenieSolution — START COMMAND
#  Une seule commande pour tout lancer
# ═══════════════════════════════════════════════════

set -e

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║    🚀  OrderGenieSolution                ║"
echo "║    Démarrage automatique...               ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# 1. Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé."
    echo "   → https://docs.docker.com/engine/install/ubuntu/"
    exit 1
fi

# 2. Vérifier npm
if ! command -v npm &> /dev/null; then
    echo "❌ Node.js n'est pas installé."
    echo "   → https://nodejs.org (version LTS)"
    exit 1
fi

# 3. Installer les dépendances si besoin
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install --legacy-peer-deps
fi

# 4. Démarrer Supabase
echo "🗄️  Démarrage de Supabase..."
npx supabase start 2>/dev/null || true

# 5. Initialiser la base de données (si première fois)
echo "⚙️  Initialisation de la base de données..."
bash scripts/init_db.sh 2>/dev/null || true

# 6. Lancer l'application
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  ✅  Prêt !                              ║"
echo "║  Ouvre http://localhost:8080              ║"
echo "║                                          ║"
echo "║  Email : Alex@admin.com                  ║"
echo "║  Mot de passe : Ammimmer27               ║"
echo "║  PIN : 1201                              ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "Appuie sur Ctrl+C pour tout arrêter."
echo ""

npm run dev
