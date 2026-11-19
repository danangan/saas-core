import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authGuard } from "@/lib/auth/guard";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";
import { SignOutEverywhere } from "./sign-out-everywhere";
import { PageHeader } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, company } = await authGuard.requireAuthenticatedUser();
  const rows = [
    ["Email", user.email],
    ["Company", company.name],
    ["Role", user.role === "admin" ? "Admin" : "Member"],
  ];
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="Settings" hideTitle />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your email, company and role are set by your company&apos;s admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProfileForm firstName={user.firstName} lastName={user.lastName} />
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            You&apos;ll stay signed in here and be signed out everywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign out of all devices</CardTitle>
          <CardDescription>
            Ends every session for your account, including this one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutEverywhere />
        </CardContent>
      </Card>
    </div>
  );
}
