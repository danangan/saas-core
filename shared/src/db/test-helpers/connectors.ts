import { randomUUID } from "node:crypto";
import { slugify } from "../../utils";
import type { PrismaClient } from "..";
import { AdminDBConnector } from "./admin";
import { CompanyDBConnector } from "./company";
import { JobDBConnector } from "./job";
import { SessionDBConnector } from "./session";
import { UserDBConnector } from "./user";

export const uniqueName = (label: string): string =>
  `${slugify(label) || "x"}-${randomUUID().slice(0, 8)}`;

export function dbConnectors(db: PrismaClient) {
  const client = () => db;
  const companies = new CompanyDBConnector(client);
  return {
    admins: new AdminDBConnector(client, uniqueName),
    companies: {
      /** A company named and slugged after `label`, made unique. */
      createCompany: (label = "company", options?: { isActive?: boolean }) =>
        companies.createCompany(uniqueName(label), options),
    },
    users: new UserDBConnector(client, uniqueName),
    sessions: new SessionDBConnector(client),
    jobs: new JobDBConnector(client),
  };
}

export type DBConnectors = ReturnType<typeof dbConnectors>;
