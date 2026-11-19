// Global type declarations for the backend: what the route guards and route plugins add
// to Fastify's request. Each property is set by a hook (and declared with
// `decorateRequest`) only where noted; elsewhere it isn't available.
import type {
  AdminContext,
  AdminSession,
  CompanyAudit,
  TeamActor,
  TeamContext,
  UserSession,
} from "./src/services";

declare module "fastify" {
  interface FastifyRequest {
    /** Who is signed in, and their role. Set by RouteGuard.requireAuthenticatedUser (every signed-in user route). */
    context: TeamContext;
    /** The signed-in user's session, with their name and email. Set alongside `context`. */
    userSession: UserSession;
    /** Which platform admin is signed in. Set by RouteGuard.requireAuthenticatedAdmin. */
    adminContext: AdminContext;
    /** The signed-in admin's session, with their username. Set alongside `adminContext`. */
    adminSession: AdminSession;
    /** Records audit entries as the signed-in platform admin (the admin routes). */
    adminAudit: CompanyAudit;
    /** A company admin on the /api/team routes: who they are, for invitations and the self-change guard. */
    teamActor: TeamActor;
    /** Records audit entries as that company admin (the /api/team routes). */
    teamAudit: CompanyAudit;
  }
}
