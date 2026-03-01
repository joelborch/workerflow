#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[1/6] Installing dependencies"
npm install

echo "[2/6] Initializing local config files"
npm run init

echo "[3/6] Running doctor precheck"
npm run doctor

echo "[4/6] Running migration contract guard"
npm run migrations:guard:strict

echo "[5/6] Validating route payload contracts"
npm run test:route-validation

echo "[6/6] Running local handler smoke test"
npm run smoke:handlers

echo ""
echo "Success path complete."
echo "Next: run 'npm run bootstrap' to generate Cloudflare provisioning plan."
