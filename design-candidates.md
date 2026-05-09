# Standalone

## Problem Understanding
- **Core tensions:** grounding vs simplicity, server-owned orchestration vs thin UI, flexibility vs contract stability, reliability vs completeness.
- **Likely seam:** `apps/intelligence-service/src/routes/chat.ts` with `apps/intelligence-service/src/context-adapter.ts` as the deterministic retrieval/compaction boundary.
- **What makes it hard:** the route must synthesize multi-source context, remain resilient when upstream data is partial, and still produce strict-schema markdown/payload output quickly.

## Philosophy Constraints
- Keep AI reasoning separate from deterministic retrieval/filtering/ranking logic.
- Validate all inbound payloads at service boundaries.
- Favor reliability/debuggability over premature complexity.
- Keep services modular with web as a thin BFF, not a hidden gateway owner of chat orchestration.
- **Conflict check:** no hard conflict found between docs and repo patterns; `docs/llm.md` extends the architecture in a way consistent with existing boundaries.

## Impact Surface
- `packages/shared-types`: chat request/response and context contracts must stay stable.
- `packages/ai`: chat prompt/version/schema paths must remain strict and deterministic-first.
- `apps/intelligence-service`: route, context adapter, repository persistence methods, and config wiring must remain consistent.
- `packages/db/sql/migrations`: transcript/session tables must preserve referential behavior and history retrieval semantics.
- `apps/web/app/api/chat/route.ts`: must stay a thin proxy with structured error handling and request-id traceability.

## Candidates

### Candidate 1: Minimal Proxy with Caller-Supplied Context
- **Summary:** add `POST /intelligence/chat` as a thin validated wrapper that forwards caller context directly to `AiService.chat()` and logs minimal transcript records.
- **Tensions resolved / accepted:** resolves speed and implementation simplicity; accepts weaker grounding and higher client coupling.
- **Boundary solved at:** API boundary in `apps/intelligence-service/src/routes/chat.ts`.
- **Why this boundary fits:** smallest insertion point with near-zero backend surface expansion.
- **Failure mode to watch:** client context drift causes stale or ungrounded responses; hard to audit quality centrally.
- **Repo-pattern relationship:** follows lightweight route-proxy style used in simpler API endpoints; does not follow server-owned deterministic retrieval pattern.
- **Gains / losses:** gains fastest delivery and lowest backend complexity; loses grounded-context guarantee and durable chat semantics.
- **Scope judgment:** too narrow for stated Phase 1 requirements.
- **Philosophy fit:** honors simplicity and boundary validation; conflicts with deterministic logic ownership and reliability goals.

### Candidate 2: Server-Owned Context Adapter + Thin BFF
- **Summary:** build grounded chat in intelligence-service by assembling context server-side from founder profile, analysis snapshot, recommendations, resources, and startups, then persist session/messages/snapshots and return strict chat payload.
- **Tensions resolved / accepted:** balances grounding, reliability, and boundary clarity; accepts moderate backend complexity and dependency sensitivity.
- **Boundary solved at:** `apps/intelligence-service/src/routes/chat.ts` + `apps/intelligence-service/src/context-adapter.ts`.
- **Why this boundary fits:** retrieval/persistence and deterministic safeguards belong with the service that owns chat reasoning and auditability.
- **Failure mode to watch:** upstream data outages degrade quality or latency; must degrade gracefully with warnings and compacted context.
- **Repo-pattern relationship:** adapts existing patterns exactly: zod boundary validation, heuristic fallback in `packages/ai`, and thin Next.js BFF proxy routes.
- **Gains / losses:** gains grounded responses, auditable transcript state, and future-compatible baseline; loses some implementation simplicity.
- **Scope judgment:** best-fit for Phase 1 documents and repo conventions.
- **Philosophy fit:** strongly honors separation of AI vs deterministic logic, validation-at-boundaries, reliability-first delivery, and modular service boundaries.

### Candidate 3: Early Intent-Orchestrator with Action Scaffolding
- **Summary:** extend chat now with richer intent routing, action placeholders, and pre-tool-call scaffolding in payload contracts.
- **Tensions resolved / accepted:** improves forward extensibility and richer UI semantics; accepts substantial complexity and phase creep.
- **Boundary solved at:** expands beyond chat seam into cross-phase action framework territory.
- **Why this boundary fits (if chosen):** single redesign pass could reduce later refactors when action execution is introduced.
- **Failure mode to watch:** over-coupled contracts and policy ambiguity before action confirmation/execution standards are implemented.
- **Repo-pattern relationship:** departs from current conservative incremental service evolution for this phase.
- **Gains / losses:** gains future-proof structure; loses Phase 1 clarity, reliability margin, and testability simplicity.
- **Scope judgment:** too broad for current phase boundaries.
- **Philosophy fit:** partially fits long-term modularity, conflicts with reliability-over-complexity and explicit Phase 1 deferrals.

## Recommendation
- **Pick:** Candidate 2 (server-owned context adapter + thin BFF).
- **Rationale:** only candidate that satisfies upstream Phase 1 constraints while aligning with the repo’s architecture and validation patterns.
- **Strongest argument against this pick:** context adapter coupling to multiple dependencies can create brittle behavior under partial outages.
- **Narrower option that might still work:** Candidate 1, but it fails the grounding/persistence requirement central to the phase objective.
- **Broader option that might be justified:** Candidate 3 if upstream scope explicitly moved streaming/tool execution/confirmation into this same phase.
- **Invalidating assumption:** if ownership of context assembly is required in the web layer (not intelligence-service), this recommendation would be wrong.

## Open Questions for the Main Agent
- Should context adapter degrade with partial payload plus warnings (current direction), or fail when any critical source is unavailable?
- Is `sessionId` caller-generated text the intended long-term invariant, or should service-generated UUID eventually become canonical?
- Should citation extraction remain heuristic in Phase 1, or should we require stricter entity-linking now before Phase 2 quality gates?