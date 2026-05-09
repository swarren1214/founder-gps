# LLM Intelligence Implementation Plan

## 1. Objective

Build a production-grade founder copilot chat that can:

- respond with rich markdown formatting and optional emoji tone
- speak with clear, founder-friendly, clever language without becoming verbose
- retrieve and reason over first-party data (founder profile, startup data, resources, recommendations, roadmap)
- synthesize actionable recommendations from combined signals
- execute in-app actions safely on the user's behalf (with approval and audit trail)

This plan is aligned with existing services and routes already in the repo, especially the intelligence, recommendation, and web API layers.

## 2. Product Requirements

### 2.1 Functional Requirements

- Conversational UX
- Markdown output (headings, bullets, short tables, callouts)
- Optional emoji style mode (user preference or inferred tone)
- Context-aware follow-up questions and concise summaries

- Data-aware intelligence
- Read user founder profile and onboarding context
- Read startups and resources catalog
- Read recommendation results and map/filter state
- Ground responses in retrieved data, with explicit references in the response content

- Recommendation synthesis
- Combine profile + current stage + local ecosystem resources + startup landscape
- Produce ranked recommendations with rationale, risk, and next action
- Generate alternatives when confidence is low

- Agentic app interaction
- Perform app actions via tools (filter map, save recommendation, build roadmap draft, navigate tabs, etc.)
- Require confirmation for mutating or high-impact actions
- Return human-readable action receipts

### 2.2 Non-Functional Requirements

- p95 chat latency under 4.0s for normal turns, under 6.0s for tool-heavy turns
- 99.9% API reliability target for orchestration layer
- end-to-end traceability with request IDs and step-level logs
- strict schema validation for all model and tool I/O
- safe fallback behavior when dependencies are unavailable

## 3. Current State (Baseline)

- Intelligence service already supports structured AI tasks:
	- analyze founder
	- explain recommendation
	- generate roadmap
	- map chat
- Web routes already proxy map chat and founder flow orchestration.
- Recommendation service already ranks resources.
- Resource service already exposes resources and startups.

Gap: current AI patterns are mostly single-turn, task-specific JSON generation. We need a multi-turn orchestrator with memory, retrieval, synthesis, and action execution.

## 4. Target Architecture

## 4.1 New Capability: Chat Orchestrator

Add a chat orchestration layer in the intelligence service:

- New route: POST /intelligence/chat
- Responsibilities:
	- build conversation context
	- retrieve relevant app data
	- decide when to call tools
	- synthesize final response
	- emit UI-safe markdown + structured metadata

## 4.2 Chat Pipeline

For each user turn:

1. Parse input and validate session/user context.
2. Retrieve context bundle:
	 - founder profile
	 - founder analysis snapshot (latest)
	 - candidate resources/startups/recommendations
	 - prior conversation memory (short-term + semantic summary)
3. Plan step:
	 - classify intent (ask, compare, recommend, act, clarify)
	 - detect whether tool/action call is needed
4. Execute tool calls (if needed).
5. Synthesize response with:
	 - markdown body
	 - citations to data entities (ids/names)
	 - structured cards for frontend rendering
	 - confidence + follow-up suggestions
6. Persist transcript, tool traces, and outcome.

## 4.3 Model Strategy

- Primary model: high-quality reasoning model for synthesis + tool selection.
- Secondary model: cost-efficient model for rewrite/tone transforms when needed.
- Fallback model/provider path to preserve availability.

Keep strict JSON schema for machine output from the model, then transform to user-facing markdown.

## 5. Data Integration Plan

## 5.1 Unified Context Adapter

Implement a context adapter in intelligence service that fetches and normalizes:

- Founder profile and onboarding fields
- Founder analysis snapshot
- Recommendations and ranking scores
- Resources list + filters
- Startups list + sectors/stages/location tags

Output one typed ContextBundle object for prompts and tools.

## 5.2 Retrieval Strategy

- Deterministic retrieval first:
	- exact profile fields, selected tabs, active filters, top recommendations
- Optional semantic retrieval second:
	- fetch top-k historical turns and notes relevant to current query
- Hard token budget guardrails:
	- summary compaction when context exceeds token ceiling

## 6. Recommendation Synthesis Engine

Add a synthesis module layered on top of existing recommendation ranking:

