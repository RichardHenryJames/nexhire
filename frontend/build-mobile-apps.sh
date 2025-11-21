#!/bin/bash

# RefOpen Mobile App Build Script
# This script automates the process of building Android and iOS apps

set -e  # Exit on error

echo "?? RefOpen Mobile App Builder"
echo "=============================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the frontend directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}? Error: Must be run from the frontend directory${NC}"
    echo "Run: cd frontend && ./build-mobile-apps.sh"
  exit 1
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "?? Checking prerequisites..."

if ! command_exists node; then
    echo -e "${RED}? Node.js is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}? Node.js installed: $(node --version)${NC}"

if ! command_exists npm; then
    echo -e "${RED}? npm is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}? npm installed: $(npm --version)${NC}"

# Check if EAS CLI is installed
if ! command_exists eas; then
    echo -e "${YELLOW}??  EAS CLI not found. Installing...${NC}"
    npm install -g eas-cli
    echo -e "${GREEN}? EAS CLI installed${NC}"
else
    echo -e "${GREEN}? EAS CLI installed: $(eas --version)${NC}"
fi

echo ""
echo "?? What would you like to build?"
echo "1) Android APK (Preview)"
echo "2) iOS App (Preview)"
echo "3) Both (Android + iOS)"
echo "4) Production Android"
echo "5) Production iOS"
echo "6) Exit"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
  echo ""
        echo "?? Building Android APK (Preview)..."
  eas build --platform android --profile preview
        echo -e "${GREEN}? Android APK build complete!${NC}"
        ;;
    2)
        echo ""
echo "?? Building iOS App (Preview)..."
        eas build --platform ios --profile preview
        echo -e "${GREEN}? iOS build complete!${NC}"
        ;;
    3)
    echo ""
echo "?? Building both platforms..."
  eas build --platform all --profile preview
        echo -e "${GREEN}? Both builds complete!${NC}"
        ;;
    4)
        echo ""
        echo "?? Building Production Android APK..."
        eas build --platform android --profile production
        echo -e "${GREEN}? Production Android APK complete!${NC}"
;;
 5)
        echo ""
    echo "?? Building Production iOS App..."
 eas build --platform ios --profile production
        echo -e "${GREEN}? Production iOS build complete!${NC}"
   ;;
 6)
        echo "?? Goodbye!"
  exit 0
        ;;
    *)
        echo -e "${RED}? Invalid choice${NC}"
      exit 1
        ;;
esac

echo ""
echo "?? Build process complete!"
echo ""
echo "?? Next steps:"
echo "1. Check your Expo dashboard for build status"
echo "2. Download the build when ready"
echo "3. Install on your device"
echo ""
echo "?? Expo Dashboard: https://expo.dev"
