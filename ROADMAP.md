# Shui Roadmap

Last updated: 2026-08-16

## Goal

Shui is a central identity platform that manages who can use each Application and which roles they have there. It communicates that state to Applications through OIDC/OAuth 2.1 and outbound SCIM 2.0 provisioning.

```text
Identity Platform
├── Principals
│   ├── Users
│   └── Service Accounts
├── Teams
├── System Roles
└── Applications
    ├── OAuth Resources
    ├── OIDC Clients
    ├── Assignments
    ├── Application Roles
    ├── Role Grants
    └── Provisioning
```

## Scope

### Included

- Better Auth based human authentication and sessions
- OAuth 2.1 Provider with OIDC compatibility
- First-run setup that creates exactly one initial `root` User
- Invite-only User registration after setup
- Human Users and non-human Service Accounts
- Service Account credentials using the OAuth `client_credentials` grant
- User and Team ownership for Applications and Service Accounts
- System Roles for operating Shui
- Flat Teams containing Users
- Application Assignments independent from Application Roles
- Direct User and Service Account Application Role grants
- Team Application Role grants inherited by Team members
- Application-specific OIDC claims
- Outbound SCIM 2.0 provisioning with retries and reconciliation
- Responsive login, setup, invitation, consent, and administration UI
- Audit logging for security-sensitive and administrative operations

### Not Included

- OAuth providers exposed by downstream Applications
- OAuth clients owned and managed inside downstream Applications
- Application-specific permissions such as `repo:write`
- Access tokens issued by downstream Applications
- Nested Teams or Team DAGs
- Deny roles or deny grants
- General-purpose policy language
- Inbound SCIM into Shui

## Fixed Decisions

- Runtime and deployment: one Cloudflare Worker with a custom module entrypoint
- Web framework: TanStack Start with React 19
- API framework: Elysia mounted inside a TanStack Start server route under `/api/*`
- Elysia integration: dispatch standard `Request` objects through `app.fetch(request)` instead of exporting Elysia's experimental Cloudflare adapter directly
- Typed API client: Eden Treaty, using direct in-process calls during SSR and HTTP in the browser
- Database: Cloudflare D1 with Drizzle ORM
- Build and frontend delivery: Vite, `@cloudflare/vite-plugin`, and Workers Static Assets
- UI: Kumo UI with Tailwind CSS v4
- Forms and server state: TanStack Form and TanStack Query
- API validation: Elysia `t` / TypeBox
- Formatting and linting: Vite+ with Oxlint, Oxfmt, and TypeScript strict mode
- Async provisioning: Cloudflare Queues with a dead-letter queue
- Authentication: Better Auth
- Human email/password sign-in, session, authorization, and OAuth access do not require `email_verified`; email verification remains an optional compatibility flow
- Transactional email delivery is optional; setup and invitation completion must work without a paid email provider, while invitation links can be shared manually
- Provider: `@better-auth/oauth-provider`, not the legacy `oidcProvider`
- Better Auth version: pin all Better Auth packages to `1.7.0-rc.5`
- Teams remain separate from Principals; Principals are Users and Service Accounts
- Application Assignment and Application Role Grant are separate records
- Team Assignment is inherited by Team members
- Team Role Grants are inherited by Team members
- A Role Grant never creates an Assignment implicitly
- Roles are effective only while the subject has an effective Assignment
- Direct and Team-derived Role origins remain distinguishable
- Service Account credentials are OAuth Clients, not a second custom API-key system
- One Service Account can have multiple OAuth Client credentials for safe rotation
- Better Auth owns authentication protocol data; Shui owns authorization and provisioning data
- Better Auth Organization roles are not used as Shui System or Application Roles
- Better Auth SCIM plugin is not used because it provides inbound SCIM, while Shui needs outbound provisioning
- TanStack Start Server Functions do not contain domain business logic; domain reads and mutations go through Elysia services and routes

## System Architecture

