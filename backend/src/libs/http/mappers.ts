/**
 * Response mapping (service DTOs -> API types) shared by the admin routes and the team
 * routes.
 */
import type { AuditEntry, CompanyUser } from "../../types";
import type { AuditEntryDTO, UserDTO } from "../../services";

export const toCompanyUser = (u: UserDTO): CompanyUser => ({
  id: u.id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  role: u.role,
  status: u.status,
  lastSignInAt: u.lastSignInAt?.toISOString() ?? null,
  invitation: u.invitation
    ? { sentAt: u.invitation.sentAt.toISOString(), expiresAt: u.invitation.expiresAt.toISOString() }
    : null,
  createdAt: u.createdAt.toISOString(),
});

export const toAuditEntry = (e: AuditEntryDTO): AuditEntry => ({
  ...e,
  createdAt: e.createdAt.toISOString(),
});
