#!/bin/sh
# Run on the VPS from the repo folder: sh deploy/deploy.sh [branch]   (default: feature/boss-android)
# Pulls the branch, rebuilds the game image and restarts the stack. Data volumes are kept.
set -eu
BRANCH="${1:-feature/boss-android}"
cd "$(dirname "$0")/.."
[ -f deploy/.env ] || { echo "Thiếu deploy/.env: cp deploy/env.example deploy/.env rồi sửa DOMAIN, POSTGRES_PASSWORD"; exit 1; }
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
