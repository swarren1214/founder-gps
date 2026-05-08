Founder GPS — Architecture & Implementation Plan

1. Product Vision

Founder GPS is an AI-powered startup navigation platform that helps founders understand what to do next, who to talk to, and which Utah startup ecosystem resources are most relevant to them.

Core thesis:

Founders do not need more resources. They need clarity.

Founder GPS combines:

* AI founder analysis
* resource recommendations
* people/investor/mentor matching
* Utah startup ecosystem mapping
* OSRM-powered routing
* roadmap generation

The goal is not to build a chatbot. The goal is to build an intelligence layer for founder navigation.

⸻

2. Core User Workflow

Primary Demo Flow

1. Founder enters basic profile:
    * location
    * startup idea
    * industry
    * stage
    * biggest challenge
    * funding status
    * founder background
2. AI analyzes the founder profile.
3. System identifies:
    * founder stage
    * immediate needs
    * likely blind spots
    * best-fit ecosystem resources
4. Map displays recommended Utah startup resources.
5. Recommendation engine ranks the best next actions.
6. Routing service creates an optimized “Founder Path.”
7. Roadmap service generates a 30-day action plan.

⸻

3. Recommended Tech Stack

Frontend

Next.js
React
TypeScript
shadcn/ui
Tailwind CSS
MapLibre GL JS

Backend

Node.js / TypeScript
Fastify or Express
Docker
Postgres
PostGIS
Prisma or Drizzle

AI

OpenAI API or Gemini API
Structured JSON outputs
Embeddings
RAG over resource data

Maps / Routing

MapLibre GL JS
OSRM
Utah OSRM data
GeoJSON
PostGIS

Enrichment

Logo.dev
Brandfetch fallback
favicon fallback
manual seed data
optional web enrichment later

⸻

4. Monorepo Structure

All deployable services live in apps/.

founder-gps/
  apps/
    web/
    intelligence-service/
    resource-service/
    people-service/
    routing-service/
    recommendation-service/
    roadmap-service/
    enrichment-service/
    auth-service/
  packages/
    shared-types/
    db/
    config/
    ai/
    maps/
    utils/
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  turbo.json
  .env.example

Suggested Hackathon Version

Build only the essentials first:

apps/
  web/
  intelligence-service/
  resource-service/
  routing-service/
  recommendation-service/
packages/
  shared-types/
  db/
  ai/
  maps/

Defer these unless time allows:

people-service/
roadmap-service/
enrichment-service/
auth-service/

⸻

5. Service Architecture

5.1 web

The Next.js frontend.

Responsibilities:

* founder onboarding
* AI analysis UI
* resource recommendation display
* MapLibre visualization
* route display
* roadmap/checklist UI
* demo flow orchestration

Key pages:

/
  Landing page
/onboarding
  Founder intake flow
/dashboard
  Founder profile, recommendations, roadmap
/map
  Utah startup map
/resources
  Resource explorer
/roadmap
  30-day plan

⸻

5.2 intelligence-service

The AI reasoning service.

Responsibilities:

* analyze founder intake
* classify startup stage
* extract structured needs
* identify blind spots
* generate recommendation explanations
* generate roadmap narrative
* power founder copilot chat

Example endpoints:

POST /intelligence/analyze-founder
POST /intelligence/extract-needs
POST /intelligence/explain-recommendation
POST /intelligence/chat

Example output:

type FounderAnalysis = {
  stage: "idea" | "validation" | "mvp" | "launched" | "traction" | "fundraising" | "scale";
  primaryNeeds: string[];
  secondaryNeeds: string[];
  industry: string;
  founderType: string;
  confidenceScore: number;
  suggestedFocus: string;
  risks: string[];
};

⸻

5.3 resource-service

Owns startup ecosystem resources.

Responsibilities:

* store organizations
* store events
* store coworking spaces
* store accelerators/incubators
* store startup communities
* expose map-ready resource data
* filter/search resources
* manage resource metadata

Endpoints:

GET  /resources
GET  /resources/:id
POST /resources/search
GET  /resources/map-data
GET  /resources/categories

Resource categories:

type ResourceCategory =
  | "accelerator"
  | "incubator"
  | "investor"
  | "coworking"
  | "university"
  | "event"
  | "mentor"
  | "government"
  | "service_provider"
  | "community";

⸻

5.4 people-service

Owns mentors, investors, advisors, and connectors.

Responsibilities:

