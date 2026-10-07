#!/bin/bash
set -e

echo "Starting deployment process..."

# 1. Pull latest code (Assumes git repository is already cloned)
echo "Pulling latest changes from branch main..."
git pull origin main

# 2. Build images
echo "Building Docker images..."
make build

# 3. Stop running containers
echo "Stopping existing containers..."
make down

# 4. Start new containers in detached mode
echo "Starting new containers..."
make up

# 5. Clean up unused images and volumes
echo "Cleaning up dangling images to save space..."
docker image prune -a -f

echo "Deployment completed successfully!"
