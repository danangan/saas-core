"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2Icon,
  ChevronDownIcon,
  HomeIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { UserAction } from "@saas-core/shared";

type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to users whose role allows this action. */
  permission?: UserAction;
  soon?: boolean;
};
/** A top-level entry that holds links. Its links can't hold more: the menu is two levels at most. */
type NavSection = { label: string; icon: LucideIcon; children: NavLink[] };
type NavItem = NavLink | NavSection;

const items: NavItem[] = [
  { href: "/home", label: "Home", icon: HomeIcon },
  { href: "/team", label: "Team", icon: UsersIcon, permission: UserAction.TeamManagement },
  { href: "/company", label: "Company", icon: Building2Icon, permission: UserAction.CompanyManagement },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

const itemClass =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground";

/**
 * The app's sections. Add a product's pages to `items`; group related ones in a section
 * (`{ label, icon, children }`). Links with a `permission` (Team, Company) show only when the
 * user's role allows it (their `permissions` from /me, the backend's RBAC policy); a
 * section with no links left is hidden. On small screens the menu is a row, so a section's links are shown in it
 * directly (no toggle).
 */
export function NavLinks({ permissions }: { permissions: readonly string[] }) {
  const pathname = usePathname();
  const visible = (l: NavLink) => !l.permission || permissions.includes(l.permission);
  return (
    <nav aria-label="Sections" className="flex flex-wrap gap-1 md:flex-col">
      {items.map((item) => {
        if (!("children" in item)) return visible(item) && <Item key={item.href} link={item} pathname={pathname} />;
        const links = item.children.filter(visible);
        return links.length > 0 && <Section key={item.label} section={item} links={links} pathname={pathname} />;
      })}
    </nav>
  );
}

function Item({ link: { href, label, icon: Icon, soon }, pathname }: { link: NavLink; pathname: string }) {
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        itemClass,
        "w-auto md:w-full",
        active && "bg-primary/10 font-medium text-primary hover:bg-primary/15 hover:text-primary",
      )}
    >
      <Icon className="size-4" />
      {label}
      {soon && (
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Soon
        </span>
      )}
    </Link>
  );
}

function Section({ section, links, pathname }: { section: NavSection; links: NavLink[]; pathname: string }) {
  const [open, setOpen] = useState(true);
  const Icon = section.icon;
  const id = `nav-${section.label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="contents md:flex md:flex-col md:gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn(itemClass, "hidden md:flex")}
      >
        <Icon className="size-4" />
        {section.label}
        <ChevronDownIcon className={cn("ml-auto size-4 transition-transform", !open && "-rotate-90")} />
      </button>
      <div
        id={id}
        role="group"
        aria-label={section.label}
        className={cn("contents md:ml-5 md:flex md:flex-col md:gap-1 md:border-l md:pl-2", !open && "md:hidden")}
      >
        {links.map((link) => (
          <Item key={link.href} link={link} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}
