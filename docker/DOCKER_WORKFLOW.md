## Versioning and Push to Docker Hub

Use semantic versions for both images.

```bash
# Backend image
cd /home/zippy/clean-periodic-table/Backend
docker build -t zippybonhtm/clean-periodic-table-backend:1.0.0 .
docker push zippybonhtm/clean-periodic-table-backend:1.0.0

# Auth image
cd /home/zippy/clean-auth
docker build -t zippybonhtm/clean-auth:1.0.0 .
docker push zippybonhtm/clean-auth:1.0.0
```

Optionally keep `latest` in sync:

```bash
docker tag zippybonhtm/clean-periodic-table-backend:1.0.0 zippybonhtm/clean-periodic-table-backend:latest
docker push zippybonhtm/clean-periodic-table-backend:latest

docker tag zippybonhtm/clean-auth:1.0.0 zippybonhtm/clean-auth:latest
docker push zippybonhtm/clean-auth:latest
```

## Local Orchestration

Runs both services + Mongo, with backend calling auth at `http://auth:3002`.

```bash
cd /home/zippy/clean-periodic-table/Backend
docker compose -f docker-compose.local.yml up -d --build
```

If your auth repo is in another directory, set `AUTH_BUILD_CONTEXT`:

```bash
export AUTH_BUILD_CONTEXT=/absolute/path/to/clean-auth
docker compose -f docker-compose.local.yml up -d --build
```

If your Docker CLI does not have `buildx`, build images first and run compose without build:

```bash
cd /home/zippy/clean-auth
DOCKER_BUILDKIT=0 docker build -t clean-auth:local .

cd /home/zippy/clean-periodic-table/Backend
DOCKER_BUILDKIT=0 docker build -t clean-periodic-table-backend:local .
docker compose -f docker-compose.local.yml up -d --no-build
```

Seed periodic table once:

```bash
docker compose -f docker-compose.local.yml --profile seed up backend-seed
```

Stop stack:

```bash
docker compose -f docker-compose.local.yml down
```

## Production-like Orchestration

Set required environment variables first (at least JWT secrets and image tags).

```bash
export AUTH_TAG=1.0.0
export BACKEND_TAG=1.0.0
export JWT_ACCESS_SECRET='change-me'
export JWT_REFRESH_SECRET='change-me'
```

Start:

```bash
cd /home/zippy/clean-periodic-table/Backend
docker compose -f docker-compose.prod.yml up -d
```

Seed periodic table in production stack:

```bash
docker compose -f docker-compose.prod.yml --profile seed up backend-seed
```
