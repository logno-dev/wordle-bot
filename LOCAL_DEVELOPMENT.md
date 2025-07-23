# Local Development Guide

This guide explains how to run the WhatsApp Wordle Tracker Bot locally, both natively and in Docker.

## 🚨 **Important: WhatsApp QR Code Authentication Issues**

WhatsApp Web has strict requirements for QR code authentication that affect how you can run this bot:

### ✅ **What Works:**
- **Native local development**: `bun --env-file=.env src/app.ts`
- **Production deployment**: Docker containers on remote servers

### ❌ **What Doesn't Work:**
- **Local Docker containers**: Even with optimized configurations, WhatsApp often rejects QR codes from local Docker environments

## 🛠 **Recommended Development Workflow**

### Option 1: Native Development (Recommended)
```bash
# Install dependencies
bun install

# Run locally (this works reliably)
bun --env-file=.env src/app.ts
```

### Option 2: Docker Development (Limited)
```bash
# Build and run in Docker (may have QR authentication issues)
docker-compose up --build

# If QR authentication fails, fall back to native development
```

## 🔧 **Environment Configuration**

The bot automatically detects its environment and adjusts WhatsApp settings:

### Native Development
- **Browser**: macOS Safari (most compatible with local development)
- **QR Timeout**: 90 seconds
- **Terminal QR**: Enabled

### Docker Development  
- **Browser**: Chrome on Linux (optimized for containers)
- **QR Timeout**: 90 seconds
- **Terminal QR**: Enabled

### Production
- **Browser**: Ubuntu (server-optimized)
- **QR Timeout**: 60 seconds
- **Terminal QR**: Disabled

## 📱 **QR Code Access**

When running the bot, access the QR code at:
- **Web Interface**: http://localhost:3001
- **Status API**: http://localhost:3001/status
- **Manual Refresh**: `curl -X POST http://localhost:3001/refresh-qr`

## 🐛 **Troubleshooting**

### QR Code Won't Authenticate
1. **Try native development first**: `bun --env-file=.env src/app.ts`
2. **Clear WhatsApp cache**: Delete `wordle-tracker-bot_sessions/` folder
3. **Use manual refresh**: `curl -X POST http://localhost:3001/refresh-qr`
4. **Check browser compatibility**: Different browsers may work better

### Docker Issues
```bash
# Check container logs
docker-compose logs -f wa-bot

# Restart with fresh session
docker-compose down
rm -rf wordle-tracker-bot_sessions/
docker-compose up --build

# Run diagnostics
./production-qr-fix.sh diagnostic
```

### Environment Variables
Make sure your `.env` file contains:
```env
# Database configuration
DATABASE_URL=your_database_url
DATABASE_AUTH_TOKEN=your_auth_token

# Development settings
NODE_ENV=development
WEB_PORT=3001
BOT_NAME=wordle-tracker-bot

# Docker detection (automatically set in docker-compose.yml)
DOCKER_CONTAINER=true
```

## 🚀 **Production Deployment**

For production deployment, the bot uses optimized settings that work better with server environments. See `PRODUCTION_TROUBLESHOOTING.md` for production-specific guidance.

## 💡 **Why This Happens**

WhatsApp Web implements security measures that detect and block certain environments:

1. **Container Detection**: WhatsApp can detect Docker containers and may reject them
2. **Browser Fingerprinting**: Different browser configurations have different success rates
3. **Network Environment**: Local vs remote network conditions affect authentication
4. **Session Persistence**: Container restarts can interfere with session management

The native development approach bypasses these issues by running directly on your host machine with your actual browser environment.