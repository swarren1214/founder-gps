# Standalone

## Problem Understanding
- **Core tensions:** prototype UX fidelity vs compatibility with existing founder-flow dashboard gating; complete onboarding persistence vs secure credential boundaries; richer AI chat experience vs reliability/latency in a critical flow.
- **Likely seam:** `apps/web/components/onboarding/founder-intake-form.tsx` (UX + orchestration) plus auth profile persistence seam (`apps/auth-service/src/types.ts`, `apps/auth-service/src/repository.ts`, `packages/db/sql/migrations/010_auth.sql`).
- **What makes it hard:** onboarding success currently depends on both durable auth profile state and local founder-flow payload state; prototype fields do not map 1:1 to founder-flow input contract.

## Philosophy Constraints
- Auth-service owns durable profile/account truth; onboarding persistence belongs in `PATCH /profile`.
- Credentials must remain isolated from profile metadata (no raw password persistence).
- Validate strictly at boundaries (zod schemas in web/auth routes).
- Follow thin web API route style (timeouts, request ID, structured errors).
- Keep changes additive and backward-compatible with existing onboarding/dashboard behavior.
- **Conflict check:** mild tension between durable profile-first architecture and existing local founder-flow dashboard gate; both must be preserved in this change.

## Impact Surface
- `apps/web/components/onboarding/founder-intake-form.tsx` (full stepper/chat UX overhaul)
- `apps/web/app/authed/onboarding/page.tsx` (onboarding entry and routing behavior)
- `apps/web/hooks/use-auth-user.ts` and `apps/web/lib/auth-server.ts` (profile type expansion)
- `apps/web/app/api/onboarding/interview/route.ts` (new API route if AI step is model-backed)
- `apps/auth-service/src/types.ts` (profile patch and response contracts)
- `apps/auth-service/src/repository.ts` (new persisted fields and update mapping)
- `packages/db/sql/migrations/010_auth.sql` (additive onboarding profile columns)
- `apps/auth-service/test/auth-routes.test.ts` and `apps/web/test/e2e.test.ts` (contract and regression coverage)

## Candidates

### Candidate 1: Minimal additive profile JSON + deterministic interview
- **Summary:** replace onboarding UI with prototype-style stepper and persist all non-credential onboarding data in an additive `onboarding_data_json` profile field; final interview uses fixed question sequence with no model calls.
- **Tensions resolved / accepted:** resolves compatibility and delivery speed; accepts lower AI realism.
- **Boundary solved at:** onboarding UI + auth profile patch contract.
- **Why that boundary is best fit:** persistence ownership already sits in auth profile and requires minimal architectural movement.
- **Failure mode:** user expectation mismatch if "AI chat" feels scripted.
- **Repo-pattern relationship:** adapts existing onboarding + profile patch patterns.
- **Gains / losses:** gain low risk and fast delivery; lose conversational adaptability.
- **Scope judgment:** best-fit only if AI requirement is interpreted loosely.
- **Philosophy fit:** strongly honors security and validation; partially conflicts with requested AI depth.

### Candidate 2: Hybrid AI interview endpoint + profile JSON persistence (recommended)
- **Summary:** add `POST /api/onboarding/interview` for AI-assisted interview (OpenAI when configured, deterministic fallback otherwise), collect transcript in final chat step, persist full onboarding payload + Q/A transcript on profile, and preserve founder-flow generation for dashboard compatibility.
- **Tensions resolved / accepted:** resolves AI UX + reliability tradeoff via fallback; resolves durability requirement via auth profile persistence; accepts moderate implementation complexity.
- **Boundary solved at:** web onboarding route/UI for interview orchestration + auth profile contract for durability.
- **Why that boundary is best fit:** keeps auth as source of truth and keeps web layer as interaction orchestrator without introducing new service ownership.
- **Failure mode:** onboarding stall from model latency if fallback handoff is not immediate.
- **Repo-pattern relationship:** follows existing web API route and zod validation patterns; adapts auth explicit mapping approach.
- **Gains / losses:** gain requested UX fidelity and robust persistence; lose some simplicity and increase test surface.
- **Scope judgment:** best-fit for request and conservative-risk constraints.
- **Philosophy fit:** honors security separation, validation-at-boundaries, reliability via fallback, and backward compatibility.

### Candidate 3: New service-owned onboarding orchestrator
- **Summary:** create a dedicated backend orchestration endpoint/service that owns onboarding interview state, field derivation for founder-flow, and normalized persistence tables.
- **Tensions resolved / accepted:** resolves long-term consistency/extensibility; accepts major scope expansion and rollout risk.
- **Boundary solved at:** new backend orchestrator boundary outside current auth/web seams.
- **Why that boundary is best fit (long-term):** centralizes transcript intelligence and avoids client-side derivation.
- **Failure mode:** cross-service contract drift/regressions during migration.
- **Repo-pattern relationship:** departs from current incremental extension strategy.
- **Gains / losses:** gain stronger long-term architecture; lose near-term delivery speed and conservative risk posture.
- **Scope judgment:** too broad for current request.
- **Philosophy fit:** can honor validation/reliability eventually, but conflicts with scope discipline for this task.

## Recommendation
- **Winner:** Candidate 2.
- **Rationale:** it is the only candidate that satisfies explicit stepper + AI chat + durable profile persistence requirements while preserving existing founder-flow compatibility and repo patterns.
- **Self-critique (strongest argument against pick):** candidate 2 adds operational complexity in the critical onboarding path; fallback must be robust to avoid completion drop-offs.
- **Narrower option that might still work:** candidate 1, if AI realism is deprioritized for this iteration.
- **Broader option that might be justified:** candidate 3, if there is an explicit roadmap commitment to re-architect onboarding as a first-class orchestration subsystem.
- **Invalidating assumption:** if prototype field + interview mapping cannot produce acceptable founder-flow quality, candidate 2 must be reconsidered in favor of contract-level founder-flow changes.

## Open Questions for the Main Agent
- Should onboarding interview transcript be stored only as profile JSON, or also normalized later for analytics/search?
- Is founder-flow input mapping from prototype/interview responses acceptable for this release, or should founder-flow contract be extended now?
- Should onboarding chat allow free-form multi-turn follow-ups beyond the fixed question sequence in v1?