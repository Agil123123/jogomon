#!/bin/bash
# JOGO-MON Production Deployment Script
# Target: VPS Ubuntu/Debian
# Run as root: ./deploy.sh

set -e

APP_DIR="/opt/jogomon"
APP_USER="jogomon"
REPO_URL="https://github.com/Agil123123/jogomon.git"
BRANCH="main"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD before running deploy.sh}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:?Set SEED_ADMIN_PASSWORD before running deploy.sh}"
PUBLIC_API_URL="${PUBLIC_API_URL:?Set PUBLIC_API_URL before running deploy.sh}"
CORS_ORIGINS="${CORS_ORIGINS:?Set CORS_ORIGINS before running deploy.sh}"

auto_db_password="${DB_PASSWORD//\\/\\\\}"
auto_db_password="${auto_db_password//\'/\'\'}"
export DB_PASSWORD SEED_ADMIN_PASSWORD

echo "=== JOGO-MON Production Deployment ==="
echo ""

# --- 1. Install system dependencies ---
echo "[1/8] Installing system dependencies..."
apt-get update
apt-get install -y \
    python3 python3-venv python3-pip \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    git \
    curl \
    build-essential \
    libpq-dev

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# --- 2. Create app user ---
echo "[2/8] Creating app user..."
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --create-home --shell /bin/bash "$APP_USER"
    echo "User $APP_USER created"
else
    echo "User $APP_USER already exists"
fi

# --- 3. Clone/update repository ---
echo "[3/8] Setting up application directory..."
if [ ! -d "$APP_DIR/.git" ]; then
    rm -rf "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
    cd "$APP_DIR"
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
    git pull --ff-only origin "$BRANCH"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# --- 4. Setup PostgreSQL ---
echo "[4/8] Configuring PostgreSQL..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -v db_password="$auto_db_password" <<'SQL'
SELECT format('CREATE ROLE fams LOGIN PASSWORD %L', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'fams')\gexec
SELECT format('ALTER ROLE fams LOGIN PASSWORD %L', :'db_password')
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'fams')\gexec
SELECT 'CREATE DATABASE olt_monitoring OWNER fams'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'olt_monitoring')\gexec
GRANT ALL PRIVILEGES ON DATABASE olt_monitoring TO fams;
SQL

# --- 5. Setup Redis ---
echo "[5/8] Configuring Redis..."
systemctl enable redis-server
systemctl start redis-server

# --- 6. Setup backend ---
echo "[6/8] Setting up backend..."
cd "$APP_DIR/backend"
sudo -u "$APP_USER" python3 -m venv .venv
sudo -u "$APP_USER" .venv/bin/pip install --upgrade pip
sudo -u "$APP_USER" .venv/bin/pip install -r requirements.txt

# Create production .env if not exists
if [ ! -f "$APP_DIR/.env" ]; then
    echo "Creating production .env from example..."
    cp "$APP_DIR/backend/.env.example" "$APP_DIR/.env"
    
    # Generate secrets
    SECRET_KEY=$(sudo -u "$APP_USER" .venv/bin/python -c "import secrets; print(secrets.token_urlsafe(48))")
    CREDENTIAL_KEY=$(sudo -u "$APP_USER" .venv/bin/python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
    
    sed -i "s|SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" "$APP_DIR/.env"
    sed -i "s|CREDENTIAL_KEY=.*|CREDENTIAL_KEY=$CREDENTIAL_KEY|" "$APP_DIR/.env"
    sed -i "s|CORS_ORIGINS=.*|CORS_ORIGINS=$CORS_ORIGINS|" "$APP_DIR/.env"
    sed -i "s|POLLING_ENABLED=.*|POLLING_ENABLED=true|" "$APP_DIR/.env"
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql+asyncpg://fams:$auto_db_password@localhost:5432/olt_monitoring|" "$APP_DIR/.env"
    sed -i "s|SEED_ADMIN_PASSWORD=.*|SEED_ADMIN_PASSWORD=$SEED_ADMIN_PASSWORD|" "$APP_DIR/.env"
fi

chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# Keep existing production secrets on redeploy; fail if required values are absent.
grep -q '^SEED_ADMIN_PASSWORD=.' "$APP_DIR/.env" || { echo "SEED_ADMIN_PASSWORD missing in $APP_DIR/.env" >&2; exit 1; }

# Run migrations
sudo -u "$APP_USER" .venv/bin/alembic upgrade head

# --- 7. Setup frontend ---
echo "[7/8] Setting up frontend..."
cd "$APP_DIR/frontend"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" env NEXT_PUBLIC_API_URL="$PUBLIC_API_URL" npm run build

# --- 8. Setup systemd services ---
echo "[8/8] Installing systemd services..."
cp "$APP_DIR/deploy/systemd/jogomon-backend.service" /etc/systemd/system/
cp "$APP_DIR/deploy/systemd/jogomon-frontend.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable jogomon-backend
systemctl enable jogomon-frontend
systemctl start jogomon-backend
systemctl start jogomon-frontend

# --- 9. Setup nginx ---
echo "Configuring nginx..."
cp "$APP_DIR/deploy/nginx/jogomon.conf" /etc/nginx/sites-available/jogomon
ln -sf /etc/nginx/sites-available/jogomon /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "✅ Backend:  http://103.20.88.83:8100/health"
echo "✅ Frontend: http://103.20.88.83"
echo "✅ API:      http://103.20.88.83/api"
echo ""
echo "Next steps:"
echo "1. Edit /opt/jogomon/.env and set SEED_ADMIN_PASSWORD"
echo "2. Restart backend: systemctl restart jogomon-backend"
echo "3. Login at http://103.20.88.83/login (admin / your-password)"
echo "4. Add OLT devices via Settings → Provision OLT"
echo ""
echo "View logs:"
echo "  journalctl -u jogomon-backend -f"
echo "  journalctl -u jogomon-frontend -f"
echo ""