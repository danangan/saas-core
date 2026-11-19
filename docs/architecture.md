# Architecture

## Overview

```
browser ──► UI (Next.js, public) ──► backend (Fastify, internal) ──► Postgres · SMTP
                                                                      jobs table ◄── backend worker
```

- The browser talks to one origin. In production a reverse proxy sends `/api/*` to the backend and everything else to the UI ([local-dev/Caddyfile](../local-dev/Caddyfile)); in development `next dev` forwards `/api/*` itself (`ui/next.config.ts`). Server-rendered pages call the backend directly with the visitor's cookie.
- The backend holds every credential and does all authorization.
- Background work runs as jobs in Postgres ([jobs.md](jobs.md)).

| Part | Tech |
| --- | --- |
| UI | Next.js (App Router), shadcn/ui on Tailwind, Storybook |
| Backend | Node.js, Fastify, Prisma on Postgres, zod |
| Email | SMTP (Mailpit locally) |

## Code layout

```
ui/        Next.js pages and components; src/lib/api/ is the typed API client
backend/   src/api/ (routes), src/worker/ (job handlers, cron), src/services/ (logic and all
           database access), src/schemas/ (request and response schemas), scripts/
shared/    constants and helpers; /db (Prisma client), /db/test-helpers, /security
e2e/       Playwright tests
prisma/    schema.prisma and migrations
```

**Backend layers.** Routes handle HTTP only: declare schemas, call one service method, map the result. Services own the logic and every query, return DTOs (never password hashes), and throw service errors (`NotFoundError`, `ConflictError`, …) that `libs/errors.ts` maps to `{ error, fieldErrors }`. `services/container.ts` wires everything; the API (`src/api/main.ts`) and the worker (`src/worker/main.ts`) share it.

**API contract.** Each route declares zod schemas (`backend/src/schemas/`, by area). Fastify validates requests and checks responses with them, and `pnpm api:generate` turns them into `openapi.json` and the UI's client types (`ui/src/lib/api/generated/`). The UI calls the API through [openapi-fetch](https://openapi-ts.dev/openapi-fetch/), so paths, bodies and responses are type-checked.

## Data

Postgres (Prisma, `prisma/schema.prisma`) holds companies (with their plan and any limit override; `PlanService` enforces it), users (role `admin` / `member`), invitations, password reset tokens, sessions, platform admins, audit logs, jobs. Every company-owned table has `company_id`; secrets (session, invitation and reset tokens) are stored hashed.

Dates are UTC everywhere: `timestamptz` columns, connections with `TimeZone=UTC`, ISO strings over the API. Only the browser shows local time (`<LocalDate>`).

## Keeping companies apart

- The company always comes from the session, never from the request.
- Every query on a company-owned table filters on `company_id`.
- The backend connects as `saas_app` (no schema changes).

## Access control

- `UserAction` (`shared/src/rbac.ts`) lists what a role can be allowed; `ROLE_PERMISSIONS` (`backend/src/constants.ts`) is the policy.
- Routes: `guard.withPermission(UserAction.X, …)` (`backend/src/libs/route-guard.ts`). Pages: `rbacGuard.requirePermission(UserAction.X)`. Menus: a nav item's `permission`.
- `/api/settings/me` sends the user's allowed actions as `permissions`.

## Sessions

Server-side sessions in Postgres (no JWT, so deactivation signs people out at once). The cookie holds a random token; only its hash is stored. Seven-day sliding expiry, 30-day maximum. Users and platform admins have separate cookies (`saas_session`, `saas_admin_session`). Changing or resetting a password, deactivating a user or company, and "sign out everywhere" delete sessions. CSRF: `SameSite=Lax` cookies, JSON-only bodies, and an origin check on writes.

## Running it

| | Local | Production |
| --- | --- | --- |
| UI | `localhost:3000` | Public, behind the reverse proxy (consider restricting `/admin`) |
| Backend API and worker | `127.0.0.1:4000`, `pnpm dev` | Private network; any number of workers |
| Postgres, SMTP | `local-dev/docker-compose.yml` | Managed services; a real SMTP provider with SPF and DKIM |

Images: [README](../README.md#container-images).
