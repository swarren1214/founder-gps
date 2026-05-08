# Founder GPS Demo Runbook

## Overview

This runbook provides step-by-step instructions for demoing Founder GPS to judges, investors, or stakeholders. The demo showcases the complete MVP: founder intake → AI analysis → recommendations → map visualization → routing intelligence → 30-day roadmap.

**Total Time: ~8 minutes** (5 minutes core demo + 3 minutes Q&A)

---

## Pre-Demo Setup

### 1. Start Local Services

Before beginning the demo, ensure all services are running:

```bash
# In the root directory
pnpm dev

# Or using Docker Compose
docker-compose up -d
```

Wait 10-15 seconds for all services to become ready. Verify with health checks:

```bash
curl http://localhost:3000/health     # web
curl http://localhost:4001/health     # resource-service
curl http://localhost:4002/health     # routing-service
curl http://localhost:4003/health     # intelligence-service
curl http://localhost:4004/health     # recommendation-service
```

### 2. Open Browser

- **Main Demo**: http://localhost:3000
- **API Verification** (optional): Use curl or Postman for service diagnostics
- **Terminal**: Keep a terminal visible to show request logs if needed

### 3. Network & Connectivity

- Ensure stable internet connection (AI calls may timeout on poor connections)
- Have a backup mode ready (canned JSON responses) if services become unavailable
- If OSRM routing fails, the demo still works—just note "routing optimization unavailable"

---

## The Demo Script (8 Steps)

### Step 1: Landing Page (0:00–0:30)

**Narrative**: "Founder GPS is an AI-powered navigation system for entrepreneurs. Instead of giving founders a giant directory of resources, we analyze who they are, where they are, what stage they are in, and what they need next. Then we recommend the best resources, map them, route them, and turn everything into a clear action plan."

**Action**:
1. Navigate to http://localhost:3000
2. Show the landing page hero: "Founders do not need more directories. They need a route."
3. Highlight the three pillars:
   - ✨ Founder analysis
   - 📍 Resource ranking
   - 🚗 Founder Path routing
4. Point out: "Demo-ready flow: Intake to dashboard is already wired to the backend services."

**Key Message**: We're not building a chatbot. We're building an intelligence layer.

---

### Step 2: Founder Onboarding (0:30–2:00)

**Narrative**: "Let's start by having a founder describe themselves."

**Action**:
1. Click "Start founder intake" button
2. **Step 1 (Founder Profile)**:
   - Show the form fields:
     - Location city: **Lehi** (pre-filled)
     - Industry: **B2B SaaS** or **AI/ML**
     - Startup idea: "A workflow copilot for service businesses"
     - Stage: **validation** (select from dropdown)
   - Click "Continue"
   - Point out: "The form validates as you go, and we have preset personas for rapid iteration."

3. **Step 2 (Momentum & Blockers)**:
   - Challenge: "I don't know who to talk to or what to do next"
   - Funding status: **bootstrapped**
   - Background: "Product manager with field operations experience"
   - Click "Continue"
   - Say: "We're capturing founder context that drives everything downstream."

4. **Step 3 (Demo Tuning)**:
   - Category filter: **community**
   - City filter: **Lehi**
   - Top recommendations: **4** (default, OK)
   - Say: "These tuning options let us control which resources show up on the map."
   - Click "Generate founder dashboard"
   - **Wait for response** (~5–10 seconds)

**Key Message**: Structured intake = better analysis downstream.

---

### Step 3: Dashboard Overview (2:00–3:30)

**Narrative**: "Once the founder completes intake, Founder GPS instantly generates a complete dashboard with analysis, recommendations, routing, and a 30-day plan."

**Dashboard Components** (in reading order):

