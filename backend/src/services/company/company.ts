import { slugify, type PlanName } from "@saas-core/shared";
import { isPrismaError, PrismaErrorCode, type Company, type PrismaClient } from "@saas-core/shared/db";
import { ConflictError, InvalidInputError, NotFoundError } from "../../libs/errors";
import { jobKey, type JobService } from "../job/job";
import type { SessionService } from "../session/session";
import { PENDING_INVITATION, UserService, type UserDTO } from "../user/user";

export type CompanyDTO = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  plan: PlanName;
  createdAt: Date;
  userCount?: number;
  users?: UserDTO[];
};

export class CompanyService {
  constructor(
    private readonly db: PrismaClient,
    private readonly sessions: SessionService,
    private readonly jobs: JobService,
  ) {}

  private static toDTO(company: Company): CompanyDTO {
    return {
      id: company.id,
      name: company.name,
      slug: company.slug,
      isActive: company.isActive,
      plan: company.plan,
      createdAt: company.createdAt,
    };
  }

  async listCompanies(): Promise<CompanyDTO[]> {
    const companies = await this.db.company.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true } } },
    });

    return companies.map((c) => ({ ...CompanyService.toDTO(c), userCount: c._count.users }));
  }

  async getCompany(id: string): Promise<CompanyDTO> {
    const company = await this.db.company.findUnique({
      where: { id },
      include: {
        users: { orderBy: { createdAt: "desc" }, include: { invitations: PENDING_INVITATION } },
      },
    });
    if (!company || company.deletedAt) throw new NotFoundError("Company not found.");
    return { ...CompanyService.toDTO(company), users: company.users.map(UserService.toDTO) };
  }

  async findActiveBySlug(slug: string): Promise<{ name: string; slug: string }> {
    const company = await this.db.company.findUnique({
      where: { slug },
      select: { name: true, slug: true, isActive: true },
    });
    if (!company?.isActive) throw new NotFoundError("We couldn't find that workspace.");
    return { name: company.name, slug: company.slug };
  }

  async createCompany(name: string): Promise<CompanyDTO> {
    const slug = slugify(name);
    if (!slug)
      throw new InvalidInputError("The name must contain at least one letter or number.", "name");
    try {
      const company = await this.db.company.create({ data: { name, slug } });
      return { ...CompanyService.toDTO(company), userCount: 0 };
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.UniqueViolation)) {
        throw new ConflictError(`A company with the slug "${slug}" already exists.`, "name");
      }
      throw error;
    }
  }

  async setActive(id: string, isActive: boolean): Promise<CompanyDTO> {
    return (await this.updateCompany(id, { isActive })).after;
  }

  /**
   * Renames and/or activates or deactivates a company; the slug stays (it's in login
   * URLs). Deactivating signs its users out. Returns it before and after, for the audit log.
   */
  async updateCompany(
    id: string,
    changes: { name?: string; isActive?: boolean },
  ): Promise<{ before: CompanyDTO; after: CompanyDTO }> {
    const existing = await this.db.company.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) throw new NotFoundError("Company not found.");
    const company = await this.updateOrThrow(id, changes);
    if (changes.isActive === false) await this.sessions.deleteCompanySessions(id);
    return { before: CompanyService.toDTO(existing), after: CompanyService.toDTO(company) };
  }

  async deleteCompany(id: string): Promise<CompanyDTO> {
    const company = await this.db.company.findUnique({ where: { id } });
    if (!company || company.deletedAt) throw new NotFoundError("Company not found.");
    await this.db.$transaction(async (tx) => {
      await tx.company.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });
      await tx.session.deleteMany({ where: { companyId: id } });
      await this.jobs.cancelQueued({ companyId: id }, "The company was deleted.", tx);
      // app.delete-company deletes the rows (docs/jobs.md). Add a job per external store
      // (object storage, search index) a product keeps company data in.
      await this.jobs.enqueue(
        "app.delete-company",
        [{ companyId: id, payload: {}, dedupeKey: jobKey.deleteCompany(id) }],
        tx,
      );
    });
    return CompanyService.toDTO(company);
  }

  /**
   * The app.delete-company job: deletes the company's row (users, invitations, tokens and
   * sessions cascade), which is when the company is deleted (it was hidden from the start).
   * Safe to run again.
   */
  async purgeCompany(id: string): Promise<void> {
    await this.db.company.deleteMany({ where: { id } });
  }

  private async updateOrThrow(
    id: string,
    data: { name?: string; isActive?: boolean },
  ): Promise<Company> {
    try {
      return await this.db.company.update({ where: { id }, data });
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound))
        throw new NotFoundError("Company not found.");
      throw error;
    }
  }
}
