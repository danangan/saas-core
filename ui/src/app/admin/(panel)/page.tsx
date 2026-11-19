import type { Metadata } from "next";
import { PLAN_LABELS } from "@saas-core/shared";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AddCompanyDialog } from "@/components/admin/add-company-dialog";
import { CompanyStatusBadge } from "@/components/admin/status-badge";
import { CompanyActions } from "@/components/admin/company-actions";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { serverAdminApiClient } from "@/lib/api/admin-server-client";
import { LocalDate } from "@/components/local-date";
import { EmptyState } from "@/components/ui/states";
import { PageHeader } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage() {
  const result = await serverAdminApiClient.listCompanies();
  if (!result.ok) {
    if (result.status === 401) redirect("/admin/login");
    throw new Error(`Couldn't load the companies (${result.status}): ${result.error}`);
  }
  const companies = result.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Companies"
        description="Companies using SaaS Core and their users."
        actions={<AddCompanyDialog />}
      />

      <Card className="py-0">
        {companies.length === 0 ? (
          <EmptyState title="No companies yet" description="Add a company to start inviting its users." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/admin/companies/${company.id}`} className="hover:underline">
                      {company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground">{company.slug}</TableCell>
                  <TableCell>
                    <CompanyStatusBadge isActive={company.isActive} />
                  </TableCell>
                  <TableCell>{PLAN_LABELS[company.plan]}</TableCell>
                  <TableCell className="text-right tabular-nums">{company.userCount}</TableCell>
                  <TableCell className="text-muted-foreground"><LocalDate iso={company.createdAt} /></TableCell>
                  <TableCell className="pr-4 text-right">
                    <CompanyActions
                      company={{ id: company.id, name: company.name, slug: company.slug, isActive: company.isActive }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
