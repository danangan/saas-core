import type { ReactNode } from "react";
import Link from "next/link";
import { NavLinks } from "@/components/app/nav-links";
import { SignOutButton } from "@/components/app/user-menu";
import { authGuard } from "@/lib/auth/guard";
import { Wordmark } from "@/components/app/wordmark";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, company, permissions } = await authGuard.requireAuthenticatedUser();
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      {/* On desktop the sidebar stays put, as tall as the screen, while the page scrolls;
          it scrolls on its own only if it's taller than the screen. */}
      <aside className="flex flex-col gap-4 border-b bg-muted/40 p-4 md:sticky md:top-0 md:h-svh md:w-60 md:shrink-0 md:self-start md:overflow-y-auto md:border-r md:border-b-0">
        <div>
          <Link href="/home">
            <Wordmark />
          </Link>
          <p className="truncate text-sm text-muted-foreground">{company.name}</p>
        </div>
        <NavLinks permissions={permissions} />
        <div className="mt-auto hidden flex-col gap-1 border-t pt-4 md:flex">
          <p className="truncate px-3 text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate px-3 text-xs text-muted-foreground">{user.email}</p>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
