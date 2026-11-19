/**
 * The API's types, from the generated OpenAPI types (./generated/schema.ts, built from
 * openapi.json by `pnpm api:generate`). Never edit the shapes here: change the
 * backend's schema and regenerate.
 */
import type { components, paths } from "./generated/schema";

type Schemas = components["schemas"];

/** The JSON body a route accepts. */
type Body<P extends keyof paths, M extends "post" | "patch"> = NonNullable<
  NonNullable<paths[P][M]>["requestBody"]
> extends { content: { "application/json": infer B } }
  ? B
  : never;

// --- Responses -----------------------------------------------------------------

export type ApiError = Schemas["ApiError"];
export type Admin = Schemas["Admin"];
export type AuditEntry = Schemas["AuditEntry"];
export type BulkInviteResult = Schemas["BulkInviteResult"];
export type CompanyDetail = Schemas["CompanyDetail"];
export type CompanyLimits = Schemas["CompanyLimits"];
export type CompanyPublic = Schemas["CompanyPublic"];
export type CompanyRedirect = Schemas["CompanyRedirect"];
export type CompanySummary = Schemas["CompanySummary"];
export type CompanyUser = Schemas["CompanyUser"];
export type InvitationInfo = Schemas["InvitationInfo"];
export type Plan = Schemas["Plan"];
export type User = Schemas["User"];
export type UserRole = Schemas["UserRole"];
export type UserStatus = Schemas["UserStatus"];

// --- Request bodies --------------------------------------------------------------

export type AdminLoginBody = Body<"/api/admin/auth/login", "post">;
export type CreateCompanyBody = Body<"/api/admin/companies", "post">;
/** Any of a company's name, active, plan, and limit overrides (null = the plan's). */
export type UpdateCompanyBody = Body<"/api/admin/companies/{id}", "patch">;
export type NewUserBody = Body<"/api/admin/companies/{id}/users", "post">;
export type BulkInviteBody = Body<"/api/admin/companies/{id}/users/bulk", "post">;
/** One person in a bulk invite. */
export type InviteEntry = BulkInviteBody["users"][number];
/** Any of a user's name, email, role, and whether they're active. */
export type UpdateUserBody = Body<"/api/admin/companies/{id}/users/{userId}", "patch">;
export type UserLoginBody = Body<"/api/auth/login", "post">;
export type AcceptInvitationBody = Body<"/api/auth/invitations/accept", "post">;
export type PasswordResetRequestBody = Body<"/api/auth/password-reset/request", "post">;
export type PasswordResetConfirmBody = Body<"/api/auth/password-reset/confirm", "post">;
export type ChangePasswordBody = Body<"/api/settings/password", "post">;
export type UpdateProfileBody = Body<"/api/settings/profile", "patch">;
