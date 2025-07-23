#!/bin/bash

# Production QR Code Fix Script
# This script helps troubleshoot and fix QR code connection issues in production

echo "🔧 WhatsApp Bot Production QR Code Fix Script"
echo "=============================================="

# Configuration
CONTAINER_NAME="wa-bot"
WEB_PORT=${WEB_PORT:-3001}
SERVER_URL="http://localhost:$WEB_PORT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if container is running
check_container() {
    print_status "Checking if container is running..."
    if docker ps | grep -q "$CONTAINER_NAME"; then
        print_success "Container is running"
        return 0
    else
        print_error "Container is not running"
        return 1
    fi
}

# Function to check web server
check_web_server() {
    print_status "Checking web server accessibility..."
    if curl -s "$SERVER_URL/health" > /dev/null; then
        print_success "Web server is accessible"
        return 0
    else
        print_error "Web server is not accessible at $SERVER_URL"
        return 1
    fi
}

# Function to get current status
get_status() {
    print_status "Getting current bot status..."
    STATUS=$(curl -s "$SERVER_URL/status" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$STATUS" | jq '.' 2>/dev/null || echo "$STATUS"
    else
        print_error "Could not get status"
    fi
}

# Function to refresh QR code
refresh_qr() {
    print_status "Refreshing QR code..."
    RESPONSE=$(curl -s -X POST "$SERVER_URL/refresh-qr" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
        print_success "QR refresh request sent"
    else
        print_error "Could not refresh QR code"
    fi
}

# Function to check session files
check_sessions() {
    print_status "Checking session files..."
    if check_container; then
        docker exec "$CONTAINER_NAME" ls -la /app/wordle-tracker-bot_sessions/ 2>/dev/null || {
            print_warning "Could not access session directory"
        }
    fi
}

# Function to clear sessions
clear_sessions() {
    print_warning "This will clear all session files and force re-authentication"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Clearing session files..."
        
        # Stop container
        docker-compose down
        
        # Clear local sessions
        rm -rf ./wordle-tracker-bot_sessions/*
        
        # Clear docker volume if it exists
        docker volume rm $(docker volume ls -q | grep wa-bot) 2>/dev/null || true
        
        # Restart
        docker-compose up -d --build
        
        print_success "Sessions cleared and container restarted"
        print_status "Wait 10 seconds for startup..."
        sleep 10
    else
        print_status "Session clear cancelled"
    fi
}

# Function to show logs
show_logs() {
    print_status "Showing recent logs..."
    docker-compose logs --tail=50 -f
}

# Function to run full diagnostic
run_diagnostic() {
    echo
    print_status "Running full diagnostic..."
    echo "================================"
    
    # Check container
    if ! check_container; then
        print_error "Container not running. Starting..."
        docker-compose up -d
        sleep 10
    fi
    
    # Check web server
    check_web_server
    
    # Get status
    echo
    print_status "Current Status:"
    get_status
    
    # Check sessions
    echo
    check_sessions
    
    echo
    print_status "Diagnostic complete"
}

# Function to show help
show_help() {
    echo "Usage: $0 [OPTION]"
    echo
    echo "Options:"
    echo "  status      - Show current bot status"
    echo "  refresh     - Refresh QR code"
    echo "  sessions    - Check session files"
    echo "  clear       - Clear all sessions (requires confirmation)"
    echo "  logs        - Show container logs"
    echo "  diagnostic  - Run full diagnostic"
    echo "  help        - Show this help message"
    echo
    echo "Environment Variables:"
    echo "  WEB_PORT    - Web server port (default: 3001)"
    echo
    echo "Examples:"
    echo "  $0 diagnostic    # Run full diagnostic"
    echo "  $0 refresh       # Refresh QR code"
    echo "  $0 clear         # Clear sessions and restart"
}

# Main script logic
case "${1:-diagnostic}" in
    "status")
        get_status
        ;;
    "refresh")
        refresh_qr
        ;;
    "sessions")
        check_sessions
        ;;
    "clear")
        clear_sessions
        ;;
    "logs")
        show_logs
        ;;
    "diagnostic")
        run_diagnostic
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        print_error "Unknown option: $1"
        show_help
        exit 1
        ;;
esac

echo
print_status "Done! For more help, run: $0 help"