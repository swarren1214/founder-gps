# Implementation Plan: Onboarding Overhaul (Stepper + AI Interview + Profile Persistence)

## 1) Problem Statement
Current onboarding captures a narrow founder intake and does not persist full prototype-level onboarding context to the authenticated user profile. The required change is a complete stepper onboarding flow that collects the prototype fields, runs a final chat-style AI interview, and persists all onboarding context (including interview Q/A) to user profile data for reuse in later flows.

## 2) Acceptance Criteria
No `spec.md` exists in this repo; acceptance criteria are derived from user request + existing auth architecture constraints:
- Onboarding UX is stepper-based and includes the prototype-equivalent data collection stages.
- Final onboarding stage is a chat-style interview with AI behavior.
- AI interview supports deterministic fallback so onboarding completion is not blocked by model/provider failures.
- All onboarding profile context (including interview question/answer transcript) is persisted to authenticated user profile storage.
- Raw credential values (password/confirm fields) are never persisted in profile payloads or logs.
- Existing founder-flow generation remains functional so dashboard/map gating behavior does not regress.
- Profile patch and read paths remain schema-validated and type-consistent across auth-service and web app.
- Interview step remains completable when model provider is unavailable (deterministic path must stay user-visible and unblocked).

## 3) Non-Goals
- Full re-architecture to a dedicated onboarding orchestration service.
- Streaming chat transport or agentic tool execution in onboarding interview.
- Major redesign of downstream recommendation/intelligence services.
- Immediate normalization of onboarding transcript into dedicated relational tables.

## 4) Philosophy-Driven Constraints
- Auth-service remains source of truth for durable user profile state.
- Credentials/session concerns remain isolated from profile metadata.
- Validation at boundaries: all new request/response paths use strict schema validation.
- Reliability first: deterministic onboarding progression must remain available under AI/provider failure.
- Incremental compatibility: preserve existing founder-flow and dashboard flows.

## 5) Invariants
- No password-like values are written to profile storage or logs.
- `PATCH /profile` remains explicit allowlist-driven for persisted fields.
- Onboarding payload stored in profile carries explicit `schemaVersion`.
- AI interview step has hard timeout + auto-fallback in the same interaction cycle.
- Founder-flow submit path continues to produce valid `founderFlowResponseSchema` output.
- Deterministic interview question flow exists independent of model response path.

## 6) Selected Approach + Rationale + Runner-Up
- **Selected:** Hybrid onboarding interview design with deterministic-first behavior and model augmentation.
  - Implement stepper UI collecting prototype fields.
  - Add onboarding interview API route that uses OpenAI when available, with deterministic behavior as canonical baseline and automatic fallback on timeout/error.
  - Persist full onboarding context in profile JSON via auth-service contract extension.
  - Preserve founder-flow generation by mapping collected onboarding context into existing founder intake contract.
- **Rationale:** Satisfies UX + persistence requirements while respecting architecture boundaries and conservative risk posture.
- **Runner-up:** Deterministic-only interview with same persistence model.
  - Lost because it may under-deliver explicit AI-chat expectation.

## 7) Vertical Slices

### Slice A: Auth persistence contract and schema extension
Scope:
- Extend `user_profiles` schema additively for onboarding payload storage.
- Extend auth types/schemas/repository mapping for new onboarding profile fields.
- Enforce explicit allowlist and sensitive-field dropping behavior.
Done criteria:
- Auth routes accept and return extended profile shape with validation.
- Tests prove password-like fields are not persisted.
- Existing auth/profile behavior remains green.

### Slice B: Web onboarding data model + type alignment
Scope:
- Add/extend web-side onboarding types and profile type consumers.
- Ensure `useAuthUser` and server-side auth user typing align with new profile payload.
Done criteria:
- Type-check passes with new profile fields.
- Existing consumers compile and render safely with defaults.

### Slice C: Stepper onboarding UI overhaul
Scope:
- Replace current founder intake form with prototype-aligned stepper UX.
- Collect required onboarding fields and maintain validation/progression behavior.
- Include avatar upload stage behavior compatible with existing avatar endpoint.
Done criteria:
- User can complete all steps with validation and progress state.
- Onboarding completion path still routes to dashboard flow.

### Slice D: AI interview route and deterministic-first fallback
Scope:
- Add `POST /api/onboarding/interview` with strict request/response schema.
- Implement deterministic interview baseline and model augmentation path with hard timeout + auto-fallback.
- Ensure structured error handling and request tracing style consistency.
Done criteria:
- Interview endpoint returns valid response under success, timeout, and provider-error scenarios.
- Fallback activates automatically and does not block user progression.
- Deterministic baseline can be exercised by test without model credentials.
- Default operational policy documented and tested:
  - model call timeout default `4000ms`,
  - one attempt only (no retry in onboarding critical path),
  - fallback response generated in same request cycle.

### Slice E: Founder-flow mapping + onboarding submit integration
Scope:
- Map stepper + interview outputs into founder-flow input contract.
- Add minimum-signal checks and deterministic defaults for required founder-flow inputs.
- Persist onboarding profile payload + transcript via auth profile patch.
Done criteria:
- Founder-flow request validates and returns usable dashboard run payload.
- Persisted onboarding context is available via auth profile read.
- Low-signal submissions trigger guarded defaults or targeted follow-up prompts (no hard crash path).
- Mapping quality gate exists in tests for representative low/medium/high-signal onboarding inputs.

### Slice F: End-to-end regression and reliability hardening
Scope:
- Add/update tests across auth-service and web for persistence, fallback, and onboarding completion.
- Verify no regression in protected routing, profile editing, and dashboard onboarding gate behavior.
Done criteria:
- Test suite sections for auth/web affected paths pass.
- Failure-mode tests cover sensitive-field filtering and fallback activation.

