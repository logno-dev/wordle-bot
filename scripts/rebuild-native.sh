#!/bin/bash

echo "🔧 Rebuilding native dependencies..."

# Rebuild better-sqlite3 native bindings
echo "📦 Rebuilding better-sqlite3..."
pnpm rebuild better-sqlite3

# If that fails, try manual build
if [ $? -ne 0 ]; then
    echo "⚠️  Rebuild failed, trying manual build..."
    cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3
    npm run build-release
    cd - > /dev/null
fi

echo "✅ Native dependencies rebuilt successfully!"
echo "🚀 You can now run: npm run dev"