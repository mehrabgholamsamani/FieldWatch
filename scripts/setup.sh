#!/bin/bash
set -e

echo "Setting up FieldWatch development environment..."

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "docker-compose is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required but not installed."; exit 1; }

# Start services
echo "Starting Docker services..."
docker-compose up -d --build

# Wait for services
echo "Waiting for services to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
docker-compose exec backend alembic upgrade head

# Install mobile dependencies
echo "Installing mobile dependencies..."
cd packages/mobile && npm install && cd ../..

echo "Setup complete! Run 'make up' to start the services."
