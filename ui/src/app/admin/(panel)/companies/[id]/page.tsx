import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { CompanyStatusBadge } from "@/components/admin/status-badge";
import { CompanyActions } from "@/components/admin/company-actions";
import { PlanLimits } from "@/components/admin/plan-limits";
import { ChangePlanDialog } from "@/components/admin/change-plan-dialog";
import { LocalDate } from "@/components/local-date";
import { ActivityList } from "@/components/users/activity-list";
import { AddUserDialog } from "@/components/users/add-user-dialog";
import { BulkInviteDialog } from "@/components/users/bulk-invite-dialog";
import { RenameCompanyDialog } from "@/components/users/rename-company-dialog";
import type { UserScope } from "@/components/users/user-api";
import { UsersTable } from "@/components/users/users-table";
import { serverAdminApiClient } from "@/lib/api/admin-server-client";
import { Heading, PageHeader, SectionHeader } from "@/components/ui/typography";

type Props = { params: Promise<{ id: string }> };

const loadCompany = cache(async (id: string) => {
  const result = await serverAdminApiClient.getCompany(id);
  if (result.ok) return result.data;
  if (result.status === 401) redirect("/admin/login");
  if (result.status === 404) notFound();
  throw new Error(`Couldn't load the company (${result.status}): ${result.error}`);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await loadCompany((await params).id);
  return { title: company.name };
}

export default async function CompanyDetailPage({ params }: Props) {
  const company = await loadCompany((await params).id);
  const activity = await serverAdminApiClient.getCompanyActivity(company.id);
  const scope: UserScope = { kind: "admin", companyId: company.id };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Companies
      </Link>

      <PageHeader
        title={company.name}
        badge={<CompanyStatusBadge isActive={company.isActive} />}
        description={
          <>
            Slug <span className="font-mono text-foreground">{company.slug}</span> · Created{" "}
            <LocalDate iso={company.createdAt} />
          </>
        }
        actions={
          <>
            <RenameCompanyDialog scope={scope} name={company.name} slug={company.slug} />
            <CompanyActions
              company={{
                id: company.id,
                name: company.name,
                slug: company.slug,
                isActive: company.isActive,
              }}
              variant="buttons"
              redirectAfterDelete="/admin"
            />
          </>
        }
      />

      <SectionHeader
        title="Plan and limits"
        actions={<ChangePlanDialog companyId={company.id} plan={company.plan} />}
      />
      <PlanLimits limits={company.limits} />

      <SectionHeader
        title="Users"
        actions={
          <>
            <BulkInviteDialog scope={scope} companyName={company.name} />
            {/* A company's first user is usually the one who manages the rest. */}
            <AddUserDialog
              scope={scope}
              companyName={company.name}
              defaultRole={company.users.length ? "member" : "admin"}
            />
          </>
        }
      />

      <UsersTable scope={scope} users={company.users} />

      <Heading level={2}>Activity</Heading>
      <ActivityList entries={activity.ok ? activity.data : []} />
    </div>
  );
}
