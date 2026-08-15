#!/usr/bin/env bash
# media-dev-local.sh (M413 / RUNBOOK médias) — sert les BINAIRES photos (poi/**/photos/, 685 images du manifeste A140) en
# DEV, pour que le hero carrousel de C montre de VRAIES images + pour prototyper le service médias du Go Live.
#
# R2 : n'expose QUE poi/ (via un root symlink jetable), jamais le reste du repo (code, deploy/.env, secrets). Localhost only.
# Les URLs du manifeste (`chemin` = poi/.../photos/x.jpg) résolvent en `http://localhost:<PORT>/<chemin>`.
# Go Live : même arborescence poi/**/photos/ servie par un statique/CDN/DB2 (base d'URL à injecter côté front).
set -euo pipefail

ICI="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${BJT_MEDIA_PORT:-8088}"
ROOT="$(mktemp -d)/media"
mkdir -p "$ROOT"
ln -sfn "$ICI/poi" "$ROOT/poi"   # seul poi/ est exposé (symlink), rien d'autre du repo

echo "Médias dev : base = http://localhost:$PORT/  →  http://localhost:$PORT/poi/.../photos/x.jpg"
echo "  (sert $ICI/poi ; R2 : localhost only, poi/ seul)"
cd "$ROOT"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
