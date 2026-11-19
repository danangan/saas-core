import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { WorkspaceForm } from "./workspace-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthCard title="Sign in to your workspace" description="Enter your company's workspace name.">
      <WorkspaceForm />
    </AuthCard>
  );
}
