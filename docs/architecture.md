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
