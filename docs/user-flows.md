# User flows

Rules and components are in [architecture.md](architecture.md), background work in [jobs.md](jobs.md).

## Sign in
1. The user enters their workspace (the company's slug); it must exist and be active.
2. They enter email and password. The backend creates a session and sets its cookie, and the UI opens `/home`.

## Invitation
1. A platform admin or company admin adds a user (name, email, role), within the company's user limit. A company's first user defaults to admin.
2. An email with a one-time sign-up link is sent (valid 7 days; can be resent).
3. The user sets a password from the link and can sign in.

## Password reset
1. "Forgot password" always says an email was sent, so accounts can't be discovered.
2. The link sets a new password and signs out every session.

## Plan and limits
1. On the company's admin page, "Change plan or limits" sets the plan and, optionally, a user limit of its own (empty = the plan's). Each change is in the activity log.
2. Lowering the limit below the company's usage is allowed: nobody is removed, but invites and reactivations are refused until it's back under, and the Team page says so.

## Delete a company
1. From the admin pages, after typing the company's slug. In one transaction the company is deactivated and hidden, its users are signed out, its queued jobs are cancelled, and an `app.delete-company` job is queued.
2. The worker deletes its row; users, invitations, sessions and audit logs cascade.
