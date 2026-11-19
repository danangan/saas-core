# Features

English only: the UI and emails.

## Accounts

- Sign in Slack-style: the company's workspace name, then email and password.
- Sign up from an emailed invitation (valid 7 days); forgot and reset password.
- Settings: change your name and password, sign out of every device.
- Home: where users land after signing in; a placeholder for the product's main page.

## Roles

- Users are company admins or members. Admins get the Team and Company pages; members don't (404).
- What each role may do is one policy in the backend (`ROLE_PERMISSIONS`), sent to the UI with the user, so menus and pages follow it.

## Team (company admins)

- Invite one user, or several from a pasted list; resend invitations; edit name, email and role; deactivate and delete. An admin can't change their own account.
- See each user's last sign-in and the company's activity log.

## Company (company admins)

- Rename the company (its sign-in address stays).

## Plans and limits

- Each company is on a plan: **Free** (5 users) or **Premium** (20 users). A platform admin can override the limit, up or down.
- Users counted are those who can sign in or are invited.
- At the limit, no one can be invited or reactivated. Users over a lowered limit stay; the Team page says when the company is full or over.

## Admin pages (platform admins)

- Separate sign-in at `/admin` (admins are created with `pnpm admin:create`).
- Companies: create (the name gives its sign-in address, e.g. "Will & Co" → `will-co`), rename, activate or deactivate, change the plan and limits, delete permanently.
- Each company's users and activity, with the same user management as the Team page.

## Background jobs

- A Postgres-backed queue with any number of workers, retries, leases and deduplication ([jobs.md](jobs.md)). Deleting a company runs as a job.
