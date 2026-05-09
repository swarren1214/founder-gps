# Auth Implementation Plan

## Goal
Build a dedicated `auth-service` to own user registration, login, user profile management, and avatar storage metadata, then move the web app into a protected `authed/` area so all non-auth pages require authentication. The user experience should include:

1. Registration.
2. Login.
3. First-time onboarding.
4. Profile editing.
5. Avatar upload and persistence.

This should become the single source of truth for authenticated user state, replacing the current browser-only gating model.

## Current State

The existing web app currently gates access with client-side state derived from browser storage, and the onboarding flow stores its finished dashboard payload in local/session storage rather than a backend user record. That means there is no durable authenticated identity yet, no protected server-side route boundary, and no backend profile store for user account data.

## Target Architecture

### New backend service

Create `apps/auth-service` as a first-class service alongside the existing backend services. It should handle:

1. User registration.
2. Login and logout.
3. Session creation and validation.
4. Current-user lookup.
5. User profile read/update.
6. Avatar upload registration and deletion metadata.

### Web app routing model

Move all authenticated pages under a protected `authed/` directory. The only public web routes should be:

1. Landing page.
2. Login.
3. Registration.

All other app routes should require authentication and live beneath `app/authed/`.

### Data model

Use Postgres as the source of truth for user/account data. Store avatar files in object storage or an equivalent file store, and persist only the durable metadata in the database.

## Proposed Database Schema

Add migrations for a small auth domain with explicit account and profile separation:

1. `users`
	- `id`
	- `email`
	- `password_hash`
	- `email_verified_at`
	- `created_at`
	- `updated_at`
	- `status` or `is_active`

2. `user_profiles`
	- `id`
	- `user_id`
	- `display_name`
	- `first_name`
	- `last_name`
	- `company_name`
	- `role_title`
	- `bio`
	- `location_city`
	- `avatar_url`
	- `avatar_storage_key`
	- `onboarding_status`
	- `onboarding_completed_at`
	- `created_at`
	- `updated_at`

3. `auth_sessions`
	- `id`
	- `user_id`
	- `session_token_hash`
	- `expires_at`
	- `revoked_at`
	- `created_at`
	- `last_seen_at`

4. Optional supporting tables if needed later:
	- `email_verification_tokens`
	- `password_reset_tokens`
	- `avatar_uploads`

The profile table should be the place where onboarding-completed user state is persisted, while the `users` table owns credentials and account identity.

## auth-service API Plan

Build the service around explicit auth and profile endpoints:

1. `POST /auth/register`
	- Create the user account.
	- Hash the password.
	- Create the default profile row.
	- Issue a session.
	- Return the authenticated user payload.

2. `POST /auth/login`
	- Validate credentials.
	- Issue a session.
	- Return the authenticated user payload.

3. `POST /auth/logout`
	- Revoke the current session.

4. `GET /auth/me`
	- Return the current user and profile.
	- Serve as the client bootstrap endpoint.

5. `PATCH /profile`
	- Update profile fields from onboarding or profile settings.

6. `POST /profile/avatar`
	- Accept an avatar upload.
	- Store the binary in object storage.
	- Persist `avatar_url` and `avatar_storage_key`.

7. `DELETE /profile/avatar`
	- Remove the avatar reference and optionally delete the stored object.

8. Optional account management endpoints:
	- `PATCH /auth/password`
	- `POST /auth/verify-email`
	- `POST /auth/forgot-password`
	- `POST /auth/reset-password`

## Auth Flow

### Registration flow

1. User opens the registration page.
2. User enters email and password.
3. User creates a profile shell with display name and basic metadata.
4. Service creates `users`, `user_profiles`, and `auth_sessions` records.
5. Client receives the session and redirects into authenticated onboarding.

### Login flow

1. User opens the login page.
2. User submits email and password.
3. Service validates credentials and creates a session.
4. Client loads the current user with `GET /auth/me`.
5. User is routed into the protected area.

