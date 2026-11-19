import type { Metadata } from "next";
import { AuthCard, AuthLink, Notice } from "@/components/auth/auth-card";
import { serverApiClient } from "@/lib/api/server-client";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Sign in" };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reset?: string; signedUp?: string; expired?: string }>;
};

const notices: Record<string, string> = {
  reset: "Your password was changed. Sign in with your new password.",
  signedUp: "Your account is ready. Sign in to continue.",
  expired: "Your sign-in expired. Please sign in again.",
};

export default async function CompanyLoginPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const result = await serverApiClient.findCompany(slug);
  if (!result.ok && result.status !== 404) {
    throw new Error(`Couldn't look up the workspace (${result.status}): ${result.error}`);
  }
  const company = result.ok ? result.data : null;

  if (!company) {
    return (
      <AuthCard
        title="Workspace not found"
        description={`There's no active workspace called "${slug}".`}
        footer={<AuthLink href="/login">Try another workspace</AuthLink>}
      >
        <p className="text-sm text-muted-foreground">Check the workspace name in your invitation email, or ask your admin.</p>
      </AuthCard>
    );
  }

  const notice = Object.keys(notices).find((key) => query[key as keyof typeof query]);

  return (
    <AuthCard
      title={`Sign in to ${company.name}`}
      description={<span className="font-mono">{company.slug}</span>}
      footer={
        <>
          <AuthLink href={`/forgot-password?company=${encodeURIComponent(company.slug)}`}>Forgot your password?</AuthLink>
          <span>
            Not your workspace? <AuthLink href="/login">Choose another</AuthLink>
          </span>
        </>
      }
    >
      {notice && <Notice>{notices[notice]}</Notice>}
      <PasswordForm slug={company.slug} />
    </AuthCard>
  );
}
