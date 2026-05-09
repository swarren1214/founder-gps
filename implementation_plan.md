# Implementation Plan: Phase 1 Chat Foundations

## 1) Problem Statement
The plan proposes implementing Phase 1 founder-copilot chat foundations so `POST /intelligence/chat` returns grounded markdown plus structured payload, persists transcripts/context snapshots, and is exposed through a thin web BFF route.

## 2) Acceptance Criteria
No `spec.md` exists in this repo, so acceptance criteria are derived from `docs/llm.md` Phase 1 requirements:
- `POST /intelligence/chat` validates request payload and returns strict chat response structure.
- Chat response is grounded in deterministic server-side context (founder profile/analysis/recommendations/resources/startups where available).
- Chat response includes explicit grounding/citation references to retrieved entities and avoids fabricated claims.
- Transcript/session/context snapshot persistence exists and retrieval endpoint returns history.
- Web BFF route proxies chat request/response with structured errors.
- Schema validation exists at route and model boundaries.
- Fallback/degraded behavior is explicit when dependencies are unavailable.
- Phase 1 excludes streaming and action execution paths.
- Chat session/history retrieval is access-scoped to the requesting user (no cross-user transcript leakage).

## 3) Non-Goals
- Streaming chat output (SSE/chunked).
- Agentic tool/action execution and confirmation UX.
- Full recommendation synthesis engine tuning/eval harness for later phases.
- New external integrations beyond current internal service calls.

## Upstream Boundary Compliance (Phase 1)
- Effort bound check: no slice includes action execution framework, streaming transport, or week-4 hardening work from `docs/llm.md`.
- Out-of-scope check: no mutating tools, no confirmation UX, no external integrations.
- Justification check: every slice maps to Phase 1 foundations plus pass-2 confirmed reliability hardening gaps.
- Acceptance coverage check: each criterion below maps to planned tests (see Section 9 matrix).

## 4) Philosophy-Driven Constraints
- Keep AI reasoning separate from deterministic retrieval/filtering logic.
- Validate at boundaries with strict schemas.
- Keep web layer thin; intelligence-service owns orchestration and persistence.
- Favor reliability and debuggability over premature feature breadth.

## 5) Invariants
- Chat must never bypass schema validation for request or model output.
- Missing dependencies must degrade safely (warnings/metadata), not fabricate data.
- Session/message/context snapshot writes must remain consistent per `sessionId`.
- Optional context sources must not block a valid response if core context exists.
- BFF must not embed business orchestration logic.
- Session and history reads must enforce user ownership checks.

## 6) Selected Approach + Rationale + Runner-Up
- **Selected:** The approach implements a server-owned context adapter in intelligence-service with tiered retrieval and explicit degraded mode.
- **Rationale:** The approach best satisfies grounding + persistence requirements and existing repo/service boundaries while keeping web as a thin proxy.
- **Runner-up:** Minimal proxy with caller-supplied context; rejected because it undercuts server-owned grounding and auditability.

## 7) Vertical Slices

### Slice A: Contracts and AI chat schema baseline
Scope:
- Shared types for chat request/response/context contracts.
- AI package chat prompt/version/schema + deterministic `chat()` path.
Done criteria:
- Types compile across packages.
- AI chat output validates against `ChatOutputSchema` in deterministic mode.

### Slice B: Intelligence chat orchestration + persistence
Scope:
- `POST /intelligence/chat`, `GET /intelligence/chat/session/:id`.
- Context adapter with tiered retrieval and safe compaction.
- Transcript/session/context snapshot persistence and migration coverage.
- Ownership-aware session/history access checks.
Done criteria:
- Route tests pass for happy-path, validation errors, and history retrieval.
- Degraded mode returns valid response shape and explicit context/degradation signal.
- Cross-user session/history access attempts are denied.

### Slice C: Web BFF chat endpoint
Scope:
- `apps/web/app/api/chat/route.ts` request validation + proxy + structured errors.
Done criteria:
- Web route tests pass for valid proxy and malformed request handling.
- Request ID and no-store behavior preserved.

### Slice D: Reliability control hardening (pass-2 review delta)
Scope:
- Parameterize context adapter policy:
  - per-source timeout,
  - retry/backoff,
  - aggregate context budget,
  - source priority tiers.
