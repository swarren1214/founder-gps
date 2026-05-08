# Founder GPS - Architecture Plan

## 1. Architecture Goals

Founder GPS should deliver a clear and convincing MVP that proves one core promise: founders get actionable next steps, not just a list of links.

This is a Next.js microservice application: a Next.js web frontend with separately deployed backend microservices.

Architecture goals:

1. Ship quickly for demo readiness with low operational overhead.
2. Keep AI reasoning separate from deterministic logic.
3. Support map and routing features as first class capabilities.
4. Remain modular so services can scale independently after MVP.
5. Favor reliability and debuggability over premature complexity.

## 1.1 Frontend and Mapping Standards (Required)

The MVP UI and mapping stack is standardized as follows:

1. Web frontend framework: Next.js with React.
2. Styling and component system: Tailwind CSS + shadcn/ui components.
3. UI animations: Framer Motion is the standard animation library.
4. Map rendering: MapLibre GL JS.
5. Advanced map overlays and custom pins/icons: deck.gl integrated with MapLibre.
6. Routing system of record: OSRM, using Utah road network data.

## 2. MVP Scope and Service Boundaries

### In Scope (MVP)

1. `web`
2. `intelligence-service`
3. `resource-service`
4. `recommendation-service`
5. `routing-service`
6. `postgres` with PostGIS

### Deferred (Post-MVP)

1. `people-service`
2. `roadmap-service` as a standalone service (roadmap generation can initially live in `intelligence-service`)
3. `enrichment-service`
4. `auth-service`

## 3. System Context

### Primary user flow

1. Founder completes onboarding form in `web`.
2. `web` sends intake to `intelligence-service` for founder analysis.
3. `web` requests candidate resources from `resource-service`.
4. `web` sends founder analysis + resources + founder location to `recommendation-service`.
5. `recommendation-service` ranks resources and returns prioritized recommendations.
6. `web` requests optimized route for top recommendations from `routing-service`.
7. `routing-service` calls OSRM and returns ordered stops + route GeoJSON.
8. `web` requests a 30 day plan from `intelligence-service` using recommendations and founder analysis.
9. UI presents analysis, recommendations, route, and roadmap in a single dashboard flow.

### Key architecture rule

AI provides interpretation and explanations. Deterministic services own filtering, scoring, ranking, routing, and data retrieval.

## 4. Monorepo Layout

```text
founder-gps/
	apps/
		web/
		intelligence-service/
		resource-service/
		recommendation-service/
		routing-service/
	packages/
		shared-types/
		db/
		ai/
		maps/
		config/
		utils/
	docker-compose.yml
	package.json
	pnpm-workspace.yaml
	turbo.json
	.env.example
```

## 5. Service Responsibilities and APIs

### 5.1 web (Next.js)

Implementation standard:

1. Built with Next.js + React.
2. Uses Tailwind CSS for styling.
3. Uses shadcn/ui for reusable UI components.
4. Uses Framer Motion for page transitions and UI animations.

Responsibilities:

1. Onboarding intake and validation.
2. Orchestrate calls to backend services.
3. Render analysis and recommendations.
4. Show map pins, custom icons, and optimized route with MapLibre + deck.gl overlays.
5. Render 30 day action plan.

Routes:

1. `/`
2. `/onboarding`
3. `/dashboard`
4. `/map`
5. `/resources`
6. `/roadmap`

### 5.2 intelligence-service

Responsibilities:

1. Analyze founder profile into structured JSON.
2. Extract needs, risks, and suggested focus.
3. Generate recommendation explanations from ranked outputs.
4. Generate 30 day roadmap narrative and tasks.

Endpoints:

1. `POST /intelligence/analyze-founder`
2. `POST /intelligence/explain-recommendation`
3. `POST /intelligence/generate-roadmap`

Output contract (example):

```ts
type FounderAnalysis = {
	stage: "idea" | "validation" | "mvp" | "launched" | "traction" | "fundraising" | "scale";
	primaryNeeds: string[];
	secondaryNeeds: string[];
	founderType: string;
	confidenceScore: number;
	suggestedFocus: string;
	risks: string[];
};
```

### 5.3 resource-service

Responsibilities:

1. Store and query Utah ecosystem resources.
2. Expose map ready GeoJSON and filtered search.
3. Maintain category and metadata consistency.

Endpoints:

1. `GET /resources`
2. `GET /resources/:id`
3. `POST /resources/search`
4. `GET /resources/map-data`
5. `GET /resources/categories`

