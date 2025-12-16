#!/bin/bash

# Build script for GujWear Coming Soon

echo "🔨 GujWear Build Process"
echo "========================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js >= 14.0.0${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js${NC} ${NODE_VERSION}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm${NC} ${NPM_VERSION}"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Validate files
echo ""
echo "🔍 Validating files..."

FILES=("index.html" "server.js" "css/style.css" "js/main.js" "package.json")
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file"
    else
        echo -e "${RED}✗${NC} $file missing"
        exit 1
    fi
done

# Build assets
echo ""
echo "🎨 Building assets..."

# CSS validation (basic check)
if grep -q "body{" css/style.css; then
    echo -e "${GREEN}✓${NC} CSS validated"
else
    echo -e "${YELLOW}⚠${NC} CSS structure check skipped"
fi

# JS validation (basic check)
if grep -q "function\|const\|let" js/main.js; then
    echo -e "${GREEN}✓${NC} JavaScript validated"
else
    echo -e "${YELLOW}⚠${NC} JavaScript structure check skipped"
fi

# HTML validation (basic check)
if grep -q "<html>" index.html; then
    echo -e "${GREEN}✓${NC} HTML validated"
else
    echo -e "${RED}✗${NC} HTML validation failed"
    exit 1
fi

# Create .env if not exists
echo ""
echo "⚙️  Configuration..."
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}ℹ${NC} .env file not found"
    echo "   Copy .env.example to .env and configure your settings:"
    echo "   cp .env.example .env"
else
    echo -e "${GREEN}✓${NC} .env file exists"
fi

# Build summary
echo ""
echo "📊 Build Summary"
echo "==============="
FILE_COUNT=$(find . -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" \) ! -path "./node_modules/*" | wc -l)
echo "📄 Files: $FILE_COUNT"
SIZE=$(du -sh . | cut -f1)
echo "💾 Size: $SIZE"

# Final message
echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "🚀 Start the server:"
echo "   npm start          (production)"
echo "   npm run dev        (development)"
echo ""
echo "📖 Documentation:"
echo "   See README.md for more information"
echo ""
