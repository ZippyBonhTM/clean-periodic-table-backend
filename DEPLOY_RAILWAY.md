# Deploy (Railway + Docker Hub)

## Publish image

```bash
docker login
cd /home/zippy/clean-periodic-table-backend
npm run docker:publish -- <DOCKERHUB_USER> <VERSION_TAG>
```

Image names:

- `<DOCKERHUB_USER>/clean-periodic-table-backend:<VERSION_TAG>`
- `<DOCKERHUB_USER>/clean-periodic-table-backend:latest`

## Railway env vars

Use `/home/zippy/clean-periodic-table-backend/railway.env.example` as template.

Required values:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `DATA_SOURCE=mongo`
- `MONGO_URI=<YOUR_BACKEND_MONGO_URI>`
- `AUTH_REQUIRED=true`
- `AUTH_SERVICE_URL=https://<AUTH_PUBLIC_DOMAIN>`
- `AUTH_INTERNAL_SERVICE_TOKEN=<SHARED_INTERNAL_SECRET>`
- `AUTH_VALIDATE_PATH=/validate-token`
- `AUTH_PROFILE_PATH=/profile`
- `ADMIN_BOOTSTRAP_USER_IDS=<AUTH_USER_ID_OF_INITIAL_ADMIN>`
- `CORS_ORIGINS=https://<FRONTEND_DOMAIN>`

Notes:

- Railway injects `PORT` automatically.
- `AUTH_REVOKE_USER_SESSIONS_PATH` is optional, but when enabled it should point to the internal auth endpoint `/internal/users/:userId/sessions/revoke`.
- `AUTH_INTERNAL_SERVICE_TOKEN` must match the same shared secret configured in `clean-auth`.
