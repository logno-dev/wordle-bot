# Wordle Score Tracking Setup

This bot now tracks Wordle scores automatically when users send messages starting with "Wordle".

## Features

- Automatically parses Wordle messages like "Wordle 1,495 6/6..."
- Stores: sender name, game number, attempts, and date
- **Stats & Leaderboard**: `!stats` command shows rankings and statistics
- **Personal Stats**: `!mystats` command shows individual performance
- Uses SQLite database with Drizzle ORM
- Persists data between Docker runs
- Fully configurable via environment variables

## Database Schema

```sql
CREATE TABLE wordle_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_name TEXT NOT NULL,
  game_number INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT 'CURRENT_TIMESTAMP'
);
```

## Setup

1. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

2. **Development:**
   ```bash
   npm run dev
   ```

3. **Production with Docker:**
   ```bash
   docker-compose up -d
   ```

4. **Database Commands:**
   ```bash
   npm run db:generate  # Generate new migrations
   npm run db:migrate   # Apply migrations
   ```

## Configuration

The bot is fully configurable via environment variables in `.env`:

### Authentication Options
- **QR Code (Default)**: Set `USE_PAIRING_CODE=false`
- **Pairing Code**: Set `USE_PAIRING_CODE=true` and `PHONE_NUMBER=+1234567890`

### Key Settings
- `BOT_NAME`: Bot identifier (default: wordle-tracker-bot)
- `PORT`: Server port (default: 3008)
- `GROUPS_IGNORE`: Process group messages (default: false)
- `TIME_RELEASE`: Session cleanup interval in ms (default: 6 hours)
- `DATABASE_PATH`: SQLite database location (default: ./data/wordle.db)

See `.env.example` for all available options.

## Message Format

The bot recognizes messages like:
- "Wordle 1,495 6/6 ⬛⬛🟨⬛⬛..."
- "Wordle 1495 3/6 🟩🟩🟩🟩🟩..."

It extracts:
- Game number: 1,495 → 1495
- Attempts: 6/6 → 6 (the number before the slash)
- Sender name: From WhatsApp contact name or phone number
- Date: Current date when message is received

## Bot Commands

### `!stats`
Shows the complete leaderboard with:
- 🏆 Player rankings (based on games played × (7 - average score))
- 📊 Overall statistics (total players, games, averages)
- 📈 Recent activity (games this week)
- 🥇🥈🥉 Top 3 players with medals

### `!mystats`
Shows personal statistics including:
- 🏆 Your current rank
- 🎯 Total games played
- ⭐ Average score
- 🏅 Best score
- 📊 Success rate
- 💪 Performance feedback

### Sample Commands for Testing
```bash
# Add sample data for testing
npm run db:sample

# Test the stats (after adding sample data)
# Send "!stats" in WhatsApp
# Send "!mystats" in WhatsApp
```

## Docker Persistence

The `docker-compose.yml` file includes volume mounts for:
- `./data:/app/data` - SQLite database storage
- `./bot_sessions:/app/bot_sessions` - WhatsApp session data

This ensures your Wordle scores and bot session persist between container restarts.

## Troubleshooting

### Native Dependencies Issue
If you encounter errors about missing `better_sqlite3.node` bindings:

```bash
# Option 1: Use the rebuild script
npm run rebuild:native

# Option 2: Manual rebuild
pnpm rebuild better-sqlite3

# Option 3: Reinstall with build scripts
pnpm remove better-sqlite3
pnpm add better-sqlite3 --ignore-scripts=false
```

### First Time Setup
1. Copy environment template: `cp .env.example .env`
2. Run development server: `npm run dev`
3. Scan QR code with WhatsApp
4. Send a test Wordle message to verify tracking

### Authentication Options
- **QR Code**: Default method, scan with WhatsApp
- **Pairing Code**: Set `USE_PAIRING_CODE=true` and `PHONE_NUMBER=+1234567890` in `.env`