- Inputs:
	- profile traits (stage, funding status, challenge, background)
	- ranked resources
	- startups and ecosystem signals
	- active user goal from current chat
- Outputs:
	- ranked action plan (top 3-5 actions)
	- why this matters now
	- tradeoffs and risks
	- execution checklist for next 7 days

Scoring dimensions:

- relevance to current stage/challenge
- effort vs impact
- time-to-first-value
- confidence (data coverage and agreement)

## 7. App Action Framework (Agentic Capabilities)

## 7.1 Tool Contract

Define tool interfaces with zod schemas:

- filter_map
- change_tab
- save_recommendation
- generate_roadmap_draft
- explain_recommendation
- refresh_founder_analysis

Each tool returns:

- status (success/failure)
- user-facing receipt text
- machine metadata
- reversible action info when applicable

## 7.2 Permission and Confirmation Model

- Read-only actions: allowed automatically
- Mutating actions: require explicit user confirmation
- High-impact actions (future external integrations): two-step confirmation

## 7.3 Reliability

- tool timeout and retry policy per action type
- partial success handling and graceful degradation
- deterministic error messaging to user

## 8. Response Quality and Style

## 8.1 Output Contract

Return both:

- responseMarkdown (for chat display)
- responsePayload (typed cards/actions/suggestions for UI)

## 8.2 Style Controls

- tone preset: concise, encouraging, strategic, technical
- emoji mode: off, light, expressive
- verbosity: short, standard, deep dive

## 8.3 Guardrails

- no fabricated data claims
- call out uncertainty and missing data
- avoid overconfident recommendations when evidence is weak

## 9. API and Schema Changes

## 9.1 Intelligence Service

Add:

- POST /intelligence/chat
- POST /intelligence/chat/action (optional split for explicit action execution)
- GET /intelligence/chat/session/:id (history and summaries)

## 9.2 Web App API

Add:

- app/api/chat/route.ts as BFF endpoint for UI
- streaming support (SSE or chunked response) for progressive rendering

## 9.3 Shared Types

Add typed contracts in shared-types for:

- ChatRequest / ChatResponse
- ContextBundle
- ToolInvocation / ToolResult
- RecommendationSynthesis
- ChatCitation

## 10. Persistence and Observability

## 10.1 Storage

Store per session:

- user turns and assistant turns
- context summaries
- tool invocations + results
- recommendation snapshots shown to user

## 10.2 Metrics

- latency by phase (retrieve, model, tools, render)
- tool call rate and tool failure rate
- fallback model usage
- user acceptance rate of suggested actions
- recommendation click/save conversion

## 10.3 Evaluation

Create an offline eval set of founder prompts across stages and industries.

Track:

- factual grounding accuracy
- recommendation usefulness (human rating rubric)
- action correctness
- tone/format quality

## 11. Security, Privacy, and Compliance

- Minimize PII in prompts by default (mask where not needed).
- Store only required transcript fields.
- Add redaction rules for logs and traces.
- Enforce per-user access control in all context fetchers.
- Add prompt-injection defenses:
	- tool allowlist
	- system policy priority
	- untrusted text isolation markers

## 12. Rollout Plan

## Phase 1: Foundations (Week 1)

- Create chat contracts and schemas.
- Add intelligence chat endpoint skeleton.
- Implement context adapter (profile/resources/startups/recommendations).
- Add transcript persistence and baseline logs.

Exit criteria:

- chat endpoint responds with grounded markdown from deterministic context

## Phase 2: Synthesis + Quality (Week 2)

- Add recommendation synthesis engine.
- Add style controls (formatting, verbosity, emoji mode).
- Add uncertainty and citation behavior.
- Build evaluation harness and initial test set.

Exit criteria:

- recommendations are ranked with rationale and pass baseline quality gates

## Phase 3: Agentic Actions (Week 3)

- Implement tool contract and action executor.
- Add confirmation UX for mutating actions.
- Add receipts and undo where possible.
- Add reliability guards (timeouts/retries/fallback text).

Exit criteria:

- assistant can safely perform approved in-app actions

## Phase 4: Streaming + Hardening (Week 4)

- Add streaming response path in web BFF.
- Add advanced observability dashboards.
- Run load and resilience tests.
- Tune prompts/models for latency and quality.

