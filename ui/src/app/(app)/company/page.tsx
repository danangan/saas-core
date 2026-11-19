import type { Metadata } from "next";
import { UserAction } from "@saas-core/shared";
import { CompanyDetails } from "@/components/users/company-details";
import type { UserScope } from "@/components/users/user-api";
import { PageHeader, SectionHeader } from "@/components/ui/typography";
import { rbacGuard } from "@/lib/auth/rbac-guard";

export const metadata: Metadata = { title: "Company" };

const scope: UserScope = { kind: "team" };

/** A company admin changing their company's details. Roles without company:management don't see it. */
export default async function CompanyPage() {
  const { company } = await rbacGuard.requirePermission(UserAction.CompanyManagement);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title="Company" hideTitle />

      <SectionHeader title="Company details" />
      <CompanyDetails scope={scope} name={company.name} slug={company.slug} />
    </div>
  );
}
