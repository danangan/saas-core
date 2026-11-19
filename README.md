# SaaS Core

A base for multi-tenant SaaS products. Each company is its own workspace (like Slack): users are invited by email, sign in at their company's address, and only ever see their company's data. Platform admins manage companies from `/admin`.

What's included: landing page, home page, sign-in / invitation sign-up / password reset, server-side sessions, role-based access (company admin / member), Team, Company and Settings pages, platform admin (companies, users, plans and user limits, activity log), and a Postgres-backed job queue with a worker. Details: [docs/features.md](docs/features.md).

## Layout

| Folder | What it is |
| --- | --- |
| [`ui/`](ui) | Next.js: user pages and admin pages (`/admin`). No database access. |
| [`backend/`](backend) | Fastify API and job worker. Internal only. |
| [`shared/`](shared) | Constants and helpers; `/db` (Prisma client), `/db/test-helpers`, `/security`, `/test-containers` |
| [`e2e/`](e2e) | Playwright tests |
| [`prisma/`](prisma) | Database schema and migrations |
| [`local-dev/`](local-dev) | Docker Compose for Postgres and Mailpit; `run.sh` starts everything |
| [`docs/`](docs) | How it works |

## Setup

Requirements: Node.js 22.12+, pnpm, Docker or Podman.

```sh
./local-dev/run.sh         # containers, migrations, API, worker, UI
pnpm admin:create          # once, in another terminal: a platform admin
```

`run.sh` creates the `.env` files from their examples and installs dependencies on its first run. Ctrl+C stops the apps; `run.sh stop` stops the containers; `run.sh infra` starts just the containers and migrates (then `pnpm dev`).

Sign in at http://localhost:3000/admin. Emails land in Mailpit (http://localhost:8025).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | API, worker and UI in watch mode |
| `pnpm build` | Build every package |
| `pnpm test` | Unit and integration tests (Vitest; integration tests need Docker or Podman) |
| `pnpm e2e` | Browser tests against their own stack in containers |
| `pnpm e2e:staging` | The same tests against a deployed instance (`E2E_BASE_URL`, `E2E_DATABASE_URL`) |
| `pnpm typecheck`, `pnpm lint`, `pnpm format` | TypeScript, ESLint, Prettier |
| `pnpm api:generate` | Write `openapi.json` from the routes and regenerate the UI's client types |
| `pnpm db:migrate`, `pnpm db:deploy` | Create and apply a migration (dev); apply pending ones |
| `pnpm admin:create [username]` | Create a platform admin, or reset their password |
| `pnpm images:build [--push]` | Build the container images ([Container images](#container-images)) |
| `pnpm --filter @saas-core/ui storybook` | UI components on http://localhost:6006 |

## Tests

- **Unit and integration** (`pnpm test`): integration tests (`*.integration.test.ts`) start their own Postgres container (`startTestDatabase()`) and make fixtures with the DB connectors in `@saas-core/shared/db/test-helpers`. With Podman behind a Docker-compatible socket, set `TESTCONTAINERS_RYUK_DISABLED=true`.
- **End to end** (`pnpm e2e`): Playwright drives Chromium through the UI only. Local mode starts the backend and UI against containers; staging mode runs against a deployed instance. Tests name their data after the run (`e2e-<id>`) and the teardown deletes it. First time: `pnpm --filter @saas-core/e2e exec playwright install chromium`.

## Container images

`scripts/build-images.sh` builds `saas-core-backend` (API by default; `node dist/worker.js` for the worker; migrations and `admin:create` run from it too) and `saas-core-ui` (Next.js standalone), with Docker or Podman. `IMAGE_TAG` (default: the git commit), `IMAGE_REGISTRY` (e.g. `ghcr.io/acme`) and `PLATFORM` (e.g. `linux/amd64`) set the names and target; `--push` pushes them.

To run the images locally behind a reverse proxy, as in production (http://localhost:8080):

```sh
cd local-dev && docker compose -f docker-compose.yml -f docker-compose.images.yml up
```

In production, a reverse proxy sends `/api/*` to the backend and everything else to the UI ([local-dev/Caddyfile](local-dev/Caddyfile)). The backend must only be reachable through it.

## Database

- Change `prisma/schema.prisma`, then `pnpm db:migrate`. A new table needs `GRANT SELECT, INSERT, UPDATE, DELETE` to `saas_app` in its migration.
- Roles: `saas` (owner, migrations: `DB_MIGRATION_*`), `saas_app` (backend: `DB_USERNAME`).

## Building your product on it

[docs/extending.md](docs/extending.md): adding pages, endpoints, permissions, jobs and limits.

## Docs

- [Features](docs/features.md)
- [User flows](docs/user-flows.md)
- [Architecture](docs/architecture.md)
- [Jobs](docs/jobs.md)
- [UI](docs/ui.md)
- [Extending](docs/extending.md)