## 8) Work Packages (only where helpful)
- WP1: DB/auth contract updates (Slice A)
- WP2: Web typing and onboarding UI replacement (Slices B-C)
- WP3: Interview endpoint + fallback behavior (Slice D)
- WP4: Submit integration and mapping guardrails (Slice E)
- WP5: Cross-slice tests and regression hardening (Slice F)

## 9) Test Design
- **Auth-service tests**
  - `PATCH /profile` accepts onboarding payload and persists expected fields.
  - Password-like onboarding fields are rejected/dropped from persistence.
  - `GET /auth/me` returns extended profile shape with stable defaults.
- **Web API tests**
  - Interview route request validation failures return 400.
  - Timeout/provider failures return deterministic fallback response (not hard failure).
  - Response schema remains stable for onboarding chat UI.
  - Timeout policy test asserts model path abort around configured default and fallback is returned.
- **UI/component tests (or integration-level checks)**
  - Stepper progression and required field validation.
  - Interview step captures transcript entries and completion state.
  - Submit path persists profile context and completes founder-flow.
- **Regression checks**
  - Existing auth login/register/profile/avatar flows still pass.
  - Dashboard onboarding gate behavior remains functional after completion.

Acceptance-to-test mapping:
- Stepper + field capture -> UI progression/validation tests.
- AI interview + fallback -> interview route timeout/error tests.
- Durable profile persistence -> auth patch/get round-trip tests.
- Sensitive data isolation -> explicit non-persistence tests.
- Founder-flow compatibility -> integration test of submit path producing valid dashboard run payload.
- Founder-flow mapping quality gate -> matrix test for representative signal levels with expected fallback/default behavior.

## 10) Risk Register
- R1: Sensitive-field leakage to DB/logs.
  - Mitigation: allowlist persistence filter + explicit redaction and tests.
  - Proceed condition: security tests must pass before merge.
- R2: AI latency/errors degrade onboarding completion.
  - Mitigation: deterministic-first flow, hard timeout, immediate fallback.
  - Proceed condition: failure path tested and non-blocking.
- R3: Founder-flow mapping quality is insufficient.
  - Mitigation: minimum-signal checks, deterministic defaults, targeted follow-up prompts.
  - Proceed condition: representative test matrix passes for low/medium/high-signal onboarding inputs.
- R4: JSON schema drift across auth/web.
  - Mitigation: `schemaVersion` + typed validators + round-trip tests.
  - Proceed condition: contract tests green across auth/web.
- R5: PR2 scope concentration (Slices B-D together) increases integration risk.
  - Mitigation: keep interview route contract stabilized before UI wiring; split PR2 if churn grows.
  - Proceed condition: if PR diff exceeds reviewability threshold, split PR2 into UI and route sub-PRs.

## 11) PR Packaging Strategy
- Estimated PRs: **3**
1. PR1: Auth schema/types/repository + tests (Slice A).
2. PR2: Web onboarding stepper + interview route + type alignment (Slices B-D).
3. PR3: Founder-flow integration mapping + cross-service regressions/hardening tests (Slices E-F).

Packaging guardrail:
- If PR2 mixes unstable route contract changes with UI iteration noise, split into `PR2a` (route/types) and `PR2b` (stepper UI integration).

## 12) Philosophy Alignment Per Slice
- **Slice A**
  - Auth ownership -> satisfied (profile persistence remains in auth-service).
  - Credential isolation -> satisfied (allowlist + non-persistence tests).
  - Validation-at-boundaries -> satisfied (zod schema expansion).
- **Slice B**
  - Type safety -> satisfied (web/auth profile contract alignment).
- **Slice C**
  - User-facing reliability -> tension (larger UX change surface), acceptable with validation and regression tests.
- **Slice D**
  - Reliability-over-complexity -> satisfied if deterministic-first fallback is enforced.
  - Thin API boundaries -> satisfied (route-level schema + timeout/error handling only).
- **Slice E**
  - Backward compatibility -> tension (mapping layer complexity), acceptable with signal checks/defaults.
- **Slice F**
  - Reliability/debuggability -> satisfied (failure-mode coverage and regressions).

## Open Questions Gate Resolution
- Material open questions from Phase 0 have been resolved to implementation decisions:
  - Password handling in prototype security step -> do not persist raw values; enforce allowlist and tests.
  - Founder-flow compatibility with prototype fields -> proceed with guarded mapping + defaults and validate via integration tests.
  - AI reliability in onboarding -> deterministic-first flow with model augmentation and hard timeout fallback.
- `unresolvedUnknownCount`: 0

## 13) Follow-Up Tickets
- FUP-1: Evaluate normalizing onboarding interview transcript for analytics/search once schema stabilizes.
- FUP-2: Add staged rollout controls (feature flag/canary) for model augmentation path if production telemetry indicates volatility.
- FUP-3: Revisit founder-flow input contract to reduce derivation/mapping burden from onboarding payload.

## 14) Audit Delta (Pass 1)
- Confirmed weakest assumption: founder-flow mapping quality from prototype/interview fields.
- Plan fix applied: added deterministic-baseline invariant, low-signal done criteria, and PR packaging split guardrail.
- Plan confidence after audit: **Medium-High**.

## 15) Audit Delta (Pass 2)
- Confirmed remaining gap: reliability and mapping gates needed concrete defaults/threshold-style checks.
- Plan fixes applied:
  - Added explicit fallback policy defaults (`4000ms`, single attempt, same-cycle fallback).
  - Added mapping quality gate requirement and related test coverage entries.
- Plan confidence after second audit: **High**.
