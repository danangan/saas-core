# Extending

How to build a product on SaaS Core. Rename the product in `ui/src/components/app/wordmark.tsx`, `ui/src/app/layout.tsx` (metadata), `ui/src/app/page.tsx` (landing copy) and `EMAIL_FROM`.

## A page

1. `ui/src/app/(app)/<name>/page.tsx`. Start with `authGuard.requireAuthenticatedUser()`, or `rbacGuard.requirePermission(UserAction.X)` if only some roles may see it.
2. Add it to `items` in `ui/src/components/app/nav-links.tsx` (with `permission` if guarded).
3. Add its path to `USER_PAGES` and `matcher` in `ui/src/proxy.ts`.
4. Replace `/home` with the product's main page, or keep it and change its content.

## An endpoint

1. Request and response schemas in `backend/src/schemas/<area>.ts`. Name a response schema with `.meta({ id: "Thing" })` to make it a named type.
2. Logic and queries in a service (`backend/src/services/<area>/`), wired in `services/container.ts`. Throw a service error for anything the user should see.
3. A route in `backend/src/api/routes/`, registered in `src/api/app.ts`, declaring `schema: { body, params, querystring, response }` (`errorResponses` and `noContent` are in `libs/http/schema.ts`).
4. `pnpm api:generate`.
5. A typed call in `ui/src/lib/api/` (`browser-client.ts` or `server-client.ts`, and the `admin-` ones): `call(this.api.POST("/api/<group>/thing", { body }))`.

## A table

Add the model to `prisma/schema.prisma` with `companyId` and a relation to `Company` (`onDelete: Cascade`, so company deletion removes it), then `pnpm db:migrate` and add the `GRANT … TO saas_app` to the migration. Filter every query on `companyId` from the session.

## A permission

1. Add it to `UserAction` (`shared/src/rbac.ts`).
2. Allow or deny it per role in `ROLE_PERMISSIONS` (`backend/src/constants.ts`).
3. Guard routes with `guard.withPermission` and pages with `rbacGuard.requirePermission`.

## A job

1. Its payload schema in `jobPayloadSchemas` and its dedupe key in `jobKey` (`backend/src/services/job/job.ts`).
2. Queue it with `JobService.enqueue(type, jobs, tx)` inside the transaction that needs it.
3. A handler in `backend/src/worker/handlers/` (extend `CompanyJobHandler` for a company's job), added to `createJobHandlers`.
4. For data kept outside Postgres (object storage, a search index), queue a cleanup job from `CompanyService.deleteCompany`.

Scheduled work: a task in `createCronTasks` (`backend/src/worker/cron.ts`) that queues a deduplicated job.

## A limit

Add the field to `Company` and `PLAN_LIMITS` (`shared/src/constants.ts`), compute it in `PlanService.getLimits`, add an `assertCan…` check called inside the transaction after `PlanService.lock`, and show it with `UsageMeter`.

## An audit action

Add it to `AUDIT_ACTION_LABELS` (`shared/src/constants.ts`) and record it through `CompanyAudit` (`backend/src/services/audit/company-audit.ts`).
