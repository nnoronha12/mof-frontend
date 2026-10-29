# MOF phase 1 Docker deployment

Repository: `nnoronha12/mof-frontend`, branch `main`.
Source snapshot: `mof-code/mof-main` commit `24861ad`.
Comparison baseline: `nin-dev-ai/mof-ai-chat` commit `f78ac7c`.
Application baseline: `mof-code` commit `f8dab29` plus deployment compatibility changes.

## What changed since the old deployment

| Area | Old repository | This branch |
|---|---|---|
| Source layout | App at repository root | App remains in `frontend/`; root Dockerfile supports the old `docker build .` command |
| Build | Node 20 + Vite single `main.js` | Node 22.23.3 + tested Webpack app with hashed lazy chunks |
| Browser API | Hardcoded `http://172.26.129.185/webhook` | Same default, declared in `frontend/config/mof.env` |
| Browser Socket.IO | Hardcoded `http://172.26.129.186/socket.io/` | Same default; `/socket.io/` is a transport path, not a namespace |
| Portal mount | Old Nginx serves `/`; external gateway configuration is absent | `/frontend/` assets and routes; Nginx accepts stripped or preserved prefixes |
| Service catalogue | Legacy local/static catalogue | Current backend `user/services` catalogue and current features retained |
| Auth | n8n `auth/login`, `auth/signup`, `user/refresh`, `user/logout` | Same routes under configured API base |
| Proxy configuration | Old `/auth/` and `/socket.io/` proxies depend on Docker names `gotrue` and `socketio` | Browser uses the existing 185/186 gateways directly; no dependence on undocumented container names |

The old `/auth/` Nginx proxy is not the app login route: the app logs in through n8n.
HTTP port 80 on 185 is the browser API endpoint from the old repository. The backend
migration's `185:5678` address is an internal service address, not a frontend replacement.

## Build and run

From the repository root on the deployment machine:

```sh
git checkout main
docker build -t mof-portal:phase1 .
docker run -d --name mof-portal -p 8080:8080 --restart unless-stopped mof-portal:phase1
```

Alternatively `docker build -f frontend/Dockerfile .` or `docker build frontend`.
The Docker build installs the lockfile dependencies and runs typecheck + production
build. For the full regression checks, run `npm ci && npm run verify:web` from
`frontend/` first (Node 22.23.3 and Python 3).

The expected public URL is `http://172.26.129.186/frontend/`, as indicated by the
operator. Route it at the existing MOF gateway to this container's port 8080.
Both gateway configurations work:

- `/frontend/main.<hash>.js` forwarded unchanged;
- `/frontend/` stripped before forwarding (upstream sees `/main.<hash>.js`).

Do not replace the existing gateway configuration for GoTrue, WebSocket or PDF
visual with this frontend-only Nginx configuration. This image serves the portal.

## Configuration

`frontend/config/mof.env` is the default in this repository.
The settings are compiled into the browser bundle, not changed by `docker run -e`.
For another deployment, supply a public configuration file and build with:

```sh
docker build --build-arg MOF_CONFIG_FILE=config/production.env -t mof-portal:phase1 .
```

`MOF_PUBLIC_BASE_PATH=/frontend/` controls asset URLs. Use `/` for a root-hosted
portal. The image accepts both request prefixes regardless of asset-path choice.
HTTP is explicitly allowed by `MOF_ALLOW_HTTP=true` to match the old intranet
setup. If the portal is served over HTTPS, configure HTTPS API and Socket.IO
endpoints too; browsers block calls from HTTPS pages to these HTTP IP addresses.
Do not put secrets in this public settings file.

## Target acceptance checks

The repository does not contain the MOF gateway/container-orchestration configuration.
Before switching traffic, verify from an MOF user machine:

1. `/frontend/` loads; refresh a nested path and confirm chunks/logos return real files.
2. Login and refresh reach `http://172.26.129.185/webhook`, with required CORS headers.
3. Socket.IO polling/upgrade uses origin `http://172.26.129.186` and path `/socket.io/`.
4. The backend service catalogue contains the target chat routes; absolute URLs returned
   by the catalogue must point to MOF, not UAT. Relative chat routes are preferred.
5. Exercise general chat, document upload/citations, presentation generation/edit/export
   and translation, including final WebSocket replies and reopening saved history.
6. Backend-generated PDF/preview/asset links must be reachable from the browser. Backend
   workflow credential rebinding, service migration, storage and database setup are separate.

Local build tests and container checks are not evidence that these private-network
services or the MOF gateway have been deployed. The branch is deployment source;
no live MOF server has been changed by preparing it.

## Validation recorded for this branch

- Full `npm run verify:web` passed: regression checks, typecheck, production build, artifact scan and DOM startup at `/frontend/` and a nested route.
- Focused tests passed for the `/webhook` API prefix, explicit HTTP settings and Socket.IO transport paths.
- Root Docker build passed with locked dependencies.
- `python3 deployment/test-container.py mof-portal:phase1-review` passed against the built image: root/prefixed/nested routes, both gateway prefix behaviors, script/logo files, caching, redirect and missing-file 404.
- The generated browser JavaScript contains the MOF API/relay and no UAT gateway, Railway relay or old n8n host.
- MOF private-network login, CORS, WebSocket connectivity and generation/export are not validated by these isolated tests.