Exit criteria:

- p95 and reliability targets met in staging

## Phase 5: Controlled Launch (Week 5)

- Canary release to internal users.
- Gather feedback and error analytics.
- Iterate on recommendation quality and action confidence thresholds.

Exit criteria:

- launch-readiness checklist complete and approved

## 13. Test Strategy

- Unit tests:
	- schema validation
	- scoring/synthesis logic
	- tool policy enforcement
- Integration tests:
	- intelligence chat route with mocked downstream services
	- action confirmation flows
- End-to-end tests:
	- real chat flow in web app with streamed output
	- map/filter actions reflected in UI state
- Regression suite:
	- golden prompts for style, formatting, and grounding

## 14. Risks and Mitigations

- Risk: Hallucinated recommendations
	- Mitigation: strict grounding + citation requirement + low-confidence fallback

- Risk: Slow responses with heavy context
	- Mitigation: context compaction + staged retrieval + streaming

- Risk: Unsafe or unintended app actions
	- Mitigation: action allowlist + confirmation gates + audit logs + reversible ops

- Risk: Cross-service failures degrade UX
	- Mitigation: partial responses, warnings, and deterministic fallback messaging

## 15. Immediate Next Engineering Tasks

1. Add shared chat and tool schemas.
2. Implement POST /intelligence/chat with context adapter and deterministic response draft.
3. Add web app BFF endpoint for chat (non-streaming first).
4. Add transcript persistence table/model and logging.
5. Build first 30-prompt eval set and automate scoring report.

---

## 16. Implementation Checklist

### Phase 1 — Foundations

#### Shared Types (`packages/shared-types`)
- [ ] Define `ChatMessage` type (`role`, `content`, `createdAt`, `id`)
- [ ] Define `ChatRequest` type (`sessionId`, `userId`, `message`, `stylePrefs`)
- [ ] Define `ChatResponse` type (`responseMarkdown`, `responsePayload`, `citations`, `suggestions`, `metadata`)
- [ ] Define `ContextBundle` type (profile, analysis, resources, startups, recommendations)
- [ ] Define `ChatCitation` type (`entityId`, `entityType`, `label`, `url`)
- [ ] Define `ToolInvocation` type (`tool`, `input`, `status`, `result`, `durationMs`)
- [ ] Define `ToolResult` type (`status`, `receipt`, `metadata`, `reversible`)
- [ ] Define `RecommendationSynthesis` type (`rankedActions`, `rationale`, `risks`, `nextSteps`)
- [ ] Define `StylePrefs` type (`tone`, `emojiMode`, `verbosity`)
- [ ] Export all new types from `packages/shared-types/src/index.ts`

#### AI Package (`packages/ai`)
- [ ] Add `chatPrompt()` function to `prompts.ts` with system policy, grounding rules, and injection defenses
- [ ] Add `ChatInputSchema` and `ChatOutputSchema` to `schemas.ts`
- [ ] Add `AiTask` variant `"chat"` to `service.ts`
- [ ] Add `chat(input: ChatInput): Promise<AiResult<ChatOutput>>` method to `AiService`
- [ ] Implement streaming-compatible overload (returns `AsyncIterable<string>`) for future use
- [ ] Add `PROMPT_VERSIONS.chat` constant

#### Intelligence Service — Context Adapter
- [ ] Create `src/context-adapter.ts` in intelligence service
- [ ] Implement `buildContextBundle(userId, sessionId)` function
  - [ ] Fetch founder profile from resource service or DB
  - [ ] Fetch latest founder analysis snapshot from repository
  - [ ] Fetch top recommendations from recommendation service
  - [ ] Fetch resources list (filtered to user location/stage)
  - [ ] Fetch startups list (all, paginated if needed)
- [ ] Add token-budget estimator to compact context when it exceeds ceiling
- [ ] Write unit tests for context adapter with mocked service responses

#### Intelligence Service — Chat Route
- [ ] Create `src/routes/chat.ts`
- [ ] Implement `POST /intelligence/chat` endpoint
  - [ ] Validate request body against `ChatInputSchema`
  - [ ] Call `buildContextBundle()` with user/session IDs
  - [ ] Classify intent (`ask`, `compare`, `recommend`, `act`, `clarify`)
  - [ ] Build system prompt with context bundle and style prefs
  - [ ] Call `aiService.chat()` with assembled prompt
  - [ ] Validate response against `ChatOutputSchema`
  - [ ] Return `ChatResponse` with markdown, citations, and suggestions
