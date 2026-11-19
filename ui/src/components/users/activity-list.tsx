import { auditActionLabel } from "@saas-core/shared";
import type { AuditEntry } from "@/lib/api/types";
import { LocalDate } from "@/components/local-date";
import { Card } from "@/components/ui/card";

/** What changed, beyond the action: a rename's new name, a role change's new role. */
function detail(entry: AuditEntry): string | null {
  const d = entry.details as Record<string, { from?: unknown; to?: unknown } | unknown>;
  if (entry.action === "company.renamed" && typeof d.from === "string") return `from "${d.from}"`;
  if (entry.action === "user.role_changed" && typeof d.to === "string") return `to ${d.to}`;
  if (entry.action === "user.invited" && typeof d.role === "string") return `as ${d.role}`;
  if (entry.action === "user.updated") {
    const fields = Object.keys(d).map(
      (f) => ({ firstName: "first name", lastName: "last name", email: "email" })[f] ?? f,
    );
    return fields.length ? `(${fields.join(", ")})` : null;
  }
  return null;
}

/** A company's activity (audit log), newest first. */
export function ActivityList({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card className="py-0">
      {entries.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="divide-y" aria-label="Activity">
          {entries.map((entry) => {
            const extra = detail(entry);
            return (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm"
              >
                <span>
                  <span className="font-medium">{entry.actorLabel}</span>
                  {entry.actorType === "admin" && (
                    <span className="text-muted-foreground"> (platform admin)</span>
                  )}{" "}
                  {auditActionLabel(entry.action)}
                  {entry.targetLabel && !entry.action.startsWith("company.") && (
                    <span className="font-medium"> {entry.targetLabel}</span>
                  )}
                  {extra && <span className="text-muted-foreground"> {extra}</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  <LocalDate iso={entry.createdAt} withTime />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
