#!/usr/bin/env bash
# Simple deploy helper for a Linux server with Docker
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Building and starting containers with docker compose..."
docker compose up --build -d

echo "Done. Frontend -> port 3000, Backend -> port 5000"

echo "If you want a systemd service for docker-compose, see deploy/durain.service"
