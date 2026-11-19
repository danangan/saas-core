import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { serverApiClient } from "@/lib/api/server-client";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Create your account" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function SignupPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const invitation = token ? await serverApiClient.lookupInvitation(token) : null;
  // A rejected token gets the message below; the backend being down or failing is an error page.
  if (invitation && !invitation.ok && (invitation.status === 0 || invitation.status >= 500)) {
    throw new Error(`Couldn't look up the invitation (${invitation.status}): ${invitation.error}`);
  }

  if (!token || !invitation?.ok) {
    return (
      <AuthCard title="This invitation can't be used" description="The link is invalid, has expired, or was already used.">
        <p className="text-sm text-muted-foreground">
          Ask your admin to send a new invitation. If you&apos;ve already set your password, sign in instead.
        </p>
      </AuthCard>
    );
  }

  const { companyName, email, firstName } = invitation.data;
  return (
    <AuthCard title={`Welcome, ${firstName}`} description={`Set a password to join ${companyName} on SaaS Core.`}>
      <SignupForm token={token} email={email} />
    </AuthCard>
  );
}