```text
Browser
  │ HTTPS
  ▼
Single Cloudflare Worker
  ├── fetch
  │   └── TanStack Start
  │       ├── React 19 SSR and routing
  │       ├── Workers Static Assets
  │       └── /api/* -> Elysia app.fetch(request)
  │                    ├── Better Auth handler
  │                    │   ├── Email/password authentication
  │                    │   ├── Sessions
  │                    │   ├── OAuth 2.1 / OIDC Provider
  │                    │   └── JWT / JWKS
  │                    ├── Identity and authorization services
  │                    └── Audit and outbox writer
  ├── queue -> provisioning consumer
  └── scheduled -> outbox dispatch and reconciliation
       │
       ├── D1 via Drizzle
       ├── Cloudflare Queues
       └── Application SCIM endpoints
```

Elysia's direct Cloudflare Worker adapter is currently experimental, so Shui does not export it as the Worker entrypoint. Elysia runs through its documented TanStack Start integration and receives requests through `app.fetch(request)`. This combined path must still be tested in the actual Workers runtime rather than only in Node.js. The custom Worker entrypoint delegates `fetch` to TanStack Start and also exposes `queue` and `scheduled` handlers.

## Domain Semantics

### Principals

`User` represents a human and maps one-to-one to a Better Auth User. `Service Account` represents a Bot, CI job, or backend process and never receives a fake email/password User.

Principal IDs are stable and never reused. Disabling a Principal immediately prevents new token issuance. Existing JWTs remain valid until expiration, so access-token lifetimes must stay short.

### Teams

Teams contain Users only. Service Accounts cannot become Team members in the initial scope. Teams are flat and cannot contain other Teams.

Teams may own Applications and Service Accounts. Ownership identifies the responsible party but does not implicitly grant an Assignment, Application Role, or System Role.

### System Roles

Initial built-in System Roles:

| Role | Purpose |
| --- | --- |
| `root` | Full control of Shui and recovery-critical operations |
| `user-admin` | Manage Users, invitations, Teams, and memberships |
| `application-admin` | Manage Applications, Assignments, Roles, OIDC Clients, and provisioning |

System Role definitions and permission mappings are code-defined initially. Grants are stored in D1. Application Roles remain dynamic and Application-specific.

The last active `root` User cannot be disabled, deleted, or stripped of `root`.

### Applications

An Application is a service that trusts Shui. Each Application has:

- One OAuth Resource identifier used as the Access Token audience
- One or more OIDC/OAuth Clients
- Independent Assignments for Users, Service Accounts, and Teams
- Dynamic Application Roles
- Direct and Team Role Grants
- Optional outbound provisioning configuration
- An owner that is either a User or Team

Human-facing OIDC Clients and Service Account credentials are both OAuth Clients, but their purposes are recorded separately and validated differently.

### Assignments

Assignment controls whether a subject may use an Application and whether it is included in provisioning.

```text
effective User Assignment
= direct User Assignment
  OR active Assignment of any Team containing the User

effective Service Account Assignment
= direct Service Account Assignment
```

The following states are intentionally different:

| State | Login/token issuance | Provisioning | Roles |
| --- | --- | --- | --- |
| Not assigned | Denied | Deprovisioned | Not effective |
| Assigned without Roles | Allowed | Active | Empty list |
| Assigned with Roles | Allowed | Active | Effective Role list |

### Application Roles

Application Roles describe what a Principal is inside one Application. They do not define concrete permissions inside Shui or the downstream Application.

```text
effective User Roles
= direct User Role Grants
  UNION Team Role Grants from all active Team memberships

effective Service Account Roles
= direct Service Account Role Grants
```

Effective Role evaluation occurs only after an effective Assignment is confirmed. Duplicate Role keys are removed for claims, while all Direct and Team origins are retained for administration and audit responses.

Removing one origin does not remove a Role when another origin still grants it.

### Service Account Credentials

Each Service Account credential is a confidential OAuth Client that supports `client_credentials` and is linked to exactly one Service Account and one Application Resource.

The OAuth Client's `client_id` and `client_secret` are the credential. The secret is displayed once and stored only in the secure form provided by Better Auth.

Credential rotation uses overlap rather than in-place secret rotation:

1. Create a new OAuth Client credential.
2. Link it to the same Service Account and Application Resource.
3. Move the consumer to the new credential.
4. Disable and later delete the old OAuth Client.

This avoids downtime because Better Auth's in-place rotation immediately invalidates the old secret.

## OIDC And OAuth Contract

### Flows

