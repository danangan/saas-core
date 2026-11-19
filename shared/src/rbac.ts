// Role-based access control: what a role can be allowed or denied. The backend holds
// the role → permissions policy (ROLE_PERMISSIONS) and enforces it; the UI uses these to
// show and guard the same features.

/** Everything a role can be allowed or denied, as "<area>:<action>". */
export enum UserAction {
  /** The Team page: invite, change and remove users, see the company's activity. */
  TeamManagement = "team:management",
  /** The Company page: change the company's details (for now, its name). */
  CompanyManagement = "company:management",
}

/** Every action, in declaration order. */
export const USER_ACTIONS: readonly UserAction[] = Object.values(UserAction);