### Onboarding flow

1. After registration or first login, the user is routed to onboarding.
2. Onboarding collects profile data in discrete steps.
3. Avatar upload occurs during onboarding or in the profile step if the user skips it.
4. On completion, `PATCH /profile` marks onboarding complete.
5. The user is redirected into the authenticated app shell.

### Profile editing flow

1. Authenticated users can open profile settings.
2. They can update their profile fields and avatar.
3. Changes persist immediately through `auth-service`.

## Web App Restructure

Move the app router into a protected layout structure such as:

1. `app/login`
2. `app/register`
3. `app/authed/onboarding`
4. `app/authed/profile`
5. `app/authed/dashboard`
6. `app/authed/map`
7. `app/authed/resources`
8. `app/authed/roadmap`

Consider a shared `app/authed/layout.tsx` that:

1. Checks authentication on the server.
2. Redirects unauthenticated users to `/login` or `/register`.
3. Fetches the current user once and passes it through the protected shell.

Public routes should not import client-side onboarding gates for authorization. Auth should be enforced server-side, not only in the browser.

## UI Plan

### Public auth pages

Create polished entry points for:

1. Login.
2. Registration.
3. Password recovery if included in scope.

These pages should share a consistent auth layout and use the same visual language as the rest of the app.

### Protected onboarding UI

Design onboarding as a structured, multi-step experience that collects:

1. Identity basics.
2. Company or founder profile details.
3. Goals and operating context.
4. Avatar upload.
5. Final review and submit.

The onboarding UI should show progress, validation state, and completion state, and it should feel distinct from the login flow.

### Avatar upload UX

Support at least one avatar input method:

1. File picker upload.
2. Drag-and-drop if time permits.

The UI should preview the selected image before submit, handle upload failures, and allow replacing or removing the avatar later.

### Authenticated shell

Once logged in, the app should show the authenticated shell with:

1. User identity in the header.
2. Profile/avatar display.
3. Clear logout action.
4. Route protection behavior that never exposes protected pages to unauthenticated visitors.

## Avatar Storage Plan

Store avatar files outside the database in an object store or equivalent file backend.

Recommended behavior:

1. Validate file type and size on the backend.
2. Generate a stable storage key per upload.
3. Persist the public URL or signed-access reference in `user_profiles`.
4. Retain the storage key so replacement and deletion are possible.
5. Resize or normalize images before or after upload if the backend stack supports it.

## Security Plan

Authentication must be server-verified for every protected route.

1. Hash passwords with a modern adaptive algorithm.
2. Store session tokens hashed in the database.
3. Use HTTP-only cookies for session transport.
4. Enforce CSRF protections if cookie-based state-changing requests are used.
5. Add rate limiting on login and registration.
6. Validate file uploads strictly for avatar endpoints.
7. Keep password and session logic isolated inside `auth-service`.

## Integration With Existing Services

The other services should not own auth state. Instead, they should consume user identity from the request context or from the web app session bootstrap when needed.

1. The web app should fetch the current user from `auth-service` on bootstrap.
2. Existing founder/dashboard data can remain in their current services initially.
3. If later needed, `founder_profile_id` can be linked to `user_id` so authenticated users own their founder data.

## Migration Strategy

Roll this out in phases to avoid breaking the current demo flow:

1. Add schema and auth-service without switching the public web routing yet.
2. Build login and registration pages.
3. Add the protected `authed/` route structure.
4. Migrate onboarding into authenticated profile onboarding.
5. Add avatar upload.
6. Remove client-only onboarding gating once server-side auth is live.
7. Clean up legacy browser-storage-based session behavior.

## Testing Plan

Add coverage at three levels:

1. Backend unit tests for password hashing, session creation, profile updates, and avatar metadata handling.
2. API tests for register, login, logout, `me`, profile update, and avatar endpoints.
3. Web tests for protected-route redirects, onboarding completion, upload UX, and authenticated navigation.

Add at least one end-to-end test for each critical path:

