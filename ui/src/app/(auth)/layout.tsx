import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/app/wordmark";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/40">
      <header className="px-6 py-5">
        <Link href="/">
          <Wordmark />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:pt-16">{children}</main>
    </div>
  );
}