- [ ] Implement `GET /intelligence/chat/session/:id` to retrieve history and summaries
- [ ] Register chat routes in `src/app.ts`
- [ ] Add step-level structured logging with request IDs at each pipeline stage

#### Persistence — Chat Transcript
- [ ] Write SQL migration to create `chat_sessions` table (`id`, `user_id`, `created_at`, `updated_at`)
- [ ] Write SQL migration to create `chat_messages` table (`id`, `session_id`, `role`, `content`, `tool_invocations`, `citations`, `created_at`)
- [ ] Write SQL migration to create `chat_context_snapshots` table (`id`, `session_id`, `bundle_hash`, `created_at`)
- [ ] Add repository methods: `createSession`, `appendMessage`, `getSession`, `getMessages`
- [ ] Add `IntelligenceRepository` methods for chat in `src/repository.ts`

#### Web BFF (`apps/web/app/api/chat`)
- [ ] Create `app/api/chat/route.ts`
- [ ] Validate session/auth before forwarding to intelligence service
- [ ] Proxy `ChatRequest` to `POST /intelligence/chat`
- [ ] Return `ChatResponse` to frontend
- [ ] Return structured error responses for all failure cases

**Phase 1 Exit Gate:** `/api/chat` returns grounded markdown using deterministic context with no hallucinated data.

---

### Phase 2 — Synthesis + Quality

#### Recommendation Synthesis Engine
- [ ] Create `src/synthesis.ts` in intelligence service
- [ ] Implement `synthesizeRecommendations(bundle: ContextBundle, goal: string): RecommendationSynthesis`
  - [ ] Score resources on relevance, effort vs impact, time-to-value, confidence
  - [ ] Produce top 3–5 ranked actions with rationale
  - [ ] Generate tradeoffs and risks section
  - [ ] Generate 7-day execution checklist
- [ ] Wire synthesis output into chat response payload
- [ ] Write unit tests for scoring logic (multiple stage/industry combinations)

#### Style Controls
- [ ] Parse `StylePrefs` from `ChatRequest` in chat route
- [ ] Add tone variants to `chatPrompt()` (`concise`, `encouraging`, `strategic`, `technical`)
- [ ] Add emoji mode injection to system prompt (`off`, `light`, `expressive`)
- [ ] Add verbosity instruction to system prompt (`short`, `standard`, `deep dive`)
- [ ] Write tests asserting style variants change prompt content

#### Citation and Uncertainty Behavior
- [ ] Implement citation extraction from model output (match entity IDs/names in response to context bundle)
- [ ] Add grounding check: flag responses that reference entities not present in context bundle
- [ ] Add low-confidence fallback path: return alternative suggestions when confidence < threshold
- [ ] Add "I don't have enough data" response path for missing context scenarios

#### Evaluation Harness
- [ ] Create `scripts/eval/` directory
- [ ] Write 30 golden founder prompts across stages (idea, pre-seed, seed) and industries (SaaS, marketplace, hardware, health)
- [ ] Write scoring script: factual grounding, recommendation relevance, tone/format quality
- [ ] Integrate eval script into CI (run on schedule or PR label trigger)
- [ ] Define minimum passing thresholds for each dimension

**Phase 2 Exit Gate:** Recommendations are ranked with rationale, scored by eval harness, and pass all baseline quality gates.

---

### Phase 3 — Agentic Actions

#### Tool Contract (`packages/shared-types` + `packages/ai`)
- [ ] Define `ToolDefinition` interface (`name`, `description`, `inputSchema`, `outputSchema`, `requiresConfirmation`, `reversible`)
- [ ] Implement tool definitions with zod schemas for:
  - [ ] `filter_map` (categories, sectors, states, keywords)
  - [ ] `change_tab` (tab name)
  - [ ] `save_recommendation` (resource ID, note)
  - [ ] `generate_roadmap_draft` (stage, needs, constraints)
  - [ ] `explain_recommendation` (resource ID)
  - [ ] `refresh_founder_analysis` (no input required)