- Add degraded-mode contract fields and confidence policy.
- Add counters for degraded-rate/dependency-failure/partial-context.
- Keep hardening limited to read-path chat orchestration (no action tooling, no streaming).
Done criteria:
- Policy values are explicit in code/config.
- Tests assert degraded-mode behavior at threshold boundaries.
- Basic metrics emission verified in service tests.

## 8) Work Packages (only where helpful)
- WP1: Contract/package updates (shared-types + ai)
- WP2: Service route/repository/context adapter
- WP3: DB migration and repository method coverage
- WP4: Web BFF route and tests
- WP5: Reliability policy + degraded-mode hardening

## 9) Test Design
- **Unit tests**
  - Chat schema validation success/failure.
  - Context adapter tiering/compaction logic and degraded metadata behavior.
  - Reliability policy branch tests (timeout/retry/budget triggers).
- **Integration tests**
  - Intelligence route end-to-end with mocked upstream services.
  - Session/message/snapshot persistence and retrieval semantics.
  - Ownership enforcement tests for session/history retrieval.
- **BFF tests**
  - Request validation failures map to 400.
  - Upstream failures map to structured 503.
- **Regression checks**
  - Existing intelligence routes still pass.
  - Chat response shape stable for existing consumers.

Acceptance-to-test mapping:
- Request/response schema validation -> route tests for valid and malformed payloads.
- Grounded context usage -> integration tests asserting context bundle fields influence response payload.
- Citation/no-fabrication behavior -> unit/integration assertions that citations reference known retrieved entities.
- Transcript/session/snapshot persistence -> repository + route history retrieval tests.
- User ownership enforcement -> cross-user retrieval rejection tests.
- BFF proxy + structured errors -> web route tests for success and upstream failure mapping.
- Explicit degraded mode -> threshold tests for degraded metadata and confidence behavior.
- No streaming/actions in Phase 1 -> negative tests or route-surface assertions for absent streaming/action endpoints in current slice set.

## 10) Risk Register
- R1: Silent degraded-quality output under partial outages.
  - Mitigation: explicit degraded metadata + confidence floor + telemetry.
  - Proceed decision: proceed with policy gating in Slice D.
- R2: Context fan-out causes latency variance.
  - Mitigation: source tiering + aggregate budget + skip optional tier when budget exhausted.
  - Proceed decision: proceed with hard budgets and threshold tests.
- R3: Session-id semantics may evolve later.
  - Mitigation: compatibility tests and follow-up ticket for migration strategy.
  - Proceed decision: proceed with current text `sessionId` for Phase 1.
- R4: Cross-user data exposure risk in chat history retrieval.
  - Mitigation: enforce ownership checks in repository/route path + explicit authorization tests.
  - Proceed decision: proceed only if access-control tests are green for positive and negative cases.

## Phase 6 Execution Notes (from planning audit)
- Add a route-level regression test asserting no streaming or action execution endpoint is introduced in Phase 1 slices.
- Keep ownership checks close to repository and route boundary to avoid accidental bypass in future refactors.

## 11) PR Packaging Strategy
- Estimated PRs: **4**
1. PR1: contracts + AI chat baseline + tests.
2. PR2: intelligence orchestration/persistence + migration + tests.
3. PR3: web BFF route/tests only.
4. PR4: reliability hardening delta + observability/tests (read-path only).

## 12) Philosophy Alignment Per Slice
- **Slice A**
  - Validate-at-boundaries -> satisfied (schema-first contracts).
  - Reliability-over-complexity -> satisfied (deterministic baseline).
- **Slice B**
  - Service ownership clarity -> satisfied (orchestration in intelligence-service).
  - AI vs deterministic separation -> satisfied (adapter vs model).
  - Reliability-over-complexity -> tension (fan-out), addressed via degraded mode.
- **Slice C**
  - Thin web boundary -> satisfied (proxy only).
- **Slice D**
  - Reliability-over-complexity -> satisfied (explicit policy/thresholds).
  - Scope discipline -> tension (hardening adds work), acceptable because findings are confirmed.

## Open Questions Gate Resolution
Open questions from earlier phases were explicitly resolved for planning:
- Should degraded mode fail hard or continue with warnings?
  - Decision: continue with explicit degraded metadata/confidence policy.
- Session ID policy (text caller-provided vs service UUID)?
  - Decision: keep current text `sessionId` in Phase 1; track migration strategy as follow-up.
- Citation strictness level in Phase 1?
  - Decision: keep heuristic citation matching in Phase 1 with no-fabrication rule; tighten in later quality phase.
