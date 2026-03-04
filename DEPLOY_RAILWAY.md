# Deploy (Railway + Docker Hub)

## Publish image

```bash
docker login
cd /home/zippy/clean-periodic-table/Backend
npm run docker:publish -- <DOCKERHUB_USER> <VERSION_TAG>
```

Image names:

- `<DOCKERHUB_USER>/clean-periodic-table-backend:<VERSION_TAG>`
- `<DOCKERHUB_USER>/clean-periodic-table-backend:latest`

## Railway env vars

Use `/home/zippy/clean-periodic-table/Backend/railway.env.example` as template.

Required values:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `DATA_SOURCE=mongo`
- `MONGO_URI=<YOUR_BACKEND_MONGO_URI>`
- `AUTH_REQUIRED=true`
- `AUTH_SERVICE_URL=https://<AUTH_PUBLIC_DOMAIN>`
- `AUTH_VALIDATE_PATH=/validate-token`
- `CORS_ORIGINS=https://<FRONTEND_DOMAIN>`

Notes:

- Railway injects `PORT` automatically.