1. Register a new user and land in onboarding.
2. Log in as an existing user and reach a protected page.
3. Upload an avatar and confirm it renders from the profile.
4. Attempt direct access to a protected route while signed out and confirm redirect.

## Delivery Phases

### Phase 1: Foundation

1. Create `apps/auth-service` scaffold.
2. Add database migrations for auth tables.
3. Add service configuration, route wiring, and session middleware.
4. Define shared auth/profile types.

### Phase 2: Core Auth

1. Implement registration.
2. Implement login and logout.
3. Implement `GET /auth/me`.
4. Add auth cookies and server-side session validation.

### Phase 3: Profile and Avatar

1. Implement profile fetch/update.
2. Add avatar upload and delete.
3. Persist avatar metadata in the profile table.
4. Wire avatar display into the header and profile pages.

### Phase 4: Web Restructure

1. Move protected pages into `app/authed/`.
2. Add a protected layout.
3. Create login and registration pages.
4. Replace browser-only gating with server auth checks.

### Phase 5: Onboarding UX

1. Convert onboarding into authenticated first-run setup.
2. Add avatar upload to onboarding.
3. Save onboarding completion in the backend profile record.
4. Redirect users into the protected app after completion.

### Phase 6: Hardening

1. Add validation, rate limits, and security headers.
2. Cover redirects and permission failures in tests.
3. Remove legacy client-side session storage for app access control.

## Open Decisions

1. Which object storage provider should hold avatar images.
2. Whether email verification is required for first release.
3. Whether password reset ships with the first auth milestone.
4. Whether existing founder profile records should be migrated to link to `user_id` immediately.

## Definition of Done

The implementation is complete when:

1. A user can register, log in, and log out.
2. All non-auth web routes are protected by server-side auth.
3. Onboarding is delivered as an authenticated first-run flow.
4. Avatar upload works end-to-end and the image is displayed in the UI.
5. User profile data is persisted in the database.
6. Protected pages are inaccessible without authentication.
7. The old browser-storage gating is no longer required for access control.

## Task List

### Project Setup

- [x] Create `apps/auth-service` package scaffold.
- [x] Add auth-service scripts, TypeScript config, and environment config.
- [x] Add auth-service to workspace orchestration (dev, build, test).
- [x] Add service URL env vars to web app and local docker/dev scripts.

### Database and Migrations

- [x] Create migration for `users` table.
- [x] Create migration for `user_profiles` table.
- [x] Create migration for `auth_sessions` table.
- [x] Add indexes and unique constraints for email and session lookup.
- [x] Add foreign keys and cascade/revoke behavior.
- [ ] Add rollback scripts or down migrations as needed by repo convention.

### Auth-Service Backend

- [x] Implement password hashing and verification utility.
- [x] Implement session token generation and hashing utility.
- [x] Implement auth repository methods for users/profiles/sessions.
- [x] Implement `POST /auth/register`.
- [x] Implement `POST /auth/login`.
- [x] Implement `POST /auth/logout`.
- [x] Implement `GET /auth/me`.
- [x] Implement auth middleware for session validation.
- [x] Add standardized error responses and validation errors.

### Profile and Avatar APIs

- [x] Implement `PATCH /profile` endpoint.
- [x] Implement avatar upload endpoint (`POST /profile/avatar`).
- [x] Implement avatar delete endpoint (`DELETE /profile/avatar`).
- [x] Add server-side upload validation (mime type, size limits).
- [x] Persist avatar metadata (`avatar_url`, `avatar_storage_key`) in profile.
- [x] Integrate object storage client for upload/delete operations.

### Web Routing and Protection

- [x] Create public auth routes: `/login` and `/register`.
- [x] Move protected pages under `app/authed/`.
- [x] Add `app/authed/layout.tsx` with server-side auth guard.
- [x] Redirect unauthenticated users to `/login` from protected routes.
- [x] Redirect authenticated users away from `/login` and `/register`.
- [x] Remove browser-only route protection as access-control source of truth.

