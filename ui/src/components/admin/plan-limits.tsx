import { PLAN_LABELS } from "@saas-core/shared";
import { UsageMeter } from "@/components/plan/usage-meter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import type { CompanyLimits } from "@/lib/api/types";

/** A company's plan, its limits (marked when an admin overrode the plan's), and its usage. */
export function PlanLimits({ limits }: { limits: CompanyLimits }) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{PLAN_LABELS[limits.plan]} plan</Badge>
        {limits.overrides.maxUsers !== null && <Text variant="muted">Custom user limit</Text>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <UsageMeter label="Users" used={limits.usage.users} limit={limits.maxUsers} />
      </div>
    </Card>
  );
}