- Human login: Authorization Code Flow with PKCE S256
- Service Account: Client Credentials Grant
- Refresh Token Grant: disabled for the initial release
- Dynamic Client Registration: disabled
- Unauthenticated Client Registration: disabled
- JWT Access Tokens: required for downstream Applications
- Opaque Access Tokens: not accepted by downstream Applications

Refresh tokens remain disabled until Better Auth 1.7 is stable or D1 concurrency testing proves refresh-family rotation and invalidation safe.

### Audience Rules

- Access Token `aud`: the target Application's OAuth Resource identifier
- ID Token `aud`: the authenticating OIDC `client_id`, as required by OIDC
- `iss`: Shui's canonical public issuer URL
- `azp` / `client_id`: the authenticated OAuth Client

Clients must be linked to allowed Resources. Managed Clients request exactly one Application Resource per flow. Tokens requesting no Resource, an unknown Resource, multiple Resources, or a Resource owned by another Application are rejected.

### Claims

Standard OIDC claims are exposed according to scopes through ID Token and UserInfo behavior supported by Better Auth:

- `sub`
- `name`
- `email`
- `email_verified`

Shui-specific claims use a URI namespace based on the final issuer domain:

- `application_id`
- `principal_id`
- `principal_type`
- `roles`
- `teams`
- `authz_version`

Only data for the target Application is included. System Roles and Roles belonging to other Applications must never appear.

For human flows, `sub` identifies the User according to the Provider's subject policy. For `client_credentials`, `sub` identifies the OAuth Client credential. Applications use the namespaced `principal_id` claim when they need the stable Service Account identity across credential rotation.

Team claims contain only Teams relevant to the target Application. Claim keys and shape are versioned before the first production release.

## Data Model Direction

Better Auth generated tables remain isolated as authentication infrastructure. Domain migrations reference Better Auth Users but do not modify generated tables manually unless required by a documented plugin extension.

Core Shui tables:

- `principals`
- `human_principals`
- `service_accounts`
- `teams`
- `team_memberships`
- `system_roles`
- `system_role_grants`
- `applications`
- `application_roles`
- Typed User, Service Account, and Team Assignment tables
- Typed User, Service Account, and Team Role Grant tables
- OAuth Resource and OAuth Client mapping tables
- Service Account OAuth Client credential mappings
- `invitations`
- `bootstrap_state`
- `provisioning_connections`
- `provisioning_resource_mappings`
- `outbox_events`
- `provisioning_deliveries`
- `audit_events`

Typed Assignment and Role Grant tables are preferred over nullable polymorphic foreign keys so D1 can enforce referential integrity for each subject type.

Domain records use soft deletion or disabling where identity, ownership, or audit references must remain stable. Relationship records such as membership, Assignment, and Role Grant may be physically deleted after an audit event and outbox event are written.

## D1 Consistency Strategy

D1 is the source of truth. The implementation must not depend on long-running interactive transactions.

Use:

- Unique constraints for invariants
- Foreign keys for relational integrity
- Conditional updates for compare-and-swap behavior
- `INSERT ... ON CONFLICT` for idempotency
- `D1Database.batch()` for atomic groups of prepared statements
- State machines when Better Auth writes and Shui domain writes cannot share one transaction
- Reconciliation jobs for cross-system convergence

Every administrative domain mutation writes its audit event and outbox event in the same D1 atomic batch.

Sending to Cloudflare Queues is not atomic with D1. An outbox dispatcher sends pending events to the Queue, and all consumers are idempotent. Duplicate and out-of-order delivery are expected.

## Bootstrap And Invitations

### Bootstrap

The first-run setup page is available only while `bootstrap_state` is incomplete. Any UI route visited before initialization automatically redirects to `/setup`, except `/setup` itself. Production setup additionally requires a high-entropy `BOOTSTRAP_TOKEN` stored as a Worker secret. The token is submitted in a POST body and never placed in a URL or log.

Bootstrap is an idempotent state machine:

```text
uninitialized -> reserved -> user-created -> completed
```

A singleton unique constraint and conditional writes ensure only one setup request can reserve initialization. Concurrent attempts lose safely. A failed reservation can be resumed only with the bootstrap secret; it is never automatically released to an anonymous caller.

Completion creates the Better Auth User, Human Principal, `root` grant, audit event, and required repair markers. After completion, setup endpoints return not found or redirect to sign-in, and direct `/setup` navigation redirects to `/sign-in`.

