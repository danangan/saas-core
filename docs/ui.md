# UI

Next.js (App Router) in `ui/`. Components are browsable in Storybook (`pnpm --filter @saas-core/ui storybook`).

## Components

- `src/components/ui/`: [shadcn/ui](https://ui.shadcn.com) on Tailwind and Radix, owned by the project. Includes the house components: `PageHeader` / `Heading` / `Text`, `Alert` / `ErrorAlert`, `Spinner`, `LoadingState` / `EmptyState` / `ErrorState`, and `Button`'s `loading` state.
- `src/components/form/`: `useForm` with `<Form>`, `TextField`, `TextareaField`, `SelectField`, `FormError`, `SubmitButton`. Server field errors land on their fields; inputs disable and the button spins while submitting.
- Feature folders: `app/` (shell, nav, wordmark), `auth/`, `users/`, `admin/`, `plan/`.
- Toasts: [sonner](https://sonner.emilkowal.ski).

Messages: an error that stops the user is an alert in the page; a result of an action is a toast.

## Routing

- The company comes from the session, so signed-in routes have no slug. The slug appears only in the login link (`/login/<slug>`).
- `src/proxy.ts` sends visitors without a session cookie to the login page; the backend validates the session itself on every request. Add new signed-in routes to its `USER_PAGES` and `matcher`.
- Pages guarded by a permission call `rbacGuard.requirePermission(UserAction.X)` (`src/lib/auth/rbac-guard.ts`).
- The signed-in and admin pages have `loading.tsx` and `error.tsx`.

## Pages

| Page | Route | Who |
| --- | --- | --- |
| Landing | `/` | Anyone |
| Sign in (workspace, then credentials) | `/login`, `/login/[slug]` | Anyone |
| Sign up from invitation | `/signup?token=…` | Invited user |
| Forgot / reset password | `/forgot-password`, `/reset-password?token=…` | Anyone |
| Home | `/home` | User |
| Team | `/team` | Company admin (404 for members) |
| Company | `/company` | Company admin (404 for members) |
| Settings | `/settings` | User |
| Admin sign in | `/admin/login` | Anyone |
| Companies | `/admin` | Platform admin |
| Company (users, plan, activity) | `/admin/companies/[id]` | Platform admin |