* store people profiles
* match founders to people
* classify people by expertise
* support investor/mentor filtering
* enrich founder recommendations beyond organizations

Endpoints:

GET  /people
GET  /people/:id
POST /people/search
POST /people/match

Example person model:

type Person = {
  id: string;
  name: string;
  role: string;
  organization?: string;
  expertise: string[];
  industries: string[];
  stageFit: FounderStage[];
  location?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
};

⸻

5.5 routing-service

Owns OSRM integration.

Responsibilities:

* route between coordinates
* calculate drive time
* calculate distance matrix
* optimize multi-stop founder path
* return GeoJSON for MapLibre
* use Utah OSRM data

Endpoints:

POST /routing/route
POST /routing/matrix
POST /routing/trip
POST /routing/founder-path

Example use case:

Founder is in Lehi. Recommended resources are in Provo, Sandy, and Salt Lake City. Routing service finds the most efficient order and returns travel time plus route geometry.

Example output:

type FounderRoute = {
  orderedStops: StartupResource[];
  totalDriveTimeMinutes: number;
  totalDistanceMiles: number;
  geojson: GeoJSON.FeatureCollection;
};

⸻

5.6 recommendation-service

Owns scoring and ranking.

Responsibilities:

* combine AI analysis, resources, people, and routing data
* score resources against founder profile
* rank recommendations
* explain why each recommendation matters
* determine which resources appear on the map
* generate prioritized next actions

Endpoints:

POST /recommendations/generate
POST /recommendations/rank
POST /recommendations/score-resource

Example scoring model:

fitScore =
  stageMatch       35%
  needMatch        25%
  industryMatch    15%
  proximity        15%
  urgency          10%

Example recommendation:

type Recommendation = {
  id: string;
  resourceId: string;
  score: number;
  priority: "high" | "medium" | "low";
  reason: string;
  recommendedAction: string;
};

⸻

5.7 roadmap-service

Owns founder action plans.

Responsibilities:

* generate 30/60/90 day plans
* convert recommendations into tasks
* track progress
* regenerate roadmap after profile changes
* support checklist UI

Endpoints:

POST /roadmaps/generate
GET  /roadmaps/:founderId
PATCH /roadmaps/tasks/:taskId

Example roadmap:

type Roadmap = {
  founderId: string;
  title: string;
  weeks: RoadmapWeek[];
};
type RoadmapWeek = {
  weekNumber: number;
  goal: string;
  tasks: RoadmapTask[];
};
type RoadmapTask = {
  id: string;
  title: string;
  description: string;
  relatedResourceId?: string;
  status: "todo" | "in_progress" | "done";
};

⸻

5.8 enrichment-service

Owns external data enrichment.

Responsibilities:

* fetch company logos
* enrich organizations from domains
* normalize brand metadata
* cache third-party results
* fallback when enrichment fails

Integrations:

Logo.dev
Brandfetch
favicon fallback
generated initials avatar

Fallback flow:

resource.website
  → Logo.dev
  → Brandfetch
  → favicon
  → generated initials avatar

Endpoints:

POST /enrichment/logo
POST /enrichment/company
POST /enrichment/geocode

⸻

5.9 auth-service

Optional for hackathon MVP.

For speed, use Clerk or Supabase Auth.

Responsibilities:

* user authentication
* sessions
* saved recommendations
* user-owned founder profiles
* future team/workspace support

Endpoints if custom-built:

POST /auth/signup
POST /auth/login
POST /auth/logout
GET  /auth/session

⸻

6. No API Gateway Approach

Each backend service owns its own API.

Frontend calls services directly using environment variables.

Example:

NEXT_PUBLIC_RESOURCE_SERVICE_URL=http://localhost:4001
NEXT_PUBLIC_ROUTING_SERVICE_URL=http://localhost:4002
NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL=http://localhost:4003
NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL=http://localhost:4004

For production, each service can be deployed independently.

web
  → resource-service
  → routing-service
  → intelligence-service
  → recommendation-service

⸻

7. Docker Architecture

Each app has its own container.

apps/
  web/
    Dockerfile
  resource-service/
    Dockerfile
  routing-service/
    Dockerfile
  intelligence-service/
    Dockerfile
  recommendation-service/
    Dockerfile

Example docker-compose.yml:

