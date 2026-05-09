# Vercel + Supabase Deployment

This repo is a pnpm monorepo with one Next.js app and Fastify backend services.

The backend services now include Vercel function entrypoints under `api/[...route].ts`, so they can be deployed as separate Vercel projects.

## 1. Deploy web app (`apps/web`)

1. Import this repo in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Framework preset: **Next.js**.
4. Install command: `pnpm install --frozen-lockfile`.
5. Build command: `pnpm build`.

Add environment variables from `apps/web/.env.example`.

Minimum web runtime variables:

- `OPENAI_API_KEY`
- `OPENROUTESERVICE_API_KEY` (or `ORS_API_KEY`)
- `RESOURCE_SERVICE_URL`
- `INTELLIGENCE_SERVICE_URL`
- `RECOMMENDATION_SERVICE_URL`
- `AUTH_SERVICE_URL`

Optional for legacy founder-path routing service:

- `ROUTING_SERVICE_URL`

For Vercel-hosted services, point each service URL to its `/api` base, for example:

- `RESOURCE_SERVICE_URL=https://founder-gps-resource.vercel.app/api`
- `INTELLIGENCE_SERVICE_URL=https://founder-gps-intelligence.vercel.app/api`

Optional Supabase variables (direct web usage):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## 2. Deploy backend services (one Vercel project per service)

Create one Vercel project for each service:

- `apps/auth-service`
- `apps/intelligence-service`
- `apps/recommendation-service`
- `apps/resource-service`

Optional legacy project (only if you still need founder-path routing-service output):

- `apps/routing-service`

Recommended per-project settings:

1. **Root Directory**: service folder listed above.
2. Framework preset: **Other**.
3. Install command: `pnpm install --frozen-lockfile`.
4. Build command: `pnpm build`.

Each service is exposed from the `/api` prefix via Vercel function routing.

### Required variables per backend service

`auth-service`:

- `DATABASE_URL`
- `AUTH_COOKIE_NAME` (optional)
- `AUTH_SESSION_TTL_DAYS` (optional)
- `AUTH_AVATAR_STORAGE_DIR` (optional, Vercel filesystem is ephemeral)
- `AUTH_AVATAR_PUBLIC_BASE_URL` (optional)

`resource-service`:

- `DATABASE_URL`

`intelligence-service`:

- `DATABASE_URL`
- `RESOURCE_SERVICE_URL`
- `RECOMMENDATION_SERVICE_URL`
- `OPENAI_API_KEY` (or provider-specific equivalent)

`recommendation-service`:

- `DATABASE_URL`
- `RESOURCE_SERVICE_URL`
- `INTELLIGENCE_SERVICE_URL`
- `OPENAI_API_KEY` (optional, if using LLM recommendations)
- `OPENAI_BASE_URL` (optional)
- `OPENAI_RECOMMENDATION_MODEL` (optional)

`routing-service`:

- `OSRM_BASE_URL` (must point to hosted OSRM endpoint)
- `OSRM_REQUEST_TIMEOUT_MS` (optional)
- `OSRM_MAX_RETRIES` (optional)

## 3. Smoke tests

Web:

```bash
curl -i https://<web-domain>/api/routing/ors \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"coordinates":[[-111.891,40.7608],[-111.9,40.75]]}'
```

Backend service examples:

```bash
curl -i https://<resource-service-domain>/api/health
curl -i https://<auth-service-domain>/api/health
curl -i https://<recommendation-service-domain>/api/health
```

## 4. Common failure modes

- `routes-manifest.json` missing on web deploy: ensure Turbo outputs include `.next/**` in root `turbo.json`.
- Backend 404 on root path: backend endpoints are served from `/api/*` on Vercel.
- `503` from web API routes: one or more `*_SERVICE_URL` values are missing or unreachable.
- `ORS_API_KEY_MISSING`: add `OPENROUTESERVICE_API_KEY` or `ORS_API_KEY`.
- Routing service failures on Vercel: set `OSRM_BASE_URL` to an externally hosted OSRM instance; local Docker OSRM is not available inside Vercel functions.

## 5. Supabase notes

- Supabase is primarily used by backend services through `DATABASE_URL`.
- If you want direct Supabase usage in web paths, add a web-side Supabase client and migrate the current service-based flows.
