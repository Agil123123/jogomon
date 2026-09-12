# JOGO-MON Deployment Guide

## Production VPS Setup

Target: **103.20.88.83** (Ubuntu/Debian)

### Quick Deploy

```bash
ssh root@103.20.88.83
git clone git@github.com:joglonet/jogomon.git /tmp/jogomon
cd /tmp/jogomon/deploy
./deploy.sh
nano /opt/jogomon/.env  # set SEED_ADMIN_PASSWORD
systemctl restart jogomon-backend
```

### Prerequisites
- SSH root access
- Git repo access
- Domain: `jogomon.joglonet.id` (optional, IP works)