1. **Top Hero Card**:
   - Stage: **validation**
   - Confidence: **87%**
   - Route duration: **24m** (or "Pending" if routing isn't ready)
   - Say: "The AI analyzed the founder profile and classified their stage. The confidence score reflects how certain the system is about that classification."

2. **Founder Analysis Sidebar** (right side):
   - Primary needs: **customer_discovery**, **mentor_network**, **prototype_strategy**
   - Risks: "Building too early", "Unclear buyer persona", "No defined distribution channel"
   - Say: "The AI identified immediate needs and potential blind spots. This guides the recommendations."

3. **Map + Route** (center, top):
   - Show the Utah map with resource pins
   - Orange line = optimized Founder Path
   - Pins = recommended resources (highlighted in larger icons)
   - Say: "The map shows all available resources. The orange route is OSRM-powered optimization—it visits the founder's recommended resources in the most efficient order."

4. **Recommendations Card** (right side, middle):
   - Show 3–4 recommendations with priority badges
   - Click on each to show reason and recommended action
   - Example: "Silicon Slopes: High priority. You should start here because your immediate need is founder community..."
   - Say: "These are deterministically ranked. Each recommendation is scored 35% stage match, 25% needs match, 15% industry match, 15% proximity, 10% urgency."

5. **30-Day Roadmap Card** (bottom right):
   - Show week-by-week breakdown:
     - Week 1: Validate the problem
     - Week 2: Talk to ecosystem mentors
     - Week 3: Build prototype scope
     - Week 4: Prepare pitch and next-step plan
   - Say: "The roadmap converts recommendations into concrete weekly milestones. The founder knows exactly what to do next."

**Key Message**: The dashboard connects intelligence, recommendations, geography, and time into one unified experience.

---

### Step 4: Map & Routing Deep Dive (3:30–5:00)

**Narrative**: "Let's focus on the map intelligence."

**Action**:
1. Hover over different resource pins to show details
2. Explain the category color coding:
   - **Dark Navy**: Founder location
   - **Teal**: Community resources
   - **Orange**: Investor resources
   - **Blue**: University resources
   - **Purple**: Coworking spaces
3. Point to the orange Founder Path route:
   - "This is an optimized multi-stop route using OSRM (Open Source Routing Machine)"
   - "It starts at the founder's location (Lehi)"
   - "It visits the top 3–4 recommended resources in the most efficient order"
   - "Total drive time: XX minutes, XX miles"
4. Say: "The founder can use this to plan a real-world visit to the ecosystem. It's not theoretical—it's actionable."

**Optional Deep Dive** (if time allows):
- Show the distance matrix calculation: "We computed drive times between the founder and every resource"
- Show the OSRM trip optimization: "OSRM figures out the best order to visit all stops"
- Say: "This is what makes Founder GPS different. We don't just recommend resources. We route them."

**Key Message**: Geographic intelligence + routing = clarity for founders.

---

### Step 5: Architecture & Reliability (5:00–6:00)

**Narrative**: "Under the hood, Founder GPS is built on a scalable microservice architecture."

**Action** (optional, if showing architecture):
1. Open architecture diagram (if available)
2. Show 5 services:
   - 🧠 **Intelligence Service**: AI analysis + roadmap generation
   - 📦 **Resource Service**: Database of 15+ Utah startups
   - 🎯 **Recommendation Service**: Deterministic scoring
   - 🗺️ **Routing Service**: OSRM integration
   - 🌐 **Web**: Next.js frontend
3. Say: "Each service is independent. If one fails, the others keep working. Request IDs trace calls across services. Timeouts prevent cascading failures."
4. Mention: "Resources cache for 1 hour. AI calls have rate limiting (20/min). The system is built for reliability."

**Key Message**: This isn't a prototype. It's production-ready.

---

### Step 6: Fallback & Resilience (6:00–6:30)

**Narrative**: "If a service becomes unavailable, the demo still works."

**Show**:
1. If routing is unavailable: "Routing optimization unavailable. Map visualization may be limited." (still shows resources & recommendations)
2. If roadmap generation fails: "Roadmap generation unavailable. Use recommendations as action items." (still shows full dashboard)
3. Say: "Critical path (analysis + recommendations) always works. Optional features (routing, roadmap) degrade gracefully."

**Key Message**: Resilience = reliability for demos.

---

### Step 7: Try Another Persona (6:30–7:00)

**Optional, if time allows**:
1. Go back to home page
2. Click "Open dashboard preview" or reload and enter a different persona:
   - **Provo Deeptech Builder**: "Computer-vision system for manufacturers"
   - Different needs, different resources, different roadmap
3. Say: "The system personalizes to each founder. Same infrastructure, different outcomes."

**Key Message**: The system scales across founder archetypes.

---

### Step 8: Close & Key Takeaway (7:00–8:00)

**Narrative**: "In 7 minutes, we went from founder intake to a complete navigation plan. Here's why this matters:

1. **Founders get clarity.** Not a directory—a route.
2. **AI + deterministic logic.** We use AI for interpretation, not random outputs. Every recommendation is scored and explained.
3. **Personalization at scale.** Utah startups have 15+ resources. We help founders prioritize by stage, need, and location.
4. **Production-ready architecture.** Microservices, caching, rate limiting, fallbacks. This is not a demo hack.
5. **Actionable roadmap.** The founder leaves with a 30-day plan, not a list."

**Final Message**:

> **"Founder GPS is an AI-powered navigation layer for the Utah startup ecosystem. It analyzes who founders are, where they are, what they need, and what's nearby—then delivers a clear route and action plan. This is the intelligence layer Utah startups deserve."**

---

## Backup Plans

### If Services Are Slow

- Mention: "We have timeouts set to 8 seconds per service call. If a call is slow, it will timeout gracefully."
- Fall back to pre-recorded dashboard JSON if needed.

### If OSRM Routing Fails

- Say: "Routing service is unavailable. The recommendations and analysis still work. This shows our resilience design."
- Skip the map deep dive; focus on recommendations instead.

### If AI Analysis Fails

- Use a canned analysis response from the test suite.
- Say: "The AI is rate-limited at 20 analyses per minute. Here's a sample output."

### If Web Is Slow

- Open a second browser tab with the pre-rendered dashboard.
- Show the JSON response in the browser console (`Network` tab).
- Explain: "The API call succeeded; we're just rendering. Here's the raw data."

---

## Demo Metrics

Track these during demo:

- ⏱️ **Total time**: Aim for 7–8 minutes
- 🚀 **Founder flow latency**: ~5–10 seconds from "Generate" click to dashboard load
- 🎯 **Recommendations count**: Should be 3–5 items
- 📍 **Map pins visible**: 15+ resources should be on the map
- 🗓️ **Roadmap weeks**: Should show 4+ weeks with tasks

---

## Common Questions & Answers

| Question | Answer |
|----------|--------|
| **"Who built this?"** | A team of engineers focused on startup navigation. This MVP was built in ~4 weeks using a modular architecture. |
| **"How do you get new resources?"** | For MVP, we seed 15–30 Utah resources manually. Post-MVP, we'd integrate with public APIs and founder submissions. |
| **"What if a founder is not in Utah?"** | Today, the demo focuses on Utah. Post-MVP, we'd expand to other ecosystems using the same architecture. |
| **"How do you avoid algorithmic bias?"** | Our scoring is fully transparent and deterministic. We weight stage, need, industry, proximity, and urgency equally. No black-box ML. |
| **"What's your revenue model?"** | Not discussed in MVP. Potential models: freemium for founders, paid listings for resources, B2B SaaS for ecosystem operators. |
| **"How long to build this?"** | MVP (5 services, 20 resources, full flow): ~4 weeks with 2–3 engineers. |
| **"Can this scale?"** | Yes. Each service is stateless, resource-cacheable, and horizontally scalable. Postgres + PostGIS handles 1M+ resources. |

---

## Post-Demo

1. **Collect feedback**: Ask judges/investors what resonated most.
2. **Offer to send**: Architecture diagram, codebase link (if open-source), API docs.
3. **Next steps**: "We'd love to validate with real Utah founders and resource operators."
4. **Thank you**: "Thanks for checking out Founder GPS."

---

## Demo Checklist

Before starting:

- [ ] All services are running (`pnpm dev` or `docker-compose up`)
- [ ] Web is accessible at http://localhost:3000
- [ ] Network connection is stable
- [ ] Browser is zoomed to 100% (comfortable for watching)
- [ ] Backup JSON responses are prepared (in case of timeouts)
- [ ] You've practiced the script (2–3 times)
- [ ] You know the latitude/longitude of demo locations (Lehi: 40.3916, -111.8508; Provo: 40.2338, -111.6585)
- [ ] You have 2 preset personas memorized
- [ ] You can explain the scoring model (35% stage, 25% needs, 15% industry, 15% proximity, 10% urgency)
- [ ] You're ready to pivot if a service fails

---

## Success Criteria

The demo succeeds if the judge/investor walks away thinking:

> "This is not just a chatbot. This could actually become the startup navigation layer for Utah."

If they're thinking that, you've nailed it. 🎯
