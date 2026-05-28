# HFC — Synology Docker Deployment & Data Persistence Guide

## Storage Architecture

| Layer | Type | Key / Path | Notes |
|-------|------|-----------|-------|
| Frontend | In-memory (`window.__PERSISTED`) | `hfcs_companies`, `hfcs_selectedYear`, etc. | Loaded from server on boot, synced back via `/api/state` |
| Backend | JSON file on volume | `/data/state.json` (or equivalent) | Source of truth — **must** survive container rebuilds |
| Docker | Bind mount | `./data:/data` or `/volume2/docker/hfc/data:/data` | **Critical**: never use `-v` flag with `docker compose down` |

### Key Namespace

Storage keys are **stable strings** — no version, no hash, no build ID embedded.
Bumping `APP_VERSION` does NOT change key names and does NOT wipe data.

## Clean Rebuild Checklist (No Data Loss)

```bash
# 1. Backup (belt + suspenders)
cp -r /volume2/docker/hfc/data /volume2/docker/hfc/data.bak.$(date +%Y%m%d)

# 2. Stop containers (DO NOT use -v !)
docker compose down          # ← no -v flag!

# 3. Rebuild image
docker compose build --no-cache

# 4. Start
docker compose up -d

# 5. Verify
#   a) Origin unchanged (same IP/port/protocol)
#   b) Open browser DevTools console, check:
#      [PERSIST_BOOT] { origin, rev, keyCount, hasCompanies, updatedAt }
#   c) Data visible in app
```

## Troubleshooting "Data Disappeared"

### Symptom: After rebuild, data gone

| Cause | Diagnostic | Fix |
|-------|-----------|-----|
| `docker compose down -v` used | Volumes deleted | Restore from backup |
| Volume mount path changed | `docker inspect <container>` → check Mounts | Fix `docker-compose.yml` path |
| Origin changed (HTTP→HTTPS or port change) | Console: `[PERSIST_BOOT]` shows different origin | Restore same origin; browser storage is per-origin |
| Server `/data` dir permissions | `ls -la /volume2/docker/hfc/data/` | `chown -R 1000:1000 /data` inside container |
| Backend crashed on load | `docker logs hfc-server` | Check backend logs for JSON parse errors |

### Diagnostic Console Output

On every app boot, the console logs:
```
[PERSIST_BOOT] { origin: "https://hfc.local:8443", rev: 42, keyCount: 5, hasCompanies: true, updatedAt: "2026-02-09T..." }
```

- `rev: 0` + `keyCount: 0` → server returned empty state (data missing on server side)
- `hasCompanies: false` → companies key missing
- `origin` changed from previous session → browser context different

### Blob/HTTP→HTTPS Warnings

These are **unrelated** to data persistence. They come from PDF.js worker loading
or service worker scope mismatches. They do not affect the `/api/state` read/write
pipeline. Evidence: the persistence layer uses `fetch('/api/state')` which is a
relative URL inheriting the current origin — no blob: or mixed-content involved.

## Export / Import (Manual Backup)

The app's Settings page may offer Export/Import for data backup.
This is the recommended user-facing backup mechanism for cross-origin migrations.