### Invitations

Public Better Auth sign-up is disabled. A custom invitation flow is the only post-bootstrap User creation path.

Invitation requirements:

- Cryptographically random token
- Only a token hash stored in D1
- Fixed normalized email address
- Explicit expiration
- Single-use atomic consumption
- Optional initial Team memberships and System Roles
- Revocation support
- Generic error responses that avoid account enumeration
- Idempotent recovery if Better Auth User creation succeeds before domain completion

## Outbound Provisioning

Provisioning converges each Application toward Shui's desired state. Events are notifications to reconcile current state, not commands that must be applied blindly in event order.

### Initial SCIM Coverage

- Create and update assigned Users
- Set `active: false` when a User loses effective Assignment or is disabled
- Create and update Teams as SCIM Groups where supported
- Synchronize Team membership
- Synchronize Application Role changes through per-Application mapping
- Synchronize Assignment changes

SCIM has no universal Application Role attribute. Each provisioning connection therefore defines one of these mappings:

- SCIM Group mapping
- Enterprise User extension mapping
- Application-specific schema extension
- No Role provisioning, leaving Roles available only through OIDC claims

Service Account provisioning is not part of the baseline SCIM User/Group implementation. It requires an explicit Application-specific mapping and is added only for Applications that support non-human SCIM identities.

### Delivery Behavior

- Queue delivery is treated as at least once
- Desired-state version suppresses stale work
- Successful external resource IDs are persisted
- `429` and transient `5xx` responses retry with bounded exponential backoff
- Permanent `4xx` responses become operator-visible failures
- Exhausted retries go to a dead-letter queue
- Scheduled full reconciliation repairs missed or manually changed state
- Provisioning can be paused per Application
- Operators can retry or resynchronize an Application

Provisioning credentials are encrypted with AES-GCM using a versioned key stored outside D1 as a Worker secret or Secrets Store secret. Outbound requests require HTTPS, reject redirects, restrict destinations, cap response bodies, and redact credentials and personal data from logs.

## UI Direction

The UI is a focused identity control plane rather than a generic admin template.

TanStack Start owns routing, SSR, and route-level loading. TanStack Query owns cached server state and mutations, while TanStack Form owns form state. Eden Treaty calls Elysia directly during SSR and over HTTP in the browser. Kumo UI provides accessible, source-tested primitives and semantic tokens, while Shui keeps its own page composition and brand treatment rather than using a generic dashboard template.

Required routes:

- `/setup`
- `/sign-in`
- `/forgot-password`
- `/reset-password`
- `/invite/:token`
- `/consent`
- `/`
- `/users`
- `/service-accounts`
- `/teams`
- `/applications`
- `/system-roles`
- `/audit`

Required quality:

- Distinctive and consistent visual language
- Clear Application context during OIDC login and consent
- Responsive desktop and mobile layouts
- Keyboard navigation and visible focus states
- Accessible labels, errors, contrast, and reduced-motion behavior
- Complete loading, empty, error, disabled, and destructive-action states
- Secret values shown exactly once with explicit acknowledgement
- Direct and Team-derived Assignments and Roles visually distinguishable

## Milestones

### M0: Compatibility Spike

Purpose: prove the riskiest framework and protocol combination before building domain features.

- [x] Initialize pnpm, TypeScript strict mode, TanStack Start, React 19, Elysia, Wrangler, Drizzle, and Vitest
- [x] Pin `better-auth` and every `@better-auth/*` package to `1.7.0-rc.5` without caret ranges
- [x] Configure current Workers compatibility date and `nodejs_compat`
- [x] Configure `@cloudflare/vite-plugin` for the TanStack Start SSR environment
- [x] Mount Elysia in a TanStack Start `/api/$` server route and dispatch every supported HTTP method through `app.fetch(request)`
- [x] Configure Eden Treaty for direct SSR calls and browser HTTP calls while preserving request-scoped cookies and headers without cross-request leakage
- [x] Configure a custom Worker entrypoint that delegates `fetch` to TanStack Start and exposes `queue` and `scheduled` handlers
- [x] Initialize Tailwind CSS v4, Kumo UI, TanStack Form, TanStack Query, and Vite+
- [x] Generate binding types with `wrangler types`
- [x] Configure local and remote D1 migrations
- [x] Mount the Better Auth handler without breaking issuer-path or root `/.well-known` routes
- [x] Verify `/api/auth/ok`
- [x] Verify OpenID discovery and OAuth Authorization Server metadata
- [x] Verify JWKS generation and JWT signature validation
- [x] Verify Authorization Code + PKCE against a test client
- [x] Verify Client Credentials against a test Resource
- [x] Verify Application-specific async custom claims from D1
- [x] Verify authorization code single-use behavior under concurrent redemption
- [x] Run integration tests inside the Workers runtime
- [x] Verify the deployed Staging Worker with remote D1, human sign-in, PKCE, Client Credentials, JWT claims, and concurrent redemption

