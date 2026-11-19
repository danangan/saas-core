import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <AuthCard title="This reset link is incomplete" footer={<AuthLink href="/forgot-password">Request a new link</AuthLink>}>
        <p className="text-sm text-muted-foreground">Open the link from your email again, or request a new one.</p>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Choose a new password" description="You'll be signed out on all your devices.">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
