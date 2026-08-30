#!/bin/zsh
set -u

PROJECT_DIR="/Users/ctm/Documents/hotelmanagetest"
DOCKER="/usr/local/bin/docker"
[[ -x "$DOCKER" ]] || DOCKER="/opt/homebrew/bin/docker"
[[ -x "$DOCKER" ]] || DOCKER="$(command -v docker 2>/dev/null || true)"

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

if [[ -z "$DOCKER" || ! -x "$DOCKER" ]]; then
  log "docker CLI not found"
  exit 1
fi

# Docker Desktop may need time after macOS login. Wait up to 5 minutes.
engine_ready=0
for _ in {1..60}; do
  if "$DOCKER" info >/dev/null 2>&1; then
    engine_ready=1
    break
  fi
  sleep 5
done
if [[ "$engine_ready" -ne 1 ]]; then
  log "Docker Engine not ready after 5 minutes"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

# One project command guarantees db -> api -> web dependencies and recreates
# missing/stopped containers. Build only when an app image is actually missing.
need_build=0
for image in hotelmanagetest-api hotelmanagetest-web; do
  if ! "$DOCKER" image inspect "$image" >/dev/null 2>&1; then
    need_build=1
  fi
done

if [[ "$need_build" -eq 1 ]]; then
  log "ChiHomeHotel image missing; rebuilding unified stack"
  "$DOCKER" compose up -d --build --remove-orphans
else
  log "Ensuring unified ChiHomeHotel stack is running"
  "$DOCKER" compose up -d --remove-orphans
fi

"$DOCKER" compose ps