Exit criteria:

- [x] A real Worker runtime can complete human and M2M token flows
- [x] Access Token `aud`, ID Token `aud`, issuer, subject, and claims match the contract
- [x] D1 migrations and Better Auth generated schema work locally and remotely
- SSR, browser navigation, API requests, Queue handlers, and scheduled handlers coexist in one Worker
- No Node-only or TanStack Start/Elysia integration incompatibility remains unexplained

### M1: Authentication, Setup, And Invitation

- [x] Implement the first-run bootstrap state machine
- [x] Require and timing-safely validate `BOOTSTRAP_TOKEN`
- [x] Create the first Human Principal and `root` grant
- [x] Disable all unrestricted sign-up paths
- [x] Implement invitation creation, revocation, expiration, and atomic consumption
- [x] Implement password reset and optional email verification
- [x] Allow authentication and authorization without transactional email delivery or email verification
- [x] Implement User disablement and session revocation
- [x] Add authentication and bootstrap audit events
- [x] Build setup, sign-in, invitation, and password recovery screens
- [x] Add rate limits for setup, sign-in, invitations, and password reset

M1 follow-up hardening:

- [ ] Make concurrent invitation acceptance claim the invitation before mutating credentials, so a losing request cannot overwrite the user's password
- [ ] Prevent an interrupted or expired invitation from leaving an active principal until the scheduled cleanup runs
- [ ] Equalize password-reset behavior for existing and unknown accounts to prevent timing-based account enumeration

Exit criteria:

- Concurrent setup attempts produce exactly one initial `root`
- Direct calls to public sign-up fail after and before bootstrap unless they use the controlled setup/invitation flow
- An invitation cannot be reused, accepted by another email, or accepted after expiration
- Interrupted setup and invitation flows can safely resume or reconcile
- Incomplete bootstrap automatically redirects UI navigation to `/setup`
- An unverified root or invited User can sign in and use authorized routes
- The last active `root` invariant is enforced

### M2: Principals, Teams, And System Roles

- [x] Implement Principal lifecycle and Human Principal repair
- [x] Implement Service Account lifecycle and User/Team ownership
- [x] Implement flat Teams and User membership
- [x] Seed built-in System Roles
- [x] Implement System Role authorization guards in Elysia
- [x] Implement ownership transfer before owner deletion or disablement
- [x] Add audit events for all mutations
- [x] Build Users, Service Accounts, Teams, and System Roles administration

Exit criteria:

- [x] Service Accounts cannot authenticate as human Users
- [x] Service Accounts cannot become Team members
- [x] Teams cannot contain Teams
- [x] User and Team owners are enforced by foreign keys and application validation
- [x] Every protected management operation maps to a documented System Role permission

### M3: Applications, Assignments, And Roles

- [ ] Implement Application lifecycle and ownership
- [ ] Implement one OAuth Resource per Application
- [ ] Implement Human OIDC Client management
- [ ] Implement dynamic Application Roles
- [ ] Implement typed User, Service Account, and Team Assignments
- [ ] Implement typed direct and Team Role Grants
- [ ] Implement effective Assignment queries
- [ ] Implement effective Role queries with all origins
- [ ] Increment `authz_version` on authorization-affecting changes
- [ ] Build Application, Assignment, Role, and origin-aware administration UI

Exit criteria:

- Assigned without Roles is distinct from not assigned
- Team Assignment grants effective access to active Team members
- Direct and Team Role origins are returned separately
- Duplicate Role origins collapse into one claim value without losing administration provenance
- Team removal and membership removal update effective access immediately for new token issuance

### M4: Application OIDC And Service Accounts

