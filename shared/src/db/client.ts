import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}

/** Prisma error codes the services translate into service errors. */
export const PrismaErrorCode = {
  UniqueViolation: "P2002",
  ForeignKeyViolation: "P2003",
  RecordNotFound: "P2025",
} as const;

type PrismaErrorCodeValue = (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode];

export function isPrismaError(error: unknown, code: PrismaErrorCodeValue): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
