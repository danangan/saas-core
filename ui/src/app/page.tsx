import Link from "next/link";
import { LockIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/app/wordmark";
import { authGuard } from "@/lib/auth/guard";

// Placeholder copy: replace with your product's.
const features = [
  {
    icon: UsersIcon,
    title: "A workspace per company",
    body: "Invite your team by email. Everyone signs in at your company's own address.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Roles and permissions",
    body: "Admins manage the team and the company; members get on with their work.",
  },
  {
    icon: LockIcon,
    title: "Private to your company",
    body: "Each company's data is kept separate. Access is by invitation only.",
  },
];

export default async function LandingPage() {
  await authGuard.redirectAuthenticatedUser();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Wordmark />
        <Button asChild variant="ghost">
          <Link href="/login">Sign in</Link>
        </Button>
      </header>
      <main className="flex flex-1 flex-col items-center px-6 pt-16 pb-24 text-center sm:pt-24">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Everything your team needs, in one workspace</h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          SaaS Core gives every company its own private workspace, with its team and roles built in.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/login">Sign in to your workspace</Link>
        </Button>
        <ul className="mt-20 grid w-full max-w-4xl gap-8 text-left sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-2">
              <Icon className="size-5 text-muted-foreground" />
              <h2 className="font-medium">{title}</h2>
              <p className="text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
