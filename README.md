# MOF AI Portal — MOF deployment

This branch packages the current portal for Docker/Nginx deployment in MOF.
See [the deployment guide](deployment/MOF_PHASE1.md) for build commands and gateway checks.

| Setting | Target |
|---|---|
| Portal | `http://172.26.129.186/frontend/` |
| API | `http://172.26.129.185/webhook` |
| Browser Socket.IO | `http://172.26.129.186/socket.io/` |

Settings are compiled from `frontend/config/mof.env`. Container runtime variables
cannot change compiled browser endpoints. The relay HTTP publishing endpoint is
`http://172.26.129.186/socket.io/webhook`; browsers use the transport path above.

## Build and run

```sh
cd frontend
npm ci
npm run verify:web
cd ..
docker build -t mof-portal .
docker run --rm -p 8080:8080 mof-portal
```

The gateway must route `/frontend/` to this container. Nginx provides SPA routing,
HTML revalidation and immutable caching for hashed JavaScript.

## Deployment

Use [the Docker deployment guide](deployment/MOF_PHASE1.md) for gateway routing,
configuration and target acceptance checks. This repository contains only the
frontend with fresh history. No backend exports or original repository history
are included. Frontend test fixtures contain isolated contract examples.
