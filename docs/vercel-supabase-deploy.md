# Vercel + Supabase Deployment (Hackathon Fast Path)

This repo is a pnpm monorepo. For a public URL quickly, deploy only `apps/web` to Vercel and point its API routes to your hosted services.

## 1. Create Vercel project

1. Import this repo in Vercel.
2. Set **Root Directory** to `apps/web`.
3. Framework preset should be **Next.js**.
4. Build command: `pnpm build`.
5. Install command: `pnpm install --frozen-lockfile`.

## 2. Add environment variables

Copy values from `apps/web/.env.example` into Vercel Project Environment Variables.

Minimum required for current web API behavior:

- `OPENAI_API_KEY`
- `OPENROUTESERVICE_API_KEY` (or `ORS_API_KEY`)
- `RESOURCE_SERVICE_URL`
- `ROUTING_SERVICE_URL`
- `INTELLIGENCE_SERVICE_URL`
- `RECOMMENDATION_SERVICE_URL`
- `AUTH_SERVICE_URL`

Optional Supabase variables (for direct Supabase usage):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`

## 3. Deploy

1. Trigger a production deploy.
2. Open `https://<your-vercel-domain>/`.
3. Smoke test API routes from browser or curl:

```bash
curl -i https://<your-vercel-domain>/api/routing/ors \
  -X POST \
  -H 'content-type: application/json' \
  -d '{"coordinates":[[-111.891,40.7608],[-111.9,40.75]]}'
```

## 4. Common failure modes

- `503` from web API routes: one or more `*_SERVICE_URL` values are missing or unreachable.
- `ORS_API_KEY_MISSING`: add `OPENROUTESERVICE_API_KEY` or `ORS_API_KEY`.
- OpenAI request errors: confirm `OPENAI_API_KEY` and `OPENAI_BASE_URL` are correct for your provider.

## 5. Supabase notes

- Supabase is not yet directly integrated into `apps/web` code paths in this repository.
- If you want to use Supabase Auth/DB directly in Next.js, add a Supabase client and migrate the current auth/resource service dependencies.
- For this hackathon deploy, fastest path is to keep external service URLs configured and host those services where needed.
