import { AdminDBConnector } from "@saas-core/shared/db/test-helpers";
import { getPrismaClient } from "../db/client.ts";
import { testName } from "./names.ts";

export const adminDBConnector = new AdminDBConnector(getPrismaClient, testName);