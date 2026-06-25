#!/usr/bin/env bash
# OSRM-Vorverarbeitung: lädt einen Geofabrik-PBF-Extrakt herunter und baut
# daraus die Routing-Graphen (MLD-Pipeline). Einmalig pro Karten-Update.
#
# Aufruf:
#   bash infra/osrm/prepare.sh                      # Deutschland (Standard)
#   PBF_URL=https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf \
#     bash infra/osrm/prepare.sh                    # nur Baden-Württemberg (viel leichter)
#
# Danach trägt das Skript den passenden OSRM_DATA-Wert in infra/osrm/.env ein,
# sodass `docker compose -f infra/osrm/docker-compose.yml up -d` direkt läuft.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"

# OSRM-Backend-Image (enthält osrm-extract/partition/customize/routed + Profile).
IMAGE="${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:latest}"
# Lua-Profil im Image: /opt/car.lua | /opt/bicycle.lua | /opt/foot.lua.
LUA_PROFILE="${OSRM_LUA_PROFILE:-/opt/car.lua}"
# Geofabrik-Extrakt. Deutschland-weit (~4 GB) als Standard.
PBF_URL="${PBF_URL:-https://download.geofabrik.de/europe/germany-latest.osm.pbf}"

BASENAME="$(basename "$PBF_URL" .osm.pbf)"
PBF_FILE="$DATA_DIR/$BASENAME.osm.pbf"
OSRM_FILE="/data/$BASENAME.osrm" # Pfad INNERHALB des Containers

mkdir -p "$DATA_DIR"

echo "▶ Region:  $BASENAME"
echo "▶ Profil:  $LUA_PROFILE"
echo "▶ Daten:   $DATA_DIR"
echo

# 1) Download (resume-fähig via -C -, nur wenn nicht schon vorhanden).
if [ -f "$PBF_FILE" ]; then
  echo "✓ PBF bereits vorhanden, überspringe Download."
else
  echo "⬇ Lade $PBF_URL …"
  curl -L --fail -C - -o "$PBF_FILE" "$PBF_URL"
fi

# Hilfsfunktion: ein OSRM-Tool im Container ausführen, data/ gemountet.
run() {
  docker run --rm -t -v "$DATA_DIR:/data" "$IMAGE" "$@"
}

# 2) Extract → Partition → Customize (MLD-Pipeline, schnelle Customize-Updates).
echo "⚙ osrm-extract (RAM-intensiv) …"
run osrm-extract -p "$LUA_PROFILE" "/data/$BASENAME.osm.pbf"
echo "⚙ osrm-partition …"
run osrm-partition "$OSRM_FILE"
echo "⚙ osrm-customize …"
run osrm-customize "$OSRM_FILE"

# 3) OSRM_DATA in infra/osrm/.env hinterlegen (von docker-compose gelesen).
ENV_FILE="$SCRIPT_DIR/.env"
if grep -q '^OSRM_DATA=' "$ENV_FILE" 2>/dev/null; then
  # vorhandene Zeile ersetzen (portabel ohne sed -i Plattformunterschiede)
  grep -v '^OSRM_DATA=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
  mv "$ENV_FILE.tmp" "$ENV_FILE"
fi
echo "OSRM_DATA=$BASENAME" >> "$ENV_FILE"

echo
echo "✓ Fertig. Graph: $DATA_DIR/$BASENAME.osrm*"
echo "  Server starten:  docker compose -f infra/osrm/docker-compose.yml up -d"
echo "  Test:            curl 'http://localhost:5000/route/v1/driving/7.85,48.0;7.86,48.01'"
