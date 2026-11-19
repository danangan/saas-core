import type { Metadata } from "next";
import Link from "next/link";
import { Building2Icon, SettingsIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { UserAction } from "@saas-core/shared";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/typography";
import { authGuard } from "@/lib/auth/guard";
import { rbacGuard } from "@/lib/auth/rbac-guard";

export const metadata: Metadata = { title: "Home" };

type Shortcut = {
  href: string;
  title: string;
  body: string;
  icon: LucideIcon;
  permission?: UserAction;
};

const shortcuts: Shortcut[] = [
  {
    href: "/team",
    title: "Team",
    body: "Invite people and manage their roles.",
    icon: UsersIcon,
    permission: UserAction.TeamManagement,
  },
  {
    href: "/company",
    title: "Company",
    body: "Change your company's details.",
    icon: Building2Icon,
    permission: UserAction.CompanyManagement,
  },
  {
    href: "/settings",
    title: "Settings",
    body: "Your name, password and sessions.",
    icon: SettingsIcon,
  },
];

/** Where users land after signing in. Replace with your product's main page. */
export default async function HomePage() {
  const user = await authGuard.requireAuthenticatedUser();
  const visible = shortcuts.filter((s) => !s.permission || rbacGuard.can(user, s.permission));
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title={`Welcome, ${user.user.firstName}`} description={user.company.name} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(({ href, title, body, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <Icon className="size-5 text-muted-foreground" />
                  <CardTitle>{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
