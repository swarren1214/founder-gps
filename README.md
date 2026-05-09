# Founder GPS

Founder GPS turns founder context into prioritized Utah resources, an optimized route, and a practical 30-day action plan. Built with AI-guided analysis, deterministic recommendation scoring, and OSRM-driven route optimization.

![Founder GPS](https://img.shields.io/badge/status-MVP-blue?style=flat-square) ![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square) ![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?style=flat-square)

## Features

- **Founder Analysis**: Structured AI identifies stage, immediate needs, and blind spots
- **Resource Ranking**: Deterministic recommendation scoring prioritizes Utah ecosystem resources
- **Route Optimization**: OSRM-driven Founder Path optimizes travel across startup ecosystem
- **30-Day Roadmap**: AI-generated actionable plan based on founder context and recommendations
- **Interactive Map**: MapLibre GL + deck.gl visualization of resources, startups, and optimized routes

## Quick Start

### Prerequisites

- **Node.js**: 18+ (use `nvm` if needed)
- **pnpm**: 9.12+ (install with `npm i -g pnpm`)
- **Docker & Docker Compose**: For local Postgres and optional OSRM service
- **PostgreSQL**: 14+ (via Docker recommended)
- **API Keys**:
  - `OPENAI_API_KEY` or `GEMINI_API_KEY` (for AI features)
  - `OPENROUTESERVICE_API_KEY` (for routing)
  - `GEOAPIFY_API_KEY` (for address autocomplete)

### Setup

1. **Clone and install**:
   ```bash
   git clone https://github.com/yourusername/founder-gps.git
   cd founder-gps
   pnpm install
   ```

2. **Create environment file**:
   ```bash
   cp .env.example .env
   # Edit .env with your local database URL and API keys
   ```

3. **Start services with Docker Compose**:
   ```bash
   docker-compose up -d
   ```
   This starts PostgreSQL on port 5432. Verify: `psql -U postgres -h localhost -c "SELECT 1"`

4. **Run database migrations**:
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/founder_gps" pnpm --filter @founder-gps/db migrate
   ```

5. **Start development server**:
   ```bash
   # Option A: Full infrastructure (all services + web)
   pnpm dev

   # Option B: Web only (requires deployed backend services)
   pnpm -C apps/web dev
   ```

6. **Open browser**:
   - Web: http://localhost:3000
   - Login and start a founder intake form

### Environment Variables

See `apps/web/.env.example` for the complete list. Key variables:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/founder_gps

# AI Provider
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_ROADMAP_MODEL=gpt-4o-mini

# Routing
OPENROUTESERVICE_API_KEY=...
OSRM_BASE_URL=http://localhost:5001

# Map & Address
GEOAPIFY_API_KEY=...

# Service URLs (point to local services when running full stack)
NEXT_PUBLIC_RESOURCE_SERVICE_URL=http://localhost:4001
NEXT_PUBLIC_ROUTING_SERVICE_URL=http://localhost:4002
NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL=http://localhost:4003
NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL=http://localhost:4004
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:4005
```

## Project Structure

```
founder-gps/
├── apps/
│   ├── web/                      # Next.js frontend (Vercel deployable)
│   ├── auth-service/             # User auth, sessions, profile storage
│   ├── resource-service/         # Utah startup ecosystem database & search
│   ├── intelligence-service/     # AI analysis & roadmap generation
│   ├── recommendation-service/   # Scoring & ranking engine
│   └── routing-service/          # OSRM wrapper for route optimization
├── packages/
│   ├── shared-types/             # TypeScript types shared across services
│   ├── db/                       # Postgres schema migrations & seeders
│   ├── ai/                       # AI provider abstraction
│   └── config/                   # Shared config utilities
├── docs/
│   ├── architecture.md           # System design & service boundaries
│   ├── vercel-supabase-deploy.md # Production deployment guide
│   └── ...
└── pnpm-workspace.yaml           # Monorepo configuration
```

## Architecture Overview

### System Context

Founder GPS is a **Next.js + microservices** application where:

1. **Web Frontend** (`apps/web`) calls backend services via HTTP
2. **Backend Services** each own specific business logic and data
3. **PostgreSQL** is the single source of truth for all persistent data
4. **AI Services** (OpenAI/Gemini) provide analysis and roadmap generation
5. **OSRM** provides route optimization for the Founder Path

### User Flow

1. Founder enters onboarding form in the web app
2. Web app sends intake data to **intelligence-service** → AI analyzes founder context
3. Web app queries **resource-service** for Utah ecosystem resources
4. Web app sends analysis + resources to **recommendation-service** → ranks top matches
5. Web app calls **routing-service** → OSRM optimizes route across top recommendations
6. Web app requests 30-day plan from **intelligence-service** → AI generates roadmap
7. Dashboard displays analysis, map, recommendations, and roadmap

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Web (Next.js)                            │
│        (UI, Session, API Route Orchestration)                │
└──────────┬──────────────┬──────────────┬────────────┬────────┘
           │              │              │            │
     ┌─────▼────┐  ┌──────▼──────┐  ┌───▼────────┐  │
     │   Auth   │  │ Intelligence│  │ Recommend- │  │
     │ Service  │  │  Service    │  │   ation    │  │
     │ (Users,  │  │  (Analysis, │  │  Service   │  │
     │ Sessions)│  │  Roadmap)   │  │ (Scoring)  │  │
     └─────┬────┘  └──────┬──────┘  └───┬────────┘  │
           │              │             │           │
           └──────────────┼─────────────┘           │
                          │                         │
              ┌───────────▼────────────────────┐   │
              │   PostgreSQL (Single DB)       │   │
              │ - Users & Profiles             │   │
              │ - Resources & Startups         │   │
              │ - Chat Sessions                │   │
              └─────────────────────────────────┘  │
                                                    │
                     ┌─────────────────────────────┘
                     │
              ┌──────▼──────────┐      ┌─────────────┐
              │ Routing Service │      │ OpenAI/    │
              │   (OSRM Wrapper)│      │ Gemini API │
              └─────────────────┘      └─────────────┘
```

### Key Design Principles

1. **Separation of Concerns**: AI services handle reasoning; deterministic services own ranking, filtering, routing
2. **Single Database**: All services share PostgreSQL (no microservice data silos)
3. **Stateless Services**: Each service is horizontally scalable
4. **Clear Contracts**: TypeScript types ensure API consistency across services

## Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router, Server Components)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui components
- **Animations**: Framer Motion
- **Mapping**: MapLibre GL JS + deck.gl
- **State**: React hooks, Next.js cookies

### Backend Services
- **Framework**: Fastify (lightweight, fast)
- **Language**: TypeScript
- **Database**: PostgreSQL 14+
- **ORM**: pg (node-postgres, no ORM abstractions)

### Data & APIs
- **AI**: OpenAI / Gemini APIs (configurable)
- **Routing**: OSRM (Open Source Routing Machine)
- **Address**: Geoapify Geocoding API
- **Maps**: OpenRouteService or Geoapify for location services

## Development

### Available Commands

```bash
# Install dependencies
pnpm install

# Start everything locally
pnpm dev

# Run just the web frontend
pnpm -C apps/web dev

# Build all apps
pnpm build

# Type-check all apps
pnpm lint

# Run tests
pnpm test

# Database migrations
DATABASE_URL="postgresql://..." pnpm --filter @founder-gps/db migrate

# Database seeding
DATABASE_URL="postgresql://..." pnpm --filter @founder-gps/db seed
```

### Debugging

Each service logs to stdout. Monitor logs in your terminal when running `pnpm dev`.

For the Next.js web app, enable debug output:

```bash
DEBUG=founder-gps:* pnpm -C apps/web dev
```

### Adding a New API Endpoint

1. Create a new route file in `apps/web/app/api/[feature]/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` functions
3. Use [apps/web/lib/service-urls.ts](apps/web/lib/service-urls.ts) for service URL resolution
4. Validate input with schemas in [apps/web/lib/schemas.ts](apps/web/lib/schemas.ts)
5. Test with curl or your HTTP client

### Database Schema Changes

1. Create a new migration SQL file in `packages/db/sql/migrations/`
2. Name it sequentially: `0XX_description.sql`
3. Run: `DATABASE_URL="..." pnpm --filter @founder-gps/db migrate`
4. The migration runner tracks applied migrations in `schema_migrations` table

### Supabase Schema Push

1. Sync any new repo migrations into Supabase format:
   ```bash
   pnpm db:supabase:sync
   ```
2. Push synced migrations to your linked Supabase project:
   ```bash
   pnpm db:supabase:push
   ```

`db:supabase:push` automatically runs the sync step first, then executes `supabase db push`.

## Deployment

### Vercel (Recommended for Web)

See [docs/vercel-supabase-deploy.md](docs/vercel-supabase-deploy.md) for:
- Setting up Vercel project
- Configuring environment variables
- Deploying with Supabase Postgres
- Smoke testing production endpoints

### Self-Hosted Backend Services

Each service in `apps/*-service/` can be deployed independently:

```bash
# Build auth-service
pnpm --filter @founder-gps/auth-service build

# Run with environment variables
PORT=4005 DATABASE_URL="postgresql://..." node dist/server.js
```

Ensure:
- Each service has a unique port
- `DATABASE_URL` points to your Postgres instance
- API keys are set in environment
- Services can reach each other via `SERVICE_URL` env vars

## Contributing

1. Create a feature branch
2. Make changes and test locally
3. Run `pnpm lint` and `pnpm typecheck`
4. Commit and push
5. Open a pull request

## License

MIT

## Support

For issues or questions:
- Check [docs/](docs/) for architecture and deployment guides
- Review [apps/](apps/) service-specific READMEs
- File an issue on GitHub

---

**Founder GPS** is built for founders who need clarity, not noise. Let's ship it. 🚀