- [ ] Link every managed Client to exactly one allowed Application Resource
- [ ] Reject token issuance when Assignment is absent or suspended
- [ ] Emit only target-Application Roles and Teams
- [ ] Implement namespaced Principal and authorization claims
- [ ] Implement Service Account OAuth Client credential creation
- [ ] Display Client secrets once and never log them
- [ ] Implement overlapping credential rotation and disablement
- [ ] Deny credentials for disabled Service Accounts or Applications
- [ ] Publish a downstream token-verification integration guide
- [ ] Add a reference relying-party test Application

Exit criteria:

- Application A never receives Application B's Roles, Teams, or identifiers
- Human Access Tokens and M2M Access Tokens validate with the same JWKS
- M2M `sub` changes with a rotated credential while namespaced `principal_id` remains stable
- Resource, issuer, audience, expiration, and scope validation failures are covered by tests
- Disabled credentials cannot issue new tokens

### M5: Outbound SCIM Provisioning

- [ ] Implement encrypted provisioning connection storage
- [ ] Implement desired-state projections for Users, Teams, memberships, Assignments, and Roles
- [ ] Write mutation, audit, and outbox records in one D1 batch
- [ ] Implement an outbox dispatcher to Cloudflare Queues
- [ ] Implement an idempotent provisioning Queue consumer
- [ ] Implement SCIM User create, update, and deactivate
- [ ] Implement SCIM Group and membership synchronization
- [ ] Implement configurable Role mapping
- [ ] Persist external resource IDs and desired-state versions
- [ ] Implement retry, delay, dead-letter, and operator replay behavior
- [ ] Implement scheduled full reconciliation
- [ ] Build provisioning status, failure, pause, retry, and resync UI

Exit criteria:

- Duplicate and reversed messages converge to the latest desired state
- `429`, timeout, `5xx`, conflict, missing resource, and permanent `4xx` behavior is tested
- Assignment removal deactivates the downstream User without deleting Shui identity data
- Team membership and Role changes converge after transient failures
- No provisioning credential or sensitive response body appears in logs

### M6: Security And Operations Hardening

- [ ] Enable structured Workers logs and traces
- [ ] Add correlation IDs across API, audit, outbox, Queue, and SCIM delivery
- [ ] Configure database-backed rate limiting suitable for Workers
- [ ] Review CSRF, origin, cookie, and canonical issuer configuration
- [ ] Add short JWT lifetimes and document delayed revocation semantics
- [ ] Configure JWKS rotation and grace period
- [ ] Add backup, D1 Time Travel, restore, and migration procedures
- [ ] Add secret rotation procedures for Better Auth, bootstrap, encryption, OAuth Clients, and SCIM
- [ ] Add retention policies for audit, delivery, invitation, and expired token data
- [ ] Add health and readiness checks that do not expose secrets
- [ ] Complete threat modeling and dependency review

Exit criteria:

- Recovery procedures have been executed in staging
- Key rotation preserves verification during the grace period
- Security-sensitive endpoints have explicit abuse tests
- Audit records cover every privileged mutation and credential lifecycle event
- Operational dashboards expose authentication failures, Queue backlog, provisioning failures, and D1 errors

### M7: Release Candidate And Launch

- [ ] Run the OpenID conformance tests applicable to supported flows
- [ ] Run SCIM integration tests against representative mock and real Applications
- [ ] Run accessibility, mobile, and cross-browser UI tests
- [ ] Run bootstrap, invitation, token, and provisioning concurrency tests
- [ ] Verify D1 query plans and indexes with production-like data
- [ ] Review the Better Auth 1.7 stable migration before any dependency upgrade
- [ ] Freeze the claim contract and provisioning mapping version
- [ ] Publish operator and Application integration documentation
- [ ] Complete staging soak and production launch checklist

Exit criteria:

- No unresolved critical or high security findings
- No unexplained protocol conformance failures
- All release-critical reconciliation and recovery drills pass
- Better Auth RC risk is accepted explicitly or migrated to stable after schema and behavior review

## Testing Strategy

### Unit Tests

- Effective Assignment matrix
- Direct and Team Role provenance
- Last-root protection
- Owner transfer rules
- Invitation and bootstrap state transitions
- Claim filtering by Application
- SCIM desired-state mapping
- Retry and backoff classification

### Worker Integration Tests

