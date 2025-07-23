# Production QR Code Troubleshooting Guide

## Common Issues and Solutions

### 1. QR Code Not Registering in Production

**Symptoms:**
- QR code displays in browser but WhatsApp doesn't recognize it
- "Invalid QR code" error when scanning
- QR code works locally but not in production

**Causes & Solutions:**

#### A. Session Directory Permissions
```bash
# Check if session directory exists and has correct permissions
docker exec -it <container_name> ls -la /app/wordle-tracker-bot_sessions
docker exec -it <container_name> chown -R nodejs:nodejs /app/wordle-tracker-bot_sessions
```

#### B. Docker Volume Mounting Issues
```bash
# Ensure volume is properly mounted
docker-compose down
docker volume rm wa-bot_sessions  # If exists
docker-compose up --build
```

#### C. Network/Firewall Issues
- Ensure port 3001 (or your WEB_PORT) is accessible
- Check if your server's firewall allows the port
- Verify Docker port mapping is correct

#### D. Browser User-Agent Issues
- WhatsApp may reject QR codes from certain browsers
- Try different browsers (Chrome, Firefox, Safari)
- Use incognito/private mode

### 2. Environment-Specific Configuration

**Production Environment Variables:**
```bash
NODE_ENV=production
WEB_PORT=3001
DATABASE_URL=your_database_url
DATABASE_AUTH_TOKEN=your_token
```

### 3. Session Persistence Issues

**Check Session Files:**
```bash
# List session files
docker exec -it <container_name> ls -la /app/wordle-tracker-bot_sessions

# If no files exist, the session isn't being saved
# Check volume mounting in docker-compose.yml
```

### 4. Debugging Steps

#### Step 1: Check Container Logs
```bash
docker-compose logs -f wa-bot
```

#### Step 2: Check Web Interface
```bash
curl http://localhost:3001/status
```

#### Step 3: Verify QR Code Generation
```bash
# Should show QR code data
curl http://localhost:3001/status | jq '.hasQR'
```

#### Step 4: Test Different Browsers
- Chrome (recommended)
- Firefox
- Safari
- Mobile browsers

### 5. Production-Specific Fixes

#### A. Clear All Sessions and Restart
```bash
docker-compose down
docker volume rm $(docker volume ls -q | grep wa-bot)
rm -rf ./wordle-tracker-bot_sessions/*
docker-compose up --build
```

#### B. Force Fresh QR Code
- Wait for QR timeout (60 seconds)
- Refresh browser page manually
- Check for new QR code generation

#### C. Check WhatsApp Web Limits
- Ensure no other WhatsApp Web sessions are active
- Log out from all WhatsApp Web sessions
- Try from different IP address if possible

### 6. Alternative Solutions

#### A. Use Different Device
- Try scanning with different phone
- Ensure WhatsApp is updated on the phone

#### B. Network Troubleshooting
```bash
# Test from inside container
docker exec -it <container_name> wget -O- http://localhost:3001/status

# Test external access
curl http://your-server-ip:3001/status
```

### 7. When All Else Fails

#### A. Enable Debug Mode
Set environment variable:
```bash
NODE_ENV=development
```

#### B. Manual Session Transfer
If you have a working local session:
```bash
# Copy local session to production
scp -r ./wordle-tracker-bot_sessions/* user@server:/path/to/production/sessions/
```

#### C. Contact Support
Provide these details:
- Container logs
- Browser console errors
- Network configuration
- Docker version
- Operating system

## Prevention Tips

1. **Regular Backups**: Backup session files regularly
2. **Monitor Logs**: Set up log monitoring for early issue detection
3. **Health Checks**: Implement health check endpoints
4. **Staging Environment**: Test in staging before production deployment

## Quick Commands Reference

```bash
# Restart everything fresh
docker-compose down && docker-compose up --build

# Check status
curl http://localhost:3001/status

# View logs
docker-compose logs -f

# Access container shell
docker exec -it wa-bot_container_name sh

# Clear sessions
rm -rf ./wordle-tracker-bot_sessions/*
```