### 5.4 recommendation-service

Responsibilities:

1. Score candidate resources against founder context.
2. Rank and prioritize actions.
3. Return machine readable reasons and action suggestions.

Endpoints:

1. `POST /recommendations/generate`
2. `POST /recommendations/rank`

Scoring model (MVP deterministic):

1. Stage match: 35%
2. Need match: 25%
3. Industry match: 15%
4. Proximity: 15%
5. Urgency: 10%

### 5.5 routing-service

Responsibilities:

1. Use OSRM as the routing engine and integrate with OSRM endpoints.
2. Compute route and trip optimization for top recommendations.
3. Return map consumable GeoJSON and summary stats.

Data source requirement:

1. Routing data for Utah is sourced from the existing OSRM data repository already maintained by the team.
2. `routing-service` should consume that prebuilt dataset (or derivative artifacts) rather than rebuilding map extracts during MVP development.

Endpoints:

1. `POST /routing/route`
2. `POST /routing/matrix`
3. `POST /routing/trip`
4. `POST /routing/founder-path`

Output contract (example):

```ts
type FounderRoute = {
	orderedStops: StartupResource[];
	totalDriveTimeMinutes: number;
	totalDistanceMiles: number;
	geojson: GeoJSON.FeatureCollection;
};
```

## 6. Data Architecture

### Primary datastore

Postgres + PostGIS is the system of record for all MVP domain data.

Core tables:

1. `founder_profiles`
2. `startup_resources`
3. `recommendations`
4. `roadmaps`
5. `roadmap_tasks`

Optional now, likely later:

1. `users`
2. `saved_resources`
3. `people`
4. `resource_embeddings`
5. `enrichment_cache`

### Geospatial strategy

1. Store resource location as PostGIS geometry for proximity queries.
2. Store founder coordinates when available.
3. Use DB level filtering to narrow candidates before scoring.
4. Use OSRM for routing, not database geography functions.

## 7. API and Contract Strategy

1. Services are independently deployable and own their APIs.
2. No API gateway for MVP.
3. Frontend calls services through environment variable based base URLs.
4. Shared request and response types live in `packages/shared-types`.
5. Validate all inbound payloads at service boundary.

MVP environment variables:

1. `NEXT_PUBLIC_RESOURCE_SERVICE_URL`
2. `NEXT_PUBLIC_ROUTING_SERVICE_URL`
3. `NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL`
4. `NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL`
5. `OSRM_BASE_URL`
6. `DATABASE_URL`
7. `OPENAI_API_KEY` or `GEMINI_API_KEY`

## 8. AI Architecture

### AI responsibilities

1. Founder stage and need interpretation.
2. Blind spot and risk summarization.
3. Explanation generation for ranked recommendations.
4. 30 day roadmap generation.

### Deterministic responsibilities

1. Candidate retrieval and filtering.
2. Scoring and ranking.
3. Geospatial proximity and routing integration.
4. Data validation and persistence.

### Guardrails

1. Require structured JSON outputs from LLM calls.
2. Apply schema validation with clear fallbacks.
3. Persist both raw AI output and normalized fields for debugging.
4. Log prompt version and model metadata for traceability.

## 9. Frontend Architecture

1. Next.js app router based pages for onboarding and dashboard.
2. Server actions or API routes for orchestration where appropriate.
3. UI implementation baseline: React + Tailwind CSS + shadcn/ui with Framer Motion animations.
4. Dedicated map module for MapLibre + deck.gl layers:
	 1. resource pins
	 2. recommended pins
	 3. founder location
	 4. route polyline
	 5. deck.gl icon and scatter layers for custom pin/icon rendering
	 6. deck.gl text layers for richer marker labeling when needed
5. Dashboard composition:
	 1. Founder analysis panel
	 2. Ranked recommendation list
	 3. Map with selected resource context
	 4. 30 day roadmap checklist

## 9.1 Frontend Dependencies (Implementation Baseline)

Use these dependencies in `apps/web` to enforce stack consistency.

Required runtime dependencies:

1. `next`
2. `react`
3. `react-dom`
4. `tailwindcss`
5. `class-variance-authority`
6. `clsx`
7. `tailwind-merge`
8. `lucide-react`
9. `framer-motion`
10. `maplibre-gl`
11. `deck.gl`
12. `@deck.gl/core`
13. `@deck.gl/layers`
14. `@deck.gl/mapbox`

