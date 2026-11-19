import type { ReactNode } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { authGuard } from "@/lib/auth/guard";
import { Wordmark } from "@/components/app/wordmark";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const admin = await authGuard.requireAuthenticatedAdmin();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/admin" className="flex items-center gap-1.5">
            <Wordmark /> <span className="text-muted-foreground">Admin</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{admin.username}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
