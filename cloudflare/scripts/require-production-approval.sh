#!/usr/bin/env bash
set -euo pipefail

operation="${1:-production operation}"
target="${2:-Cloudflare production}"

if [[ ! -t 0 || ! -t 1 ]]; then
  echo "Refusing ${operation} against ${target}: an interactive terminal and fresh human approval are required." >&2
  exit 1
fi

echo "Production approval required"
echo "Operation: ${operation}"
echo "Target:    ${target}"

sudo -k
sudo -v -p "Approve this production operation with Touch ID or an administrator password: "
sudo -K
