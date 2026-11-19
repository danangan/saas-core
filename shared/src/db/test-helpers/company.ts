import type { Company, PrismaClient } from "..";

export class CompanyDBConnector {
  constructor(
    private readonly dbClient: () => PrismaClient,
  ) {}

  /** A company whose name is its slug; active unless `isActive: false`. */
  async createCompany(slug = "company", { isActive = true }: { isActive?: boolean } = {}): Promise<Company> {
    return this.dbClient().company.create({ data: { name: slug, slug, isActive } });
  }
}
