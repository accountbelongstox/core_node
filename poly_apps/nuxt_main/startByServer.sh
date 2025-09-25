#!/bin/bash

# VRISTO Nuxt 4 Production Server Startup Script
# This script automatically builds and starts the production server

echo "???? Starting VRISTO Nuxt 4 Production Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "???Error: Node.js is not installed or not in PATH"
    exit 1
fi

# Check if yarn is installed
if ! command -v yarn &> /dev/null; then
    echo "???Error: Yarn is not installed or not in PATH"
    exit 1
fi

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "???Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

echo "???? Installing dependencies..."
yarn install

echo "???? Building the application..."
yarn build

# Check if build was successful
if [ $? -ne 0 ]; then
    echo "???Build failed. Please check the error messages above."
    exit 1
fi

echo "???Build completed successfully!"

# Check if the server file exists
if [ ! -f ".output/server/index.mjs" ]; then
    echo "???Error: Server file not found at .output/server/index.mjs"
    exit 1
fi

echo "???? Starting production server..."
echo "???? Server will be available at: http://localhost:3000"
echo "???? Press Ctrl+C to stop the server"
echo ""

# Start the production server
node .output/server/index.mjs
