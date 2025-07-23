# Production Deployment Guide

## Docker Configuration Updates

The Docker configuration has been updated for the new Baileys-based bot:

### Key Changes Made:

1. **Updated Dockerfile**:
   - Runs TypeScript directly with `bun --env-file=.env src/app.ts`
   - Proper session directory: `wordle-tracker-bot_sessions`
   - No build step needed (runs TS directly)

2. **Updated docker-compose.yml**:
   - Correct session volume mapping
   - Added `stdin_open: true` and `tty: true` for QR code display
   - Removed unused environment variables

3. **Updated package.json**:
   - Start script now runs the source TypeScript file directly

## Deployment Steps

### 1. Environment Setup

Ensure your `.env` file contains:
```bash
# Database Configuration
DATABASE_URL=libsql://your-database-url.turso.io
DATABASE_AUTH_TOKEN=your-auth-token

# Bot Configuration
BOT_NAME=wordle-tracker-bot
PORT=3008
```

### 2. Build and Run

```bash
# Build the Docker image
docker-compose build

# Run the container
docker-compose up -d
```

### 3. Initial Setup (QR Code Scanning)

For the first deployment, you'll need to scan the QR code:

```bash
# View logs to see the QR code
docker-compose logs -f wa-bot
```

The QR code will be displayed in the terminal. Scan it with WhatsApp to authenticate.

### 4. Session Persistence

The WhatsApp session is stored in `./wordle-tracker-bot_sessions/` and mounted as a volume, so the bot won't need re-authentication after restarts.

## Production Considerations

### 1. Session Management
- The `wordle-tracker-bot_sessions` directory contains authentication data
- **Backup this directory** to avoid re-authentication
- Ensure proper file permissions in production

### 2. Database Connection
- Uses Turso (libsql) for production database
- Connection is established automatically on startup
- Database migrations run automatically

### 3. Monitoring
- Bot logs all message processing activities
- Monitor logs for connection issues or errors
- Restart policy is set to `unless-stopped`

### 4. Security
- Environment variables are loaded from `.env` file
- Session data is persisted in volumes
- No sensitive data in Docker images

## Troubleshooting

### Connection Issues
If you see "Stream Errored (conflict)":
1. Check if another WhatsApp Web session is active
2. Clear the session directory: `rm -rf ./wordle-tracker-bot_sessions`
3. Restart the container and scan QR code again

### Database Issues
- Verify `DATABASE_URL` and `DATABASE_AUTH_TOKEN` are correct
- Check network connectivity to Turso
- Database migrations run automatically on startup

### Message Processing
- Bot processes both individual and group messages
- Includes messages from the host phone number
- Filters out bot's own responses to prevent loops

## Commands

```bash
# Start the bot
docker-compose up -d

# View logs
docker-compose logs -f wa-bot

# Restart the bot
docker-compose restart wa-bot

# Stop the bot
docker-compose down

# Rebuild and restart
docker-compose up -d --build
```

## Features in Production

✅ **Group Message Support** - Processes messages from all group members  
✅ **Host Message Processing** - Includes messages from the bot's phone number  
✅ **Database Persistence** - Stores data in Turso database  
✅ **Session Persistence** - Maintains WhatsApp authentication  
✅ **Automatic Reconnection** - Handles connection drops gracefully  
✅ **Command Support** - Responds to !stats, !mystats, !help commands  
✅ **Wordle Tracking** - Automatically detects and saves Wordle scores  

The bot is now ready for production deployment with full group message support!