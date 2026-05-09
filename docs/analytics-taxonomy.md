# Analytics Events Taxonomy

## Goal

Define a stable baseline event taxonomy for MVP analytics so product insights stay consistent across demos and iterations.

## Event Catalog

| Event | Trigger | Payload keys | Metric intent |
|---|---|---|---|
| `preset_selected` | Founder chooses a preset in onboarding | `preset` | Understand which demo persona is used most |
| `founder_flow_started` | User submits onboarding to start orchestration | `stage`, `city`, `topN` | Track conversion into flow execution |
| `founder_flow_completed` | Orchestration succeeds and dashboard is persisted | `recommendations`, `hasRoute`, `hasRoadmap` | Track successful completions and payload health |
| `founder_flow_retry_requested` | User retries from fallback state on dashboard | `city`, `topN` | Measure resilience interactions |
| `founder_flow_retry_completed` | Retry request succeeds | `warnings`, `hasRoute`, `hasRoadmap` | Monitor recovery success rate |
| `user_registered` | New user completes registration | `method` | Track registration conversion |
| `user_logged_in` | Existing user completes login | `method` | Track active login sessions |
| `user_logged_out` | User logs out | _(none)_ | Track session termination |
| `onboarding_completed` | User completes the onboarding flow | `hasAvatar` | Track onboarding funnel completion |

## Event Hygiene Rules

- Event names are immutable once released.
- Payload keys should be additive; do not remove keys without versioning.
- Avoid sending PII in payloads.
- Keep payload values primitive or shallow objects.

## Ownership

- Source of truth in code: apps/web/lib/analytics-events.ts
- Runtime emitter: apps/web/lib/analytics.ts