### Authentication UI

- [x] Build login page UI and form validation.
- [x] Build registration page UI and form validation.
- [x] Wire login form to `POST /auth/login`.
- [x] Wire registration form to `POST /auth/register`.
- [x] Add logout action in authenticated shell/header.
- [x] Add current-user bootstrap state from `GET /auth/me`.

### Onboarding and Profile UX

- [x] Convert onboarding into authenticated first-run flow in `app/authed/onboarding`.
- [x] Persist onboarding profile steps via `PATCH /profile`.
- [x] Add avatar upload step in onboarding flow.
- [x] Update profile page to read/write auth-service profile fields.
- [x] Display user avatar in header/profile views with fallback behavior.
- [x] Mark onboarding completion in backend (`onboarding_status`, completion timestamp).

### Integration and Data Alignment

- [x] Decide whether to link founder profile records to `user_id` now or later.
- [x] Add user context propagation pattern for downstream services (if needed).
- [x] Update docs/contracts for all new auth/profile endpoints.
- [x] Update analytics events for auth lifecycle and onboarding completion.

#### Decision: founder profile → user_id linking

Deferred. The recommendation-service uses `founderProfileId` (a client-generated UUID) as its identity key. Linking it to `user_id` requires a migration of existing recommendation records and a schema change in the recommendation-service. This will be addressed in a dedicated data-alignment phase once the auth rollout is stable.

#### Decision: user context propagation

Downstream services (recommendation, resource, routing, intelligence) do not currently need user identity to serve their core functions. When propagation is needed, the convention is to forward the authenticated `user_id` as an `X-User-ID` HTTP header from the web API layer. No service-to-service auth token is required at this stage.

### Security and Hardening

- [x] Enforce HTTP-only secure cookies for session transport.
- [x] Add CSRF protections for state-changing cookie-auth requests.
- [x] Add login/register rate limiting and abuse protection.
- [x] Add audit-safe logging for auth events (without sensitive payloads).
- [x] Verify sensitive headers and cache controls for auth responses.

### Testing

- [x] Add unit tests for password, session, and auth utilities.
- [x] Add API tests for register/login/logout/me/profile/avatar endpoints.
- [x] Add web tests for auth redirects and protected route behavior.
- [x] Add end-to-end test: register -> onboarding -> dashboard.
- [x] Add end-to-end test: login -> protected page access.
- [x] Add end-to-end test: avatar upload and render.
- [x] Add end-to-end test: direct protected URL while signed out redirects to login.

### Rollout and Cleanup

- [x] Enable auth-service in local/dev environment.
- [ ] Perform staged rollout behind feature flag if desired.
- [ ] Validate migration on staging dataset.
- [x] Remove legacy local/session storage auth gating logic.
- [x] Finalize implementation notes and handoff checklist.

#### Handoff notes

- `app/page.tsx` is now a server component. Authenticated users are redirected server-side to `/authed/dashboard`; the old client-side `useOnboardingGate` redirect has been removed.
- `app/authed/onboarding/page.tsx` now checks `profile.onboardingStatus` via `useAuthUser()` instead of reading localStorage. The `FounderFlowResponse` (recommendation results) still persists in localStorage via `lib/session.ts` because backend storage for those results is deferred.
- `docs/contracts.json` now includes the full auth-service endpoint and type contracts.
- `apps/web/lib/analytics-events.ts` and `docs/analytics-taxonomy.md` include four new auth lifecycle events: `user_registered`, `user_logged_in`, `user_logged_out`, `onboarding_completed`.
- The `apps/auth-service/test/auth-routes.test.ts` test suite now covers each endpoint individually with validation, unauthenticated-access, and edge-case tests in addition to the existing integration walkthrough.
- `apps/web/test/e2e.test.ts` includes a full `Auth Service E2E` describe block covering registration, login, protected endpoint access, logout, and avatar upload/delete flows against the live auth-service.
