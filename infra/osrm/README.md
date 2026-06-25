# Eigener OSRM-Routing-Server

Echtes Straßenrouting für den Fit-Score von PflegeLotse — auf eigener
Infrastruktur statt über den öffentlichen Demo-Server (der hat Limits und keine
Verfügbarkeitsgarantie). Die App nutzt den Server, sobald
`ROUTING_PROVIDER=osrm` und `OSRM_BASE_URL` gesetzt sind; fällt OSRM aus,
greift automatisch der Haversine-Fallback.

## Was passiert hier

OSRM arbeitet in zwei Phasen:

1. **Vorverarbeitung** (einmalig, schwer): aus einem OpenStreetMap-Extrakt
   (`.osm.pbf`) wird ein Routing-Graph gebaut — `osrm-extract` →
   `osrm-partition` → `osrm-customize` (MLD-Pipeline). Das übernimmt
   `prepare.sh`.
2. **Bedienung** (dauerhaft, leicht): `osrm-routed` lädt den Graphen und
   beantwortet Anfragen über HTTP. Das übernimmt `docker-compose.yml`.

## Voraussetzungen

- Docker + Docker Compose v2.
- **Arbeitsspeicher**: Der teure Schritt ist `osrm-extract`.
  - Deutschland (`germany-latest`, PBF ~4 GB): rechne mit **~16–24 GB RAM** und
    **~30 GB freiem Speicher** für die Graph-Dateien.
  - Baden-Württemberg (`baden-wuerttemberg-latest`, PBF ~1,5 GB): kommt mit
    **~6–8 GB RAM** aus — für einen regionalen Piloten (Region Freiburg) die
    pragmatische Wahl.

## Schnellstart

Vom Projekt-Root aus (Convenience-Skripte in `package.json`):

```bash
# 1) Graph bauen — Deutschland (Standard):
pnpm run osrm:prepare

#    …oder nur Baden-Württemberg (deutlich leichter):
PBF_URL=https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf \
  pnpm run osrm:prepare

# 2) Server starten:
pnpm run osrm:up

# 3) Funktion prüfen (Route Freiburg-intern):
curl 'http://localhost:5000/route/v1/driving/7.85,48.0;7.86,48.01'

# Stoppen:
pnpm run osrm:down
```

`prepare.sh` lädt den Extrakt nach `infra/osrm/data/`, baut den Graphen und
trägt `OSRM_DATA` in `infra/osrm/.env` ein (von Compose gelesen).

## Anbindung an die App

In den Environment-Variablen der App (lokal `.env`, in Produktion z. B. Vercel):

```
ROUTING_PROVIDER=osrm
OSRM_BASE_URL=http://localhost:5000      # bzw. http://<server-ip>:5000
OSRM_PROFILE=driving
```

Hinweise:

- `OSRM_PROFILE=driving` ist für einen Server mit einem einzigen Profil nur ein
  Pfadsegment in der URL und kann so bleiben, egal welches Lua-Profil beim
  Extrahieren genutzt wurde.
- **Vercel erreicht `localhost` nicht.** Für den produktiven Betrieb muss der
  OSRM-Server öffentlich erreichbar sein (eigener Host/VM mit fester IP oder
  Domain) und sollte hinter TLS + Zugriffsschutz stehen — `osrm-routed` bringt
  selbst keine Authentifizierung mit. Setze `OSRM_BASE_URL` dann auf diese
  öffentliche Adresse.

## Produktiv: öffentlich erreichbar + abgesichert

Für den Pilotbetrieb muss der Server von Vercel aus erreichbar sein (Vercel
erreicht **kein** `localhost`). `osrm-routed` hat selbst keine
Authentifizierung — ein offener Port 5000 wäre ein für jeden nutzbares
Routing-Backend. Deshalb liegt in `docker-compose.prod.yml` ein
**Caddy-Reverse-Proxy** davor: automatisches TLS-Zertifikat (Let's Encrypt) und
Prüfung eines API-Keys (Header `X-Api-Key`). Nur Caddy ist von außen erreichbar.

### 1. Server (VPS) bereitstellen

Eine kleine VM bei einem EU-Anbieter (z. B. Hetzner Cloud — deutsche
Rechenzentren, gut für die DSGVO-Linie des Projekts). Dimensionierung nach der
RAM-Tabelle oben: für Baden-Württemberg reichen ~8 GB RAM / 2 vCPU / 40 GB
Disk; für ganz Deutschland eher 16–32 GB RAM / 80 GB Disk. Betriebssystem:
aktuelles Ubuntu/Debian.

### 2. DNS + Firewall

- Einen `A`-Record (z. B. `osrm.deine-domain.de`) auf die IP der VM zeigen
  lassen.
- In der Firewall **nur** die Ports **80** und **443** öffnen (für Caddy/TLS).
  Port 5000 bleibt zu — er ist nur im internen Docker-Netz erreichbar.

### 3. Docker installieren & Projekt holen

```bash
# auf der VM (Ubuntu/Debian):
curl -fsSL https://get.docker.com | sh
git clone https://github.com/fgirse/pflegelotse-deutschland-200.git
cd pflegelotse-deutschland-200
```

### 4. Graph bauen

```bash
PBF_URL=https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf \
  bash infra/osrm/prepare.sh
```

### 5. Secrets setzen

In `infra/osrm/.env` (legt prepare.sh teilweise schon an) ergänzen:

```
OSRM_DOMAIN=osrm.deine-domain.de
OSRM_API_KEY=<openssl rand -hex 32>
```

Den Key mit `openssl rand -hex 32` erzeugen und merken — er wird gleich auch in
Vercel gebraucht.

### 6. Produktiv starten

```bash
docker compose -f infra/osrm/docker-compose.prod.yml up -d
```

Caddy holt jetzt automatisch das TLS-Zertifikat. Test (muss **401** liefern ohne
Key und ein Ergebnis **mit** Key):

```bash
curl -i  https://osrm.deine-domain.de/nearest/v1/driving/7.85,48.0          # 401
curl -is https://osrm.deine-domain.de/nearest/v1/driving/7.85,48.0 \
     -H "X-Api-Key: DEIN_KEY" | head -1                                     # 200
```

### 7. Vercel umschalten

Die App-Env-Variablen in Vercel setzen — entweder im Dashboard
(Settings → Environment Variables, Scope „Production") oder per CLI:

```bash
printf 'osrm'                       | npx vercel env add ROUTING_PROVIDER production
printf 'https://osrm.deine-domain.de' | npx vercel env add OSRM_BASE_URL  production
printf 'driving'                    | npx vercel env add OSRM_PROFILE     production
printf 'DEIN_KEY'                   | npx vercel env add OSRM_API_KEY      production
```

Env-Änderungen greifen erst mit einem neuen Deployment:

```bash
npx vercel --prod
```

Danach nutzt der Fit-Score echte Fahrzeiten. Fällt der OSRM-Server aus, schaltet
die App automatisch auf die Haversine-Heuristik zurück — der Betrieb bricht
nicht ab, wird im Störfall nur gröber.

## Karte aktualisieren

Geofabrik veröffentlicht täglich neue Extrakte. Zum Aktualisieren `prepare.sh`
erneut laufen lassen (die alte `.osm.pbf` in `infra/osrm/data/` vorher löschen,
damit neu geladen wird) und den Server mit `osrm:down`/`osrm:up` neu starten.

## Profil wechseln (z. B. Fahrrad)

```bash
OSRM_LUA_PROFILE=/opt/bicycle.lua \
PBF_URL=https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf \
  pnpm run osrm:prepare
```
