#!/bin/sh

# Get the app name from the first argument or use default
APP_NAME=${1:-VoiceStaticServer}
echo "Starting app: $APP_NAME"

# Create necessary directories if they don't exist
mkdir -p /app/apps /app/ncore

# Copy project files from mounted volume to workspace
if [ -d "/source" ]; then
    echo "Copying project files from source..."
    cp -r "/source/apps/$APP_NAME" "/app/apps/"
    cp -r /source/ncore /app/
    cp /source/package.json /source/yarn.lock /app/
fi

# Get HTTP_PORT from .env file
if [ -f "/app/apps/$APP_NAME/.env" ]; then
    HTTP_PORT=$(grep HTTP_PORT "/app/apps/$APP_NAME/.env" | cut -d '=' -f2)
    echo "Using port from .env: $HTTP_PORT"
else
    HTTP_PORT=3000
    echo "No .env file found, using default port: $HTTP_PORT"
fi

# Export port for Docker
export PORT=$HTTP_PORT

# Install dependencies if node_modules doesn't exist
if [ ! -d "/app/node_modules" ]; then
    echo "Installing dependencies..."
    yarn install
fi

# Start the application
echo "Starting application: $APP_NAME on port $HTTP_PORT..."
cd "/app/apps/$APP_NAME"
yarn start 