Use `@cloudflare/vitest-pool-workers` with real D1 and Queue bindings where possible.

- Better Auth session and endpoint behavior
- D1 constraints, batches, and rollback
- OIDC discovery, authorization, token, UserInfo, and JWKS
- Concurrent bootstrap and authorization code consumption
- Service Account Client Credentials flow
- Outbox dispatch and Queue idempotency

### End-To-End Tests

- First-run setup
- Sign-in and password reset
- Invitation acceptance
- Team-derived Assignment and Role changes
- OIDC login from a reference Application
- Service Account credential creation and rotation
- Provisioning failure and operator retry
- Responsive and keyboard-only administration flows

### Security Tests

- Account and invitation enumeration
- CSRF and untrusted Origin rejection
- Redirect URI exact matching
- PKCE, state, and nonce validation
- Wrong issuer and audience rejection
- Cross-Application Role leakage
- Setup and invitation races
- Concurrent invitation acceptance cannot change the credential of the losing request
- An expired or interrupted invitation cannot leave an active principal or session
- Password-reset responses and processing time do not reveal whether an account exists
- Secret redaction
- SCIM SSRF and redirect rejection
- JWT behavior after Principal, Assignment, Role, Client, or Application disablement

## Known Risks

| Risk | Mitigation |
| --- | --- |
| Better Auth 1.7 is an RC | Exact version pinning, schema snapshots, compatibility spike, reviewed upgrades only |
| Elysia's direct Workers adapter is experimental | Embed Elysia through the documented TanStack Start route integration, keep a standard Fetch boundary, and run workerd integration tests |
| TanStack Start and Elysia add two server abstractions | Keep all domain APIs and business logic in Elysia, use Start only for web delivery and SSR orchestration, and test route ownership explicitly |
| Better Auth and domain writes cannot always share one transaction | Idempotent state machines, fail-closed authorization, reconciliation |
| D1 has limited transaction patterns and per-database serial throughput | Atomic batches, indexed short queries, no long transactions, production-like load tests |
| Queue delivery is at least once | Transactional outbox, idempotency keys, desired-state reconciliation |
| JWT Role changes are not instant | Short lifetimes, `authz_version`, optional live validation for high-risk Applications |
| OAuth Client secret rotation invalidates the old secret immediately | Overlapping multiple Client credentials per Service Account |
| SCIM Role representation differs by Application | Explicit versioned mapping per provisioning connection |
| First public deployment can be claimed before the owner arrives | Required Worker-secret bootstrap token and atomic singleton reservation |
| Concurrent invitation acceptance can mutate one user's credential before the losing request is rejected | Claim the invitation atomically before credential mutation, or make credential updates conditional and idempotent; cover the race in Workers integration tests |
| An interrupted or expired invitation can leave an active principal until scheduled cleanup | Re-check invitation state immediately before activation and token/session issuance; reconcile invalid claims synchronously and in the scheduled job |
| Password-reset processing can reveal account existence through timing differences | Use the same externally visible response and a bounded timing floor or equivalent asynchronous path for known and unknown accounts |

## Deferred Decisions

These decisions do not block M0 and must be fixed before the listed milestone begins.

| Decision | Deadline |
| --- | --- |
| Product name, issuer domain, and custom claim namespace | Before M3 |
| Transactional email provider and sender domain | Before enabling transactional email delivery |
| Default access-token lifetime | Before M4 |
| Pairwise or public OIDC subject policy | Before M4 |
| Provisioning credential encryption key storage | Before M5 |
| Initial real Applications used for SCIM compatibility testing | Before M5 completion |
| Audit and delivery retention periods | Before M6 completion |

## Current Status

- [x] Requirements and out-of-scope boundary defined
- [x] Single-Worker TanStack Start and embedded Elysia architecture selected
- [x] Eden Treaty, Kumo UI, Tailwind CSS v4, TanStack Form, and TanStack Query selected
- [x] D1 and Drizzle selected
- [x] Better Auth OAuth Provider 1.7 RC strategy selected
- [x] Independent Assignment model selected
- [x] Service Account Client Credentials strategy selected
- [x] Outbound SCIM direction selected
- [x] M0 compatibility spike implemented and locally verified
- [x] M2 principals, teams, system roles, ownership, and administration implemented and locally verified
