import type { AppConfig } from "../libs/config";
import { createPrismaClient, type PrismaClient } from "@saas-core/shared/db";
import { FailureLimiter } from "../libs/rate-limit";
import {
  AuditService,
  CompanyService,
  EmailService,
  JobService,
  SessionService,
  SmtpTransport,
  AuthService,
  PlanService,
  UserService,
} from ".";

export type Services = {
  sessions: SessionService;
  companies: CompanyService;
  users: UserService;
  email: EmailService;
  auth: AuthService;
  jobs: JobService;
  audit: AuditService;
  plans: PlanService;
};

export type Container = {
  db: PrismaClient;
  services: Services;
  close(): Promise<void>;
};

const loginLimiter = () => new FailureLimiter({ maxFailures: 5, windowMs: 15 * 60 * 1000 });

/** Composition root: creates every dependency once and wires them together. */
export function createContainer(config: AppConfig): Container {
  const db = createPrismaClient(config.databaseUrl);
  const email = new EmailService(new SmtpTransport(config.smtp), config.smtp.from);

  const jobs = new JobService(db);
  const sessions = new SessionService(db);
  const plans = new PlanService(db);
  const users = new UserService(db, sessions, email, plans, config.appUrl);
  const companies = new CompanyService(db, sessions, jobs);
  const auth = new AuthService(db, sessions, email, loginLimiter(), loginLimiter(), config.appUrl);
  const audit = new AuditService(db);

  return {
    db,
    services: { sessions, auth, companies, users, email, jobs, audit, plans },
    close: () => db.$disconnect(),
  };
}