services:
  web:
    build: ./apps/web
    ports:
      - "3000:3000"
    env_file:
      - .env
  resource-service:
    build: ./apps/resource-service
    ports:
      - "4001:4001"
    env_file:
      - .env
  routing-service:
    build: ./apps/routing-service
    ports:
      - "4002:4002"
    env_file:
      - .env
  intelligence-service:
    build: ./apps/intelligence-service
    ports:
      - "4003:4003"
    env_file:
      - .env
  recommendation-service:
    build: ./apps/recommendation-service
    ports:
      - "4004:4004"
    env_file:
      - .env
  postgres:
    image: postgis/postgis:16-3.4
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: founder_gps
      POSTGRES_USER: founder
      POSTGRES_PASSWORD: founderpass
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:

⸻

8. Database Schema

Use Postgres + PostGIS.

Core tables

users
founder_profiles
startup_resources
people
events
recommendations
roadmaps
roadmap_tasks
saved_resources
resource_embeddings
enrichment_cache

founder_profiles

type FounderProfile = {
  id: string;
  userId?: string;
  name?: string;
  locationCity: string;
  locationLat?: number;
  locationLng?: number;
  startupIdea: string;
  industry?: string;
  stage: FounderStage;
  biggestChallenge: string;
  fundingStatus?: string;
  founderBackground?: string;
  createdAt: Date;
  updatedAt: Date;
};

startup_resources

type StartupResource = {
  id: string;
  name: string;
  category: ResourceCategory;
  description: string;
  website?: string;
  logoUrl?: string;
  address?: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  stageFit: FounderStage[];
  industryFit: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
};

recommendations

type Recommendation = {
  id: string;
  founderProfileId: string;
  resourceId: string;
  score: number;
  priority: "high" | "medium" | "low";
  reason: string;
  recommendedAction: string;
  createdAt: Date;
};

⸻

9. AI Design Principles

Do not let the LLM own everything.

Use AI for:

classification
summarization
need extraction
profile analysis
recommendation explanations
roadmap generation
chat/coplay

Use deterministic services for:

distance
routing
filtering
scoring
ranking
validation
database queries

This makes the system feel intelligent while staying reliable.

⸻

10. AI Workflows

10.1 Founder Intake Analysis

Input:

{
  location: "Lehi, UT",
  idea: "AI tool for service businesses",
  stage: "idea",
  challenge: "I don't know who to talk to or what to do first",
  background: "Product manager with field operations experience"
}

AI output:

{
  stage: "validation",
  primaryNeeds: [
    "customer_discovery",
    "mentor_network",
    "prototype_strategy"
  ],
  suggestedFocus: "Validate problem before building full MVP",
  risks: [
    "Building too early",
    "Unclear buyer persona",
    "No defined distribution channel"
  ],
  confidenceScore: 0.87
}

⸻

10.2 Resource Matching

Recommendation service receives:

FounderProfile
FounderAnalysis
StartupResources
People
OSRM distance matrix

Then it scores resources.

AI is used only for explanation:

“You should start with Silicon Slopes because your immediate need is founder community and early customer conversations. It is nearby and relevant to B2B SaaS founders.”

⸻

10.3 Roadmap Generation

Input:

Founder profile
Top recommendations
Stage
Needs
Constraints

Output:

30-day founder action plan

Example:

Week 1: Validate the problem
Week 2: Talk to ecosystem mentors
Week 3: Build prototype scope
Week 4: Prepare pitch and next-step plan

⸻

11. MapLibre Implementation

Core map features

MVP:

* Utah map
* resource pins
* category filters
* marker clustering
* selected resource side panel
* recommended resources highlighted
* route line from founder location to recommended stops

Stretch:

* ecosystem density heatmap
* region polygons
* animated founder path
* drive-time rings
* resource score layers

Map layers

resources-layer
recommended-resources-layer
route-line-layer
founder-location-layer
cluster-layer

Map data format

Use GeoJSON.

type ResourceFeature = {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    name: string;
    category: ResourceCategory;
    score?: number;
    logoUrl?: string;
  };
};

⸻

12. OSRM Usage

Use existing Utah OSRM data.

OSRM capabilities

/route
  Point A to point B
/table
  Matrix between founder/resources
/trip
  Optimized multi-stop route
/nearest
  Snap coordinates to road network

Founder Path flow

Founder location
  → top recommended resources
  → routing-service calls OSRM trip
  → returns ordered stops
  → frontend displays route on MapLibre

⸻

13. Integrations

Required MVP