- [ ] Add `tools` field to `ChatRequest` and `ChatResponse`
- [ ] Add tool call detection and parsing to chat pipeline

#### Action Executor (`intelligence service`)
- [ ] Create `src/action-executor.ts`
- [ ] Implement `executeToolCall(tool: ToolInvocation, context: ContextBundle): Promise<ToolResult>`
- [ ] Add tool allowlist enforcement (reject any tool not in registered list)
- [ ] Add per-tool timeout and retry config
- [ ] Add audit log entry for every tool invocation (user, tool, input, outcome, timestamp)
- [ ] Add reversible action tracking where applicable

#### Confirmation UX (Web)
- [ ] Add `pendingAction` state to chat component
- [ ] Render confirmation card for mutating actions before execution
- [ ] On user approval, send `POST /api/chat/action` with confirmed invocation
- [ ] On rejection, send cancellation event and log it
- [ ] Display action receipt in chat thread after completion

#### Reliability Guards
- [ ] Add per-tool timeout config (e.g. 5s read tools, 10s mutating tools)
- [ ] Add exponential backoff retry for transient failures
- [ ] Add partial success handler: continue chat response even if one tool fails
- [ ] Write integration tests for tool failure paths and confirmation flows

**Phase 3 Exit Gate:** Assistant can safely perform all approved in-app actions with confirmation, receipts, and audit trail.

---

### Phase 4 — Streaming + Hardening

#### Streaming Response
- [ ] Add streaming path to `AiService.chat()` returning `AsyncIterable<string>`
- [ ] Update `POST /intelligence/chat` to support `Accept: text/event-stream`
- [ ] Update web BFF `app/api/chat/route.ts` to stream SSE to the browser
- [ ] Update chat UI component to consume streamed chunks and render progressively
- [ ] Handle stream interruption gracefully (show partial response + retry option)

#### Observability
- [ ] Add latency histogram per pipeline phase (retrieve, model, tools, render)
- [ ] Add tool call rate counter and tool failure rate gauge
- [ ] Add fallback model usage counter
- [ ] Add recommendation save/click conversion event tracking
- [ ] Wire metrics to existing analytics pipeline (`lib/analytics.ts` events)
- [ ] Add log-based alert for error rate > 1% and p95 latency > 6s

#### Load + Resilience Testing
- [ ] Write load test script simulating 50 concurrent chat sessions
- [ ] Run load test and capture latency percentiles
- [ ] Run chaos test: kill intelligence service mid-request, verify web fallback
- [ ] Run chaos test: slow context adapter response, verify timeout + degraded response
- [ ] Document results and remediate any failures

#### Prompt and Model Tuning
- [ ] Run eval harness against all prompt variants; pick best performer per quality dimension
- [ ] Test primary vs fallback model on latency and quality tradeoff
- [ ] Lock prompt versions and add prompt version to all AI metadata logs
- [ ] Add regression gate: block prompt changes that drop eval scores below baseline

**Phase 4 Exit Gate:** p95 latency under 4s (normal) / 6s (tool-heavy) and error rate under 1% in staging.

---

### Phase 5 — Controlled Launch

#### Canary Release
- [ ] Add feature flag for new chat endpoint (off by default)
- [ ] Enable for internal users and log all sessions
- [ ] Monitor error rates, latency, and action outcomes for 48h
- [ ] Fix any P0/P1 bugs before broader rollout

#### Feedback and Iteration
- [ ] Add thumbs up/down rating to chat messages
- [ ] Store ratings in `chat_messages.feedback` column
- [ ] Build simple feedback review dashboard or query for weekly review
- [ ] Define action items process: low-rated turns → prompt investigation → fix → re-eval

#### Launch Readiness Checklist
- [ ] All Phase 1–4 exit gates confirmed
- [ ] Security review complete (PII handling, prompt injection, access control)
- [ ] Load test results documented and sign-off obtained
- [ ] Eval harness passing at or above defined thresholds
- [ ] Runbook written for on-call: chat degradation, fallback model activation, tool failures
- [ ] Rollback plan documented (feature flag off, DB migration reversibility confirmed)
- [ ] Stakeholder demo and sign-off complete

**Phase 5 Exit Gate:** Launch-readiness checklist fully signed off.

