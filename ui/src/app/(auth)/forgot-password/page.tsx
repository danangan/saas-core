import type { Metadata } from "next";
import { AuthCard, AuthLink } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

type Props = { searchParams: Promise<{ company?: string }> };

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const { company } = await searchParams;
  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to choose a new password."
      footer={<AuthLink href={company ? `/login/${encodeURIComponent(company)}` : "/login"}>Back to sign in</AuthLink>}
    >
      <ForgotPasswordForm company={company} />
    </AuthCard>
  );
}
