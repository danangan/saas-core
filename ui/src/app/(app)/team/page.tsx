import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UserLimitAlert } from "@/components/plan/limit-alert";
import { isBlocked, usersState } from "@/components/plan/limits";
import { UsageMeter } from "@/components/plan/usage-meter";
import { ActivityList } from "@/components/users/activity-list";
import { AddUserDialog } from "@/components/users/add-user-dialog";
import { BulkInviteDialog } from "@/components/users/bulk-invite-dialog";
import type { UserScope } from "@/components/users/user-api";
import { UsersTable } from "@/components/users/users-table";
import { UserAction } from "@saas-core/shared";
import { rbacGuard } from "@/lib/auth/rbac-guard";
import { serverApiClient } from "@/lib/api/server-client";
import { Heading, PageHeader, SectionHeader } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Team" };

const scope: UserScope = { kind: "team" };

/** A company admin managing their company's users. Roles without team:management don't see it. */
export default async function TeamPage() {
  const { user, company } = await rbacGuard.requirePermission(UserAction.TeamManagement);
  const [team, activity, limits] = await Promise.all([
    serverApiClient.getTeam(),
    serverApiClient.getTeamActivity(),
    serverApiClient.getLimits(),
  ]);
  const full = limits.ok && isBlocked(usersState(limits.data));
  if (!team.ok) {
    if (team.status === 401) redirect("/login");
    if (team.status === 403) notFound();
    throw new Error(`Couldn't load the team (${team.status}): ${team.error}`);
  }

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title="Team" hideTitle />

      <SectionHeader
        title="Users"
        actions={
          <>
            {limits.ok && (
              <UsageMeter label="Users" used={limits.data.usage.users} limit={limits.data.maxUsers} className="w-48" />
            )}
            <BulkInviteDialog scope={scope} companyName={company.name} disabled={full} />
            <AddUserDialog scope={scope} companyName={company.name} disabled={full} />
          </>
        }
      />
      {limits.ok && <UserLimitAlert limits={limits.data} />}

      {/* Your own row has no actions: another admin manages your account. */}
      <UsersTable scope={scope} users={team.data} selfId={user.id} />

      <Heading level={2}>Activity</Heading>
      <ActivityList entries={activity.ok ? activity.data : []} />
    </div>
  );
}