Required dev dependencies:

1. `typescript`
2. `@types/node`
3. `@types/react`
4. `@types/react-dom`
5. `postcss`
6. `autoprefixer`

Recommended install command:

```bash
pnpm --filter web add next react react-dom tailwindcss class-variance-authority clsx tailwind-merge lucide-react framer-motion maplibre-gl deck.gl @deck.gl/core @deck.gl/layers @deck.gl/mapbox
pnpm --filter web add -D typescript @types/node @types/react @types/react-dom postcss autoprefixer
```

Notes:

1. `deck.gl` + `@deck.gl/mapbox` provides the MapLibre overlay integration used for custom icon/pin layers.
2. shadcn/ui is scaffolded into project components; its runtime helpers are covered by `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react`.
3. Framer Motion should be used for route/page transitions and staged reveal animations in dashboard modules.

## 10. Deployment Topology

### Local development

Use Docker Compose for:

1. `resource-service`
2. `routing-service`
3. `intelligence-service`
4. `recommendation-service`
5. `postgres`
6. `osrm` container backed by the existing Utah dataset from the external OSRM repo

Run `web` either in Docker or locally for fast UI iteration.

OSRM data integration note:

1. Treat the external Utah OSRM repository as the source for `.osrm` routing artifacts.
2. Local source path for artifacts: `/Developer/opswift/monorepo/osrm-data`.
3. Mount or copy those artifacts into the local `osrm` container in Docker Compose.
4. Point `routing-service` to that host via `OSRM_BASE_URL`.

Example Docker Compose snippet:

```yaml
services:
	osrm:
		image: osrm/osrm-backend:latest
		container_name: founder-gps-osrm
		command: osrm-routed --algorithm mld /data/utah-latest.osrm
		ports:
			- "5000:5000"
		volumes:
			- /Developer/opswift/monorepo/osrm-data:/data:ro

	routing-service:
		build: ./apps/routing-service
		environment:
			OSRM_BASE_URL: http://osrm:5000
		depends_on:
			- osrm
```

Snippet notes:

1. The mounted folder must include the full `.osrm` artifact set for `utah-latest.osrm`.
2. If your base filename differs, update the `osrm-routed` command path to match.
3. Use `http://localhost:5000` from host tools and `http://osrm:5000` from other Docker services.

### Production minded approach

1. Deploy each service independently.
2. Keep stateless services horizontally scalable.
3. Use managed Postgres with PostGIS support.
4. Keep OSRM host separate due to memory and data footprint.

## 11. Reliability and Observability

1. Health endpoint per service: `GET /health`.
2. Structured logs with request ID propagation.
3. Timeouts and retries for service to service calls.
4. Circuit breaker or graceful degradation for AI provider errors.
5. Fallback UX states when routing or AI is unavailable.

## 12. Security and Data Protection (MVP Appropriate)

1. Keep API keys in environment variables only.
2. Do not expose server secrets to browser runtime.
3. Input validation on every POST endpoint.
4. Basic rate limiting on AI intensive endpoints.
5. Minimal founder PII collection for demo.

## 13. Build Phases and Milestones

### Phase 1: Foundation

1. Monorepo setup with shared packages.
2. Resource schema and seed data.
3. Resource service API and map data endpoint.
4. Web onboarding shell and dashboard skeleton.

### Phase 2: Intelligence

1. Founder analysis endpoint with structured output.
2. UI rendering for stage, needs, risks, and focus.
3. Persist analysis snapshots for iteration.

### Phase 3: Recommendations

1. Deterministic scoring pipeline.
2. Ranked recommendation API.
3. Explanation generation from AI using ranked output.

### Phase 4: Routing

1. OSRM integration with founder path endpoint.
2. Route visualization in MapLibre.
3. Drive time and stop ordering display.

### Phase 5: Roadmap and Demo Polish

1. 30 day roadmap generation.
2. Loading states and error boundaries.
3. Final demo script alignment and seed data tuning.

## 14. MVP Success Criteria

The architecture is successful if the product can consistently run this end to end flow in demo conditions:

1. Intake founder profile.
2. Produce credible analysis.
3. Return and rank relevant Utah resources.
4. Visualize recommendations on map.
5. Generate optimized founder route.
6. Deliver a practical 30 day action plan.

If all six steps execute with strong UX and reasonable latency, the MVP validates the core Founder GPS thesis.