Integration	Purpose
OpenAI or Gemini	AI analysis and roadmap generation
MapLibre	Interactive map
OSRM	Routing and drive-time intelligence
Postgres/PostGIS	Data storage and geographic queries
Logo.dev	Company logos
Brandfetch	Logo fallback

Optional Stretch

Integration	Purpose
Supabase Auth	User accounts
Google Places	Business/address enrichment
Luma/Eventbrite	Startup events
Exa/Tavily/SerpAPI	Web enrichment
Resend	Email founder roadmap
LinkedIn OAuth	Import authenticated founder profile only

LinkedIn Note

LinkedIn is not useful for bulk enrichment of investors or mentors. It can be used only for authenticated user profile import if approved.

Do not build around LinkedIn scraping.

⸻

14. Hackathon MVP Scope

Must build

Founder onboarding
AI founder analysis
Resource database
Recommendation ranking
MapLibre resource map
OSRM founder route
30-day roadmap output

Nice to build

Logo enrichment
Resource detail cards
Save/bookmark resource
People matching
Event recommendations
Founder copilot chat

Cut if needed

Auth
Full admin portal
Real-time event ingest
Complex vector search
Investor CRM
Multi-user workspaces

⸻

15. Demo Narrative

Pitch

Founder GPS is an AI-powered navigation system for entrepreneurs. Instead of giving founders a giant directory of resources, it analyzes who they are, where they are, what stage they are in, and what they need next. Then it recommends the best resources, maps them, routes them, and turns everything into a clear action plan.

Demo script

1. “I’m a first-time founder in Lehi building B2B SaaS.”
2. Founder GPS analyzes my startup stage.
3. It identifies my top needs.
4. It recommends the best Utah resources.
5. The map lights up.
6. It creates my optimized Founder Path.
7. It generates a 30-day roadmap.
8. I leave with clarity.

⸻

16. Build Order

Phase 1 — Foundation

Create monorepo
Set up Next.js web app
Set up shadcn/ui
Set up MapLibre
Create resource seed data
Set up resource-service

Phase 2 — Intelligence

Create intelligence-service
Build founder analysis endpoint
Use structured JSON output
Display analysis in UI

Phase 3 — Recommendations

Create recommendation-service
Implement deterministic scoring
Call resource-service
Call intelligence-service
Return ranked recommendations

Phase 4 — Routing

Create routing-service
Connect to local OSRM
Create founder-path endpoint
Return ordered stops and GeoJSON
Display route in MapLibre

Phase 5 — Polish

Add resource cards
Add logos
Add roadmap UI
Add loading states
Add demo data
Add pitch-ready visuals

⸻

17. Suggested Initial Seed Resources

Seed 15–30 Utah startup ecosystem resources manually.

Categories:

Silicon Slopes
Utah Tech Week
UVU Business Resource Center
BYU Rollins Center
Lassonde Entrepreneur Institute
Kiln
RevRoad
BoomStartup
47G
Utah Innovation Center
World Trade Center Utah
MountainWest Capital Network
Kickstart Fund
Peterson Ventures
Album VC
Pelion Venture Partners

Enough to make the demo feel real.

⸻

18. Environment Variables

OPENAI_API_KEY=
GEMINI_API_KEY=
DATABASE_URL=
LOGO_DEV_API_KEY=
BRANDFETCH_API_KEY=
OSRM_BASE_URL=http://localhost:5000
NEXT_PUBLIC_RESOURCE_SERVICE_URL=http://localhost:4001
NEXT_PUBLIC_ROUTING_SERVICE_URL=http://localhost:4002
NEXT_PUBLIC_INTELLIGENCE_SERVICE_URL=http://localhost:4003
NEXT_PUBLIC_RECOMMENDATION_SERVICE_URL=http://localhost:4004

⸻

19. Success Criteria

Founder GPS should demonstrate:

* personalization
* clarity
* real recommendations
* map-based intelligence
* routing intelligence
* useful roadmap
* polished UI
* scalable architecture

A judge should walk away thinking:

“This is not just a chatbot. This could actually become the startup navigation layer for Utah.”

⸻

20. Final MVP Recommendation

Build this version:

web
resource-service
intelligence-service
recommendation-service
routing-service
Postgres/PostGIS
MapLibre
OSRM
OpenAI/Gemini
Logo.dev fallback chain

The winning feature is:

AI-generated founder roadmap + resource recommendations + MapLibre visualization + OSRM-powered Founder Path.

That is the whole product in one sentence.