#!/bin/bash
# === TTN SFTP Relay — Installation sur VPS (Ubuntu/Debian) ===
set -e

echo "=== Installation TTN SFTP Relay ==="

# Node.js 20
if ! command -v node &> /dev/null; then
  echo "Installation Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# PM2
if ! command -v pm2 &> /dev/null; then
  echo "Installation PM2..."
  sudo npm install -g pm2
fi

# Dependencies
echo "Installation dépendances..."
cd "$(dirname "$0")"
npm install

# .env
if [ ! -f .env ]; then
  echo "Création .env..."
  cat > .env << 'ENVEOF'
PORT=3000
SFTP_HOST=
SFTP_PORT=22
SFTP_USER=
SFTP_PASS=
SFTP_PATH=/invoices
TTN_POLL_INTERVAL=5000
TTN_POLL_RETRIES=12
AUTH_TOKEN=
ENVEOF
  echo "⚠️  Éditez .env avec vos identifiants SFTP TTN"
fi

echo "=== Installation terminée ==="
echo ""
echo "Pour configurer :"
echo "  nano $(dirname "$0")/.env"
echo ""
echo "Pour démarrer :"
echo "  pm2 start server.js --name ttn-relay"
echo "  pm2 save"
echo "  pm2 startup"
echo ""
echo "Pour voir les logs :"
echo "  pm2 logs ttn-relay"