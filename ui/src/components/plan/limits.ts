import type { CompanyLimits } from "@/lib/api/types";

/** Where a company is against one of its limits. "over": an admin lowered it below the usage. */
export type LimitState = "ok" | "full" | "over";

export function limitState(used: number, limit: number): LimitState {
  if (used > limit) return "over";
  if (used >= limit) return "full";
  return "ok";
}

export const usersState = (limits: CompanyLimits) => limitState(limits.usage.users, limits.maxUsers);

/** Nothing more can be added once a limit is reached or exceeded. */
export const isBlocked = (state: LimitState) => state !== "ok";
